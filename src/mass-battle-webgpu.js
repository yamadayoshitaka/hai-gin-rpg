import {JOBS} from './mass-battle-sim.js';
import {MASS_UNIT_FIELDS,MASS_UNIT_STRIDE,applyMassUnits,packMassUnits} from './mass-battle-worker-protocol.js';
import {MASS_MOVEMENT_SCALE} from './mass-battle-grid-sim.js';

const F=Object.fromEntries(MASS_UNIT_FIELDS.map((name,index)=>[name,index]));
const WORKGROUP=64;
const GPU_FREE=0xffffffff;
const ORDER_CODES=Object.freeze({balanced:0,charge:1,defend:2,hold:3,retreat:4});

// WebGPU's compute backend for large grid battles. No simplified characters:
// Three.js keeps drawing the exact textured/animated crowd via WebGL.
// All per-tick target selection, attack damage, move proposals, tile arbitration
// and death state are computed in parallel on GPU storage buffers.
export const MASS_WEBGPU_SHADER=`
struct Floats { data: array<f32> };
struct Uints { data: array<u32> };
struct Atomics { data: array<atomic<u32>> };
struct Jobs { data: array<vec4<f32>> };
struct Params {
  width:u32, height:u32, count:u32, strategy:u32,
  time:f32, dt:f32, sideCount:u32, reserved:u32,
};
@group(0) @binding(0) var<storage,read> original: Floats;
@group(0) @binding(1) var<storage,read_write> updated: Floats;
@group(0) @binding(2) var<storage,read> terrain: Uints;
@group(0) @binding(3) var<storage,read_write> scratch: Atomics;
@group(0) @binding(4) var<storage,read> jobs: Jobs;
@group(0) @binding(5) var<uniform> params: Params;
const STRIDE:u32=${MASS_UNIT_STRIDE}u;
${MASS_UNIT_FIELDS.map((name,index)=>`const F_${name.toUpperCase()}:u32=${index}u;`).join('\n')}
const FREE:u32=0xffffffffu;
fn cells()->u32{return params.width*params.height;}
fn val(id:u32,field:u32)->f32{return original.data[id*STRIDE+field];}
fn setval(id:u32,field:u32,value:f32){updated.data[id*STRIDE+field]=value;}
fn cell(x:i32,z:i32)->u32{return u32(z)*params.width+u32(x);}
fn inside(x:i32,z:i32)->bool{return x>=0&&z>=0&&x<i32(params.width)&&z<i32(params.height);}
// Sparse clearing leaves old IDs in inactive tiles. Validate every lookup
// against the authoritative position before treating an ID as a blocker.
fn occ(tile:u32)->u32{
  let id=atomicLoad(&scratch.data[tile]);
  if(id==FREE||id>=params.count||val(id,F_ALIVE)<0.5){return FREE;}
  let x=i32(val(id,F_X));let z=i32(val(id,F_Z));
  if(inside(x,z)&&cell(x,z)==tile){return id;}
  if(val(id,F_MOVEELAPSED)<val(id,F_MOVEDURATION)){
    let fx=i32(val(id,F_FROMX));let fz=i32(val(id,F_FROMZ));
    if(inside(fx,fz)&&cell(fx,fz)==tile){return id;}
  }
  return FREE;
}
fn walk(tile:u32)->bool{return terrain.data[tile]!=0u;}
fn flow(tile:u32,east:bool)->f32{
  let offset=select(3u,2u,east)*cells();
  return f32(terrain.data[offset+tile]);
}
fn lineClear(ax:i32,az:i32,bx:i32,bz:i32)->bool{
  var x=ax;var z=az;
  let dx=abs(bx-ax);let dz=abs(bz-az);
  let sx=select(-1,1,ax<bx);let sz=select(-1,1,az<bz);
  var err=dx-dz;
  loop{
    if(x==bx&&z==bz){break;}
    let doubled=err*2;
    if(doubled > -dz){err-=dz;x+=sx;}
    if(doubled < dx){err+=dx;z+=sz;}
    if(!inside(x,z)){return false;}
    if((x!=bx||z!=bz)&&terrain.data[cells()+cell(x,z)]!=0u){return false;}
  }
  return true;
}
@compute @workgroup_size(${WORKGROUP})
fn reset(@builtin(global_invocation_id) tid:vec3<u32>){
  let id=tid.x;let n=cells();
  if(id<params.count){
    // Each soldier can reserve its current/departure cell and propose only
    // one of four neighbors. Reset those active cells, not the entire map.
    if(val(id,F_ALIVE)>=0.5){
      let x=i32(val(id,F_X));let z=i32(val(id,F_Z));
      if(inside(x,z)){
        for(var direction:u32=0u;direction<5u;direction++){
          let dx=select(select(0,-1,direction==2u),1,direction==1u);
          let dz=select(select(0,-1,direction==4u),1,direction==3u);
          let nx=x+dx;let nz=z+dz;
          if(inside(nx,nz)){
            let tile=cell(nx,nz);
            atomicStore(&scratch.data[tile],FREE);
            atomicStore(&scratch.data[n+tile],FREE);
          }
        }
      }
      if(val(id,F_MOVEELAPSED)<val(id,F_MOVEDURATION)){
        let fx=i32(val(id,F_FROMX));let fz=i32(val(id,F_FROMZ));
        if(inside(fx,fz)){
          let departure=cell(fx,fz);
          atomicStore(&scratch.data[departure],FREE);
          atomicStore(&scratch.data[n+departure],FREE);
        }
      }
    }
    atomicStore(&scratch.data[n*2u+id],0u);
    atomicStore(&scratch.data[n*2u+params.count+id],FREE);
  }
  if(id==0u){atomicStore(&scratch.data[n*2u+params.count*2u],0u);}
}
@compute @workgroup_size(${WORKGROUP})
fn occupy(@builtin(global_invocation_id) tid:vec3<u32>){
  let id=tid.x;if(id>=params.count||val(id,F_ALIVE)<0.5){return;}
  let x=i32(val(id,F_X));let z=i32(val(id,F_Z));
  if(inside(x,z)){atomicMin(&scratch.data[cell(x,z)],id);}
  if(val(id,F_MOVEELAPSED)<val(id,F_MOVEDURATION)){
    let fx=i32(val(id,F_FROMX));let fz=i32(val(id,F_FROMZ));
    if(inside(fx,fz)){atomicMin(&scratch.data[cell(fx,fz)],id);}
  }
}
@compute @workgroup_size(${WORKGROUP})
fn decide(@builtin(global_invocation_id) tid:vec3<u32>){
  let id=tid.x;if(id>=params.count){return;}
  for(var k:u32=0u;k<STRIDE;k++){updated.data[id*STRIDE+k]=original.data[id*STRIDE+k];}
  if(val(id,F_ALIVE)<0.5){return;}
  let jobIndex=u32(val(id,F_JOBINDEX));
  let job=jobs.data[jobIndex];
  let cooldown=max(-0.1,val(id,F_COOLDOWN)-params.dt);
  setval(id,F_COOLDOWN,cooldown);
  setval(id,F_HITFLASH,max(0.0,val(id,F_HITFLASH)-params.dt));
  setval(id,F_ATTACKELAPSED,min(99.0,val(id,F_ATTACKELAPSED)+params.dt));
  setval(id,F_PHASE,val(id,F_PHASE)+params.dt*select(0.8,3.8,val(id,F_ACTION)==1.0));
  if(val(id,F_MOVEELAPSED)<val(id,F_MOVEDURATION)){
    let duration=val(id,F_MOVEDURATION);
    let moved=min(duration,val(id,F_MOVEELAPSED)+params.dt);
    setval(id,F_MOVEELAPSED,moved);
    if(moved>=duration){setval(id,F_COMPLETEDSTEPS,val(id,F_COMPLETEDSTEPS)+1.0);}
    setval(id,F_ACTION,1.0);return;
  }
  let x=i32(val(id,F_X));let z=i32(val(id,F_Z));
  let reach=job.y+2.0;let radius=i32(ceil(reach));
  let team=id/params.sideCount;
  var nearest=FREE;var nearestDistance=reach*reach;
  for(var dz:i32=-radius;dz<=radius;dz++){
    for(var dx:i32=-radius;dx<=radius;dx++){
      let tx=x+dx;let tz=z+dz;
      if(!inside(tx,tz)){continue;}
      let other=occ(cell(tx,tz));
      if(other==FREE||other==id||other/params.sideCount==team||val(other,F_ALIVE)<0.5){continue;}
      let d=f32(dx*dx+dz*dz);
      if(d<nearestDistance){nearestDistance=d;nearest=other;}
    }
  }
  if(nearest!=FREE){
    let ex=i32(val(nearest,F_X));let ez=i32(val(nearest,F_Z));
    if(!lineClear(x,z,ex,ez)){nearest=FREE;}
  }
  if(nearest!=FREE&&nearestDistance<=job.y*job.y){
    let ex=i32(val(nearest,F_X));let ez=i32(val(nearest,F_Z));
    setval(id,F_ACTION,2.0);setval(id,F_VX,0.0);setval(id,F_VZ,0.0);
    let facingX=select(select(0.0,-1.0,ex<x),1.0,ex>x);
    let facingZ=select(select(0.0,-1.0,ez<z),1.0,ez>z);
    setval(id,F_FACINGX,select(val(id,F_FACINGX),facingX,ex!=x));
    setval(id,F_FACINGZ,facingZ);
    if(cooldown<=0.0){
      setval(id,F_COOLDOWN,cooldown+job.w);
      setval(id,F_ATTACKELAPSED,0.0);
      atomicAdd(&scratch.data[cells()*2u+nearest],u32(job.z));
      atomicAdd(&scratch.data[cells()*2u+params.count*2u],1u);
    }
    return;
  }
  var order=u32(val(id,F_ORDER));
  if(team==0u&&order==0u){order=params.strategy;}
  if(team!=0u){order=0u;}
  if(order==3u&&nearest==FREE){setval(id,F_ACTION,3.0);return;}
  let river=terrain.data[cells()*4u+u32(z)];
  if(order==2u&&team==0u&&x>=i32(river)-12&&nearest==FREE){setval(id,F_ACTION,3.0);return;}
  let towardEast=(team==0u&&order!=4u);
  let here=flow(cell(x,z),towardEast);
  var best=f32(0x3fffffff);var destination=FREE;
  for(var direction=0u;direction<4u;direction++){
    let dx=select(select(0,-1,direction==1u),1,direction==0u);
    let dz=select(select(0,-1,direction==3u),1,direction==2u);
    let nx=x+dx;let nz=z+dz;
    if(!inside(nx,nz)){continue;}
    let tile=cell(nx,nz);
    if(!walk(tile)||occ(tile)!=FREE){continue;}
    var cost=flow(tile,towardEast);
    if(cost>=f32(0x3fffffff)){continue;}
    if(nearest!=FREE){
      let ex=i32(val(nearest,F_X));let ez=i32(val(nearest,F_Z));
      cost+=(f32(abs(nx-ex)+abs(nz-ez)-abs(x-ex)-abs(z-ez)))*0.8;
    }
    let jitter=(i32(id)*13+nx*31+nz*19)%7;
    cost+=f32(jitter)*0.01;
    if(cost<best&&(cost<=here+1.05||nearest!=FREE)){best=cost;destination=tile;}
  }
  if(destination==FREE){setval(id,F_ACTION,4.0);setval(id,F_VX,0.0);setval(id,F_VZ,0.0);return;}
  atomicStore(&scratch.data[cells()*2u+params.count+id],destination);
  atomicMin(&scratch.data[cells()+destination],id);
}
@compute @workgroup_size(${WORKGROUP})
fn commit(@builtin(global_invocation_id) tid:vec3<u32>){
  let id=tid.x;if(id>=params.count||val(id,F_ALIVE)<0.5){return;}
  let dmg=atomicLoad(&scratch.data[cells()*2u+id]);
  if(dmg>0u){
    let hp=max(0.0,val(id,F_HP)-f32(dmg));
    setval(id,F_HP,hp);setval(id,F_HITFLASH,0.2);
    if(hp<=0.0){
      let duration=val(id,F_MOVEDURATION);
      let progress=select(1.0,min(1.0,val(id,F_MOVEELAPSED)/max(0.001,duration)),duration>0.0);
      setval(id,F_DEATHX,mix(val(id,F_FROMX),val(id,F_X),progress));
      setval(id,F_DEATHZ,mix(val(id,F_FROMZ),val(id,F_Z),progress));
      setval(id,F_DEATHAT,params.time);
      setval(id,F_ALIVE,0.0);setval(id,F_MOVEELAPSED,duration);
      return;
    }
  }
  let tile=atomicLoad(&scratch.data[cells()*2u+params.count+id]);
  if(tile==FREE){return;}
  if(atomicLoad(&scratch.data[cells()+tile])!=id){
    setval(id,F_ACTION,4.0);setval(id,F_VX,0.0);setval(id,F_VZ,0.0);return;
  }
  let x=i32(val(id,F_X));let z=i32(val(id,F_Z));
  let nx=i32(tile%params.width);let nz=i32(tile/params.width);
  let dx=nx-x;let dz=nz-z;
  let job=jobs.data[u32(val(id,F_JOBINDEX))];
  let team=id/params.sideCount;
  var order=u32(val(id,F_ORDER));
  if(team==0u&&order==0u){order=params.strategy;}
  if(team!=0u){order=0u;}
  let multiplier=select(select(1.0,0.65,order==2u),1.3,order==1u);
  setval(id,F_FROMX,f32(x));setval(id,F_FROMZ,f32(z));
  setval(id,F_VX,f32(dx));setval(id,F_VZ,f32(dz));
  setval(id,F_FACINGX,f32(dx));setval(id,F_FACINGZ,f32(dz));
  setval(id,F_X,f32(nx));setval(id,F_Z,f32(nz));
  setval(id,F_MOVEDURATION,1.0/(job.x*${MASS_MOVEMENT_SCALE}*multiplier));
  setval(id,F_MOVEELAPSED,0.0);setval(id,F_ACTION,1.0);
  let river=i32(terrain.data[cells()*4u+u32(nz)]);
  if(val(id,F_CROSSED)<0.5&&((team==0u&&nx>river+7)||(team==1u&&nx<river-7))){
    setval(id,F_CROSSED,1.0);
  }
}
`;

