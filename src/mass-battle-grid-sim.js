// 実ゲームのマス・橋・建物衝突をそのまま使う大軍シミュレーション。
// 空間索引＋共有フローフィールドで2000体でも全件A*を避ける。
import { JOBS } from './mass-battle-sim.js';
import { CombatActionRuntime } from './combat-action-runtime.js?v=4.6.1';
import { COMBAT_RULES } from './combat-action-spec.js?v=4.6.1';
import {createSquadFormationPlan,squadSpeedFactor} from './mass-battle-formations.js';
import {territoryAt,legalHomeWarpCell,chooseHomeWarpLanding} from './battle-territory.js';
import {heightAdvanceCost,shouldSeekHighGround,isHeightTactician} from './tactical-height-priority.js';
import {updateDefensivePosture} from './battle-defensive-doctrine.js';

const SECTOR = 5;
const NEIGHBORS = [[1,0],[-1,0],[0,1],[0,-1]];
// Default advance is a fast dash; tile reservations and collision remain unchanged. The grid still reserves
// every tile and respects soldiers, bridges and formation speed penalties.
export const MASS_MOVEMENT_SCALE = 0.70;
export const MASS_DEATH_DURATION = 0.85;
const cellKey = (x,z) => x+':'+z;
// One rear-rank strategist per squad; no extra soldier/render instance.
// Combat stats are the arithmetic mean of the ten existing professions.
export const STRATEGIST_STATS=Object.freeze({
  hp:Math.round(JOBS.reduce((n,j)=>n+j.hp,0)/JOBS.length),
  speed:JOBS.reduce((n,j)=>n+j.speed,0)/JOBS.length,
  damage:0,range:0,
});

function seededRandom(seed) {
  let n=seed>>>0;
  return ()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296};
}

function makeFlow(width,height,walkable,goals) {
  const distances=new Int32Array(width*height);
  distances.fill(0x3fffffff);
  const queue=new Int32Array(width*height);
  let front=0,back=0;
  for(const {x,z} of goals){
    if(x<0||z<0||x>=width||z>=height)continue;
    const i=z*width+x;
    if(!walkable[i]||distances[i]===0)continue;
    distances[i]=0;queue[back++]=i;
  }
  while(front<back){
    const index=queue[front++],x=index%width,z=Math.floor(index/width),value=distances[index]+1;
    for(const [dx,dz] of NEIGHBORS){
      const nx=x+dx,nz=z+dz;
      if(nx<0||nz<0||nx>=width||nz>=height)continue;
      const next=nz*width+nx;
      if(!walkable[next]||distances[next]<=value)continue;
      distances[next]=value;queue[back++]=next;
    }
  }
  return distances;
}

