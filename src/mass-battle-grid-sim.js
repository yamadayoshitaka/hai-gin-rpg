// 実ゲームのマス・橋・建物衝突をそのまま使う大軍シミュレーション。
// 空間索引＋共有フローフィールドで2000体でも全件A*を避ける。
import { JOBS } from './mass-battle-sim.js';

const SECTOR = 5;
const NEIGHBORS = [[1,0],[-1,0],[0,1],[0,-1]];
// One deliberate tile step at a time, close to the original 50-vs-50 pace.
// Job speed still matters, but no unit may skip an occupied or impassable tile.
export const MASS_MOVEMENT_SCALE = 0.32;
const cellKey = (x,z) => x+':'+z;
const sectorKey = (x,z) => Math.floor(x/SECTOR)+':'+Math.floor(z/SECTOR);

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
      this.units.push({id:team*sideCount+n,team,jobIndex,male:rnd()>.48,
        x:position.x,z:position.z,bridgeIndex,hp:job.hp,maxHp:job.hp,
        alive:true,cooldown:rnd()*job.interval,phase:rnd()*6.28,
        vx:0,vz:0,fromX:position.x,fromZ:position.z,moveElapsed:0,moveDuration:0,
        facingX:side===-1?1:-1,facingZ:0,hitFlash:0,attackElapsed:99,
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
    this.walkable=next;this._buildFlows();
  }

  killAtCells(cells){
    for(const u of this.units){
      if(!u.alive||!cells.has(u.x+','+u.z))continue;
      u.alive=false;u.hp=0;u.moveElapsed=u.moveDuration;this.live[u.team]--;
    }
  }

  // Rendering reads a fractional position, but simulation and collisions always
  // use the integer destination tile. alpha=0..1 is the fraction of the next AI tick.
  getRenderCell(u,alpha=0){
    const t=u.moveDuration>0
      ?Math.min(1,(u.moveElapsed+Math.max(0,Math.min(1,alpha))*.1)/u.moveDuration):1;
    return {x:u.fromX+(u.x-u.fromX)*t,z:u.fromZ+(u.z-u.fromZ)*t};
  }

  step(dt=.1){
    const start=typeof performance!=='undefined'?performance.now():Date.now();
    dt=Math.min(Math.max(dt,0),.2);this.time+=dt;this.tickCount++;
    const occupied=new Map(),sectors=new Map();
    for(const u of this.units){
      if(!u.alive)continue;
      occupied.set(cellKey(u.x,u.z),u.id);
      // The departure tile remains reserved until its full walking animation
      // has cleared the cell. This prevents visual overlaps in narrow bridges.
      if(u.moveElapsed<u.moveDuration)occupied.set(cellKey(u.fromX,u.fromZ),u.id);
      const key=sectorKey(u.x,u.z);
      if(!sectors.has(key))sectors.set(key,[]);
      sectors.get(key).push(u);
    }
    for(const u of this.units){
      if(!u.alive)continue;
      const job=JOBS[u.jobIndex];
      u.cooldown=Math.max(-.1,u.cooldown-dt);u.hitFlash=Math.max(0,u.hitFlash-dt);
      u.attackElapsed=Math.min(99,u.attackElapsed+dt);
      u.phase+=dt*(u.action==='walk'?3.8:.8);
      if(u.moveElapsed<u.moveDuration){
        u.moveElapsed=Math.min(u.moveDuration,u.moveElapsed+dt);
        u.action='walk';
        continue;
      }
      const reach=job.range+2,radius=Math.ceil(reach/SECTOR);
      const sx=Math.floor(u.x/SECTOR),sz=Math.floor(u.z/SECTOR);
      let nearest=null,best=reach*reach;
      for(let dx=-radius;dx<=radius;dx++)for(let dz=-radius;dz<=radius;dz++){
        const group=sectors.get((sx+dx)+':'+(sz+dz));if(!group)continue;
        for(const other of group){
          if(!other.alive||other.team===u.team)continue;
          const d=(other.x-u.x)**2+(other.z-u.z)**2;
          if(d<best){best=d;nearest=other}
        }
      }
      if(nearest&&!this._canSee(u,nearest))nearest=null;
      if(nearest&&best<=job.range**2){
        u.action='attack';u.vx=0;u.vz=0;
        u.facingX=Math.sign(nearest.x-u.x)||u.facingX;
        u.facingZ=Math.sign(nearest.z-u.z);
        if(u.cooldown<=0){
          u.cooldown+=job.interval;
          u.attackElapsed=0;
          nearest.hp=Math.max(0,nearest.hp-job.damage);
          nearest.hitFlash=.2;this.attacks++;
          if(!nearest.hp){nearest.alive=false;nearest.moveElapsed=nearest.moveDuration;
            this.live[nearest.team]--;occupied.delete(cellKey(nearest.x,nearest.z))}
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
        if(!this._walkable(x,z)||occupied.has(cellKey(x,z)))continue;
        let cost=flow[z*this.width+x];
        if(cost>=0x3fffffff)continue;
        if(preferred){const before=Math.abs(u.x-preferred.x)+Math.abs(u.z-preferred.z),after=Math.abs(x-preferred.x)+Math.abs(z-preferred.z);cost+=(after-before)*.8;}
        const wiggle=((u.id*13+x*31+z*19)%7)*.01;
        cost+=wiggle;
        // 曲がり角の渋滞を避ける。逆走は目標が隣接している場合のみ。
        if(cost<score&&(cost<=here+1.05||nearest)){score=cost;next={x,z};}
      }
      if(!next){u.action='blocked';u.vx=0;u.vz=0;continue}
      occupied.set(cellKey(next.x,next.z),u.id);
      u.fromX=u.x;u.fromZ=u.z;
      u.vx=next.x-u.x;u.vz=next.z-u.z;
      u.facingX=u.vx;u.facingZ=u.vz;
      u.x=next.x;u.z=next.z;
      const multiplier=order==='charge'?1.3:order==='defend'?.65:1;
      u.moveDuration=1/(job.speed*MASS_MOVEMENT_SCALE*multiplier);
      u.moveElapsed=0;u.action='walk';
      if(!u.crossed&&((u.team===0&&u.x>this.riverXAt(u.z)+7)||(u.team===1&&u.x<this.riverXAt(u.z)-7))){u.crossed=true;this.crossings[u.team]++;}
    }
    this.lastAiMs=(typeof performance!=='undefined'?performance.now():Date.now())-start;
    return this.live;
  }

  getStats(){return {sideCount:this.sideCount,alive:this.live.slice(),total:this.units.length,
    attacks:this.attacks,time:this.time,tickCount:this.tickCount,aiMs:this.lastAiMs,
    bridgeCrossings:this.crossings.slice()};}
}
