// 実ゲームのマス・橋・建物衝突をそのまま使う大軍シミュレーション。
// 空間索引＋共有フローフィールドで2000体でも全件A*を避ける。
import { JOBS } from './mass-battle-sim.js';
import { CombatActionRuntime } from './combat-action-runtime.js?v=20261119-rally-reserve2';
import { COMBAT_RULES,availableCombatSkills } from './combat-action-spec.js?v=4.6.51';
import {applySquadHeal} from './room-item-registry.js?v=20261119-rally-reserve2';
import {createSquadFormationPlan,squadSpeedFactor} from './mass-battle-formations.js';
import {recomposeSquadAssignments,applySquadRecomposition,FORMATION_TYPES} from './battle-squad-recomposition.js?v=4.6.49';
import {territoryAt,legalHomeWarpCell,chooseHomeWarpLanding} from './battle-territory.js';
import {heightAdvanceCost,shouldSeekHighGround,isHeightTactician} from './tactical-height-priority.js';
import {updateDefensivePosture,shouldCounterNearbyThreat} from './battle-defensive-doctrine.js?v=20261122-close-threat1';
import {strategistAuraMultipliers} from './strategist-command-aura.js';
import {chooseBlockedMovementDetour} from './battle-movement-recovery.js?v=20261122-cell-pingpong2';
import {formationCombatIntent,isHighGroundFiringJob,highGroundShieldIntent} from './formation-driven-ai.js?v=formation-ai-v2-20261124';
import {MASS_GRID_DIRECTIONS,massDiagonalClear,massStepDuration} from './mass-battle-directional-nav.js';
import {advanceMassHighGroundRoute,targetVisibleFromWindow} from './mass-battle-highground.js?v=4.6.31';

const SECTOR = 5;
const NEIGHBORS = MASS_GRID_DIRECTIONS;
// Default advance is a fast dash; tile reservations and collision remain unchanged. The grid still reserves
// every tile and respects soldiers, bridges and formation speed penalties.
export const MASS_MOVEMENT_SCALE = 0.88;
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
      if(!walkable[next]||!massDiagonalClear(x,z,dx,dz,width,walkable)||distances[next]<=value)continue;
      distances[next]=value;queue[back++]=next;
    }
  }
  return distances;
}