export class MassBattleGridSimulation {
  constructor(sideCount, seed, {width,height,walkable,water,opaque,bridges,riverXAt,elevationMap=null}) {
    if(!Number.isInteger(sideCount)||sideCount<1||sideCount>1000)throw RangeError('兵数は1～1000');
    if(!(walkable instanceof Uint8Array)||walkable.length!==width*height)throw Error('通行可能マップが不正です');
    if(!Array.isArray(bridges))throw Error('橋の情報が不正です');
    this.width=width;this.height=height;
    this.walkable=walkable;
    if(elevationMap!=null&&(!(elevationMap instanceof Float32Array)||
       elevationMap.length!==width*height))throw Error('地形の高低差マップが不正です');
    this.elevationMap=elevationMap;
    if(water!=null&&(!(water instanceof Uint8Array)||water.length!==walkable.length))throw Error('水面マップが不正です');
    // Water is not passable for ordinary soldiers. Ninjas use a separate
    // navigation field over the same collision grid, including fallen bridges.
    this.water=water??new Uint8Array(walkable.length);
    this.ninjaWalkable=new Uint8Array(walkable.length);
    this.opaque=opaque instanceof Uint8Array&&opaque.length===walkable.length?opaque:new Uint8Array(walkable.length);
    this.bridges=bridges;
    this.hasRiver=bridges.length>0;
    this.riverXAt=this.hasRiver&&typeof riverXAt==='function'?riverXAt:()=>Math.floor(width/2);
    // Riverless maps have three virtual deployment corridors, not fake
    // bridges. These anchors control formation spacing only; they never
    // add passable cells, bridge objects or collision exceptions.
    const deploymentLanes=this.hasRiver?bridges:[.25,.5,.75].map(fraction=>({
      x:Math.floor(width/2),z:Math.round((height-1)*fraction)}));
    this.sideCount=sideCount;
    this.seed=seed;
    this.time=0;this.tickCount=0;this.attacks=0;this.lastAiMs=0;
    this.strategy='eliminate';this.autoStrategySquads=new Set();
    this.squadSize=Math.max(10,Math.ceil(sideCount/10));
    this.squadCount=Math.ceil(sideCount/this.squadSize);
    this.formations=[
      createSquadFormationPlan(sideCount,deploymentLanes.length,0),
      createSquadFormationPlan(sideCount,deploymentLanes.length,1)
    ];
    const formationSlots=2*this.squadCount;
    this._formationSumX=new Float32Array(formationSlots);
    this._formationSumZ=new Float32Array(formationSlots);
    this._formationCount=new Uint16Array(formationSlots);
    // Commander-issued destinations belong to whole squads, not individuals.
    // Each squad shares one BFS field; never calculate A* for 1000 soldiers.
    this.squadDestinations=new Map();this.squadFlows=new Map();this.squadCommands=new Map();
    this.squadHealTargets=new Map();this.squadMissions=new Map();
    this.units=[];this.live=[sideCount,sideCount];this.crossings=[0,0];
    this.actions=new CombatActionRuntime({width,height,walkable});
    this.objects=this.actions.objects;
    this.actionEvents=[];
    this._queuedWarpEvents=[];
    this.actions.onNavigationChange=()=>this._buildFlows();
    // Dense random access for collisions, but clear only occupied cells on the
    // next tick. A million-cell map should not cost a million writes per tick.
    this._occupancy=new Int32Array(width*height);
    this._occupancy.fill(-1);
    this._occupiedTouched=[];
    // Reusable spatial linked lists: stable unit-ID order within each sector,
    // with no Map, string keys or per-unit node allocation on every AI tick.
    this._sectorCols=Math.ceil(width/SECTOR);
    this._sectorRows=Math.ceil(height/SECTOR);
    this._sectorHeads=new Int32Array(this._sectorCols*this._sectorRows);
    this._sectorTails=new Int32Array(this._sectorHeads.length);
    this._sectorNext=new Int32Array(sideCount*2);
    // CombatActionRuntime expects a Map-like sector lookup for area skills.
    // Resolve groups lazily from the same packed linked lists used by movement;
    // rebuilding 2000 arrays on every AI tick would undo the optimization.
    this._combatSectors={get:key=>{
      const colon=key.indexOf(':');
      const x=Number(key.slice(0,colon)),z=Number(key.slice(colon+1));
      if(!Number.isInteger(x)||!Number.isInteger(z)||x<0||z<0||x>=this._sectorCols||z>=this._sectorRows)return undefined;
      const first=this._sectorHeads[z*this._sectorCols+x];
      if(first<0)return undefined;
      const group=[];
      for(let id=first;id!==-1;id=this._sectorNext[id])group.push(this.units[id]);
      return group;
    }};
    this._buildFlows();
    const rnd=seededRandom(seed),occupied=new Set();
    for(let team=0;team<2;team++)for(let n=0;n<sideCount;n++){
      const squadId=Math.floor(n/this.squadSize);
      const plan=this.formations[team][squadId];
      const member=plan.slots[n-squadId*this.squadSize];
      const bridgeIndex=plan.bridgeIndex,bridge=deploymentLanes[bridgeIndex];
      const side=team===0?-1:1;
      // Compact the rear rank on small testing maps and enclosed arenas.
      // Full-size world maps retain the exact wide four-layer formation.
      const bankDepth=Math.max(12,Math.min(bridge.x,width-1-bridge.x)-10);
      const fit=Math.min(1,(bankDepth-9)/Math.max(1,plan.advanceDepth+plan.rows*2-9));
      const wantedX=bridge.x+side*Math.round(9+(plan.advanceDepth-9+member.row*2)*fit);
      const shift=Math.max(-height/3,Math.min(height/3,plan.lateralShift));
      const wantedZ=bridge.z+shift+member.lateral*2;
      const flow=team===0?this.flowEast:this.flowWest;
      let position=null;
      for(let radius=0;radius<=24&&!position;radius++){
        for(let dz=-radius;dz<=radius&&!position;dz++)for(let dx=-radius;dx<=radius;dx++){
          if(Math.max(Math.abs(dx),Math.abs(dz))!==radius)continue;
          const x=wantedX+dx,z=wantedZ+dz;
          if(!this._inside(x,z)||!this.walkable[z*width+x]||occupied.has(cellKey(x,z)))continue;
          if((x-this.riverXAt(z))*side<8||flow[z*width+x]>=0x3fffffff)continue;
          position={x,z};break;
        }
      }
      // A castle wall or crowded settlement may consume a whole formation
      // rectangle. Fall back to the closest legal cell on this bank instead
      // of failing the entire 1000-vs-1000 battle during loading.
      if(!position){
        let bestDistance=Infinity;
        for(let z=1;z<height-1;z++)for(let x=1;x<width-1;x++){
          const index=z*width+x;
          if(!this.walkable[index]||occupied.has(cellKey(x,z))||
            (x-this.riverXAt(z))*side<8||flow[index]>=0x3fffffff)continue;
          const distance=(x-wantedX)**2+(z-wantedZ)**2;
          if(distance<bestDistance){bestDistance=distance;position={x,z};}
        }
      }
      if(!position)throw Error('大軍の配置場所が不足: '+team+' / '+n);
      occupied.add(cellKey(position.x,position.z));
      const isStrategist=sideCount>=20&&member.row===plan.rows-1&&member.col===0;
      // The strategist uses the existing complete robed rig to keep the
      // 16-attribute Android GPU instancing budget unchanged.
      const jobIndex=isStrategist?7:member.jobIndex,job=JOBS[jobIndex];
      this.units.push({id:team*sideCount+n,team,jobIndex,jobId:job.id,
        isStrategist,strategistStats:isStrategist?STRATEGIST_STATS:null,
        strategistWarpUsed:false,
        rarity:n%13===0?'UR':n%3===0?'R':'N',mp:COMBAT_RULES.maxMp,maxMp:COMBAT_RULES.maxMp,male:rnd()>.48,
        x:position.x,z:position.z,bridgeIndex,squadId,
        formationType:plan.type,formationForward:member.forward*2,formationLateral:member.lateral*2,
        hp:isStrategist?STRATEGIST_STATS.hp:job.hp,maxHp:isStrategist?STRATEGIST_STATS.hp:job.hp,
        alive:true,cooldown:rnd()*job.interval,phase:rnd()*6.28,completedSteps:0,blockedTicks:0,
        vx:0,vz:0,fromX:position.x,fromZ:position.z,moveElapsed:0,moveDuration:0,
        facingX:side===-1?1:-1,facingZ:0,hitFlash:0,attackElapsed:99,
        deathAt:-1,deathX:position.x,deathZ:position.z,
        action:'advance',crossed:false});
    }
    // Each commander starts on an individually owned ceremonial warhorse.
    // The mount is a world object, not a second humanoid or occupied tile.
    for(const commander of this.units.filter(u=>u.isStrategist)){
      const horse=this.actions.spawnObject('horse',commander,commander.x,commander.z,{mounted:true});
      if(horse){horse.commanderMount=true;horse.hp=horse.maxHp=240;
        horse.expiresAt=Infinity;horse.spec={...horse.spec,speed:9.5};}
    }
  }

