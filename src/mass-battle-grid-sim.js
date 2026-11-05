// 実ゲームのマス・橋・建物衝突をそのまま使う大軍シミュレーション。
// 空間索引＋共有フローフィールドで2000体でも全件A*を避ける。
import { JOBS } from './mass-battle-sim.js';
import { CombatActionRuntime } from './combat-action-runtime.js?v=4.4.17';
import { COMBAT_RULES } from './combat-action-spec.js';

const SECTOR = 5;
const NEIGHBORS = [[1,0],[-1,0],[0,1],[0,-1]];
// One deliberate tile step at a time, close to the original 50-vs-50 pace.
// Job speed still matters, but no unit may skip an occupied or impassable tile.
export const MASS_MOVEMENT_SCALE = 0.32;
export const MASS_DEATH_DURATION = 0.85;
const cellKey = (x,z) => x+':'+z;

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
  constructor(sideCount, seed, {width,height,walkable,opaque,bridges,riverXAt}) {
    if(!Number.isInteger(sideCount)||sideCount<1||sideCount>1000)throw RangeError('兵数は1～1000');
    if(!(walkable instanceof Uint8Array)||walkable.length!==width*height)throw Error('通行可能マップが不正です');
    if(!bridges?.length)throw Error('橋の情報がありません');
    this.width=width;this.height=height;
    this.walkable=walkable;
    this.opaque=opaque instanceof Uint8Array&&opaque.length===walkable.length?opaque:new Uint8Array(walkable.length);
    this.bridges=bridges;
    this.riverXAt=riverXAt;
    this.sideCount=sideCount;
    this.seed=seed;
    this.time=0;this.tickCount=0;this.attacks=0;this.lastAiMs=0;
    this.strategy='balanced';
    this.units=[];this.live=[sideCount,sideCount];this.crossings=[0,0];
    this.actions=new CombatActionRuntime({width,height,walkable});
    this.objects=this.actions.objects;
    this.actionEvents=[];
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
      const bridgeIndex=n%bridges.length,bridge=bridges[bridgeIndex];
      const rank=Math.floor(n/bridges.length);
      const column=Math.floor(rank/19),row=rank%19;
      const side=team===0?-1:1;
      const wantedX=bridge.x+side*(17+column*2);
      const wantedZ=bridge.z+(row-9)*2;
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
      if(!position)throw Error('大軍の配置場所が不足: '+team+' / '+n);
      occupied.add(cellKey(position.x,position.z));
      const jobIndex=(n*7+team*3)%JOBS.length,job=JOBS[jobIndex];
      this.units.push({id:team*sideCount+n,team,jobIndex,jobId:job.id,
        rarity:n%13===0?'UR':n%3===0?'R':'N',mp:COMBAT_RULES.maxMp,maxMp:COMBAT_RULES.maxMp,male:rnd()>.48,
        x:position.x,z:position.z,bridgeIndex,hp:job.hp,maxHp:job.hp,
        alive:true,cooldown:rnd()*job.interval,phase:rnd()*6.28,completedSteps:0,
        vx:0,vz:0,fromX:position.x,fromZ:position.z,moveElapsed:0,moveDuration:0,
        facingX:side===-1?1:-1,facingZ:0,hitFlash:0,attackElapsed:99,
        deathAt:-1,deathX:position.x,deathZ:position.z,
        action:'advance',crossed:false});
    }
  }

  _inside(x,z){return x>=0&&z>=0&&x<this.width&&z<this.height}
  _walkable(x,z){return this._inside(x,z)&&this.walkable[z*this.width+x]===1}
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
    const goalsFor=direction=>{
      const goals=[];
      for(const bridge of this.bridges){
        const side=direction===1?1:-1;
        for(let dz=-8;dz<=8;dz++)for(let dx=17;dx<=23;dx++){
          const x=bridge.x+side*dx,z=bridge.z+dz;
          if(this._walkable(x,z))goals.push({x,z});
        }
      }
      return goals;
    };
    this.flowEast=makeFlow(this.width,this.height,this.walkable,goalsFor(1));
    this.flowWest=makeFlow(this.width,this.height,this.walkable,goalsFor(-1));
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
    const occupied=this._occupancy;
    const heads=this._sectorHeads,tails=this._sectorTails,nextIds=this._sectorNext;
    const touched=this._occupiedTouched;
    for(const tile of touched)occupied[tile]=-1;
    touched.length=0;
    const reserve=(tile,id)=>{
      if(occupied[tile]===-1)touched.push(tile);
      occupied[tile]=id;
    };
    heads.fill(-1);tails.fill(-1);
    for(const u of this.units){
      if(!u.alive)continue;
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
      if(!this._walkable(u.x,u.z)||occupied[u.z*this.width+u.x]!==-1)return false;
      this.live[u.team]++;u.deathAt=-1;u.deathX=u.x;u.deathZ=u.z;
      u.fromX=u.x;u.fromZ=u.z;u.moveElapsed=u.moveDuration=0;
      reserve(u.z*this.width+u.x,u.id);return true;
    };
    this.actions.onRelocate=(u,x,z)=>{
      if(!this._walkable(x,z)||occupied[z*this.width+x]!==-1)return false;
      if(occupied[u.z*this.width+u.x]===u.id)occupied[u.z*this.width+u.x]=-1;
      reserve(z*this.width+x,u.id);
      u.fromX=x;u.fromZ=z;u.moveElapsed=u.moveDuration=0;
      return true;
    };
    this.actions.beginTick(dt,this.units,{occupancy:occupied,sectors:this._combatSectors,walkable:this.walkable});
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
      const reach=job.range+2,radius=Math.ceil(reach/SECTOR);
      const sx=Math.floor(u.x/SECTOR),sz=Math.floor(u.z/SECTOR);
      let nearest=null,best=reach*reach;
      for(let dx=-radius;dx<=radius;dx++)for(let dz=-radius;dz<=radius;dz++){
        const cx=sx+dx,cz=sz+dz;
        if(cx<0||cz<0||cx>=this._sectorCols||cz>=this._sectorRows)continue;
        const sector=cz*this._sectorCols+cx;
        for(let id=heads[sector];id!==-1;id=nextIds[id]){
          const other=this.units[id];
          if(!other.alive||other.team===u.team)continue;
          const d=(other.x-u.x)**2+(other.z-u.z)**2;
          if(d<best){best=d;nearest=other}
        }
      }
      for(const o of this.objects){
        if(!o.alive||o.team===u.team||!['summon','mount'].includes(o.category))continue;
        const d=(o.x-u.x)**2+(o.z-u.z)**2;
        if(d<best){best=d;nearest=o;}
      }
      if(nearest&&!this._canSee(u,nearest))nearest=null;
      // Every rarity/job uses the same authoritative actions. Summons and
      // mounts remain separate collision-aware world objects, never soldiers.
      if(u.cooldown<=0&&this.actions.tryAutoAction(u,nearest,this.units)){
        u.cooldown=Math.max(u.cooldown,.35);
        u.vx=0;u.vz=0;
        continue;
      }
      if(job.id==='summoner'&&nearest&&best<=job.range**2){
        u.action='idle';u.vx=0;u.vz=0;continue;
      }
      if(nearest&&best<=job.range**2){
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
      const order=u.team===0?(u.order||this.strategy):'balanced';
      if(order==='hold'&&!nearest){u.action='hold';continue;}
      if(order==='defend'&&u.team===0&&u.x>=this.riverXAt(u.z)-12&&!nearest){u.action='hold';continue;}
      const flow=order==='retreat'&&u.team===0?this.flowWest:u.team===0?this.flowEast:this.flowWest;
      const here=flow[u.z*this.width+u.x];
      let next=null,score=Infinity;
      const preferred=nearest?{x:nearest.x,z:nearest.z}:null;
      for(const [dx,dz] of NEIGHBORS){
        const x=u.x+dx,z=u.z+dz;
        if(!this._walkable(x,z)||occupied[z*this.width+x]!==-1)continue;
        let cost=flow[z*this.width+x];
        if(cost>=0x3fffffff)continue;
        if(preferred){const before=Math.abs(u.x-preferred.x)+Math.abs(u.z-preferred.z),after=Math.abs(x-preferred.x)+Math.abs(z-preferred.z);cost+=(after-before)*.8;}
        const wiggle=((u.id*13+x*31+z*19)%7)*.01;
        cost+=wiggle;
        // 曲がり角の渋滞を避ける。逆走は目標が隣接している場合のみ。
        if(cost<score&&(cost<=here+1.05||nearest)){score=cost;next={x,z};}
      }
      if(!next){u.action='blocked';u.vx=0;u.vz=0;continue}
      reserve(next.z*this.width+next.x,u.id);
      u.fromX=u.x;u.fromZ=u.z;
      u.vx=next.x-u.x;u.vz=next.z-u.z;
      u.facingX=u.vx;u.facingZ=u.vz;
      u.x=next.x;u.z=next.z;
      const multiplier=order==='charge'?1.3:order==='defend'?.65:1;
      const mounted=u.mountId&&this.objects.some(o=>o.id===u.mountId&&o.alive&&o.mountedBy===u.id);
      if(!mounted)u.mountId=null;
      u.moveDuration=1/(job.speed*MASS_MOVEMENT_SCALE*multiplier*(mounted?COMBAT_RULES.mountedSpeedMultiplier:1));
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
    this.actionEvents=this.actions.events.slice();
    this.lastAiMs=(typeof performance!=='undefined'?performance.now():Date.now())-start;
    return this.live;
  }

  getStats(){return {sideCount:this.sideCount,alive:this.live.slice(),total:this.units.length,
    attacks:this.attacks,time:this.time,tickCount:this.tickCount,aiMs:this.lastAiMs,
    bridgeCrossings:this.crossings.slice(),...this.actions.getStats()};}
}