export class MassBattleGridSimulation {
  constructor(sideCount, seed, {width,height,walkable,water,opaque,bridges,riverXAt,elevationMap=null,mountForbidden=null}) {
    if(!Number.isInteger(sideCount)||sideCount<1||sideCount>1000)throw RangeError('兵数は1～1000');
    if(!(walkable instanceof Uint8Array)||walkable.length!==width*height)throw Error('通行可能マップが不正です');
    if(!Array.isArray(bridges))throw Error('橋の情報が不正です');
    this.width=width;this.height=height;
    this.walkable=walkable;
    this.mountForbidden=mountForbidden instanceof Uint8Array&&mountForbidden.length===walkable.length?mountForbidden:null;
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
    this.squadSize=Math.max(1,Math.ceil(sideCount/10));
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
    this.enemySquadCommands=new Map();this.explorationOrders=new Map();this.explorationFlows=new Map();this.enemySquadItemBuffs=new Map();
    this.squadItemBuffs=new Map();this.squadDebuffs=new Map();
    // Cache target-focused BFS fields across troops. A soldier must retain
    // the direction of an enemy hidden by a wall, tree or indoor furnishing.
    // The budget prevents 2000 agents from creating separate A* searches.
    this._pursuitFlows=new Map();this._pursuitBuildsThisTick=0;
    this._enemyPursuitFlows=new Map();this._enemyBuildsPerTeam=[0,0];
    this.squadHealTargets=new Map();this.squadMissions=new Map();
    this.units=[];this.live=[sideCount,sideCount];this.crossings=[0,0];
    this.actions=new CombatActionRuntime({width,height,walkable,mountForbidden:this.mountForbidden});
    this.objects=this.actions.objects;
    this.actionEvents=[];
    this._queuedWarpEvents=[];
    // Large battles retain real staircase/window geometry from the shared
    // building BOM. Only a bounded number of specialists ascend at once.
    this.highGroundRoutes=[];
    this._highGroundFlows=[];
    this._highGroundClaims=new Map();
    // Every squad uses a shared stair gate; the ground entrance is freed
    // once a soldier climbs into the real 3D staircase.
    this._highGroundEntryNext=new Map();
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
      const isStrategist=sideCount>=20&&member.row===plan.rows-1&&
        member.col===(plan.count-1)%plan.columns; // preserve the mage slot in balanced squads
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
        highGroundRouteIndex:-1,highGroundPhase:0,highGroundStep:0,highGroundT:0,
        upperPursuitTargetId:-1,
        highGroundFloor:1,action:'advance',crossed:false});
    }
    // Each commander starts on an individually owned ceremonial warhorse.
    // The mount is a world object, not a second humanoid or occupied tile.
    for(const commander of this.units.filter(u=>u.isStrategist)){
      const horse=this.actions.spawnObject('horse',commander,commander.x,commander.z,{mounted:true});
      if(horse){horse.commanderMount=true;horse.hp=horse.maxHp=240;
        horse.expiresAt=Infinity;horse.spec={...horse.spec,speed:9.5};}
    }
    this.squadStrategies=new Map();
    this.battleStarted=false;
    for(let id=0;id<this.squadCount;id++){
      const members=this.units.filter(u=>u.team===0&&u.squadId===id&&!u.isStrategist);
      this.squadStrategies.set(String(id),this.recommendedSquadStrategy(members));
    }
  }

  _inside(x,z){return x>=0&&z>=0&&x<this.width&&z<this.height}
  // A mounted rider may enter a house only after the horse is parked on a
  // legal exterior tile. Applies equally in main-thread and Worker authority.
  _prepareMountedEntry(unit,x,z){
    if(!unit.mountId||!this._inside(x,z)||!this.mountForbidden?.[z*this.width+x])return true;
    return this.actions.dismountObject(unit);
  }
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
    if(!this._prepareMountedEntry(unit,x,z))return false;
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
  /** Load only actual, authored 3D staircase/window paths. No per-soldier A*. */
  configureHighGroundRoutes(routes=[]){
    this.highGroundRoutes=routes.filter(route=>
      route?.points?.length>=2&&Number.isInteger(route.access?.x)&&
      Number.isInteger(route.access?.z)&&this._walkable(route.access.x,route.access.z)&&
      ['window','roof','interior'].includes(route.kind)).slice(0,80);
    this._highGroundClaims.clear();
    this._highGroundEntryNext.clear();
    this._rebuildHighGroundFlows();
  }

  _rebuildHighGroundFlows(){
    this._highGroundFlows=this.highGroundRoutes.map(route=>
      makeFlow(this.width,this.height,
        route.kind==='roof'?this.ninjaWalkable:this.walkable,[route.access]));
  }

  _highGroundRouteAlive(route){
    if(!route)return false;
    if(!route.structureId)return true;
    const structure=this.objects.find(o=>o.id===route.structureId);
    return !structure||structure.alive;
  }

  /** One order authorizes the *entire* squad, never an arbitrary scout.
   * Every surviving member must share a traversable stair route. If the
   * complete squad cannot reach it, reject instead of silently splitting. */
  orderSquadHighGround(squadId,routeIndex,team=0,{manualHold=true,formationRolesOnly=false}={}){
    const id=String(squadId),index=Number(routeIndex),route=this.highGroundRoutes[index];
    if(!route||!this._highGroundRouteAlive(route)||
      !['interior','window','roof'].includes(route.kind))return false;
    const members=this.units.filter(u=>u.team===team&&String(u.squadId)===id&&u.alive&&u.hp>0&&(!formationRolesOnly||isHighGroundFiringJob(u.jobId)));
    if(!members.length)return false;
    const key=route.buildingIndex+':'+team,claimed=this._highGroundClaims.get(key);
    if(claimed!=null&&String(claimed)!==id)return false;
    const flow=this._highGroundFlows[index];
    if(!flow||members.some(u=>u.mountId||
      (u.highGroundRouteIndex>=0&&u.highGroundRouteIndex!==index)||
      (u.highGroundRouteIndex<0&&flow[u.z*this.width+u.x]>=0x3fffffff)))return false;
    if(!formationRolesOnly&&team===0){
      this.autoStrategySquads.delete(id);this.squadDestinations.delete(id);
      this.squadFlows.delete(id);this.squadMissions.delete(id);
      this.squadHealTargets.delete(id);this.clearSquadExploration(id,team);
      this.squadCommands.set(id,'move');
    }else if(!formationRolesOnly)this.enemySquadCommands.set(id,'move');
    for(const unit of members){
      if(unit.highGroundRouteIndex===index){
        // Switching a selected rooftop from wait to attack must also affect
        // soldiers who are already ascending or standing on the upper level.
        unit.highGroundManualHold=manualHold;
        continue;
      }
      unit.highGroundRouteIndex=index;unit.highGroundPhase=0;unit.highGroundStep=0;
      unit.highGroundT=0;unit.highGroundFloor=1;unit.highGroundManualHold=manualHold;
      unit.tacticalOrder=null;unit.tacticalOrderUntil=0;
    }
    if(!formationRolesOnly&&team===0&&members.every(u=>u.highGroundPhase===2))
      this.squadCommands.set(id,manualHold?'hold':'charge');
    this._highGroundClaims.set(key,id);
    return true;
  }
  /** Arrival posture changes without discarding the reached upper floor.
   * A charge fights from windows or roof; defend/hold keeps every member waiting. */
  setSquadHighGroundArrival(squadId,command,team=0){
    if(!['charge','defend','hold'].includes(command))return false;
    const members=this.units.filter(u=>u.team===team&&String(u.squadId)===String(squadId)&&u.alive&&u.hp>0);
    if(!members.length||members.some(u=>u.highGroundRouteIndex<0||u.highGroundPhase!==2))return false;
    for(const u of members)u.highGroundManualHold=command!=='charge';
    (team===0?this.squadCommands:this.enemySquadCommands).set(String(squadId),command);
    return true;
  }
  /** Preserve a building claim while any comrade still occupies its route. */
  _releaseHighGroundClaimIfEmpty(unit,route){
    if(!route)return;
    const key=route.buildingIndex+':'+unit.team;
    if(this.units.some(other=>other!==unit&&other.alive&&other.team===unit.team&&
      other.highGroundRouteIndex>=0&&
      this.highGroundRoutes[other.highGroundRouteIndex]?.buildingIndex===route.buildingIndex))return;
    this._highGroundClaims.delete(key);
  }
  /** Later orders walk back down the actual staircase before ground travel. */
  _cancelSquadHighGround(squadId,team=0){
    const id=String(squadId);
    for(const u of this.units){
      if(u.team!==team||String(u.squadId)!==id||u.highGroundRouteIndex<0)continue;
      if(u.highGroundPhase===0){this._releaseHighGroundUnit(u);continue;}
      const route=this.highGroundRoutes[u.highGroundRouteIndex];
      if(u.highGroundPhase===2){
        u.highGroundStep=Math.max(0,(route?.points.length||2)-2);
        u.highGroundT=1;
      }
      u.highGroundManualHold=false;u.upperPursuitTargetId=-1;
      u.highGroundPhase=3;u.action='walk';
    }
  }
  _assignHighGroundUnits(){
    if(!this.highGroundRoutes.length)return;
    // Allocate inside-room patrol, second-floor archer and rooftop ninja
    // across neighboring buildings; never commit every staircase to one job.
    const rank=route=>{
      const desired=['interior','window','roof'][route.buildingIndex%3];
      return route.kind===desired?0:route.kind==='interior'?1:route.kind==='window'?2:3;
    };
    const candidates=this.highGroundRoutes.slice().sort((a,b)=>
      a.buildingIndex-b.buildingIndex||rank(a)-rank(b));
    for(const route of candidates){
      // Indoor exploration is a manual objective, never an automatic
      // combat patrol: the old AI left whole squads standing in rooms.
      if(route.kind==='interior')continue;
      if(this._highGroundClaims.has(route.buildingIndex+':'+route.team)||!this._highGroundRouteAlive(route))continue;
      const index=this.highGroundRoutes.indexOf(route),flow=this._highGroundFlows[index];
      let best=null,score=Infinity;
      for(const u of this.units){
        if(!u.alive||u.isStrategist||u.team!==route.team||u.mountId||
          (u.team===0&&(this.squadDestinations.has(String(u.squadId))||
            this.squadMissions.has(String(u.squadId))))||
          u.highGroundRouteIndex>=0||u.hp<u.maxHp*.35)continue;
        if(route.kind==='roof'?
          !(u.jobId==='ninja'&&['attack','ambush'].includes(u.formationType)||u.formationType==='highground'&&isHighGroundFiringJob(u.jobId)):
          !(isHighGroundFiringJob(u.jobId)&&
            ['highground','support','balanced'].includes(u.formationType)))continue;
        const standingOrder=(u.team===0?this.squadCommands:this.enemySquadCommands)
          .get(String(u.squadId));
        if(['hold','defend','retreat'].includes(standingOrder))continue;
        // A specialist can divert to a nearby accessible stair, but not
        // abandon a distant front line to cross the entire 232-cell map.
        const d=Math.hypot(u.x-route.access.x,u.z-route.access.z);
        if(d>(route.kind==='interior'?65:48)||!flow||flow[u.z*this.width+u.x]>=0x3fffffff)continue;
        const threat=u.pursuitMemory?.until>this.time&&
          Math.hypot(u.x-u.pursuitMemory.x,u.z-u.pursuitMemory.z)<5;
        if(threat)continue;
        const cost=d+(route.kind==='roof'?3:0)+(u.hp/u.maxHp<.6?8:0);
        if(cost<score){best=u;score=cost;}
      }
      if(best){
        // Automatic rooftop tactics are squad-level too, not one-person detours.
        this.orderSquadHighGround(best.squadId,index,best.team,{manualHold:false,formationRolesOnly:best.formationType==='highground'});
      }
    }
  }

  /**
   * Actual 2F / rooftop targets are discoverable in the Worker. Reuse the
   * same authored stairs and team-specific entrance path as the defenders;
   * do not teleport a melee soldier vertically or permit floor-piercing hits.
   * At most one assaulting unit per building/team, evaluated once every 3s.
   */
  _assignUpperFloorPursuits(){
    if(!this.highGroundRoutes.length)return;
    const upperEnemies=this.units.filter(u=>u.alive&&u.highGroundPhase===2&&u.highGroundFloor>1);
    for(const enemy of upperEnemies){
      const defended=this.highGroundRoutes[enemy.highGroundRouteIndex];
      if(!defended||!this._highGroundRouteAlive(defended))continue;
      const attackerTeam=1-enemy.team;
      const claimKey=defended.buildingIndex+':'+attackerTeam;
      if(this._highGroundClaims.has(claimKey))continue;
      const routeIndex=this.highGroundRoutes.findIndex(r=>
        r.buildingIndex===defended.buildingIndex&&r.level===enemy.highGroundFloor&&
        r.kind===defended.kind&&this._highGroundRouteAlive(r));
      if(routeIndex<0)continue;
      const route=this.highGroundRoutes[routeIndex];
      const flow=this._highGroundFlows[routeIndex];
      let best=null,min=Infinity;
      for(const u of this.units){
        if(!u.alive||u.isStrategist||u.team!==attackerTeam||u.mountId||
          u.highGroundRouteIndex>=0||u.hp<u.maxHp*.3)continue;
        if(!['sword','fighter','ninja','shield','thief','lancer'].includes(u.jobId))continue;
        if(defended.kind==='roof'&&u.jobId!=='ninja')continue;
        if(u.team===0&&(this.squadDestinations.has(String(u.squadId))||
          this.squadMissions.has(String(u.squadId))))continue;
        const dist=Math.hypot(u.x-route.access.x,u.z-route.access.z);
        if(dist>45||!flow||flow[u.z*this.width+u.x]>=0x3fffffff)continue;
        if(dist<min){min=dist;best=u;}
      }
      if(best){
        if(this.orderSquadHighGround(best.squadId,routeIndex,best.team,{manualHold:false}))
          for(const u of this.units)if(u.team===best.team&&String(u.squadId)===String(best.squadId))
            u.upperPursuitTargetId=enemy.id;
      }
    }
  }

  _releaseHighGroundUnit(u){
    const route=this.highGroundRoutes[u.highGroundRouteIndex];
    this._releaseHighGroundClaimIfEmpty(u,route);
    u.highGroundRouteIndex=-1;u.highGroundPhase=0;
    u.highGroundFloor=1;u.highGroundStep=0;u.highGroundT=0;
    u.upperPursuitTargetId=-1;u.highGroundManualHold=false;
  }

  /** A window can see only outside its actual aperture. Never melee through
   * a floor, never shoot through a wall from a synthetic ground coordinate. */
  _windowCanSee(route,target){
    if(!route?.window||!targetVisibleFromWindow(route.window,target))return false;
    let x=Math.round(route.window.aperture.x),z=Math.round(route.window.aperture.z);
    const tx=Math.round(target.x),tz=Math.round(target.z);
    if(!this._inside(x,z)||!this._inside(tx,tz))return false;
    const dx=Math.abs(tx-x),dz=Math.abs(tz-z),sx=x<tx?1:-1,sz=z<tz?1:-1;
    let err=dx-dz,steps=0;
    while(x!==tx||z!==tz){
      const e=err*2;
      if(e>-dz){err-=dz;x+=sx;}
      if(e<dx){err+=dx;z+=sz;}
      if(!this._inside(x,z))return false;
      // The open aperture itself is a physical hole in the first facade;
      // all subsequent solid cells still block the shot.
      if(++steps>1&&(x!==tx||z!==tz)&&this.opaque[z*this.width+x])return false;
    }
    return true;
  }

  _tickHighGroundUnit(u,dt){
    const route=this.highGroundRoutes[u.highGroundRouteIndex];
    if(!route||!this._highGroundRouteAlive(route)){
      if(u.highGroundPhase>0)this._markDead(u);
      else this._releaseHighGroundUnit(u);
      return true;
    }
    if(u.highGroundPhase===0){
      // Keep the ground tile reserved until the authored 3D path has fully
      // cleared the staircase; no worker/grid teleport into a solid tread.
      if(u.x===route.access.x&&u.z===route.access.z&&
        u.moveElapsed>=u.moveDuration){
        if(route.kind==='interior'){
          // The unit WALKED along passable tiles to the true room cell.
          // Its authoritative x/z and item pickup stay inside the building.
          u.highGroundPhase=2;u.highGroundFloor=1;
          u.vx=0;u.vz=0;u.action='hold';return true;
        }
        const gate=route.buildingIndex+':'+u.team;
        if((this._highGroundEntryNext.get(gate)||0)>this.time){
          u.action='hold';u.vx=0;u.vz=0;return true;
        }
        this._highGroundEntryNext.set(gate,this.time+.65);
        u.highGroundPhase=1;u.highGroundStep=0;u.highGroundT=0;
        u.moveElapsed=0;u.moveDuration=0;
        u.vx=0;u.vz=0;u.action='walk';return true;
      }
      return false;
    }
    if(u.highGroundPhase===1){
      const speed=(u.strategistStats?.speed??JOBS[u.jobIndex].speed)*
        MASS_MOVEMENT_SCALE*2.2*dt;
      const step=advanceMassHighGroundRoute(route,u.highGroundStep,u.highGroundT,speed);
      u.highGroundStep=step.step;u.highGroundT=step.t;
      u.completedSteps+=speed/2.2;
      u.action='walk';u.vx=0;u.vz=0;
      if(step.done){u.highGroundPhase=2;u.highGroundFloor=route.level;u.action='idle';}
      return true;
    }
    if(u.highGroundPhase===3){
      // Return along the exact authored stair treads after the upper enemy
      // dies/moves away. Releasing at the original entrance is not a warp.
      const n=route.points.length-1;
      const reversed={points:route.points.slice().reverse()};
      const reverseStep=Math.max(0,n-1-u.highGroundStep);
      const reverseT=1-u.highGroundT;
      const speed=(u.strategistStats?.speed??JOBS[u.jobIndex].speed)*
        MASS_MOVEMENT_SCALE*2.2*dt;
      const step=advanceMassHighGroundRoute(reversed,reverseStep,reverseT,speed);
      if(step.done){
        // Descend to a genuinely empty, walkable ground cell; do not stack
        // every returning soldier in the same staircase entrance tile.
        let landing=null;
        for(let radius=0;radius<=4&&!landing;radius++)
          for(let dz=-radius;dz<=radius&&!landing;dz++)
            for(let dx=-radius;dx<=radius;dx++){
              if(Math.max(Math.abs(dx),Math.abs(dz))!==radius)continue;
              const x=route.access.x+dx,z=route.access.z+dz,index=z*this.width+x;
              if(!this._walkable(x,z,u.jobId)||this._occupancy[index]!==-1)continue;
              landing={x,z,index};break;
            }
        if(!landing){u.action='hold';return true;}
        u.x=landing.x;u.z=landing.z;u.fromX=u.x;u.fromZ=u.z;
        u.moveElapsed=u.moveDuration=0;u.vx=u.vz=0;
        this._occupancy[landing.index]=u.id;this._occupiedTouched.push(landing.index);
        this._releaseHighGroundUnit(u);u.action='idle';return true;
      }
      u.highGroundStep=n-1-step.step;u.highGroundT=1-step.t;
      u.action='walk';u.vx=0;u.vz=0;return true;
    }
    if(u.highGroundPhase===2){
      if(u.highGroundManualHold){u.vx=0;u.vz=0;u.action='hold';return true;}
      if(u.upperPursuitTargetId>=0){
        const enemy=this.units[u.upperPursuitTargetId];
        const enemyRoute=enemy&&this.highGroundRoutes[enemy.highGroundRouteIndex];
        if(!enemy?.alive||enemy.highGroundPhase!==2||
          enemy.highGroundFloor!==u.highGroundFloor||
          enemyRoute?.buildingIndex!==route.buildingIndex){
          u.highGroundPhase=3;
          u.highGroundStep=Math.max(0,route.points.length-2);
          u.highGroundT=1;
          u.action='walk';return true;
        }
        if(u.cooldown<=0&&this._canSee(u,enemy)){
          const job=JOBS[u.jobIndex];
          this.actions.damageUnit(enemy,this._debuffDamage(u,enemy,Math.max(1,job.damage)),u);
          enemy.hitFlash=.2;this.attacks++;
          u.cooldown=Math.max(.4,job.interval);
          u.attackElapsed=0;u.action='attack';
          const p=route.points.at(-1);
          this.actions.event('skill',{sourceId:u.id,
            x:Math.round(p.x/2.2+6),z:Math.round(p.z/2.2+6),
            worldY:p.y,targetX:enemy.x,targetZ:enemy.z,
            effect:'slash',animation:'attack'});
        }else if(u.attackElapsed>.7)u.action='idle';
        return true;
      }
      if(route.kind==='interior'){
        // Autonomous combat AI must leave the room when there is no
        // explicit exploration/hold assignment; normal BFS then pursues
        // living opponents through the collision map and real doors.
        if(!u.highGroundManualHold&&
           !this.explorationOrders.has(u.team+':'+String(u.squadId))){
          this._releaseHighGroundUnit(u);return false;
        }
        // Remain visibly INSIDE the room for exploration/loot, but fight
        // normally if an enemy actually approaches the same floor.
        if(Math.hypot(u.x-route.access.x,u.z-route.access.z)>4){
          this._releaseHighGroundUnit(u);return false;
        }
        const range=JOBS[u.jobIndex].range+1;
        for(const foe of this.units){
          if(foe.alive&&foe.team!==u.team&&foe.highGroundFloor===1&&
            (foe.x-u.x)**2+(foe.z-u.z)**2<range*range&&this._canSee(u,foe))
            return false;
        }
        u.action='hold';u.vx=0;u.vz=0;return true;
      }
      if(u.jobId==='summoner'&&u._pendingCast){
        this.actions.tryAutoAction(u,null,this.units);u.vx=0;u.vz=0;return true;
      }
      const job=JOBS[u.jobIndex],bay=route.window;
      const range=(u.jobId==='ninja'?Math.max(6,job.range):job.range)*
        Math.min(8,2**(route.level-1));
      let nearest=null,distance=range*range;
      const center=bay.aperture;
      if(u.cooldown<=0){
        for(const target of this.units){
          if(!target.alive||target.team===u.team||[1,3].includes(target.highGroundPhase))continue;
          const upper=target.highGroundPhase===2&&target.highGroundFloor>1;
          const sameFloor=upper&&target.highGroundFloor===u.highGroundFloor&&
            this.highGroundRoutes[target.highGroundRouteIndex]?.buildingIndex===route.buildingIndex;
          const d=sameFloor?1:(center.x-target.x)**2+(center.z-target.z)**2;
          if(d>=distance||!(sameFloor||!upper&&this._windowCanSee(route,target)))continue;
          nearest=target;distance=d;
        }
      }
      if(u.jobId==='summoner'){
        if(nearest&&this.actions.tryAutoAction(u,nearest,this.units)){
          u.cooldown=Math.max(u.cooldown,.35);u.action='skill';
        }else u.action='idle';
        u.vx=0;u.vz=0;return true;
      }
      if(nearest){
        const damage=Math.max(1,Math.round(job.damage*Math.min(8,2**(route.level-1))));
        this.actions.damageUnit(nearest,this._debuffDamage(u,nearest,damage),u);
        nearest.hitFlash=.2;this.attacks++;
        u.cooldown=Math.max(.45,job.interval);u.attackElapsed=0;u.action='attack';
        this.actions.event('skill',{sourceId:u.id,x:Math.round(center.x),z:Math.round(center.z),
          worldY:route.points.at(-1).y,targetX:nearest.x,targetZ:nearest.z,
          effect:u.jobId==='mage'?'arcane':'arrow',animation:u.jobId==='mage'?'cast':'ranged'});
      }else if(u.action!=='attack'||u.attackElapsed>.65)u.action='idle';
      return true;
    }
    return false;
  }

  _canSee(a,b){
    // Ground-level melee cannot reach a different storey. Upper-floor ranged
    // sight passes through authored window bays only, never solid ceilings.
    if([1,3].includes(a.highGroundPhase)||[1,3].includes(b.highGroundPhase))return false;
    const aUpper=a.highGroundPhase===2&&a.highGroundFloor>1;
    const bUpper=b.highGroundPhase===2&&b.highGroundFloor>1;
    if(aUpper||bUpper){
      if(aUpper&&bUpper){
        const aRoute=this.highGroundRoutes[a.highGroundRouteIndex];
        const bRoute=this.highGroundRoutes[b.highGroundRouteIndex];
        // Upper-storey opponents can fight on the SAME real floor; never
        // hit enemies on another floor or through a different building.
        return a.highGroundFloor===b.highGroundFloor&&
          aRoute?.buildingIndex===bRoute?.buildingIndex;
      }
      if(aUpper)return this._windowCanSee(this.highGroundRoutes[a.highGroundRouteIndex],b);
      const range=JOBS[a.jobIndex]?.range??0;
      return range>=4&&this._windowCanSee(this.highGroundRoutes[b.highGroundRouteIndex],a);
    }
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
    this._pursuitFlows?.clear(); // bridges/objects may have changed
    this._enemyPursuitFlows?.clear();
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
    if(this.highGroundRoutes?.length)this._rebuildHighGroundFlows();
  }

  // A goal concealed by a solid object stays in memory. Units route toward
  // LOS-accessible tiles around that goal, not toward the obstacle itself.
  // Cache at most sixteen flow maps; share each among the nearby soldiers.
  _pursuitFlow(target,jobId){
    if(!target||!Number.isFinite(target.x)||!Number.isFinite(target.z))return null;
    const x=Math.round(target.x),z=Math.round(target.z);
    const ninja=jobId==='ninja',key=(ninja?'n:':'r:')+Math.round(x/3)*3+':'+Math.round(z/3)*3;
    const cached=this._pursuitFlows.get(key);
    if(cached&&this.time-cached.createdAt<1.8)return cached.flow;
    if(this._pursuitBuildsThisTick>=2)return cached?.flow??null;
    const goals=[];
    for(let dz=-4;dz<=4;dz++)for(let dx=-4;dx<=4;dx++){
      if(dx*dx+dz*dz>16)continue;
      const gx=x+dx,gz=z+dz;
      if(!this._walkable(gx,gz,jobId))continue;
      if(!this._canSee({x:gx,z:gz},target))continue;
      goals.push({x:gx,z:gz});
    }
    // A dynamic obstruction may conceal every nearby tile; do not invent
    // a path through the wall or select an arbitrary inaccessible location.
    if(!goals.length)return null;
    this._pursuitBuildsThisTick++;
    const flow=makeFlow(this.width,this.height,ninja?this.ninjaWalkable:this.walkable,goals);
    this._pursuitFlows.delete(key);
    this._pursuitFlows.set(key,{flow,createdAt:this.time});
    while(this._pursuitFlows.size>16)this._pursuitFlows.delete(this._pursuitFlows.keys().next().value);
    return flow;
  }

  /** Defenders help nearby comrades already fighting instead of watching
   * another division be surrounded. Explicit HOLD remains stationary; DEFEND
   * leaves its post only within a compact local support perimeter. */
  _engagedAllyNear(u,heads,nextIds,radius=10){
    const sx=Math.floor(u.x/SECTOR),sz=Math.floor(u.z/SECTOR);
    const sectors=Math.ceil(radius/SECTOR),r2=radius*radius;
    for(let dz=-sectors;dz<=sectors;dz++)
      for(let dx=-sectors;dx<=sectors;dx++){
        const x=sx+dx,z=sz+dz;
        if(x<0||z<0||x>=this._sectorCols||z>=this._sectorRows)continue;
        for(let id=heads[z*this._sectorCols+x];id!==-1;id=nextIds[id]){
          const ally=this.units[id];
          if(!ally||ally===u||!ally.alive||ally.team!==u.team||
            ally.isStrategist||ally.currentTargetSquadId==null||
            ally.currentTargetSquadId<0||!['attack','skill'].includes(ally.action))continue;
          if((ally.x-u.x)**2+(ally.z-u.z)**2<=r2)return true;
        }
      }
    return false;
  }

  // Periodically refreshed shared goal field for every surviving enemy.
  // Unlike the fixed front-line flow, this also works after a flank or retreat.
  _enemyPursuitFlow(team,jobId,targetSquadId=null){
    const ninja=jobId==='ninja';
    const key=team+':'+(ninja?'n':'r')+':'+(targetSquadId??'*');
    const cached=this._enemyPursuitFlows.get(key);
    if(cached&&this.time-cached.createdAt<1.5)return cached.flow;
    // One budget for each team: iterating player units first used to starve
    // every enemy of target paths on every tick.
    if(this._enemyBuildsPerTeam[team]>=1)return cached?.flow??null;
    const goals=[];
    for(const enemy of this.units){
      if(!enemy.alive||enemy.team===team||
         (enemy.highGroundPhase===2&&enemy.highGroundFloor>1)||
         (targetSquadId!=null&&String(enemy.squadId)!==String(targetSquadId)))continue;
      for(const [dx,dz] of NEIGHBORS){
        const x=enemy.x+dx,z=enemy.z+dz;
        // A reachable tile just OUTSIDE a castle wall must not become a
        // completed attack goal while the opponent stands INSIDE the wall.
        // Only actual visible approach cells can terminate pursuit.
        if(this._walkable(x,z,jobId)&&this._canSee({x,z},enemy))
          goals.push({x,z});
      }
    }
    if(!goals.length)return null;
    this._enemyBuildsPerTeam[team]++;
    const flow=makeFlow(this.width,this.height,ninja?this.ninjaWalkable:this.walkable,goals);
    this._enemyPursuitFlows.delete(key);
    this._enemyPursuitFlows.set(key,{flow,createdAt:this.time});
    while(this._enemyPursuitFlows.size>12)
      this._enemyPursuitFlows.delete(this._enemyPursuitFlows.keys().next().value);
    return flow;
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

  /**
   * Place a squad ONLY before the first simulation tick. Applies to both
   * main thread and Worker with the same deterministic free-cell search.
   * No teleporting after combat begins; the rear bank and existing terrain
   * collision map remain authoritative.
   */
  deploySquadBeforeBattle(squadId,x,z,team=0){
    if(this.battleStarted||![0,1].includes(team)||!Number.isInteger(x)||
      !Number.isInteger(z)||!this._inside(x,z))return false;
    const members=this.units.filter(u=>u.team===team&&String(u.squadId)===String(squadId)&&u.alive);
    if(!members.length||members.length>this.width*this.height)return false;
    const midX=this.riverXAt(z),side=team===0?-1:1;
    if((x-midX)*side<9)return false;
    const occupied=new Set(this.units.filter(u=>u.alive&&!members.includes(u))
      .map(u=>u.z*this.width+u.x));
    const objects=this.objects.filter(o=>o.alive&&o.blocking&&o.mountedBy==null);
    const blocked=(cx,cz)=>{
      if(!this._inside(cx,cz)||!this._walkable(cx,cz)||occupied.has(cz*this.width+cx)||
         (cx-this.riverXAt(cz))*side<9)return true;
      return objects.some(o=>o.bounds?cx>=o.bounds.minX&&cx<=o.bounds.maxX&&
        cz>=o.bounds.minZ&&cz<=o.bounds.maxZ:
        Math.round(o.x)===cx&&Math.round(o.z)===cz);
    };
    const slots=[];
    // Keep every unit on a distinct legal cell in a bounded formation ring.
    // The centre click is the formation anchor, not a 100-soldier stack.
    for(let radius=0;radius<=Math.max(24,Math.ceil(Math.sqrt(members.length))*3)&&
      slots.length<members.length;radius++){
      for(let dz=-radius;dz<=radius&&slots.length<members.length;dz++)
        for(let dx=-radius;dx<=radius&&slots.length<members.length;dx++){
          if(Math.max(Math.abs(dx),Math.abs(dz))!==radius)continue;
          const cx=x+dx,cz=z+dz;
          if(blocked(cx,cz))continue;
          slots.push({x:cx,z:cz});occupied.add(cz*this.width+cx);
        }
    }
    if(slots.length!==members.length)return false;
    members.forEach((u,i)=>{
      const cell=slots[i];u.x=cell.x;u.z=cell.z;
      u.fromX=cell.x;u.fromZ=cell.z;
      u.vx=u.vz=0;u.moveElapsed=u.moveDuration=0;u.blockedTicks=0;
      const mount=this.objects.find(o=>o.alive&&o.mountedBy===u.id);
      if(mount){mount.x=cell.x;mount.z=cell.z;}
    });
    this._occupiedTouched.length=0;this._occupancy.fill(-1);
    return true;
  }

  setSquadDestination(squadId,x,z){
    const id=String(squadId);
    if(!this.units?.some(u=>u.team===0&&String(u.squadId)===id))return false;
    if(!Number.isInteger(x)||!Number.isInteger(z)||!this._walkable(x,z))return false;
    this.squadHealTargets.delete(id);this.squadMissions.delete(id);
    this.autoStrategySquads.delete(id);
    this.clearSquadExploration(id,0);
    this._cancelSquadHighGround(id,0);
    this.squadDestinations.set(id,{x,z});this.squadCommands.set(id,'move');this._rebuildSquadFlows();return true;
  }
  clearSquadDestination(squadId){
    const id=String(squadId);
    this.autoStrategySquads.delete(id);
    this.squadDestinations.delete(id);this.squadFlows.delete(id);this.squadCommands.delete(id);
    this.squadHealTargets.delete(id);this.squadMissions.delete(id);
  }
  /** Choose a real profession mix by moving existing soldiers into the
   *  chosen squad slots; identity, mesh costume and HP are preserved. */
  setSquadFormationTypes(types,team=0,assignedSlots=null,jobSnapshots=null){
    if(this.battleStarted||![0,1].includes(team)||!types)return false;
    const squads=this.formations[team];
    for(const squad of squads){
      const selected=types[String(squad.id)];
      if(!FORMATION_TYPES.includes(selected))return false;
    }
    if(Array.isArray(jobSnapshots)){
      for(const entry of jobSnapshots){
        const unit=this.units[entry.id],job=JOBS[entry.jobIndex];
        if(!unit||unit.team!==team||unit.isStrategist||!job)continue;
        unit.jobIndex=entry.jobIndex;unit.jobId=job.id;
        if(entry.maxHp>0&&Number.isFinite(entry.maxHp)){
          unit.maxHp=entry.maxHp;unit.hp=Math.min(unit.maxHp,Math.max(0,entry.hp??unit.maxHp));
        }
      }
    }
    const planned=assignedSlots?{assignments:assignedSlots,
      summaries:recomposeSquadAssignments(this.units,types,team).summaries}:
      recomposeSquadAssignments(this.units,types,team);
    if(!applySquadRecomposition(this.units,planned,{team}))return false;
    for(const squad of squads){
      const type=types[String(squad.id)];
      squad.type=type;
      for(const general of this.units)if(general.team===team&&general.isStrategist&&general.squadId===squad.id)
        general.formationType=type;
      squad.advanceDepth=16+({attack:0,balanced:25,support:55}[type]||0);
      if(team===0)this.squadStrategies.set(String(squad.id),type==='support'?'recovery':'eliminate');
    }
    return planned;
  }
  /** The pre-battle assignment respects the squad's practical capabilities. */
  recommendedSquadStrategy(members){
    if(members.some(u=>u.jobId==='priest'))return 'recovery';
    if(members.some(u=>u.jobId==='thief'))return 'environment_prepare';
    if(members.some(u=>u.jobId==='mage'))return 'environment_prepare';
    if(members.some(u=>u.jobId==='ninja'))return 'environment_prepare';
    return 'eliminate';
  }
  setSquadStrategy(squadId,strategy){
    const id=String(squadId);
    if(!this.squadStrategies.has(id)||
       !['eliminate','environment_prepare','recovery'].includes(strategy))return false;
    const remaining=this.units.filter(u=>u.team===0&&u.alive&&!u.isStrategist&&String(u.squadId)===id).length;
    if(this.battleStarted)return false;
    if(remaining<=1&&strategy!=='eliminate')return false;
    this.squadStrategies.set(id,strategy);
    return true;
  }
  _enforceLastSurvivorStrategy(onlySquadId=null){
    for(const [id,mission] of this.squadStrategies){
      if(onlySquadId!==null&&id!==String(onlySquadId))continue;
      const surviving=this.units.filter(u=>u.team===0&&u.alive&&!u.isStrategist&&String(u.squadId)===id).length;
      if(surviving===1&&mission!=='eliminate'){
        this.squadStrategies.set(id,'eliminate');
        if(this.autoStrategySquads.has(id))this.clearSquadDestination(id);
      }
    }
  }

  /** Consumables heal the authoritative simulation, including Worker replicas. */
  healFromItem(unitId,amount){
    const target=this.units.find(unit=>unit.id===Number(unitId));
    if(!target||!target.alive||!(target.hp>0)||!(amount>0)||!Number.isFinite(amount))return false;
    if(this._squadDebuff(target,'heal_block')>=1)return false;
    const gain=Math.min(target.maxHp-target.hp,Math.min(500,Math.round(amount)));
    if(gain<=0)return false;
    target.hp+=gain;
    this.actions.event('skill',{sourceId:target.id,x:target.x,z:target.z,
      targetX:target.x,targetZ:target.z,effect:'heal',animation:'cast',
      skillKind:'item',heal:gain});
    return true;
  }

  /** Explicit summon order for the summoner squad. Real summon objects and MP costs. */
  summonSquadCreature(squadId,team=0){
    const casters=this.units.filter(u=>u.team===team&&String(u.squadId)===String(squadId)&&
      u.alive&&u.hp>0&&!u.isStrategist&&u.jobId==='summoner'&&!this.actions.summonOf(u).length);
    let summoned=0;
    for(const caster of casters){
      const skills=availableCombatSkills('summoner',caster.rarity)
       .filter(skill=>skill.kind==='summon'&&caster.mp>=skill.mp&&
        (!caster._skillNext||(caster._skillNext[skill.id]||0)<=this.actions.time))
       .sort((a,b)=>b.mp-a.mp);
      for(const skill of skills){
       if(this.actions.fireSkill(caster,skill,caster,this.units)){summoned++;break;}
      }
    }
    // One invocation fills all available caster slots, not only the first.
    return summoned>0;
  }
  /** Assign the creature its own battle target in the authoritative grid. */
  commandSquadSummonAttack(squadId,targetSquadId,team=0){
    return this.actions.commandSummonAttack(squadId,targetSquadId,this.units,team);
  }
  /** Refill existing fallen unit slots with carried reserve soldiers.
   * No new GPU actor objects and never more than the squad's authored size.
   */
  reinforceSquadFromReserve(squadId,count,team=0){
    const missing=this.units.filter(u=>u.team===team&&String(u.squadId)===String(squadId)&&
      !u.isStrategist&&(!u.alive||!(u.hp>0)));
    const leader=this.units.find(u=>u.team===team&&String(u.squadId)===String(squadId)&&
      u.alive&&u.hp>0);
    if(!leader||!missing.length)return {added:0};
    const occupancy=new Set(this.units.filter(u=>u.alive&&u.hp>0)
      .map(u=>u.x+':'+u.z));
    let added=0;
    const limit=Math.min(missing.length,Math.max(0,Math.floor(Number(count)||0)));
    for(const u of missing){
      if(added>=limit)break;
      let cell=null;
      for(let radius=1;radius<=6&&!cell;radius++)
       for(let dz=-radius;dz<=radius&&!cell;dz++)
        for(let dx=-radius;dx<=radius&&!cell;dx++){
         const x=leader.x+dx,z=leader.z+dz;
         if(Math.max(Math.abs(dx),Math.abs(dz))!==radius||
           !Number.isInteger(x)||!Number.isInteger(z)||
           !this._walkable(x,z)||occupancy.has(x+':'+z))continue;
         cell={x,z};
        }
      if(!cell)break;
      occupancy.add(cell.x+':'+cell.z);
      Object.assign(u,{x:cell.x,z:cell.z,fromX:cell.x,fromZ:cell.z,
       hp:u.maxHp,alive:true,deathAt:-1,deathX:cell.x,deathZ:cell.z,
       cooldown:1,action:'idle',hitFlash:0,moveElapsed:0,moveDuration:0,
       tacticalOrder:null,tacticalOrderUntil:0,highGroundRouteIndex:-1});
      added++;
    }
    return {added};
  }
  /** Restores MP to living members of a single physical squad, with a finite per-person cap. */
  restoreSquadMp(squadId,amount=35,team=0){
    let restored=0;
    for(const unit of this.units){
      if(unit.team!==team||String(unit.squadId)!==String(squadId)||!unit.alive||unit.hp<=0)continue;
      const current=Number(unit.mp)||0,max=Number(unit.maxMp)||0;
      const gain=Math.max(0,Math.min(Math.max(0,Number(amount)||0),max-current));
      if(gain){unit.mp=current+gain;restored+=gain;}
    }
    return restored;
  }
  /** Antidote clears active squad debuffs without changing beneficial rally buffs. */
  cleanseSquad(squadId,team=0){
    return this.squadDebuffs.delete(team+':'+String(squadId));
  }
  /** Same capped healing budget in the Worker and main-thread mirrors. */
  healSquadFromItem(squadId,totalHp,team=0){
    if(this._squadDebuff({team,squadId},'heal_block')>=1)return false;
    return applySquadHeal(this.units,squadId,totalHp,{team});
  }
  /** Per-squad buff effects run in the authoritative AI, not just as UI labels. */
  applySquadItemBuff(squadId,itemId,buff,duration,team=0){
    const id=String(squadId);
    if(!this.units.some(u=>u.team===team&&String(u.squadId)===id&&u.alive&&u.hp>0))return false;
    if(this._squadDebuff({team,squadId:id},'buff_block')>=1)return false;
    const values={attack:Math.min(.5,Math.max(0,Number(buff?.attack)||0)),
      defense:Math.min(.4,Math.max(0,Number(buff?.defense)||0)),
      speed:Math.min(.6,Math.max(0,Number(buff?.speed)||0))};
    if(!(values.attack||values.defense||values.speed)||!(Number(duration)>0))return false;
    const store=team===0?this.squadItemBuffs:this.enemySquadItemBuffs;
    const current=(store.get(id)||[]).filter(x=>x.until>this.time&&x.itemId!==itemId);
    current.push({itemId,...values,until:this.time+Math.min(120,Number(duration))});
    store.set(id,current);
    return true;
  }
  /** Three pre-battle strategies; four tactical orders remain independent. */
  setStrategy(strategy){
    if(!['eliminate','environment_prepare','recovery'].includes(strategy))return false;
    if(this.strategy===strategy)return true;
    for(const id of [...this.autoStrategySquads])this.clearSquadDestination(id);
    this.autoStrategySquads.clear();
    this.strategy=strategy;
    return true;
  }

  _applyGlobalStrategy(){
    this._enforceLastSurvivorStrategy();
    if([...this.squadStrategies.values()].includes('recovery')){
      const freeSupport=[...new Set(this.units.filter(u=>u.team===0&&u.alive&&!u.isStrategist&&
        u.jobId==='priest'&&u.formationType==='support'&&
        !this.squadCommands.has(String(u.squadId))&&
        this.squadStrategies.get(String(u.squadId))==='recovery').map(u=>String(u.squadId)))];
      if(freeSupport.length){
      const injured=this.units.filter(u=>u.team===0&&u.alive&&u.maxHp>0&&u.hp/u.maxHp<.72)
        .sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp);
      for(const patient of injured){
        const response=this.requestSquadHealing(patient.squadId,freeSupport[0]);
        if(response){this.autoStrategySquads.add(response.supportId);break;}
      }
      }
    }
    if([...this.squadStrategies.values()].includes('environment_prepare')){
      // One thief can strengthen friendly gates or open enemy locks. All
      // attempts share the real door collision/lock-level state.
      const thieves=this.units.filter(u=>u.team===0&&u.alive&&u.jobId==='thief'&&
        this.squadStrategies.get(String(u.squadId))==='environment_prepare'&&
        !this.squadCommands.has(String(u.squadId)));
      for(const u of thieves){
        const gates=this.objects.filter(o=>o.alive&&o.type==='door'&&
          ((o.team===0&&o.lockLevel<5)||
           (o.team===1&&o.locked&&o.lockLevel<=(u.rarity==='UR'?5:u.rarity==='R'?3:1))))
          .sort((a,b)=>(a.x-u.x)**2+(a.z-u.z)**2-(b.x-u.x)**2-(b.z-u.z)**2);
        for(const door of gates){
          if((door.x-u.x)**2+(door.z-u.z)**2>50**2)continue;
          const mission=door.team===0?'fortify_lock':'unlock_door';
          if(this.setSquadMission(u.squadId,mission,{targetId:door.id,x:door.x,z:door.z})){
            this.autoStrategySquads.add(String(u.squadId));return;
          }
        }
      }
      // Recovery remains a dedicated strategy, but environmental-maintenance
      // teams with a priest can also heal wounded troops before repairs.
      for(const u of this.units){
        if(!u.alive||u.team!==0||u.isStrategist||u.jobId!=='priest'||
          this.squadStrategies.get(String(u.squadId))!=='environment_prepare'||
          this.squadCommands.has(String(u.squadId)))continue;
        const patient=this.units.filter(v=>v.team===0&&v.alive&&v.hp<v.maxHp*.65)
          .sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp)[0];
        if(patient&&this.requestSquadHealing(patient.squadId,u.squadId)){
          this.autoStrategySquads.add(String(u.squadId));return;
        }
      }
      // Restoration never revives collapsed geometry (which needs remeshing).
      const structures=this.objects.filter(o=>o.alive&&o.category==='structure'&&
        this.territoryAt(o.x,o.z)==='blue'&&
        (o.hp<o.maxHp||o.burningUntil>this.actions.time));
      if(structures.length){
      const members=this.units.filter(u=>u.team===0&&u.alive&&
        ['mage','ninja'].includes(u.jobId)&&!this.squadCommands.has(String(u.squadId))&&
        this.squadStrategies.get(String(u.squadId))==='environment_prepare');
      const visited=new Set();
      for(const unit of members){
        const id=String(unit.squadId);
        if(visited.has(id))continue;
        visited.add(id);
        const candidates=structures.map(o=>({o,d:(o.x-unit.x)**2+(o.z-unit.z)**2}))
          .filter(candidate=>candidate.d<50*50).sort((a,b)=>{
            const aBurn=a.o.burningUntil>this.actions.time&&unit.jobId==='mage';
            const bBurn=b.o.burningUntil>this.actions.time&&unit.jobId==='mage';
            return Number(bBurn)-Number(aBurn)||a.d-b.d;
          });
        for(const {o} of candidates){
          const type=o.burningUntil>this.actions.time&&unit.jobId==='mage'
            ?'extinguish_fire':'repair_structure';
          if(o.hp>=o.maxHp&&type==='repair_structure')continue;
          if(this.setSquadMission(id,type,{x:o.x,z:o.z,targetId:o.id})){
            this.autoStrategySquads.add(id);return;
          }
        }
      }
      }
    }
    if(![...this.squadStrategies.values()].includes('environment_prepare'))return;
    // Initial fixed "environment preparation" is territory-aware:
    // BLUE home base: extinguish fires with water, repair damaged structures;
    // RED opposing base: mages ignite hostile trees/buildings, ninjas may
    // demolish obstructions; NEUTRAL corridor: never auto-start a fire.
    // Structure ownership overrides geographic position when available.
    const structures=this.objects.filter(o=>o.alive&&o.category==='structure'&&
      (o.type==='tree'||o.type==='building')&&o.team!==0&&
      this.territoryAt(o.x,o.z)==='red');
    if(!structures.length)return;
    const ready=new Set(this.units.filter(u=>u.team===0&&u.alive&&['mage','ninja'].includes(u.jobId)&&
      !this.squadCommands.has(String(u.squadId))&&
      this.squadStrategies.get(String(u.squadId))==='environment_prepare').map(u=>String(u.squadId)));
    for(const id of ready){
      const members=this.units.filter(u=>u.team===0&&u.alive&&String(u.squadId)===id);
      const mage=members.find(u=>u.jobId==='mage'&&u.mp>=6);
      const ninja=members.find(u=>u.jobId==='ninja');
      const operative=mage||ninja;
      if(!operative)continue;
      const ordered=structures.map(o=>({o,d:(o.x-operative.x)**2+(o.z-operative.z)**2}))
        .filter(pair=>pair.d<45*45&&
          // A burning hostile structure already satisfies the objective:
          // do not waste another spell re-igniting it.
          (operative.jobId==='ninja'||pair.o.burningUntil<=this.actions.time))
        .sort((a,b)=>a.d-b.d);
      for(const {o} of ordered){
        const type=operative.jobId==='ninja'?'demolish_structure':
          o.type==='tree'?'burn_tree':'burn_building';
        if(this.setSquadMission(id,type,{x:o.x,z:o.z,targetId:o.id})){
          this.autoStrategySquads.add(id);
          return;
        }
      }
    }
  }

  /** Both armies follow navigable routes to selected building loot. */
  setSquadExploration(squadId,buildingId,x,z,team=0){
    const id=String(squadId),side=Number(team),key=side+':'+id;
    if(![0,1].includes(side)||!buildingId||
      !this.units.some(u=>u.team===side&&String(u.squadId)===id&&u.alive))return false;
    if(!Number.isInteger(x)||!Number.isInteger(z)||!this._inside(x,z))return false;
    // The loot can be 10+ tiles inside a large castle. The old +/-5
    // search rejected otherwise valid distant exploration orders outright.
    // Look for a genuinely reachable entrance, independent of army distance.
    const members=this.units.filter(u=>u.team===side&&String(u.squadId)===id&&u.alive);
    const nearX=members.reduce((n,u)=>n+u.x,0)/members.length;
    const nearZ=members.reduce((n,u)=>n+u.z,0)/members.length;
    const candidates=[];
    for(let dz=-28;dz<=28;dz++)for(let dx=-28;dx<=28;dx++){
      const tx=x+dx,tz=z+dz;
      if(!this._walkable(tx,tz))continue;
      const distance=dx*dx+dz*dz;
      // For equally close entrances, prefer the side of the building where
      // the squad is actually standing; do not turn distant orders into a
      // hidden hard range restriction.
      const approach=Math.hypot(tx-nearX,tz-nearZ);
      candidates.push({x:tx,z:tz,score:distance+.2*approach});
    }
    candidates.sort((a,b)=>a.score-b.score);
    let goal=null,flows=null,attempts=0;
    const directions=new Set();
    for(const candidate of candidates){
      const dx=candidate.x-x,dz=candidate.z-z;
      const direction=Math.round(Math.atan2(dz,dx)*8/Math.PI);
      if(directions.has(direction))continue;
      directions.add(direction);
      const goals=[];
      for(let oz=-2;oz<=2;oz++)for(let ox=-2;ox<=2;ox++){
        const gx=candidate.x+ox,gz=candidate.z+oz;
        if(ox*ox+oz*oz<=4&&this._walkable(gx,gz))goals.push({x:gx,z:gz});
      }
      if(!goals.length)continue;
      const regular=makeFlow(this.width,this.height,this.walkable,goals);
      const ninja=makeFlow(this.width,this.height,this.ninjaWalkable,goals);
      const reachable=members.some(u=>{
        if(!this._inside(u.x,u.z))return false;
        const steps=(u.jobId==='ninja'?ninja:regular)[u.z*this.width+u.x];
        return steps<0x3fffffff;
      });
      if(reachable){goal=candidate;flows={regular,ninja};break;}
      if(++attempts>=12)break;
    }
    if(!goal)return false;
    this.explorationOrders.set(key,{buildingId,x:goal.x,z:goal.z});
    this.explorationFlows.set(key,flows);
    for(const u of this.units)if(u.team===side&&String(u.squadId)===id){u.tacticalOrder=null;u.tacticalOrderUntil=0;}
    (side===0?this.squadCommands:this.enemySquadCommands).set(id,'explore');
    if(side===0){
      this.squadDestinations.delete(id);this.squadFlows.delete(id);
      this.squadHealTargets.delete(id);this.squadMissions.delete(id);this.autoStrategySquads.delete(id);
    }
    return true;
  }
  clearSquadExploration(squadId,team=0){
    const key=team+':'+String(squadId);
    this.explorationOrders.delete(key);this.explorationFlows.delete(key);
  }
  /** Targeted, time-limited force suppression. Shared by all units of the enemy squad. */
  applySquadDebuff(squadId,stat,amount,duration=20,team=1){
    const id=String(squadId),key=team+':'+id;
    if(!['attack','defense','speed','heal_block','buff_block'].includes(stat)||!Number.isFinite(amount)||amount<=0||
      !this.units.some(u=>u.team===team&&String(u.squadId)===id&&u.alive))return false;
    const existing=this.squadDebuffs.get(key)||{};
    this.squadDebuffs.set(key,{...existing,[stat]:Math.min(stat.endsWith('_block')?1:.4,Math.max(existing[stat]||0,amount)),
     until:Math.max(existing.until||0,this.time+Math.max(1,Math.min(45,duration)))});
    return true;
  }
  _squadDebuff(unit,stat){
    if(!unit)return 0;
    const value=this.squadDebuffs.get(unit.team+':'+String(unit.squadId));
    return value?.until>this.time?value[stat]||0:0;
  }
  _debuffDamage(attacker,defender,damage){
    const reduced=1-this._squadDebuff(attacker,'attack');
    const exposed=1+this._squadDebuff(defender,'defense');
    return Math.max(1,Math.round(damage*reduced*exposed));
  }
  /** Shield squad intercepts attacks against a nominated allied squad.
   * Persist this order in the simulation (including Worker), not just in UI. */
  assignShieldCover(squadId,targetSquadId,team=0){
    const guards=this.units.filter(u=>u.team===team&&u.alive&&u.hp>0&&
      String(u.squadId)===String(squadId)&&u.jobId==='shield');
    const protectedAlive=this.units.some(u=>u.team===team&&u.alive&&u.hp>0&&
      String(u.squadId)===String(targetSquadId));
    if(!guards.length||!protectedAlive)return false;
    for(const guard of guards){
      guard.guardCoverTargetSquadId=String(targetSquadId);
      guard.guardCoverUntil=this.actions.time+60;
    }
    return true;
  }
  setSquadCommand(squadId,command,team=0){
    const id=String(squadId);
    if(!['charge','defend','hold','retreat'].includes(command)||!this.units.some(u=>u.team===team&&String(u.squadId)===id))return false;
    for(const u of this.units)if(u.team===team&&String(u.squadId)===id){u.tacticalOrder=null;u.tacticalOrderUntil=0;}
    this._cancelSquadHighGround(id,team);
    this.clearSquadExploration(id,team);
    if(team===0){
      this.autoStrategySquads.delete(id);
      this.squadDestinations.delete(id);this.squadFlows.delete(id);this.squadCommands.set(id,command);
      this.squadHealTargets.delete(id);this.squadMissions.delete(id);
    }else this.enemySquadCommands.set(id,command);
    return true;
  }

  /** Explicit resurrection has an authoritative HP/MP and Worker outcome.
   * The UI can first move this entire squad into casting range. */
  reviveSquadTarget(squadId,targetSquadId,team=0){
    const members=this.units.filter(u=>u.team===team&&String(u.squadId)===String(squadId)&&
      u.alive&&u.hp>0&&!u.isStrategist&&u.jobId==='priest');
    const fallen=this.units.filter(u=>u.team===team&&String(u.squadId)===String(targetSquadId)&&
      (!u.alive||u.hp<=0));
    for(const caster of members){
      const spells=availableCombatSkills('priest',caster.rarity)
        .filter(spell=>spell.kind==='revive'&&caster.mp>=spell.mp)
        .sort((a,b)=>b.hpPercent-a.hpPercent);
      for(const spell of spells){
        const victim=fallen.find(u=>Math.hypot(u.x-caster.x,u.z-caster.z)<=spell.range);
        if(!victim)continue;
        const liveBefore=this.live[team];
        if(!this.actions.fireSkill(caster,spell,victim,this.units))continue;
        // onRevive is attached during step(); before the first tick there
        // is no event callback, so keep the actual alive counter correct.
        if(this.live[team]===liveBefore)this.live[team]++;
        return true;
      }
    }
    return false;
  }
  requestSquadHealing(targetSquadId,preferredSupportId=null){
    const targetId=String(targetSquadId);
    const wounded=this.units.filter(u=>u.alive&&u.team===0&&String(u.squadId)===targetId&&u.hp<u.maxHp&&this._squadDebuff(u,'heal_block')<1);
    if(!wounded.length)return null;
    const candidateSupportIds=[...new Set(this.units.filter(u=>u.alive&&!u.isStrategist&&u.team===0&&u.jobId==='priest'&&
      (u.formationType==='support'||(preferredSupportId!=null&&String(u.squadId)===String(preferredSupportId))))
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
    if(!['destroy_bridge','burn_tree','burn_building','eliminate_squad','eliminate_commander','unlock_door','fortify_lock',
      'repair_structure','extinguish_fire','demolish_structure','break_structure'].includes(type)||
      !this.units.some(u=>u.team===0&&u.alive&&String(u.squadId)===id))return false;
    if(!Number.isInteger(target?.x)||!Number.isInteger(target?.z)||!this._inside(target.x,target.z))return false;
    const qualified=this.units.filter(u=>u.team===0&&u.alive&&String(u.squadId)===id);
    if((type.startsWith('burn_')||type==='extinguish_fire')&&!qualified.some(u=>u.jobId==='mage'))return false;
    if(type==='repair_structure'&&!qualified.some(u=>['mage','ninja'].includes(u.jobId)))return false;
    if(type==='demolish_structure'&&!qualified.some(u=>u.jobId==='ninja'))return false;
    if(type==='break_structure'&&!qualified.some(u=>['mage','summoner'].includes(u.jobId)))return false;
    if(['unlock_door','fortify_lock'].includes(type)&&!qualified.some(u=>u.jobId==='thief'))return false;
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
      if(!structure||(!['repair_structure','extinguish_fire','demolish_structure','unlock_door','fortify_lock'].includes(type)&&
        structure.type!==(type==='destroy_bridge'?'bridge':type==='burn_tree'?'tree':'building')))return false;
      if(['unlock_door','fortify_lock'].includes(type)){
        if(structure.type!=='door')return false;
        if(type==='fortify_lock'&&(structure.team!==0||structure.lockLevel>=5))return false;
        if(type==='unlock_door'&&(structure.team!==1||!structure.locked))return false;
      }
      if(type==='repair_structure'&&structure.hp>=structure.maxHp)return false;
      if(type==='extinguish_fire'&&!(structure.burningUntil>this.actions.time))return false;
      point=this._missionApproach(id,structure);
      if(!point)return false;
    }
    this.autoStrategySquads.delete(id);
    this.clearSquadExploration(id,0);
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
      }else if(
        !this.actions.objects.some(o=>o.id===mission.targetId&&o.alive)||
        (mission.type==='repair_structure'&&this.actions.objects.some(o=>o.id===mission.targetId&&o.hp>=o.maxHp))||
        (mission.type==='extinguish_fire'&&this.actions.objects.some(o=>o.id===mission.targetId&&o.burningUntil<=this.actions.time))||
        (mission.type==='fortify_lock'&&this.actions.objects.some(o=>o.id===mission.targetId&&o.lockLevel>=5))||
        (mission.type==='unlock_door'&&this.actions.objects.some(o=>o.id===mission.targetId&&!o.locked))
      ){
        this.clearSquadDestination(id);changed=true;
      }
    }
    if(changed)this._rebuildSquadFlows();
  }

  /** 橋が破壊された場合も、同じ通行判定で経路を更新できる。 */
  updateWalkable(next){
    if(!(next instanceof Uint8Array)||next.length!==this.walkable.length)throw Error('通行可能マップが不正です');
    this.walkable=next;this.actions.walkable=next;this._buildFlows();
    // Destructible bridges/stairs can invalidate a cached exploration route.
    // Rebuild at terrain revisions, never on each frame or each soldier.
    for(const [key,task] of [...this.explorationOrders]){
      const separator=key.indexOf(':'),team=Number(key.slice(0,separator)),id=key.slice(separator+1);
      if(!this.setSquadExploration(id,task.buildingId,task.x,task.z,team))
        this.clearSquadExploration(id,team);
    }
  }
  updateOpaque(next){
    if(!(next instanceof Uint8Array)||next.length!==this.opaque.length)throw Error('遮蔽マップが不正です');
    this.opaque=next;
    this._pursuitFlows.clear();this._enemyPursuitFlows.clear();
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
    // A corpse stays visible for the death animation but immediately frees
    // its collision footprint, including the interpolated departure cell.
    // This also applies to killAtCells() outside the regular AI step.
    const occupied=this._occupancy;
    for(const [x,z] of [[u.x,u.z],[u.fromX,u.fromZ]]){
      const tile=z*this.width+x;
      if(occupied[tile]===u.id)occupied[tile]=-1;
    }
    if(u.highGroundRouteIndex>=0){
      const route=this.highGroundRoutes[u.highGroundRouteIndex];
      this._releaseHighGroundClaimIfEmpty(u,route);
    }
    if(u.team===0&&!u.isStrategist)this._enforceLastSurvivorStrategy(u.squadId);
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
    this._pursuitBuildsThisTick=0;this._enemyBuildsPerTeam.fill(0);
    if(this.tickCount%30===0){
      this._refreshSquadObjectives();this._applyGlobalStrategy();
      this._assignHighGroundUnits();this._assignUpperFloorPursuits();
    }
    this.battleStarted=true;
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
      // Upper-floor soldiers no longer occupy a ground-floor collision tile.
      // Their physical coordinates are controlled by real 3D stair waypoints.
      // Otherwise one soldier would permanently block every following squadmate.
      if(u.highGroundPhase===0){
        reserve(u.z*this.width+u.x,u.id);
        // The departure tile remains reserved until the grid stride clears it.
        if(u.moveElapsed<u.moveDuration)reserve(u.fromZ*this.width+u.fromX,u.id);
      }
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
    // Cache the currently alive rear-row commander once per team/squad.
    // O(N), not O(N x commanders), so 1000-vs-1000 remains affordable.
    const strategistBySquad=new Map();
    for(const commander of this.units)if(commander.alive&&commander.isStrategist)
      strategistBySquad.set(commander.team+':'+commander.squadId,commander);
    for(const store of [this.squadItemBuffs,this.enemySquadItemBuffs])for(const [id,buffs] of store){
      const active=buffs.filter(buff=>buff.until>this.time);
      if(active.length)store.set(id,active);
      else store.delete(id);
    }
    for(const soldier of this.units){
      const store=soldier.team===0?this.squadItemBuffs:this.enemySquadItemBuffs;
      const active=store.get(String(soldier.squadId))||[];
      soldier.itemAttackBonus=active.reduce((n,b)=>Math.max(n,b.attack),0);
      soldier.itemDefenseBonus=active.reduce((n,b)=>Math.max(n,b.defense),0);
      soldier.itemSpeedMultiplier=1+active.reduce((n,b)=>Math.max(n,b.speed),0);
      const leader=strategistBySquad.get(soldier.team+':'+soldier.squadId);
      const aura=strategistAuraMultipliers(soldier,leader);
      soldier.strategistAttackBonus=aura.attack-1;
      soldier.strategistDefenseMultiplier=aura.defense;
    }
    this.actions.beginTick(dt,this.units,{occupancy:occupied,sectors:this._combatSectors,walkable:this.walkable});
    const formationPosts=new Map();
    for(const u of this.units){
      if(!u.alive||u.formationType!=='highground'||!isHighGroundFiringJob(u.jobId)||u.highGroundRouteIndex<0||u.highGroundManualHold||u.highGroundPhase===3)continue;
      const route=this.highGroundRoutes[u.highGroundRouteIndex];
      if(!route||!this._highGroundRouteAlive(route))continue;
      const key=u.team+':'+String(u.squadId),ready=u.highGroundPhase===2&&u.highGroundFloor>1;
      if(!formationPosts.has(key)||ready&&!formationPosts.get(key).ready)formationPosts.set(key,{route,index:u.highGroundRouteIndex,ready,team:u.team});
    }
    for(const post of formationPosts.values()){
      let best=24*24;
      for(const enemy of this.units){
        if(!enemy.alive||enemy.team===post.team||enemy.highGroundFloor>1)continue;
        const d=(enemy.x-post.route.access.x)**2+(enemy.z-post.route.access.z)**2;
        if(d<best){best=d;post.enemy=enemy;}
      }
    }
    // Dedicated defensive mode: gradually build resistance, regenerate
    // missing HP, and leave true large-area healing to nearby priests.
    // The same update runs inside the worker, independent of rendering.
    for(const u of this.units){
      if(!u.alive)continue;
      const command=(u.tacticalOrderUntil>this.time?u.tacticalOrder:null)||
         (u.team===0?this.squadCommands:this.enemySquadCommands).get(String(u.squadId));
      const defending=(command==='defend'||
        (!command&&(u.order==='defend'||(!u.order&&(this.strategy==='defend'||this.strategy==='recovery')))));
      updateDefensivePosture(u,dt,defending);
    }
    for(const u of this.units){
      if(!u.alive)continue;
      const job=JOBS[u.jobIndex];
      u.cooldown=Math.max(-.1,u.cooldown-dt);u.hitFlash=Math.max(0,u.hitFlash-dt);
      u.attackElapsed=Math.min(99,u.attackElapsed+dt);
      u.phase+=dt*(u.action==='walk'?3.8:.8);
      if(u.highGroundRouteIndex>=0&&this._tickHighGroundUnit(u,dt))continue;
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
          if(!this._walkable(x,z)||occupied[z*this.width+x]!==-1||
            !massDiagonalClear(u.x,u.z,dx,dz,this.width,this.walkable,occupied))continue;
          const cost=Math.hypot(x-targetX,z-targetZ);
          if(cost+.1<best){best=cost;next={x,z};}
        }
        if(next&&!this._prepareMountedEntry(u,next.x,next.z))next=null;
        if(next){
          reserve(next.z*this.width+next.x,u.id);
          u.fromX=u.x;u.fromZ=u.z;u.vx=next.x-u.x;u.vz=next.z-u.z;
          u.facingX=u.vx;u.facingZ=u.vz;u.x=next.x;u.z=next.z;
          const riding=u.mountId&&this.objects.some(o=>o.alive&&o.id===u.mountId&&o.mountedBy===u.id);
          u.moveElapsed=0;u.moveDuration=massStepDuration(STRATEGIST_STATS.speed,u.vx,u.vz,
            {scale:MASS_MOVEMENT_SCALE,mounted:riding?COMBAT_RULES.mountedSpeedMultiplier:1});
          u.action='walk';
        }else{u.action='hold';u.vx=0;u.vz=0;}
        continue;
      }
      const reach=job.range+2,radius=Math.ceil(reach/SECTOR);
      const sx=Math.floor(u.x/SECTOR),sz=Math.floor(u.z/SECTOR);
      const personalOrderActive=u.tacticalOrderUntil>this.time&&Boolean(u.tacticalOrder);
      const mission=u.team===0&&!personalOrderActive?this.squadMissions.get(String(u.squadId)):null;
      const healTarget=u.team===0&&!personalOrderActive?this.squadHealTargets.get(String(u.squadId)):null;
      // Independent medic duty: all formations may rescue injured allies.
      // Scan one tenth of the priests per tick to preserve 1000v1000 FPS;
      // no squad order, original formation or commander command is replaced.
      const usableHeals=u.jobId==='priest'?
        availableCombatSkills('priest',u.rarity).filter(skill=>skill.kind==='heal'&&u.mp>=skill.mp):[];
      const canTriage=usableHeals.length>0&&!mission&&!healTarget&&
        !this.explorationOrders.has(u.team+':'+String(u.squadId));
      if(canTriage&&this.tickCount%10===u.id%10){
        const injured=this.actions.nearby(u.team,u.x,u.z,22)
          .filter(v=>v.id!==u.id&&v.alive&&v.hp>0&&v.maxHp>0&&
            v.hp/v.maxHp<.82&&this._squadDebuff(v,'heal_block')<1)
          .sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp||
            Math.hypot(a.x-u.x,a.z-u.z)-Math.hypot(b.x-u.x,b.z-u.z));
        u._triagePatientId=injured[0]?.id??-1;
      }
      const patient=canTriage?this.units[u._triagePatientId]:null;
      const triageTarget=patient?.alive&&patient.hp>0&&patient.hp/patient.maxHp<.9&&
        Math.hypot(patient.x-u.x,patient.z-u.z)<=24?patient:null;
      u.healTargetSquadId=healTarget??triageTarget?.squadId??null;
      // N rarity heal reaches only four tiles. Never stop an N priest at
      // the seven-tile range used for higher-tier group healing.
      const healingRange=usableHeals.reduce((max,skill)=>Math.max(max,skill.range),0);
      const healingStop=Math.max(2,Math.min(7,healingRange-1));
      const triageNeedsMovement=triageTarget&&
        Math.hypot(triageTarget.x-u.x,triageTarget.z-u.z)>healingStop;
      // An explicit squad-healing order is actionable, not merely a move
      // marker. At spell range, priests must cast on the nominated wounded
      // squad before the generic combat AI selects a different target.
      if(u.jobId==='priest'&&healTarget!=null&&!u._pendingCast&&u.cooldown<=0){
        const patient=this.units.filter(v=>v.team===u.team&&v.alive&&v.hp>0&&v.hp<v.maxHp&&
          String(v.squadId)===String(healTarget)&&
          Math.hypot(v.x-u.x,v.z-u.z)<=14)
          .sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp)[0];
        const spells=availableCombatSkills('priest',u.rarity)
          .filter(skill=>skill.kind==='heal'&&u.mp>=skill.mp&&
            (!u._skillNext||(u._skillNext[skill.id]||0)<=this.actions.time)&&
            patient&&Math.hypot(patient.x-u.x,patient.z-u.z)<=skill.range)
          .sort((a,b)=>b.power-a.power);
        if(patient&&spells.some(spell=>{
          if(!this.actions.fireSkill(u,spell,patient,this.units))return false;
          u.cooldown=Math.max(1,spell.cooldown);return true;
        })){
          u.vx=0;u.vz=0;u.action='skill';continue;
        }
      }
      let nearest=null,best=reach*reach,missionNearest=null,missionBest=reach*reach;
      let hiddenEnemy=null,hiddenDistance=reach*reach;
      // The previous scan chose a blocked, nearest enemy then discarded it.
      // A second VISIBLE enemy at arm's reach was never considered. Evaluate
      // visibility during the existing sector scan, not after selection.
      for(let dx=-radius;dx<=radius;dx++)for(let dz=-radius;dz<=radius;dz++){
        const cx=sx+dx,cz=sz+dz;
        if(cx<0||cz<0||cx>=this._sectorCols||cz>=this._sectorRows)continue;
        const sector=cz*this._sectorCols+cx;
        for(let id=heads[sector];id!==-1;id=nextIds[id]){
          const other=this.units[id];
          if(!other.alive||other.team===u.team)continue;
          const d=(other.x-u.x)**2+(other.z-u.z)**2;
          const missionCandidate=(mission?.type==='eliminate_squad'||mission?.type==='eliminate_commander')&&
            String(other.squadId)===mission.targetSquadId&&
            (mission.type!=='eliminate_commander'||other.isStrategist);
          // Once a visible target is found, avoid tracing line-of-sight to
          // every farther opponent in a 2000-soldier firefight.
          if(d>=best&&(!missionCandidate||d>=missionBest)&&
             (nearest!==null||d>=hiddenDistance))continue;
          if(!this._canSee(u,other)){
            if(d<hiddenDistance){hiddenDistance=d;hiddenEnemy=other;}
            continue;
          }
          if(d<best){best=d;nearest=other;}
          if(missionCandidate&&d<missionBest){missionBest=d;missionNearest=other;}
        }
      }
      for(const o of this.objects){
        if(!o.alive||o.team===u.team||!['summon','mount'].includes(o.category))continue;
        const d=(o.x-u.x)**2+(o.z-u.z)**2;
        if(d<best&&this._canSee(u,o)){best=d;nearest=o;}
      }
      // A soldier directly beside a living opponent protects itself before
      // following a mission farther away. Mission focus wins outside contact.
      if(missionNearest&&(!nearest||best>4)){nearest=missionNearest;best=missionBest;}
      // Expose the opponent actually acquired by this agent to the command HUD.
      // -1 means no acquired squad (do not misreport the closest squad as a lock).
      u.currentTargetSquadId=nearest?.squadId!=null&&nearest.team!==u.team
        ?Number(nearest.squadId):-1;
      if(nearest){
        u.pursuitMemory={x:nearest.x,z:nearest.z,until:this.time+5};
      }else if(hiddenEnemy){
        u.pursuitMemory={x:hiddenEnemy.x,z:hiddenEnemy.z,until:this.time+5};
      }
      // A mage, priest or summoner must finish their chant before following
      // a structure mission, pursuing a target or launching a normal attack.
      if(u._pendingCast){
        this.actions.tryAutoAction(u,nearest,this.units);
        u.action='skill';u.vx=0;u.vz=0;
        continue;
      }
      if(u.jobId==='shield'&&u.formationType==='highground'&&!personalOrderActive&&!mission&&
         !this.explorationOrders.has(u.team+':'+String(u.squadId))&&
         !(u.team===0&&this.squadDestinations.has(String(u.squadId)))&&
         !['hold','retreat','move'].includes((u.team===0?this.squadCommands:this.enemySquadCommands).get(String(u.squadId)))){
        const post=formationPosts.get(u.team+':'+String(u.squadId));
        if(post){
          const anchor=post.route.access,target=nearest||post.enemy;
          const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
          const intent=highGroundShieldIntent({assigned:true,ready:post.ready,
            anchorDistance:dist(u,anchor),enemyDistance:target?dist(u,target):Infinity,
            enemyAnchorDistance:target?dist(anchor,target):Infinity,
            healthRatio:u.hp/Math.max(1,u.maxHp),luring:u._highGroundLuring});
          u._highGroundLuring=intent.luring;
          if(intent.phase==='return'||intent.phase==='approach'){
            const flow=intent.phase==='return'?this._highGroundFlows[post.index]:this._pursuitFlow(target,u.jobId);
            let next=null,bestFlow=flow?.[u.z*this.width+u.x]??Infinity;
            if(flow)for(const [dx,dz] of NEIGHBORS){
              const x=u.x+dx,z=u.z+dz,index=z*this.width+x;
              if(!this._walkable(x,z,u.jobId)||occupied[index]!==-1||
                 !massDiagonalClear(u.x,u.z,dx,dz,this.width,this.walkable,occupied))continue;
              if(flow[index]<bestFlow){bestFlow=flow[index];next={x,z};}
            }
            if(next&&this._prepareMountedEntry(u,next.x,next.z)){
              reserve(next.z*this.width+next.x,u.id);
              u.fromX=u.x;u.fromZ=u.z;u.vx=next.x-u.x;u.vz=next.z-u.z;
              u.facingX=u.vx;u.facingZ=u.vz;u.x=next.x;u.z=next.z;
              u.moveDuration=massStepDuration(job.speed,u.vx,u.vz,{scale:MASS_MOVEMENT_SCALE});
              u.moveElapsed=0;u.action='walk';continue;
            }
          }
          if(intent.phase!=='fallback'&&(!nearest||best>job.range**2)){
            u.vx=0;u.vz=0;u.action='hold';continue;
          }
        }else u._highGroundLuring=false;
      }
      if(mission&&!['eliminate_squad','eliminate_commander'].includes(mission.type)){
        const structure=this.actions.objects.find(o=>o.alive&&o.id===mission.targetId);
        if(structure){
          const b=structure.bounds||{minX:structure.x,maxX:structure.x,minZ:structure.z,maxZ:structure.z};
          const distance=Math.hypot(Math.max(b.minX-u.x,0,u.x-b.maxX),Math.max(b.minZ-u.z,0,u.z-b.maxZ));
          if(['unlock_door','fortify_lock'].includes(mission.type)){
            if(u.jobId==='thief'&&distance<=3.5&&u.cooldown<=0){
              const success=mission.type==='fortify_lock'
                ?this.actions.reinforceFriendlyDoor(structure.id,u)
                :this.actions.unlockEnemyDoor(structure.id,u);
              if(success){
                this.actions.event('skill',{sourceId:u.id,x:u.x,z:u.z,
                  targetX:structure.x,targetZ:structure.z,effect:'spark',animation:'skill'});
                u.cooldown=Math.max(1,job.interval);
                u.action='skill';u.vx=0;u.vz=0;continue;
              }
            }
          }
          const fire=mission.type.startsWith('burn_');
          const restoring=mission.type==='repair_structure'||mission.type==='extinguish_fire';
          const canAct=['unlock_door','fortify_lock'].includes(mission.type)?false:
            mission.type==='demolish_structure'?u.jobId==='ninja':restoring?(['mage','ninja'].includes(u.jobId)&&
            (mission.type!=='extinguish_fire'||u.jobId==='mage')&&
            (u.jobId!=='mage'||u.mp>=5)):
            fire?u.jobId==='mage'&&u.mp>=6:u.jobId!=='priest';
          const range=mission.type==='demolish_structure'?2.2:restoring?(u.jobId==='mage'?Math.min(8,job.range):2.2):
            fire?Math.min(8,job.range):u.jobId==='archer'?6:2.2;
          if(canAct&&distance<=range&&u.cooldown<=0){
            let performed=true;
            if(restoring){
              performed=mission.type==='extinguish_fire'
                ?this.actions.extinguishStructure(structure.id)
                :this.actions.repairStructure(structure.id,u.jobId==='ninja'?16:24)>0;
            }else this.actions.damageStructures(structure.x,structure.z,.01,fire?15:mission.type==='demolish_structure'?Math.max(24,job.damage*2):Math.max(5,job.damage),fire?'fire':'physical');
            if(performed){
              if(u.jobId==='mage'&&(fire||restoring))u.mp-=fire?6:5;
              this.actions.event('skill',{sourceId:u.id,x:u.x,z:u.z,targetX:structure.x,targetZ:structure.z,
                effect:restoring?(mission.type==='extinguish_fire'?'water':'nature'):fire?'fire':'heavy',
                animation:restoring||fire?'cast':'attack'});
              u.cooldown=Math.max(1,job.interval);u.action='skill';u.vx=0;u.vz=0;continue;
            }
          }
        }
      }
      // Every rarity/job uses the same authoritative actions. Summons and
      // mounts remain separate collision-aware world objects, never soldiers.
      const heightHere=this.elevationMap?.[u.z*this.width+u.x];
      let higherStep=false;
      // No optional high-ground repositioning while an enemy is already
      // in physical contact. This must hold for 100 and 1000 per side.
      const immediateThreat=nearest&&best<=Math.min(4,job.range*job.range);
      if(nearest&&!immediateThreat&&u.formationType==='highground'&&
         this.elevationMap&&isHeightTactician(u.jobId)){
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
          this.actions.damageUnit(nearest,this._debuffDamage(u,nearest,job.damage),u);
          nearest.hitFlash=.2;this.attacks++;
        }
        continue;
      }
      const squadCommand=(u.tacticalOrderUntil>this.time?u.tacticalOrder:null)||
         (u.team===0?this.squadCommands:this.enemySquadCommands).get(String(u.squadId));
      const doctrine=formationCombatIntent({
        formation:u.formationType,jobId:u.jobId,
        command:['charge','defend','hold','retreat'].includes(squadCommand)?squadCommand:
          ['charge','defend','hold','retreat'].includes(u.order)?u.order:null,
        hasEnemies:this.live[1-u.team]>0,
        enemyDistance:nearest?Math.sqrt(best):Infinity,attackRange:job.range,
        healthRatio:u.hp/Math.max(1,u.maxHp)
      });
      const order=doctrine.order;
      // Guard is a stationary posture. Combat was resolved above, so do
      // not wander towards an enemy outside attack range or chase a lost target.
      // Move, exploration and mission commands override the fallback stance.
      const guarding=squadCommand==='hold'||squadCommand==='defend'||
        (!squadCommand&&(order==='hold'||order==='defend'));
      // Approach a visible adjacent threat briefly, but retain the guard order.
      const closeThreat=guarding&&nearest&&shouldCounterNearbyThreat({
       order:'hold',enemyDistance:Math.sqrt(best),attackRange:job.range
      });
      const allyCover=guarding&&order==='defend'&&this.live[1-u.team]>0&&
        this._engagedAllyNear(u,heads,nextIds,10);
      if(guarding&&!triageNeedsMovement&&!closeThreat&&!allyCover){
        u.action='hold';u.vx=0;u.vz=0;u.blockedTicks=0;continue;
      }
      const isNinja=u.jobId==='ninja';
      const defaultFlow=isNinja
        ?(order==='retreat'?(u.team===0?this.ninjaFlowWest:this.ninjaFlowEast):u.team===0?this.ninjaFlowEast:this.ninjaFlowWest)
        :(order==='retreat'?(u.team===0?this.flowWest:this.flowEast):u.team===0?this.flowEast:this.flowWest);
      const exploration=personalOrderActive?null:this.explorationFlows.get(u.team+':'+u.squadId);
      const assigned=order!=='retreat'?(exploration||
        (u.team===0&&!personalOrderActive?this.squadFlows.get(String(u.squadId)):null)):null;
      const assignedFlow=assigned&&(isNinja?assigned.ninja:assigned.regular);
      const cell=u.z*this.width+u.x;
      // If an assigned position becomes unreachable after the last bridge
      // falls, revert to the riverbank flow instead of freezing every soldier.
      const reachable=assignedFlow&&assignedFlow[cell]<0x3fffffff;
      const supporting=squadCommand==='support'&&this.supportFlow[cell]<0x3fffffff;
      const remembered=u.pursuitMemory?.until>=this.time?u.pursuitMemory:null;
      // A completed rally point is not a permanent ceasefire. After reaching
      // the assigned area, active assault squads may resume enemy pursuit.
      // Explicit guard/hold/retreat formations retain their requested position.
      const assignedReached=Boolean(reachable&&assignedFlow[cell]===0);
      const resumeCombat=assignedReached&&!['hold','defend','retreat'].includes(order)&&
        this.live[1-u.team]>0;
      const pursuing=(!reachable||resumeCombat||closeThreat||allyCover)&&!supporting&&order!=='retreat'&&remembered&&
        Math.hypot(u.x-remembered.x,u.z-remembered.z)<26;
      const targetFlow=pursuing?this._pursuitFlow(remembered,u.jobId):null;
      const chaseFlow=targetFlow&&targetFlow[cell]<0x3fffffff?targetFlow:null;
      const missionSquad=mission&&['eliminate_squad','eliminate_commander'].includes(mission.type)?
        mission.targetSquadId:null;
      const enemyFlow=(!reachable||resumeCombat||closeThreat||allyCover)&&!supporting&&order!=='retreat'?
        this._enemyPursuitFlow(u.team,u.jobId,missionSquad):null;
      const globalChase=!chaseFlow&&enemyFlow&&enemyFlow[cell]<0x3fffffff;
      const highRoute=u.highGroundRouteIndex>=0&&u.highGroundPhase===0?
        this.highGroundRoutes[u.highGroundRouteIndex]:null;
      const highFlow=highRoute&&this._highGroundFlows[u.highGroundRouteIndex];
      const healingRoute=triageNeedsMovement?this._pursuitFlow(triageTarget,u.jobId):null;
      const triageFlow=healingRoute&&healingRoute[cell]<0x3fffffff?healingRoute:null;
      const flow=highFlow&&highFlow[cell]<0x3fffffff?highFlow:
        triageFlow|| (reachable&&!allyCover&&!(resumeCombat&&(chaseFlow||globalChase))?assignedFlow:
        supporting?this.supportFlow:chaseFlow||(globalChase?enemyFlow:
        reachable?assignedFlow:defaultFlow));
      if(!highFlow&&reachable&&flow===assignedFlow&&flow[cell]===0&&
         !(order==='charge'&&this.live[1-u.team]>0)){
        u.action='hold';u.vx=0;u.vz=0;continue;
      }
      if(supporting&&!reachable&&flow===this.supportFlow&&flow[cell]===0){u.action='hold';u.vx=0;u.vz=0;continue;}
      const here=flow[u.z*this.width+u.x];
      // The target cell of a BFS is an arrival point, not a patrol loop.
      // Healing, structure missions, exploration and stair routes can still
      // adjust within their separate arrival areas.
      const taskNeedsApproach=Boolean(triageNeedsMovement||mission||highFlow||exploration);
      if(here===0&&!nearest&&!taskNeedsApproach){
        // A front-line/rally field is not a kill target. When opponents
        // survive, request a fresh enemy approach rather than proclaiming
        // arrival and holding outside a castle facade.
        u.action=(order==='charge'&&this.live[1-u.team]>0)?'blocked':'hold';
        u.vx=0;u.vz=0;u.blockedTicks=0;continue;
      }
      let next=null,score=Infinity;
      const preferred=nearest?{x:nearest.x,z:nearest.z}:chaseFlow?remembered:null;
      const squadIndex=u.team*this.squadCount+u.squadId;
      // Maintain a rectangular advance on open terrain. Bridges, walls and
      // enemy contact take precedence, so squads can naturally funnel into
      // columns at chokepoints and re-form on the far side.
      const formationActive=!nearest&&!reachable&&!globalChase&&!triageFlow&&
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
        if(!this._walkable(x,z,u.jobId)||occupied[z*this.width+x]!==-1||
          !massDiagonalClear(u.x,u.z,dx,dz,this.width,isNinja?this.ninjaWalkable:this.walkable,occupied))continue;
        const rawFlow=flow[z*this.width+x];
        // Monotonic BFS progress is required even while an enemy is visible
        // or a mission is active. The previous condition exempted those
        // cases, allowing a 1-cell A->B->A oscillation under congestion.
        // High-ground repositioning remains a separately authorized move.
        if(rawFlow>=here&&!higherStep)continue;
        // Height seeking is the sole exception to monotonic flow. It may
        // override BFS only for a genuinely higher, free, navigable cell;
        // otherwise two neighboring tiles can alternate forever.
        if(rawFlow>=here&&higherStep&&
           (!this.elevationMap||
            this.elevationMap[z*this.width+x]<=heightHere+.2))continue;
        // A 2D detour around a stair core must not alternate between the
        // cell just visited and the current cell every AI tick. Backtracking
        // is valid only when a newly changed goal actually lowers the flow;
        // prolonged congestion is handled by the separate recovery planner.
        if(x===u.fromX&&z===u.fromZ&&rawFlow>=here&&
           (u.blockedTicks||0)<6)continue;
        let cost=rawFlow;
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
        if(u.blockedTicks>=6){
          const goalX=nearest?.x??(chaseFlow?remembered.x:(u.team===0?this.width-8:8));
          const goalZ=nearest?.z??(chaseFlow?remembered.z:u.z);
          const legal=[];
          for(const [dx,dz] of NEIGHBORS){
            const x=u.x+dx,z=u.z+dz,index=z*this.width+x;
            if(!this._walkable(x,z,u.jobId)||occupied[index]!==-1||
              !massDiagonalClear(u.x,u.z,dx,dz,this.width,isNinja?this.ninjaWalkable:this.walkable,occupied))continue;
            const distance=flow[index];
            // If a bridge was destroyed and the old flow is unreachable,
            // use legal adjacent tiles towards the new front instead of
            // holding the same tile forever. Never cross water or another unit.
            if(here<0x3fffffff&&distance>here+2)continue;
            // A side-step is valid only if it has an actual onward exit
            // to a strictly lower-flow cell without crossing back through
            // the soldier's current tile. Otherwise it is a dead-end shuffle
            // and should wait for a living blocker to move away.
            let escape=distance<here;
            if(!escape&&here<0x3fffffff)for(const [ox,oz] of NEIGHBORS){
              const ex=x+ox,ez=z+oz,ei=ez*this.width+ex;
              if((ex===u.x&&ez===u.z)||!this._walkable(ex,ez,u.jobId)||
                 occupied[ei]!==-1||flow[ei]>=here||
                 !massDiagonalClear(x,z,ox,oz,this.width,
                  isNinja?this.ninjaWalkable:this.walkable,occupied))continue;
              escape=true;break;
            }
            legal.push({x,z,flow:distance<0x3fffffff?distance:Infinity,escape});
          }
          next=chooseBlockedMovementDetour({
            x:u.x,z:u.z,goalX,goalZ,
            previousX:u.fromX,previousZ:u.fromZ,neighbors:legal,
            currentFlow:here<0x3fffffff?here:Infinity,
            requireEscape:true
          });
        }
      }
      if(next&&!this._prepareMountedEntry(u,next.x,next.z))next=null;
      if(!next){u.action='blocked';u.vx=0;u.vz=0;continue}
      u.blockedTicks=0;
      reserve(next.z*this.width+next.x,u.id);
      u.fromX=u.x;u.fromZ=u.z;
      u.vx=next.x-u.x;u.vz=next.z-u.z;
      u.facingX=u.vx;u.facingZ=u.vz;
      u.x=next.x;u.z=next.z;
      const multiplier=(order==='charge'?1.3:order==='defend'?.65:1)*(u.itemSpeedMultiplier||1);
      const mounted=u.mountId&&this.objects.some(o=>o.id===u.mountId&&o.alive&&o.mountedBy===u.id);
      if(!mounted)u.mountId=null;
      u.moveDuration=massStepDuration(job.speed*(1-this._squadDebuff(u,'speed')),u.vx,u.vz,{
        scale:MASS_MOVEMENT_SCALE,command:multiplier,formation:squadSpeedFactor(u.formationType),
        mounted:mounted?COMBAT_RULES.mountedSpeedMultiplier:1});
      u.moveElapsed=0;u.action='walk';
      if(!u.crossed&&((u.team===0&&u.x>this.riverXAt(u.z)+7)||(u.team===1&&u.x<this.riverXAt(u.z)-7))){u.crossed=true;this.crossings[u.team]++;}
    }
    // Authority: a ridden creature shares the rider's tile and heading,
    // regardless of whether it has nearby allies. A lone commander must
    // never gallop away while the horse remains at its spawn cell.
    for(const object of this.objects){
      if(!object.alive||object.mountedBy==null)continue;
      const rider=this.units[object.mountedBy];
      if(!rider?.alive||rider.mountId!==object.id){object.mountedBy=null;continue;}
      object.x=rider.x;object.z=rider.z;
      object.facingX=rider.facingX;object.facingZ=rider.facingZ;
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
