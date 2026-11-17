/**
 * Bounded, action-timed m001 effects. Only a near/source wolf that actually
 * performs an action allocates the geometry. Distant/medium 1000-unit LOD
 * never creates these meshes; nothing animates or draws while invisible.
 * This module is renderer-agnostic and is shared by model viewer and game.
 */
import * as THREE from 'three';

const clamp01=v=>Math.max(0,Math.min(1,v));
const smooth=(a,b,t)=>{const u=clamp01((t-a)/(b-a));return u*u*(3-2*u);};
const windowPulse=(t,start,peak,end)=>
  smooth(start,peak,t)*(1-smooth(peak,end,t));

function createClawArcGeometry(){
 const vertices=[],indices=[];
 // A single three-claw scratch mesh, not one draw call per claw or shard.
 for(let claw=0;claw<3;claw++){
  const start=vertices.length/3,segments=12;
  for(let i=0;i<=segments;i++){
   const t=i/segments;
   const cx=(claw-1)*.155+.14*Math.sin(Math.PI*t*.80);
   const cy=.24-.53*t+.085*Math.sin(Math.PI*t);
   const z=.012+.012*Math.sin(Math.PI*t);
   const half=.024*(1-t)*(.70+.30*Math.sin(Math.PI*t));
   vertices.push(cx-half,cy,z,cx+half,cy,z);
  }
  for(let i=0;i<segments;i++){
   const a=start+2*i;indices.push(a,a+1,a+2,a+1,a+3,a+2);
  }
 }
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
 geometry.setIndex(indices);
 geometry.computeVertexNormals();
 return geometry;
}
function makeTransient(geometry,color,name){
 const material=new THREE.MeshBasicMaterial({
  color,transparent:true,opacity:0,side:THREE.DoubleSide,
  depthWrite:false,toneMapped:false
 });
 const mesh=new THREE.Mesh(geometry,material);
 mesh.name=name;mesh.visible=false;
 mesh.userData.ownedGeometry=true;
 mesh.userData.ownedEffectMaterial=true;
 mesh.userData.m001ActionFx=true;
 mesh.renderOrder=3;
 return mesh;
}
function ensureFx(model){
 if(model.userData.m001ActionEffects)return model.userData.m001ActionEffects;
 if(model.userData.speciesId!=='m001'||!['high','source'].includes(model.userData.detail)||
   model.userData.disableMonsterActionEffects)return null;
 const scratches=makeTransient(createClawArcGeometry(),0xbecbd0,'m001-claw-air-streaks');
 scratches.position.set(0,1.10,1.32);
 const roar=makeTransient(new THREE.TorusGeometry(.35,.016,7,38),
   0xc5d4da,'m001-roar-pressure-wave');
 roar.position.set(0,1.16,1.25);
 const dust=makeTransient(new THREE.TorusGeometry(.27,.025,7,32),
   0x8c9290,'m001-paw-dust-wave');
 dust.rotation.x=-Math.PI/2;
 dust.position.set(0,.047,1.18);
 model.add(scratches,roar,dust);
 const fx={scratches,roar,dust};
 model.userData.m001ActionEffects=fx;
 return fx;
}
function show(mesh,opacity,scale=1){
 mesh.visible=opacity>.015;
 mesh.material.opacity=clamp01(opacity);
 mesh.scale.setScalar(scale);
}
export function updateM001ActionEffects(model,{action='idle',progress=0,time=0}={}){
 if(!model||model.userData.speciesId!=='m001')return false;
 const enabled=['attack','special','roar','run','dodge','hit'].includes(action);
 const fx=model.userData.m001ActionEffects||
   (enabled?ensureFx(model):null);
 if(!fx)return false;
 const p=clamp01(progress);
 const claw=(action==='attack'||action==='special')?
   windowPulse(p,.22,.43,.67):0;
 const pressure=(action==='roar'||action==='special')?
   windowPulse(p,.18,.44,.93):0;
 const dustStrength=action==='run'?.17+.21*Math.pow(Math.sin(time*13),2):
   action==='dodge'?.35*windowPulse(p,.12,.35,.80):
   action==='hit'?.25*windowPulse(p,.09,.30,.75):
   action==='attack'?.16*windowPulse(p,.34,.47,.70):0;
 show(fx.scratches,claw*.62, .76+.41*p);
 fx.scratches.position.x=action==='special'?.055:0;
 show(fx.roar,pressure*(action==='special'?.32:.42),.60+1.75*p);
 show(fx.dust,dustStrength,.75+.53*(action==='run'?
   Math.abs(Math.sin(time*13)):p));
 return true;
}
export function wolfKingEffectsBudget(model){
 const fx=model?.userData?.m001ActionEffects;
 return {meshes:fx?3:0,visible:fx?
   Object.values(fx).filter(m=>m.visible).length:0};
}