  _inside(x,z){return x>=0&&z>=0&&x<this.width&&z<this.height}
  get territoryWorld(){return {width:this.width,height:this.height,riverXAt:this.riverXAt};}
  territoryAt(x,z){return territoryAt(x,z,this.territoryWorld);}
  canWarpStrategist(unitId,x,z){
    const u=this.units[unitId];
    return !!u&&legalHomeWarpCell(u,x,z,this.territoryWorld,{
      walkable:this.walkable,occupied:this._occupancy,units:this.units,objects:this.objects
    });
  }
  // User may choose any legal tile on THEIR home side, even at the far
  // northern/southern edge. A non-UR or already-spent general never warps.
  warpStrategist(unitId,x,z){
    if(!this.canWarpStrategist(unitId,x,z))return false;
    const unit=this.units[unitId];
    const before={x:unit.x,z:unit.z};
    const oldCell=before.z*this.width+before.x,newCell=z*this.width+x;
    const oldFrom=unit.fromZ*this.width+unit.fromX;
    if(this._occupancy[oldCell]===unit.id)this._occupancy[oldCell]=-1;
    if(this._occupancy[oldFrom]===unit.id)this._occupancy[oldFrom]=-1;
    this._occupancy[newCell]=unit.id;
    // The next simulation step clears only tracked touched tiles.
    this._occupiedTouched.push(newCell);
    unit.x=x;unit.z=z;unit.fromX=x;unit.fromZ=z;
    unit.moveDuration=0;unit.moveElapsed=0;unit.vx=0;unit.vz=0;
    unit.strategistWarpUsed=true;unit.action='skill';
    unit.skillPoseUntil=this.time+.4;
    // Attached mount remains the SAME object; it is not duplicated.
    const mount=this.objects.find(o=>o.alive&&o.id===unit.mountId&&o.mountedBy===unit.id);
    if(mount){mount.x=x;mount.z=z;}
    this._queuedWarpEvents.push({type:'strategistWarp',time:this.time,
      sourceId:unit.id,team:unit.team,squadId:unit.squadId,
      fromX:before.x,fromZ:before.z,x,z});
    return true;
  }
  _walkable(x,z,jobId=null){
    if(!this._inside(x,z))return false;
    const index=z*this.width+x;
    return this.walkable[index]===1||(jobId==='ninja'&&this.water[index]===1);
  }
  _canSee(a,b){
    let x=a.x,z=a.z;
    const dx=Math.abs(b.x-x),dz=Math.abs(b.z-z),sx=x<b.x?1:-1,sz=z<b.z?1:-1;
    let err=dx-dz;
    while(x!==b.x||z!==b.z){
      const e=err*2;
      if(e>-dz){err-=dz;x+=sx}
      if(e<dx){err+=dx;z+=sz}
      if((x!==b.x||z!==b.z)&&this.opaque[z*this.width+x])return false;
    }
    return true;
  }
  _buildFlows(){
    for(let i=0;i<this.walkable.length;i++)this.ninjaWalkable[i]=this.walkable[i]|this.water[i];
    // A demolished bridge must not remain a navigation goal: previously all
    // its landing zones still pulled thousands of soldiers into a dead end.
    this.activeBridges=this.bridges.filter(bridge=>[-5,-2,0,2,5].every(dx=>this._walkable(bridge.x+dx,bridge.z)));
    const goalsFor=direction=>{
      const goals=[];
      if(!this.hasRiver){
        // Bridge-free forests, deserts and forts are open battlefields:
        // each army must cross the centre instead of stopping at a bank.
        const goalX=Math.round(this.width*(direction===1?.70:.30));
        for(let z=3;z<this.height-3;z+=2)for(let dx=-2;dx<=2;dx++){
          const x=goalX+dx;
          if(this._walkable(x,z)){goals.push({x,z});break;}
        }
        return goals;
      }
      for(const bridge of this.activeBridges){
        const side=direction===1?1:-1;
        for(let dz=-8;dz<=8;dz++)for(let dx=17;dx<=23;dx++){
          const x=bridge.x+side*dx,z=bridge.z+dz;
          if(this._walkable(x,z))goals.push({x,z});
        }
      }
      // No surviving crossing: keep armies advancing to defend the riverbanks
      // and fight across the water. Do not send non-ninjas into the river.
      if(!goals.length)for(let z=3;z<this.height-3;z+=3){
        const center=Math.round(this.riverXAt(z));
        for(const side of [-1,1])for(let offset=8;offset<=16;offset++){
          const x=center+side*offset;
          if(this._walkable(x,z)){goals.push({x,z});break;}
        }
      }
      return goals;
    };
    this.flowEast=makeFlow(this.width,this.height,this.walkable,goalsFor(1));
    this.flowWest=makeFlow(this.width,this.height,this.walkable,goalsFor(-1));
    // Ninjas may cross any water surface, so their goals must not depend on
    // which bridges survived. They aim for the opposite bank at their own row.
    const ninjaGoals=direction=>{
      if(!this.hasRiver)return goalsFor(direction);
      const goals=[];
      for(let z=3;z<this.height-3;z+=2){
        const center=Math.round(this.riverXAt(z));
        for(let offset=10;offset<=22;offset++){
          const x=center+direction*offset;
          if(this._walkable(x,z,'ninja')){goals.push({x,z});break;}
        }
      }
      return goals;
    };
    this.ninjaFlowEast=makeFlow(this.width,this.height,this.ninjaWalkable,ninjaGoals(1));
    this.ninjaFlowWest=makeFlow(this.width,this.height,this.ninjaWalkable,ninjaGoals(-1));
    const supportGoals=[];
    if(!this.hasRiver){
      const safeX=Math.round(this.width*.30);
      for(let z=3;z<this.height-3;z+=3)if(this._walkable(safeX,z))supportGoals.push({x:safeX,z});
    }else
    for(let z=3;z<this.height-3;z+=3){
      const center=Math.round(this.riverXAt(z));
      for(let offset=16;offset<=23;offset++){
        const x=center-offset;
        if(this._walkable(x,z)){supportGoals.push({x,z});break;}
      }
    }
    this.supportFlow=makeFlow(this.width,this.height,this.walkable,supportGoals);
    this._rebuildSquadFlows();
  }

  _rebuildSquadFlows(){
    this.squadFlows.clear();
    for(const [id,point] of this.squadDestinations){
      const squadSize=this.units?.filter(u=>u.team===0&&String(u.squadId)===id).length||Math.max(10,Math.ceil(this.sideCount/10));
      // A 100-soldier squad cannot stand on one tile. The destination means
      // a rally AREA, with enough tiles for a non-overlapping formation.
      const radius=Math.min(16,Math.max(4,Math.ceil(Math.sqrt(squadSize*1.5/Math.PI))+2));
      const goals=[];
      for(let dz=-radius;dz<=radius;dz++)for(let dx=-radius;dx<=radius;dx++){
        if(dx*dx+dz*dz>radius*radius)continue;
        const x=point.x+dx,z=point.z+dz;
        if(this._walkable(x,z))goals.push({x,z});
      }
      // Water-crossing ninjas can occupy water at the destination's edge.
      const ninjaGoals=goals.slice();
      for(let dz=-radius;dz<=radius;dz++)for(let dx=-radius;dx<=radius;dx++){
        if(dx*dx+dz*dz>radius*radius)continue;
        const x=point.x+dx,z=point.z+dz;
        if(this._walkable(x,z,'ninja')&&!this._walkable(x,z))ninjaGoals.push({x,z});
      }
      this.squadFlows.set(id,{
        regular:makeFlow(this.width,this.height,this.walkable,goals),
        ninja:makeFlow(this.width,this.height,this.ninjaWalkable,ninjaGoals)
      });
    }
  }

