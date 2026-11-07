/**
 * Lightweight animated eyelids and physically based eye/skin finish for
 * the actual Quaternius 65-bone male/female humanoid.
 *
 * The source GLTF has skinned "Eyes" and "Eyebrows" but NO blink morphs.
 * Derive each eye's geometry from its actual skinned vertices, attach curved
 * upper/lower eyelids to the same Head bone, and animate only local morph
 * influences (never deform body geometry or modify source GLTF assets).
 *
 * The imported source face maps and their normal/roughness information remain
 * intact. This is a detailed facial enhancement, NOT a photoreal head scan.
 */
import * as THREE from 'three';

const controllers=new WeakMap();
const V=new THREE.Vector3();
const isNamed=(name,re)=>re.test(String(name||'').toLowerCase());
const ease=t=>{const x=Math.max(0,Math.min(1,t));return x*x*(3-2*x)};

// Sequence: close in 90ms, stay closed 55ms, reopen in 155ms.
// Optional short double-blinks make the rhythm nonuniform.
export function blinkAmountAt(seconds){
 if(!Number.isFinite(seconds)||seconds<=0)return 0;
 if(seconds<.09)return ease(seconds/.09);
 if(seconds<.145)return 1;
 if(seconds<.30)return 1-ease((seconds-.145)/.155);
 return 0;
}
export function nextBlinkGap(seed,number){
 // Fixed per-actor deterministic jitter avoids all soldiers blinking together.
 const v=Math.sin(seed*12.9898+number*78.233)*43758.5453;
 const frac=v-Math.floor(v);
 return 2.4+frac*3.6;
}
function sampleEyeHalves(eyes,head){
 // SkinnedMesh.getVertexPosition calculates deformed vertex position in mesh
 // space. Convert to the head-bone coordinate system before creating lids.
 eyes.updateWorldMatrix(true,true);
 head.updateWorldMatrix(true,true);
 const positions=eyes.geometry.getAttribute('position');
 if(!positions||positions.count<30)return null;
 const points=[];
 const world=new THREE.Vector3();
 const eyeCenter=new THREE.Vector3();
 for(let i=0;i<positions.count;i++){
  eyes.getVertexPosition(i,world);
  world.applyMatrix4(eyes.matrixWorld);
  head.worldToLocal(world);
  points.push(world.clone());eyeCenter.add(world);
 }
 eyeCenter.multiplyScalar(1/points.length);
 const grouped=[[],[]];
 for(const p of points)grouped[p.x<eyeCenter.x?0:1].push(p);
 const out=[];
 for(const side of grouped){
  if(side.length<30)return null;
  const box=new THREE.Box3().setFromPoints(side);
  const dimensions=box.getSize(new THREE.Vector3());
  const center=box.getCenter(new THREE.Vector3());
  if(dimensions.x<.002||dimensions.y<.002||dimensions.x>.5||dimensions.y>.5)return null;
  out.push({
   cx:center.x,cy:center.y,cz:center.z,
   halfW:Math.max(dimensions.x*.50,.004),
   halfH:Math.max(dimensions.y*.50,.003),
   frontZ:box.max.z+Math.max(dimensions.z*.12,.001),
   span:[dimensions.x,dimensions.y,dimensions.z].map(x=>+x.toFixed(5))
  });
 }
 return out;
}
function eyelidMesh(eye,upper,material){
 const segments=16,rows=4;
 const open=[],closed=[],indices=[];
 const {cx,cy,halfW,halfH,frontZ}=eye;
 for(let row=0;row<=rows;row++){
  const v=row/rows;
  for(let col=0;col<=segments;col++){
   const u=(col/segments)*2-1;
   const arc=Math.sqrt(Math.max(.02,1-u*u));
   const x=cx+u*halfW*1.02;
   const top=cy+(upper?1:-1)*halfH*(.15+.91*arc);
   const openEdge=cy+(upper?1:-1)*halfH*(.05+.71*arc);
   const closedEdge=cy+(upper?-.04:.04)*halfH*arc;
   const yOpen=top*(1-v)+openEdge*v;
   const yClosed=top*(1-v)+closedEdge*v;
   const z=frontZ+(arc*.004)-v*.0015;
   open.push(x,yOpen,z);
   closed.push(x,yClosed,z);
  }
 }
 for(let row=0;row<rows;row++)for(let col=0;col<segments;col++){
  const a=row*(segments+1)+col,b=a+segments+1;
  indices.push(a,b,a+1,b,b+1,a+1);
 }
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(open,3));
 geometry.setIndex(indices);
 geometry.computeVertexNormals();
 geometry.morphAttributes.position=[new THREE.Float32BufferAttribute(closed,3)];
 const mesh=new THREE.Mesh(geometry,material);
 mesh.name=(upper?'NaturalUpperEyelid':'NaturalLowerEyelid')+(cx<0?'_L':'_R');
 mesh.morphTargetInfluences[0]=0;
 mesh.frustumCulled=false;
 mesh.renderOrder=3;
 mesh.userData.facialBlinkLid=true;
 return mesh;
}
function enhanceOriginalFaceMaterials(model){
 const edits=[];
 model.traverse(mesh=>{
  if(!mesh.isMesh||!mesh.material)return;
  const targets=Array.isArray(mesh.material)?mesh.material:[mesh.material];
  let changed=false;
  const refined=targets.map(mat=>{
   if(!mat?.isMeshStandardMaterial||!mat?.color)return mat;
   const eye=isNamed(mesh.name,/^eyes$/i)||isNamed(mat.name,/^mi_eyes$/i);
   const skin=isNamed(mat.name,/^mi_superhero_(male|female)$/i);
   if(!eye&&!skin)return mat;
   // Clone to prevent one actor's finish from affecting all GLTF instances.
   const out=new THREE.MeshPhysicalMaterial();
   out.copy(mat);
   out.name=eye?'RealisticCorneaPBR':'RealisticFaceSkinPBR';
   out.metalness=0;
   out.roughness=eye?.18:.58;
   out.clearcoat=eye?.83:.065;
   out.clearcoatRoughness=eye?.10:.49;
   out.ior=eye?1.37:1.4;
   if(skin)out.color.multiplyScalar(1.03);
   out.needsUpdate=true;changed=true;
   edits.push({mesh,original:mat,refined:out});
   return out;
  });
  if(changed)mesh.material=Array.isArray(mesh.material)?refined:refined[0];
 });
 return {
  materials:edits.length,
  restore(){
   for(const {mesh,original,refined} of edits){
    if(Array.isArray(mesh.material))
     mesh.material=mesh.material.map(x=>x===refined?original:x);
    else if(mesh.material===refined)mesh.material=original;
    refined.dispose();
   }
  }
 };
}
export function attachRealisticFace(model,{seed=17,owner='preview',quality='battle'}={}){
 if(!model)throw Error('顔の3Dモデルが必要です');
 if(controllers.has(model)){
  const existing=controllers.get(model);
  if(owner==='shared')existing.tickOwner='shared';
  return existing;
 }
 let head=null,eyes=null;
 model.traverse(node=>{
  if(node.isBone&&node.name.toLowerCase()==='head')head=node;
  if(node.isSkinnedMesh&&node.name.toLowerCase()==='eyes')eyes=node;
 });
 if(!head||!eyes){
  const unavailable={supported:false,reason:'Head bone or Eyes skinned mesh missing',
   update(){},forceBlink(){return false},diagnostics(){return {supported:false,reason:this.reason}},dispose(){}};
  controllers.set(model,unavailable);return unavailable;
 }
 // The two eye components come from the real source skinning, not imagined
 // screen coordinates. Source geometry is sampled only once per actor.
 const measurements=sampleEyeHalves(eyes,head);
 if(!measurements){
  const unavailable={supported:false,reason:'Eye geometry cannot be split into left/right',
   update(){},forceBlink(){return false},diagnostics(){return {supported:false,reason:this.reason}},dispose(){}};
  controllers.set(model,unavailable);return unavailable;
 }
 const finish=enhanceOriginalFaceMaterials(model);
 // Use a restrained skin color only for NEW eyelids; the real body retains
 // its original photographed skin texture and normal atlas.
 const lidMat=new THREE.MeshPhysicalMaterial({
  name:'NaturalSkinEyelidPBR',color:0xbca08c,metalness:0,
  roughness:.68,clearcoat:.04,clearcoatRoughness:.52,
  side:THREE.DoubleSide,depthWrite:true
 });
 const lids=[];
 for(const eye of measurements){
  for(const upper of [true,false]){
   const lid=eyelidMesh(eye,upper,lidMat);
   head.add(lid);lids.push(lid);
  }
 }
 let elapsed=0,blinking=false,blinkTime=0,blinkNumber=0;
 let gap=nextBlinkGap(seed,blinkNumber),intensity=0;
 let doublePending=false,active=true;
 const ctrl={
  supported:true,tickOwner:owner,model,head,eyes,lids,quality,
  forceBlink(){
   if(!active)return false;
   blinking=true;blinkTime=0;doublePending=false;return true;
  },
  update(dt){
   if(!active)return;
   const delta=THREE.MathUtils.clamp(Number(dt)||0,0,.075);
   elapsed+=delta;
   if(!blinking&&elapsed>=gap){
    blinking=true;blinkTime=0;elapsed=0;
    blinkNumber++;
    gap=nextBlinkGap(seed,blinkNumber);
    doublePending=((blinkNumber+Math.floor(seed))%7===0);
   }
   if(blinking){
    blinkTime+=delta;
    intensity=blinkAmountAt(blinkTime);
    if(blinkTime>=.30){
     blinking=false;intensity=0;
     if(doublePending){elapsed=Math.max(0,gap-.22);doublePending=false}
    }
   }else intensity=0;
   for(const lid of lids)lid.morphTargetInfluences[0]=intensity;
  },
  diagnostics(){
   return {
    supported:true,eyeCount:measurements.length,eyelidMeshes:lids.length,
    blinkAmount:+intensity.toFixed(4),blinking,blinkNumber,
    nextBlinkSeconds:+Math.max(0,gap-elapsed).toFixed(3),
    realisticEyeMaterials:finish.materials,
    bone:head.name,sourceEyes:eyes.name,quality,
    eyeMeasurements:measurements.map(m=>({span:m.span,cx:+m.cx.toFixed(4),cy:+m.cy.toFixed(4)}))
   };
  },
  dispose(){
   if(!active)return;
   active=false;
   for(const lid of lids){lid.parent?.remove(lid);lid.geometry.dispose()}
   lidMat.dispose();finish.restore();controllers.delete(model);
  }
 };
 controllers.set(model,ctrl);
 return ctrl;
}
export function getRealisticFace(model){return controllers.get(model)||null}