function staticMap(sim,riverXAt){
  const cells=sim.width*sim.height;
  const result=new Uint32Array(cells*4+sim.height);
  for(let i=0;i<cells;i++){
    result[i]=sim.walkable[i];
    result[cells+i]=sim.opaque[i];
    result[cells*2+i]=sim.flowEast[i];
    result[cells*3+i]=sim.flowWest[i];
  }
  for(let z=0;z<sim.height;z++)result[cells*4+z]=Math.round(riverXAt(z));
  return result;
}

export class WebGpuMassBattleEngine{
  static async create(sim,riverXAt,gpu=globalThis.navigator?.gpu){
    if(!gpu)return null;
    const adapter=await gpu.requestAdapter({powerPreference:'high-performance'});
    if(!adapter)return null;
    const device=await adapter.requestDevice();
    const engine=new WebGpuMassBattleEngine(sim,riverXAt,device);
    try{await engine.initialize();}
    catch(error){engine.destroy();throw error;}
    return engine;
  }
  constructor(sim,riverXAt,device){
    this.sim=sim;this.riverXAt=riverXAt;this.device=device;
    this.cells=sim.width*sim.height;this.count=sim.units.length;
    this.stateBytes=this.count*MASS_UNIT_STRIDE*4;
    this.auxLength=this.cells*2+this.count*2+1;
    this.backend='webgpu';this.lastStepMs=0;
  }
  async initialize(){
    const device=this.device;
    const storage=GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC;
    this.states=[0,1].map(()=>device.createBuffer({size:this.stateBytes,usage:storage}));
    this.terrain=device.createBuffer({size:(this.cells*4+this.sim.height)*4,usage:storage});
    this.scratch=device.createBuffer({size:this.auxLength*4,usage:storage});
    this.jobs=device.createBuffer({size:JOBS.length*16,usage:storage});
    this.params=device.createBuffer({size:32,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});
    this.staging=device.createBuffer({size:this.stateBytes+4,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});
    const jobData=new Float32Array(JOBS.length*4);
    JOBS.forEach((j,i)=>jobData.set([j.speed,j.range,j.damage,j.interval],i*4));
    device.queue.writeBuffer(this.jobs,0,jobData);
    device.queue.writeBuffer(this.terrain,0,staticMap(this.sim,this.riverXAt));
    device.queue.writeBuffer(this.states[0],0,packMassUnits(this.sim.units));
    const module=device.createShaderModule({label:'mass-battle-webgpu-compute',code:MASS_WEBGPU_SHADER});
    const errors=await module.getCompilationInfo();
    const failures=errors.messages.filter(m=>m.type==='error');
    if(failures.length)throw Error('WebGPU shader: '+failures.map(m=>`${m.lineNum}:${m.message}`).join(' / '));
    const layout=device.createBindGroupLayout({entries:[
      {binding:0,visibility:GPUShaderStage.COMPUTE,buffer:{type:'read-only-storage'}},
      {binding:1,visibility:GPUShaderStage.COMPUTE,buffer:{type:'storage'}},
      {binding:2,visibility:GPUShaderStage.COMPUTE,buffer:{type:'read-only-storage'}},
      {binding:3,visibility:GPUShaderStage.COMPUTE,buffer:{type:'storage'}},
      {binding:4,visibility:GPUShaderStage.COMPUTE,buffer:{type:'read-only-storage'}},
      {binding:5,visibility:GPUShaderStage.COMPUTE,buffer:{type:'uniform'}}
    ]});
    const pipelineLayout=device.createPipelineLayout({bindGroupLayouts:[layout]});
    this.pipelines={};
    for(const entryPoint of ['reset','occupy','decide','commit']){
      this.pipelines[entryPoint]=await device.createComputePipelineAsync({layout:pipelineLayout,
        compute:{module,entryPoint}});
    }
    this.groups=[0,1].map(index=>device.createBindGroup({layout,entries:[
      {binding:0,resource:{buffer:this.states[index]}},
      {binding:1,resource:{buffer:this.states[1-index]}},
      {binding:2,resource:{buffer:this.terrain}},
      {binding:3,resource:{buffer:this.scratch}},
      {binding:4,resource:{buffer:this.jobs}},
      {binding:5,resource:{buffer:this.params}}
    ]}));
    this.current=0;
    this.device.lost.then(()=>{this.lost=true;}).catch(()=>{this.lost=true;});
  }
  updateTerrain(){
    this.device.queue.writeBuffer(this.terrain,0,staticMap(this.sim,this.riverXAt));
    this.device.queue.writeBuffer(this.states[this.current],0,packMassUnits(this.sim.units));
  }
  setOrder(id,order){
    const codes={charge:1,defend:2,hold:3,retreat:4};
    this.device.queue.writeBuffer(this.states[this.current],(id*MASS_UNIT_STRIDE+F.order)*4,
      new Float32Array([codes[order]??0]));
  }
  async step(strategy='balanced'){
    if(this.lost)throw Error('WebGPUデバイスが失われました');
    const started=performance.now();
    const sim=this.sim;
    const params=new ArrayBuffer(32),uints=new Uint32Array(params),floats=new Float32Array(params);
    uints.set([sim.width,sim.height,this.count,ORDER_CODES[strategy]??0],0);
    floats[4]=sim.time+.1;floats[5]=.1;uints[6]=sim.sideCount;
    this.device.queue.writeBuffer(this.params,0,params);
    const encoder=this.device.createCommandEncoder();
    const pass=encoder.beginComputePass();
    const bind=this.groups[this.current];
    pass.setBindGroup(0,bind);
    for(const [name,amount] of [['reset',this.count],
      ['occupy',this.count],['decide',this.count],['commit',this.count]]){
      pass.setPipeline(this.pipelines[name]);
      pass.dispatchWorkgroups(Math.ceil(amount/WORKGROUP));
    }
    pass.end();
    encoder.copyBufferToBuffer(this.states[1-this.current],0,this.staging,0,this.stateBytes);
    encoder.copyBufferToBuffer(this.scratch,(this.auxLength-1)*4,this.staging,this.stateBytes,4);
    this.device.queue.submit([encoder.finish()]);
    await this.staging.mapAsync(GPUMapMode.READ);
    const mapped=this.staging.getMappedRange();
    const result=mapped.slice(0,this.stateBytes);
    const attackCount=new Uint32Array(mapped,this.stateBytes,1)[0];
    this.staging.unmap();
    const duration=performance.now()-started;
    (this.slowSamples??=[]).push(duration);
    if(this.slowSamples.length>8)this.slowSamples.shift();
    if(this.slowSamples.length===8&&this.slowSamples.reduce((a,b)=>a+b,0)/8>28)
      throw Error('WebGPU結果読み戻しが遅いためWorkerへ切り替えます');
    this.validate(result);
    applyMassUnits(sim.units,result);
    sim.time+=.1;sim.tickCount++;sim.attacks+=attackCount;
    sim.live=[0,0];sim.crossings=[0,0];
    for(const u of sim.units){if(u.alive)sim.live[u.team]++;if(u.crossed)sim.crossings[u.team]++;}
    this.current=1-this.current;
    this.lastStepMs=performance.now()-started;
    sim.lastAiMs=this.lastStepMs;
  }
  validate(buffer){
    const state=new Float32Array(buffer),occupied=new Set();
    let aliveCount=0,changedCount=0;
    for(let id=0;id<this.count;id++){
      const start=id*MASS_UNIT_STRIDE;
      const x=state[start+F.x],z=state[start+F.z],hp=state[start+F.hp];
      if(!Number.isFinite(x)||!Number.isFinite(z)||!Number.isFinite(hp)||hp<0||x!==Math.round(x)||z!==Math.round(z))
        throw Error('WebGPU兵士状態が不正です: '+id);
      if(state[start+F.action]<0||state[start+F.action]>4||state[start+F.jobIndex]<0||state[start+F.jobIndex]>=JOBS.length)
        throw Error('WebGPU職業・行動が不正です: '+id);
      const before=this.sim.units[id];
      if(Math.abs(x-before.x)>1||Math.abs(z-before.z)>1||hp>before.maxHp)
        throw Error('WebGPUが移動・HPルールを違反しました: '+id);
      if(x!==before.x||z!==before.z||hp!==before.hp)changedCount++;
      if(state[start+F.alive]!==1)continue;
      aliveCount++;
      const tile=z*this.sim.width+x;
      if(hp<=0||x<0||z<0||x>=this.sim.width||z>=this.sim.height||!this.sim.walkable[tile]||occupied.has(tile))
        throw Error('WebGPU通行・マス重複違反: '+id);
      occupied.add(tile);
    }
    const previousAlive=this.sim.live[0]+this.sim.live[1];
    if(previousAlive>100&&aliveCount<previousAlive*.8)
      throw Error('WebGPUの戦闘不能数が異常に増加しました');
    if(this.sim.tickCount===0&&changedCount===0)
      throw Error('WebGPUが戦闘状態を更新していません');
  }
  destroy(){
    for(const buffer of [...(this.states??[]),this.terrain,this.scratch,this.jobs,this.params,this.staging])buffer?.destroy();
  }
}