  setSquadDestination(squadId,x,z){
    const id=String(squadId);
    if(!this.units?.some(u=>u.team===0&&String(u.squadId)===id))return false;
    if(!Number.isInteger(x)||!Number.isInteger(z)||!this._walkable(x,z))return false;
    this.squadHealTargets.delete(id);this.squadMissions.delete(id);
    this.autoStrategySquads.delete(id);
    this.squadDestinations.set(id,{x,z});this.squadCommands.set(id,'move');this._rebuildSquadFlows();return true;
  }
  clearSquadDestination(squadId){
    const id=String(squadId);
    this.autoStrategySquads.delete(id);
    this.squadDestinations.delete(id);this.squadFlows.delete(id);this.squadCommands.delete(id);
    this.squadHealTargets.delete(id);this.squadMissions.delete(id);
  }
  /** Three campaign strategies; older unit orders remain independent. */
  setStrategy(strategy){
    if(!['eliminate','environment','recovery'].includes(strategy))return false;
    if(this.strategy===strategy)return true;
    for(const id of [...this.autoStrategySquads])this.clearSquadDestination(id);
    this.autoStrategySquads.clear();
    this.strategy=strategy;
    return true;
  }

  _applyGlobalStrategy(){
    if(this.strategy==='recovery'){
      const freeSupport=[...new Set(this.units.filter(u=>u.team===0&&u.alive&&
        u.jobId==='priest'&&u.formationType==='support'&&
        !this.squadCommands.has(String(u.squadId))).map(u=>String(u.squadId)))];
      if(!freeSupport.length)return;
      const injured=this.units.filter(u=>u.team===0&&u.alive&&u.maxHp>0&&u.hp/u.maxHp<.72)
        .sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp);
      for(const patient of injured){
        const response=this.requestSquadHealing(patient.squadId,freeSupport[0]);
        if(response){this.autoStrategySquads.add(response.supportId);break;}
      }
      return;
    }
    if(this.strategy!=='environment')return;
    // Do not burn friendly buildings or destroy the bridge we need to cross.
    // Environment strategy automatically uses a mage only on enemy-side
    // obstructions. Explicit player missions can target either bank.
    const structures=this.objects.filter(o=>o.alive&&o.category==='structure'&&
      (o.type==='tree'||o.type==='building')&&o.x>=this.riverXAt(o.z)+4);
    if(!structures.length)return;
    const ready=new Set(this.units.filter(u=>u.team===0&&u.alive&&u.jobId==='mage'&&
      !this.squadCommands.has(String(u.squadId))).map(u=>String(u.squadId)));
    for(const id of ready){
      const mage=this.units.find(u=>u.team===0&&u.alive&&u.jobId==='mage'&&String(u.squadId)===id);
      if(!mage)continue;
      const ordered=structures.map(o=>({o,d:(o.x-mage.x)**2+(o.z-mage.z)**2}))
        .filter(pair=>pair.d<45*45).sort((a,b)=>a.d-b.d);
      for(const {o} of ordered){
        const type=o.type==='tree'?'burn_tree':'burn_building';
        if(this.setSquadMission(id,type,{x:o.x,z:o.z,targetId:o.id})){
          this.autoStrategySquads.add(id);
          return;
        }
      }
    }
  }

  setSquadCommand(squadId,command){
    const id=String(squadId);
    if(!['charge','defend','hold','retreat'].includes(command)||!this.units.some(u=>u.team===0&&String(u.squadId)===id))return false;
    this.autoStrategySquads.delete(id);
    this.squadDestinations.delete(id);this.squadFlows.delete(id);this.squadCommands.set(id,command);
    this.squadHealTargets.delete(id);this.squadMissions.delete(id);
    return true;
  }

  requestSquadHealing(targetSquadId,preferredSupportId=null){
    const targetId=String(targetSquadId);
    const wounded=this.units.filter(u=>u.alive&&u.team===0&&String(u.squadId)===targetId&&u.hp<u.maxHp);
    if(!wounded.length)return null;
    const candidateSupportIds=[...new Set(this.units.filter(u=>u.alive&&u.team===0&&u.formationType==='support'&&u.jobId==='priest')
      .map(u=>String(u.squadId)))];
    const mean=(group)=>({x:group.reduce((s,u)=>s+u.x,0)/group.length,z:group.reduce((s,u)=>s+u.z,0)/group.length});
    const point=mean(wounded);
    const supportId=preferredSupportId==null?candidateSupportIds.sort((a,b)=>{
      const aUnits=this.units.filter(u=>u.alive&&u.team===0&&String(u.squadId)===a),bUnits=this.units.filter(u=>u.alive&&u.team===0&&String(u.squadId)===b);
      const aPoint=mean(aUnits),bPoint=mean(bUnits);
      return Math.hypot(aPoint.x-point.x,aPoint.z-point.z)-Math.hypot(bPoint.x-point.x,bPoint.z-point.z);
    })[0]:String(preferredSupportId);
    if(!supportId||!candidateSupportIds.includes(supportId))return null;
    const target=wounded.reduce((best,u)=>!best||u.hp/u.maxHp<best.hp/best.maxHp?u:best,null);
    this.autoStrategySquads.delete(supportId);
    this.squadHealTargets.set(supportId,targetId);
    this.squadMissions.delete(supportId);
    this.squadDestinations.set(supportId,{x:target.x,z:target.z});this.squadCommands.set(supportId,'heal');
    this._rebuildSquadFlows();return {supportId,targetId,x:target.x,z:target.z};
  }

  _missionApproach(squadId,target){
    const members=this.units.filter(u=>u.team===0&&u.alive&&String(u.squadId)===String(squadId));
    if(!members.length)return null;
    const center={x:members.reduce((s,u)=>s+u.x,0)/members.length,
      z:members.reduce((s,u)=>s+u.z,0)/members.length};
    const b=target.bounds||{minX:target.x,maxX:target.x,minZ:target.z,maxZ:target.z};
    let best=null,bestCost=Infinity;
    for(let z=Math.max(0,b.minZ-8);z<=Math.min(this.height-1,b.maxZ+8);z++)
      for(let x=Math.max(0,b.minX-8);x<=Math.min(this.width-1,b.maxX+8);x++){
        if(!this._walkable(x,z))continue;
        const distance=Math.hypot(Math.max(b.minX-x,0,x-b.maxX),Math.max(b.minZ-z,0,z-b.maxZ));
        if(distance>5||distance<1)continue;
        const cost=Math.hypot(x-center.x,z-center.z)+distance*.7;
        if(cost<bestCost){bestCost=cost;best={x,z};}
      }
    return best;
  }

  setSquadMission(squadId,type,target){
    const id=String(squadId);
    if(!['destroy_bridge','burn_tree','burn_building','eliminate_squad','eliminate_commander'].includes(type)||
      !this.units.some(u=>u.team===0&&u.alive&&String(u.squadId)===id))return false;
    if(!Number.isInteger(target?.x)||!Number.isInteger(target?.z)||!this._inside(target.x,target.z))return false;
    if(type.startsWith('burn_')&&!this.units.some(u=>u.team===0&&u.alive&&String(u.squadId)===id&&u.jobId==='mage'))return false;
    let point=null;
    if(type==='eliminate_squad'||type==='eliminate_commander'){
      const candidates=this.units.filter(u=>u.team===1&&u.alive&&
        String(u.squadId)===String(target.targetSquadId)&&
        (type!=='eliminate_commander'||u.isStrategist));
      if(!candidates.length)return false;
      point={x:candidates[0].x,z:candidates[0].z};
    }else{
      if(typeof target.targetId!=='string')return false;
      if(type==='burn_tree'&&!this.actions.objects.some(o=>o.id===target.targetId))
        this.actions.registerStructure({id:target.targetId,type:'tree',x:target.x,z:target.z,hp:85,
          blocking:true,bounds:{minX:target.x,maxX:target.x+1,minZ:target.z,maxZ:target.z+1}});
      const structure=this.actions.objects.find(o=>o.id===target.targetId&&o.alive&&o.category==='structure');
      if(!structure||structure.type!==(type==='destroy_bridge'?'bridge':type==='burn_tree'?'tree':'building'))return false;
      point=this._missionApproach(id,structure);
      if(!point)return false;
    }
    this.autoStrategySquads.delete(id);
    this.squadHealTargets.delete(id);
    this.squadMissions.set(id,{type,targetId:target.targetId||null,targetSquadId:target.targetSquadId==null?null:String(target.targetSquadId)});
    this.squadDestinations.set(id,point);this.squadCommands.set(id,'mission');this._rebuildSquadFlows();
    return true;
  }

  _refreshSquadObjectives(){
    let changed=false;
    for(const [supportId,targetId] of this.squadHealTargets){
      const wounded=this.units.filter(u=>u.team===0&&u.alive&&String(u.squadId)===targetId&&u.hp<u.maxHp);
      if(!wounded.length){this.clearSquadDestination(supportId);changed=true;continue;}
      const target=wounded.reduce((best,u)=>!best||u.hp/u.maxHp<best.hp/best.maxHp?u:best,null);
      const previous=this.squadDestinations.get(supportId);
      if(!previous||Math.hypot(previous.x-target.x,previous.z-target.z)>6){
        this.squadDestinations.set(supportId,{x:target.x,z:target.z});changed=true;
      }
    }
    for(const [id,mission] of this.squadMissions){
      if(mission.type==='eliminate_squad'||mission.type==='eliminate_commander'){
        const targets=this.units.filter(u=>u.team===1&&u.alive&&
          String(u.squadId)===mission.targetSquadId&&
          (mission.type!=='eliminate_commander'||u.isStrategist));
        if(!targets.length){this.clearSquadDestination(id);changed=true;continue;}
        const target=targets[Math.floor(targets.length/2)],prior=this.squadDestinations.get(id);
        if(!prior||Math.hypot(prior.x-target.x,prior.z-target.z)>6){this.squadDestinations.set(id,{x:target.x,z:target.z});changed=true;}
      }else if(!this.actions.objects.some(o=>o.id===mission.targetId&&o.alive)){
        this.clearSquadDestination(id);changed=true;
      }
    }
    if(changed)this._rebuildSquadFlows();
  }

  /** 橋が破壊された場合も、同じ通行判定で経路を更新できる。 */
  updateWalkable(next){
    if(!(next instanceof Uint8Array)||next.length!==this.walkable.length)throw Error('通行可能マップが不正です');
    this.walkable=next;this.actions.walkable=next;this._buildFlows();
  }
  updateOpaque(next){
    if(!(next instanceof Uint8Array)||next.length!==this.opaque.length)throw Error('遮蔽マップが不正です');
    this.opaque=next;
  }

  killAtCells(cells){
    for(const u of this.units){
      if(!u.alive||!cells.has(u.x+','+u.z))continue;
      this._markDead(u);
    }
  }

  _markDead(u){
    if(!u.alive)return;
    const at=this.getRenderCell(u);
    u.deathX=at.x;u.deathZ=at.z;u.deathAt=this.time;
    u.alive=false;u.hp=0;u.moveElapsed=u.moveDuration;this.live[u.team]--;
  }

  getDeathProgress(u,alpha=0,extraTime=0){
    if(u.alive||u.deathAt<0)return 0;
    return Math.min(1,Math.max(0,(this.time+Math.max(0,Math.min(1,alpha))*.1+Math.max(0,extraTime)-u.deathAt)/MASS_DEATH_DURATION));
  }

  // Rendering reads a fractional position, but simulation and collisions always
  // use the integer destination tile. alpha=0..1 is the fraction of the next AI tick.
  getRenderCell(u,alpha=0,out={}){
    if(!u.alive){out.x=u.deathX;out.z=u.deathZ;return out;}
    const t=u.moveDuration>0
      ?Math.min(1,(u.moveElapsed+Math.max(0,Math.min(1,alpha))*.1)/u.moveDuration):1;
    out.x=u.fromX+(u.x-u.fromX)*t;
    out.z=u.fromZ+(u.z-u.fromZ)*t;
    return out;
  }

  // The feet, pelvis, hands and clothing are sampled on the SAME full-body
  // gait. One physical grid movement advances precisely one left/right step,
  // independent of framerate, speed, CPU scheduling or AI tick rate.
  getStepPhase(u,alpha=0){
    const progress=u.moveDuration>0&&u.moveElapsed<u.moveDuration
      ?Math.min(1,(u.moveElapsed+Math.max(0,Math.min(1,alpha))*.1)/u.moveDuration):0;
    return Math.PI*((u.completedSteps||0)+progress);
  }

  step(dt=.1){
    const start=typeof performance!=='undefined'?performance.now():Date.now();
    dt=Math.min(Math.max(dt,0),.2);this.time+=dt;this.tickCount++;
    if(this.tickCount%30===0){this._refreshSquadObjectives();this._applyGlobalStrategy();}
    const occupied=this._occupancy;
    const heads=this._sectorHeads,tails=this._sectorTails,nextIds=this._sectorNext;
    const touched=this._occupiedTouched;
    const formationX=this._formationSumX,formationZ=this._formationSumZ,formationCount=this._formationCount;
    formationX.fill(0);formationZ.fill(0);formationCount.fill(0);
    for(const tile of touched)occupied[tile]=-1;
    touched.length=0;
    const reserve=(tile,id)=>{
      if(occupied[tile]===-1)touched.push(tile);
      occupied[tile]=id;
    };
    heads.fill(-1);tails.fill(-1);
    for(const u of this.units){
      if(!u.alive)continue;
      const squadIndex=u.team*this.squadCount+u.squadId;
      if(squadIndex>=0&&squadIndex<formationCount.length){
        formationX[squadIndex]+=u.x;formationZ[squadIndex]+=u.z;formationCount[squadIndex]++;
      }
      reserve(u.z*this.width+u.x,u.id);
      // The departure tile remains reserved until its full walking animation
      // has cleared the cell. This prevents visual overlaps in narrow bridges.
      if(u.moveElapsed<u.moveDuration)reserve(u.fromZ*this.width+u.fromX,u.id);
      const sector=Math.floor(u.z/SECTOR)*this._sectorCols+Math.floor(u.x/SECTOR);
      nextIds[u.id]=-1;
      if(heads[sector]===-1)heads[sector]=u.id;
      else nextIds[tails[sector]]=u.id;
      tails[sector]=u.id;
    }
    this.actions.onDeath=u=>{
      if(!u.alive)return;
      this._markDead(u);
      // A different unit may already have reserved this soldier's previous
      // tile in the current tick. Never erase someone else's reservation.
      const current=u.z*this.width+u.x,departed=u.fromZ*this.width+u.fromX;
      if(occupied[current]===u.id)occupied[current]=-1;
      if(departed!==current&&occupied[departed]===u.id)occupied[departed]=-1;
    };
    this.actions.onRevive=u=>{
      if(!this._walkable(u.x,u.z,u.jobId)||occupied[u.z*this.width+u.x]!==-1)return false;
      this.live[u.team]++;u.deathAt=-1;u.deathX=u.x;u.deathZ=u.z;
      u.fromX=u.x;u.fromZ=u.z;u.moveElapsed=u.moveDuration=0;
      reserve(u.z*this.width+u.x,u.id);return true;
    };
    this.actions.onRelocate=(u,x,z)=>{
      if(!this._walkable(x,z,u.jobId)||occupied[z*this.width+x]!==-1)return false;
      if(occupied[u.z*this.width+u.x]===u.id)occupied[u.z*this.width+u.x]=-1;
      reserve(z*this.width+x,u.id);
      u.fromX=x;u.fromZ=z;u.moveElapsed=u.moveDuration=0;
      return true;
    };
    this.actions.beginTick(dt,this.units,{occupancy:occupied,sectors:this._combatSectors,walkable:this.walkable});
    // Dedicated defensive mode: gradually build resistance, regenerate
    // missing HP, and leave true large-area healing to nearby priests.
    // The same update runs inside the worker, independent of rendering.
    for(const u of this.units){
      if(!u.alive)continue;
      const command=u.team===0?this.squadCommands.get(String(u.squadId)):null;
      const defending=u.team===0&&(command==='defend'||
        (!command&&(u.order==='defend'||(!u.order&&(this.strategy==='defend'||this.strategy==='recovery')))));
      updateDefensivePosture(u,dt,defending);
    }
    for(const u of this.units){
      if(!u.alive)continue;
      const job=JOBS[u.jobIndex];
      u.cooldown=Math.max(-.1,u.cooldown-dt);u.hitFlash=Math.max(0,u.hitFlash-dt);
      u.attackElapsed=Math.min(99,u.attackElapsed+dt);
      u.phase+=dt*(u.action==='walk'?3.8:.8);
      if((u.skillPoseUntil||0)>this.time){u.action='skill';u.vx=0;u.vz=0;continue;}
      if(u.moveElapsed<u.moveDuration){
        u.moveElapsed=Math.min(u.moveDuration,u.moveElapsed+dt);
        if(u.moveElapsed===u.moveDuration)u.completedSteps++;
        u.action='walk';
        continue;
      }
      if(u.isStrategist){
        // Follow the unit-centre from behind, never initiate any attack or
        // cast. If a hostile closes in, evade farther into the rear rank.
        const group=u.team*this.squadCount+u.squadId;
        const memberCount=Math.max(1,formationCount[group]);
        const rear=u.team===0?-6:6;
        let targetX=formationX[group]/memberCount+rear;
        const targetZ=formationZ[group]/memberCount;
        let danger=Infinity;
        for(const enemy of this.units){
          // Enemy search is bounded to a cheap distance comparison; do not
          // pathfind every commander as an independent A* agent.
          if(!enemy.alive||enemy.team===u.team)continue;
          const d=(enemy.x-u.x)**2+(enemy.z-u.z)**2;
          if(d<danger)danger=d;
        }
        if(danger<36)targetX+=rear;
        // Emergency UR strategist escape is not restricted to a 12-cell
        // radius. Pick a safe, unoccupied tile ANYWHERE in its own half.
        if(u.rarity==='UR'&&!u.strategistWarpUsed&&danger<=9){
          const landing=chooseHomeWarpLanding(u,this.territoryWorld,{
            walkable:this.walkable,occupied,units:this.units,objects:this.objects});
          if(landing&&this.warpStrategist(u.id,landing.x,landing.z))continue;
        }
        let next=null,best=Math.hypot(u.x-targetX,u.z-targetZ);
        for(const [dx,dz] of NEIGHBORS){
          const x=u.x+dx,z=u.z+dz;
          if(!this._walkable(x,z)||occupied[z*this.width+x]!==-1)continue;
          const cost=Math.hypot(x-targetX,z-targetZ);
          if(cost+.1<best){best=cost;next={x,z};}
        }
        if(next){
          reserve(next.z*this.width+next.x,u.id);
          u.fromX=u.x;u.fromZ=u.z;u.vx=next.x-u.x;u.vz=next.z-u.z;
          u.facingX=u.vx;u.facingZ=u.vz;u.x=next.x;u.z=next.z;
          const riding=u.mountId&&this.objects.some(o=>o.alive&&o.id===u.mountId&&o.mountedBy===u.id);
          u.moveElapsed=0;u.moveDuration=1/(STRATEGIST_STATS.speed*MASS_MOVEMENT_SCALE*(riding?COMBAT_RULES.mountedSpeedMultiplier:1));
          u.action='walk';
        }else{u.action='hold';u.vx=0;u.vz=0;}
        continue;
      }
      const reach=job.range+2,radius=Math.ceil(reach/SECTOR);
      const sx=Math.floor(u.x/SECTOR),sz=Math.floor(u.z/SECTOR);
      const mission=u.team===0?this.squadMissions.get(String(u.squadId)):null;
      const healTarget=u.team===0?this.squadHealTargets.get(String(u.squadId)):null;
      u.healTargetSquadId=healTarget??null;
      let nearest=null,best=reach*reach,missionNearest=null,missionBest=reach*reach;
      for(let dx=-radius;dx<=radius;dx++)for(let dz=-radius;dz<=radius;dz++){
        const cx=sx+dx,cz=sz+dz;
        if(cx<0||cz<0||cx>=this._sectorCols||cz>=this._sectorRows)continue;
        const sector=cz*this._sectorCols+cx;
        for(let id=heads[sector];id!==-1;id=nextIds[id]){
          const other=this.units[id];
          if(!other.alive||other.team===u.team)continue;
          const d=(other.x-u.x)**2+(other.z-u.z)**2;
          if(d<best){best=d;nearest=other}
          if((mission?.type==='eliminate_squad'||mission?.type==='eliminate_commander')&&
            String(other.squadId)===mission.targetSquadId&&
            (mission.type!=='eliminate_commander'||other.isStrategist)&&d<missionBest){missionBest=d;missionNearest=other;}
        }
      }
      for(const o of this.objects){
        if(!o.alive||o.team===u.team||!['summon','mount'].includes(o.category))continue;
        const d=(o.x-u.x)**2+(o.z-u.z)**2;
        if(d<best){best=d;nearest=o;}
      }
      if(missionNearest){nearest=missionNearest;best=missionBest;}
      if(nearest&&!this._canSee(u,nearest))nearest=null;
      if(mission&&!['eliminate_squad','eliminate_commander'].includes(mission.type)){
        const structure=this.actions.objects.find(o=>o.alive&&o.id===mission.targetId);
        if(structure){
          const b=structure.bounds||{minX:structure.x,maxX:structure.x,minZ:structure.z,maxZ:structure.z};
          const distance=Math.hypot(Math.max(b.minX-u.x,0,u.x-b.maxX),Math.max(b.minZ-u.z,0,u.z-b.maxZ));
          const fire=mission.type.startsWith('burn_');
          const canAttack=fire?u.jobId==='mage'&&u.mp>=6:u.jobId!=='priest';
          const range=fire?Math.min(8,job.range):u.jobId==='archer'?6:2.2;
          if(canAttack&&distance<=range&&u.cooldown<=0){
            if(fire)u.mp-=6;
            this.actions.damageStructures(structure.x,structure.z,.01,fire?15:Math.max(5,job.damage),fire?'fire':'physical');
            this.actions.event('skill',{sourceId:u.id,x:u.x,z:u.z,targetX:structure.x,targetZ:structure.z,
              effect:fire?'fire':'heavy',animation:fire?'cast':'attack'});
            u.cooldown=Math.max(1,job.interval);u.action='skill';u.vx=0;u.vz=0;continue;
          }
        }
      }
      // Every rarity/job uses the same authoritative actions. Summons and
      // mounts remain separate collision-aware world objects, never soldiers.
      const heightHere=this.elevationMap?.[u.z*this.width+u.x];
      let higherStep=false;
      if(nearest&&this.elevationMap&&isHeightTactician(u.jobId)){
        const highNeighbors=[];
        for(const [dx,dz] of NEIGHBORS){
          const x=u.x+dx,z=u.z+dz;
          if(!this._walkable(x,z,u.jobId)||occupied[z*this.width+x]!==-1)continue;
          highNeighbors.push(this.elevationMap[z*this.width+x]);
        }
        const hasForcedDestination=u.team===0&&this.squadDestinations.has(String(u.squadId));
        higherStep=shouldSeekHighGround(u.jobId,heightHere,highNeighbors,{
          enemyDistanceSquared:best,healthRatio:u.hp/u.maxHp,hasForcedDestination});
      }
      if(u.cooldown<=0&&!higherStep&&this.actions.tryAutoAction(u,nearest,this.units)){
        u.cooldown=Math.max(u.cooldown,.35);
        u.vx=0;u.vz=0;
        continue;
      }
      if(job.id==='summoner'&&nearest&&best<=job.range**2){
        u.action='idle';u.vx=0;u.vz=0;continue;
      }
      if(nearest&&best<=job.range**2&&!higherStep){
        u.action='attack';u.vx=0;u.vz=0;
        u.facingX=Math.sign(nearest.x-u.x)||u.facingX;
        u.facingZ=Math.sign(nearest.z-u.z);
        if(u.cooldown<=0){
          u.cooldown+=job.interval;
          u.attackElapsed=0;
          this.actions.damageUnit(nearest,job.damage,u);
          nearest.hitFlash=.2;this.attacks++;
        }
        continue;
      }
      const squadCommand=u.team===0?this.squadCommands.get(String(u.squadId)):null;
      const order=u.team===0?(['charge','defend','hold','retreat'].includes(squadCommand)?squadCommand:u.order||
        (this.strategy==='recovery'?'defend':this.strategy==='eliminate'||this.strategy==='environment'?'balanced':this.strategy)):'balanced';
      if(order==='hold'&&!nearest){u.action='hold';continue;}
      if(order==='defend'&&u.team===0&&u.x>=this.riverXAt(u.z)-12&&!nearest){u.action='hold';continue;}
      const isNinja=u.jobId==='ninja';
      const defaultFlow=isNinja
        ?(order==='retreat'&&u.team===0?this.ninjaFlowWest:u.team===0?this.ninjaFlowEast:this.ninjaFlowWest)
        :(order==='retreat'&&u.team===0?this.flowWest:u.team===0?this.flowEast:this.flowWest);
      const assigned=u.team===0&&order!=='retreat'?this.squadFlows.get(String(u.squadId)):null;
      const assignedFlow=assigned&&(isNinja?assigned.ninja:assigned.regular);
      const cell=u.z*this.width+u.x;
      // If an assigned position becomes unreachable after the last bridge
      // falls, revert to the riverbank flow instead of freezing every soldier.
      const reachable=assignedFlow&&assignedFlow[cell]<0x3fffffff;
      const supporting=squadCommand==='support'&&this.supportFlow[cell]<0x3fffffff;
      const flow=reachable?assignedFlow:supporting?this.supportFlow:defaultFlow;
      if(reachable&&flow[cell]===0){u.action='hold';u.vx=0;u.vz=0;continue;}
      if(supporting&&!reachable&&flow[cell]===0){u.action='hold';u.vx=0;u.vz=0;continue;}
      const here=flow[u.z*this.width+u.x];
      let next=null,score=Infinity;
      const preferred=nearest?{x:nearest.x,z:nearest.z}:null;
      const squadIndex=u.team*this.squadCount+u.squadId;
      // Maintain a rectangular advance on open terrain. Bridges, walls and
      // enemy contact take precedence, so squads can naturally funnel into
      // columns at chokepoints and re-form on the far side.
      const formationActive=!nearest&&!reachable&&
        Math.abs(u.x-this.riverXAt(u.z))>24&&
        NEIGHBORS.every(([dx,dz])=>this._walkable(u.x+dx,u.z+dz,u.jobId))&&
        formationCount[squadIndex]>1;
      const desiredX=formationActive?formationX[squadIndex]/formationCount[squadIndex]+
        (u.team===0?1:-1)*u.formationForward:0;
      const desiredZ=formationActive?formationZ[squadIndex]/formationCount[squadIndex]+
        u.formationLateral:0;
      const previousError=formationActive?
        .38*Math.abs(u.x-desiredX)+.5*Math.abs(u.z-desiredZ):0;
      for(const [dx,dz] of NEIGHBORS){
        const x=u.x+dx,z=u.z+dz;
        if(!this._walkable(x,z,u.jobId)||occupied[z*this.width+x]!==-1)continue;
        let cost=flow[z*this.width+x];
        if(this.elevationMap&&isHeightTactician(u.jobId))
          cost+=heightAdvanceCost(u.jobId,heightHere,this.elevationMap[z*this.width+x])*(higherStep?1.6:1);
        if(cost>=0x3fffffff)continue;
        if(preferred){const before=Math.abs(u.x-preferred.x)+Math.abs(u.z-preferred.z),after=Math.abs(x-preferred.x)+Math.abs(z-preferred.z);cost+=(after-before)*.8;}
        if(formationActive)cost+=.38*Math.abs(x-desiredX)+.5*Math.abs(z-desiredZ)-previousError;
        const wiggle=((u.id*13+x*31+z*19)%7)*.01;
        cost+=wiggle;
        // 曲がり角の渋滞を避ける。逆走は目標が隣接している場合のみ。
        if(cost<score&&(cost<=here+1.05||nearest)){score=cost;next={x,z};}
      }
      if(!next){
        u.blockedTicks=(u.blockedTicks||0)+1;
        // A long queue at a gate needs an occasional legal side-step. The
        // normal flow never permits arbitrary reverse movement, but a unit
        // stuck for several AI ticks can briefly yield into an adjacent cell.
        if(u.blockedTicks>=6&&here<0x3fffffff){
          let bestDetour=Infinity;
          for(const [dx,dz] of NEIGHBORS){
            const x=u.x+dx,z=u.z+dz,index=z*this.width+x;
            if(!this._walkable(x,z,u.jobId)||occupied[index]!==-1)continue;
            const distance=flow[index];
            if(distance>here+2||distance>=0x3fffffff)continue;
            const penalty=(x===u.fromX&&z===u.fromZ)?0.7:0;
            const rank=distance+penalty+((u.id*17+x*3+z*11)%9)*.015;
            if(rank<bestDetour){bestDetour=rank;next={x,z};}
          }
        }
      }
      if(!next){u.action='blocked';u.vx=0;u.vz=0;continue}
      u.blockedTicks=0;
      reserve(next.z*this.width+next.x,u.id);
      u.fromX=u.x;u.fromZ=u.z;
      u.vx=next.x-u.x;u.vz=next.z-u.z;
      u.facingX=u.vx;u.facingZ=u.vz;
      u.x=next.x;u.z=next.z;
      const multiplier=order==='charge'?1.3:order==='defend'?.65:1;
      const mounted=u.mountId&&this.objects.some(o=>o.id===u.mountId&&o.alive&&o.mountedBy===u.id);
      if(!mounted)u.mountId=null;
      u.moveDuration=1/(job.speed*MASS_MOVEMENT_SCALE*multiplier*
        squadSpeedFactor(u.formationType)*(mounted?COMBAT_RULES.mountedSpeedMultiplier:1));
      u.moveElapsed=0;u.action='walk';
      if(!u.crossed&&((u.team===0&&u.x>this.riverXAt(u.z)+7)||(u.team===1&&u.x<this.riverXAt(u.z)-7))){u.crossed=true;this.crossings[u.team]++;}
    }
    // CombatActionRuntime writes -2 directly for blocking summons, mounts and
    // structures. Record their cells as well, including recently despawned
    // objects, so no invisible obstacle survives into the following tick.
    for(const object of this.objects){
      if(!this._inside(object.x,object.z))continue;
      const tile=object.z*this.width+object.x;
      if(occupied[tile]===-2)touched.push(tile);
    }
    this.actionEvents=[...this._queuedWarpEvents.splice(0),...this.actions.events];
    this.lastAiMs=(typeof performance!=='undefined'?performance.now():Date.now())-start;
    return this.live;
  }

  getStats(){return {sideCount:this.sideCount,alive:this.live.slice(),total:this.units.length,
    attacks:this.attacks,time:this.time,tickCount:this.tickCount,aiMs:this.lastAiMs,
    bridgeCrossings:this.crossings.slice(),squadOrders:this.squadCommands.size,...this.actions.getStats()};}
}
