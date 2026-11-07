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

/** Sample the real facial-skin UV atlas around the original eyes. Lids should
 * use photographed/painted cheek/temple SKIN pixels, not flat unlit disks. */
function faceSkinSamples(model,head,eyes){
 let skin=null;
 model.traverse(o=>{
  if(skin||!o.isSkinnedMesh||o===eyes||!o.geometry?.getAttribute('uv'))return;
  const materials=Array.isArray(o.material)?o.material:[o.material];
  if(materials.some(m=>/^mi_superhero_(male|female)$/i.test(m?.name||'')))skin=o;
 });
 if(!skin)return null;
 const uv=skin.geometry.getAttribute('uv');
 const centerY=eyes.reduce((a,o)=>a+o.cy,0)/eyes.length;
 const avgFront=eyes.reduce((a,o)=>a+o.frontZ,0)/eyes.length;
 const points=[];const world=new THREE.Vector3();
 skin.updateWorldMatrix(true,true);
 head.updateWorldMatrix(true,true);
 for(let i=0;i<uv.count;i++){
  skin.getVertexPosition(i,world);
  world.applyMatrix4(skin.matrixWorld);
  head.worldToLocal(world);
  if(Math.abs(world.y-centerY)>.075||Math.abs(world.x)>.16||
    Math.abs(world.z-avgFront)>.11)continue;
  points.push({x:world.x,y:world.y,z:world.z,u:uv.getX(i),v:uv.getY(i)});
 }
 if(points.length<8)return null;
 const mats=Array.isArray(skin.material)?skin.material:[skin.material];
 const mat=mats.find(m=>/^mi_superhero_(male|female)$/i.test(m?.name||''))||mats[0];
 if(!mat?.map)return null;
 return {samples:points,material:mat};
}
function setEyelidAtlasUV(geometry,source){
 if(!source)return false;
 const pos=geometry.getAttribute('position'),out=new Float32Array(pos.count*2);
 // A single cheek-skin swatch for each eyelid is safer than copying unrelated
 // UV island locations from face/hair/neck per vertex. Previous closest-UV
 // projection visibly stretched bright atlas triangles across the eyelids.
 let mx=0,my=0,mz=0;
 for(let i=0;i<pos.count;i++){mx+=pos.getX(i);my+=pos.getY(i);mz+=pos.getZ(i)}
 mx/=pos.count;my/=pos.count;mz/=pos.count;
 const desiredX=mx+(mx<0?-.007:.007),desiredY=my-.012;
 let score=Infinity,best=null;
 for(const p of source.samples){
  const dist=(p.x-desiredX)**2+(p.y-desiredY)**2+
   ((p.z-mz)*.30)**2;
  if(dist<score){score=dist;best=p}
 }
 if(!best)return false;
 for(let i=0;i<pos.count;i++){out[2*i]=best.u;out[2*i+1]=best.v}
 geometry.setAttribute('uv',new THREE.Float32BufferAttribute(out,2));
 return true;
}
function makeEyeSeam(eye){
 const coords=[];
 for(let n=0;n<=16;n++){
  const u=n/8-1,arc=Math.sqrt(Math.max(.025,1-u*u));
  coords.push(eye.cx+u*eye.halfW*.99,eye.cy,eye.frontZ+arc*.006+.003);
 }
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(coords,3));
 const line=new THREE.Line(geometry,new THREE.LineBasicMaterial({
  color:0x694c3c,opacity:.42,transparent:true,depthWrite:false
 }));
 line.name='ClosedEyelidSkinCrease';line.visible=false;line.frustumCulled=false;
 return line;
}
function eyelidMesh(eye,upper,material,atlas){
 const segments=16,rows=4;
 const open=[],closed=[],indices=[],vertexColor=[];
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
   // Alpha fades into surrounding real face geometry at the outer corners
   // and forehead/cheek, avoiding a circular cut-out when eyes close.
   const alpha=Math.pow(v,.58)*Math.pow(arc,.35);
   vertexColor.push(1,1,1,alpha);
  }
 }
 for(let row=0;row<rows;row++)for(let col=0;col<segments;col++){
  const a=row*(segments+1)+col,b=a+segments+1;
  indices.push(a,b,a+1,b,b+1,a+1);
 }
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(open,3));
 geometry.setAttribute('color',new THREE.Float32BufferAttribute(vertexColor,4));
 geometry.setIndex(indices);
 setEyelidAtlasUV(geometry,atlas);
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
   // MeshPhysicalMaterial.copy(MeshStandardMaterial) is NOT supported in
   // Three r160 (the missing clearcoatNormalScale triggers a read of .x).
   // Transfer only common supported material properties explicitly.
   const out=new THREE.MeshPhysicalMaterial({
    name:eye?'RealisticCorneaPBR':'RealisticFaceSkinPBR',
    color:mat.color.clone(),map:mat.map||null,
    normalMap:mat.normalMap||null,
    normalScale:mat.normalScale?.clone()||new THREE.Vector2(1,1),
    roughnessMap:mat.roughnessMap||null,
    metalnessMap:mat.metalnessMap||null,
    aoMap:mat.aoMap||null,emissive:mat.emissive?.clone()||new THREE.Color(0),
    emissiveMap:mat.emissiveMap||null,
    emissiveIntensity:mat.emissiveIntensity||1,
    alphaMap:mat.alphaMap||null,alphaTest:mat.alphaTest||0,
    opacity:mat.opacity,transparent:mat.transparent,side:mat.side,
    depthTest:mat.depthTest,depthWrite:mat.depthWrite,
    vertexColors:mat.vertexColors,
    metalness:0,roughness:eye?.18:.58,
    clearcoat:eye?.83:.065,clearcoatRoughness:eye?.10:.49,
    ior:eye?1.37:1.4
   });
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
 const atlas=faceSkinSamples(model,head,measurements);
 const finish=enhanceOriginalFaceMaterials(model);
 // Same face map and UV neighborhood as the real original face. This avoids
 // washed-out white disks when the model blinks, without touching skin mesh.
 const lidMat=new THREE.MeshPhysicalMaterial({
  name:'NaturalSkinEyelidPBR',
  color:atlas?0xffffff:0x836451,
  map:atlas?.material.map||null,
  normalMap:atlas?.material.normalMap||null,
  metalness:0,roughness:.74,clearcoat:.03,clearcoatRoughness:.55,
  side:THREE.DoubleSide,transparent:true,depthWrite:false,
  vertexColors:true
 });
 const lids=[],seams=[];
 for(const eye of measurements){
  for(const upper of [true,false]){
   const lid=eyelidMesh(eye,upper,lidMat,atlas);
   head.add(lid);lids.push(lid);
  }
  if(quality!=='battle'){
   const line=makeEyeSeam(eye);
   head.add(line);seams.push(line);
  }
 }
 let elapsed=0,blinking=false,blinkTime=0,blinkNumber=0;
 let gap=nextBlinkGap(seed,blinkNumber),intensity=0;
 let doublePending=false,active=true,autoEnabled=true,holdAmount=null;
 const ctrl={
  supported:true,tickOwner:owner,model,head,eyes,lids,quality,
  eyeCenterWorld(){
   head.updateWorldMatrix(true,false);
   const p=measurements.reduce((sum,eye)=>sum.add(new THREE.Vector3(eye.cx,eye.cy,eye.frontZ)),new THREE.Vector3());
   return head.localToWorld(p.multiplyScalar(1/measurements.length));
  },
  setAutoBlink(on){autoEnabled=Boolean(on);return autoEnabled},
  holdBlink(amount){holdAmount=amount===null?null:THREE.MathUtils.clamp(Number(amount)||0,0,1);
   if(holdAmount!==null){intensity=holdAmount;for(const lid of lids)lid.morphTargetInfluences[0]=intensity;}
   return holdAmount;
  },
  forceBlink(){
   if(!active)return false;
   blinking=true;blinkTime=0;doublePending=false;return true;
  },
  update(dt){
   if(!active)return;
   if(holdAmount!==null){
    intensity=holdAmount;
    for(const lid of lids)lid.morphTargetInfluences[0]=intensity;
   for(const seam of seams)seam.visible=intensity>=.78;
    return;
   }
   const delta=THREE.MathUtils.clamp(Number(dt)||0,0,.075);
   elapsed+=delta;
   if(autoEnabled&&!blinking&&elapsed>=gap){
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
   for(const seam of seams)seam.visible=intensity>=.78;
  },
  diagnostics(){
   return {
    supported:true,eyeCount:measurements.length,eyelidMeshes:lids.length,
    blinkAmount:+intensity.toFixed(4),blinking,blinkNumber,
    nextBlinkSeconds:+Math.max(0,gap-elapsed).toFixed(3),
    autoEnabled,holdAmount,
    realisticEyeMaterials:finish.materials,
    skinAtlasSampling:!!atlas,faceSkinSamples:atlas?.samples.length||0,
    skinCreaseLines:seams.length,
    bone:head.name,sourceEyes:eyes.name,quality,
    eyeMeasurements:measurements.map(m=>({span:m.span,cx:+m.cx.toFixed(4),cy:+m.cy.toFixed(4)}))
   };
  },
  dispose(){
   if(!active)return;
   active=false;
   for(const lid of lids){lid.parent?.remove(lid);lid.geometry.dispose()}
   for(const seam of seams){seam.parent?.remove(seam);seam.geometry.dispose();seam.material.dispose()}
   lidMat.dispose();finish.restore();controllers.delete(model);
  }
 };
 controllers.set(model,ctrl);
 return ctrl;
}
export function getRealisticFace(model){return controllers.get(model)||null}
