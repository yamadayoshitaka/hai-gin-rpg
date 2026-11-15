/**
 * Non-human GLB visual/animation adaptation, following the shipped r-wolf
 * pipeline. Preserves the donor's topology, skin weights, texture UVs and
 * native animation clips. Missing clips receive bounded per-species procedural
 * movement on real imported bones, with a whole-body fallback if unrigged.
 * Not a photorealism certificate; curator comparisons remain mandatory.
 */
import * as THREE from 'three';
import {creatureSpeciesBlueprint} from './creature-species-blueprints.js';

const TAU=Math.PI*2;
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
const FINITE_DURATIONS=Object.freeze({
 attack:.85,special:1.35,roar:1.1,guard:.8,dodge:.65,
 hit:.45,leap:1.1,defeat:1.25
});
const tintExceptions=/eye|iris|pupil|teeth|tooth|mouth|tongue|lens|cornea|feather|transparent|glass/i;
const animatedParts=/head|neck|jaw|mandible|wing|tail|thigh|calf|leg|paw|foot|arm|tentacle|antenna|spine|abdomen|body|pelvis/i;
const sourceOf=handle=>handle.root.children.find(child=>child.isObject3D)||handle.root;
const copyRot=x=>({x:x.rotation.x,y:x.rotation.y,z:x.rotation.z});
const setRot=(obj,rot)=>obj.rotation.set(rot.x,rot.y,rot.z);
const familyStride=Object.freeze({
 canine:12,feline:13,avian:9,'winged-quadruped':8,
 reptile:6,'multiheaded-reptile':5,serpent:6,insect:11,mantis:10,
 arachnid:9,amorphous:3,cephalopod:5,aquatic:5
});
const familyLimbCount=Object.freeze({
 canine:4,feline:4,avian:2,'winged-quadruped':4,reptile:4,
 'multiheaded-reptile':4,serpent:0,insect:6,mantis:6,
 arachnid:8,amorphous:0,cephalopod:8,aquatic:2
});
export function refineNonhumanCreatureHandle(handle,creatureId){
 const blueprint=creatureSpeciesBlueprint(creatureId);
 if(!handle?.root?.isObject3D||!blueprint||blueprint.protectedAsset)
  return handle;
 // The original r-wolf m001 has its own verified shader-only coat and
 // real animation adaptation. Never add geometry or overwrite that contract.
 if(blueprint.id==='m001')return handle;
 const root=handle.root,body=sourceOf(handle);
 const box=new THREE.Box3().setFromObject(root);
 const size=box.getSize(new THREE.Vector3());
 if(box.isEmpty()||size.y<=0)return handle;
 const accent=new THREE.Color(blueprint.palette.accent);
 const baseColor=new THREE.Color(blueprint.palette.base);
 const ownedOriginalMaterials=new Set();
 const clones=new Map();
 let repainted=0;
 root.traverse(object=>{
  if(!object.isMesh||!object.material)return;
  const old=object.material;
  const modify=material=>{
   if(!material?.color||material.transparent||
     tintExceptions.test(object.name+' '+material.name))return material;
   if(clones.has(material))return clones.get(material);
   const clone=material.clone();
   clone.color.lerp(baseColor,blueprint.anatomy==='amorphous'?.27:.47);
   // Keep donor PBR maps, normals and texture coordinates intact.
   if(blueprint.anatomy==='amorphous'){
    clone.roughness=.23;
    clone.metalness=0;
   }else if(Number.isFinite(clone.roughness)){
    clone.roughness=clamp(clone.roughness,.37,.92);
   }
   if(['fire','ice','lightning','light','dark'].includes(blueprint.element)
      &&clone.emissive){
    clone.emissive.lerp(accent,.26);
    clone.emissiveIntensity=clamp(clone.emissiveIntensity||.35,.12,.65);
   }
   clone.userData={...clone.userData,
    creatureSpeciesId:blueprint.id,sourceUVPreserved:true};
   clones.set(material,clone);ownedOriginalMaterials.add(material);
   return clone;
  };
  object.material=Array.isArray(old)?old.map(modify):modify(old);
  repainted++;
 });
 const originalPlay=handle.play.bind(handle);
 const originalUpdate=handle.update.bind(handle);
 const originalDispose=handle.dispose.bind(handle);
 const originalBodyRotation=copyRot(body);
 const originalBodyPosition=body.position.clone();
 const originalBodyScale=body.scale.clone();
 const bones=[];
 root.traverse(node=>{
  if(node.isBone&&animatedParts.test(node.name)&&bones.length<40)
   bones.push({node,original:copyRot(node),
    role:node.name.toLowerCase()});
 });
 let current='idle',elapsed=0,phase=0,procedural=false,disposed=false;
 function restore(){
  setRot(body,originalBodyRotation);
  body.position.copy(originalBodyPosition);
  body.scale.copy(originalBodyScale);
  for(const b of bones)setRot(b.node,b.original);
 }
 function play(action,{restart=false}={}){
  if(disposed)return false;
  if(action===current&&!restart)return true;
  current=action;
  elapsed=0;
  restore();
  if(originalPlay(action,{restart})){
   procedural=false;
  }else{
   procedural=true;
   originalPlay('idle',{restart:true});
  }
  return true;
 }
 function update(dt){
  if(disposed)return;
  const step=clamp(Number.isFinite(dt)?dt:0,0,.1);
  originalUpdate(step);
  elapsed+=step;
  if(!procedural)return;
  const locomotion=current==='run'||current==='walk';
  phase+=step*(familyStride[blueprint.anatomy]||7)*
   (current==='walk'?.58:1);
  const duration=FINITE_DURATIONS[current]||1;
  const progress=clamp(elapsed/duration,0,1);
  const gesture=FINITE_DURATIONS[current]?Math.sin(Math.PI*progress):0;
  const down=current==='defeat'?progress:0;
  const winged=['avian','winged-quadruped'].includes(blueprint.anatomy);
  const webbed=['cephalopod','aquatic','serpent'].includes(blueprint.anatomy);
  const slithering=blueprint.anatomy==='serpent';
  const bounce=locomotion?Math.abs(Math.sin(phase))*size.y*.018:0;
  const breathing=current==='defeat'?0:Math.sin(phase*.19)*.008;
  // Transform the imported source, never the battle-positioned outer root.
  body.rotation.x=originalBodyRotation.x+
   (current==='attack'?-.18*gesture:current==='hit'?.18*gesture:0)+
   (current==='leap'?-.20*gesture:0);
  body.rotation.z=originalBodyRotation.z+
   (current==='dodge'?.30*gesture:0)+down*.66+
   (slithering?.085*Math.sin(phase*.44):0);
  body.position.y=originalBodyPosition.y+bounce+breathing*size.y-
   down*size.y*.17+(current==='leap'?size.y*.15*gesture:0);
  if(blueprint.anatomy==='amorphous'){
   const pulse=current==='defeat'?0:Math.sin(phase*.43)*.045+
    (current==='attack'?gesture*.12:0);
   body.scale.set(originalBodyScale.x*(1+pulse*.5),
    originalBodyScale.y*(1-pulse),
    originalBodyScale.z*(1+pulse*.5));
  }
  for(let i=0;i<bones.length;i++){
   const {node,original,role}=bones[i];
   let swing=0;
   if(/wing/.test(role)){
    swing=(winged?.43:.13)*Math.sin(phase*1.2+i*.15)+
      (current==='special'?.40*gesture:0);
    node.rotation.z=original.z+swing*((/left|\.l|_l|l$/i.test(role))?-1:1);
   }else if(/leg|thigh|calf|foot|paw|arm/.test(role)){
    // Canine diagonal trot, six-legged tripod, eight-legged alternate gait.
    const count=familyLimbCount[blueprint.anatomy]||4;
    const alternating=((i%count)%2)*Math.PI;
    swing=locomotion?Math.sin(phase+alternating)*(current==='run'?.38:.23):0;
    node.rotation.x=original.x+swing+
      (current==='attack'&&/arm|paw/.test(role)?-.30*gesture:0);
   }else if(/tail|tentacle/.test(role)){
    node.rotation.y=original.y+
      Math.sin(phase*.60+i*.67)*(webbed?.31:.17)+
      (current==='special'?.20*gesture:0);
   }else if(/head|neck|jaw|mandible/.test(role)){
    node.rotation.x=original.x+
      (current==='attack'?-.24*gesture:current==='roar'?.20*gesture:0);
   }else if(/antenna/.test(role)){
    node.rotation.z=original.z+Math.sin(phase*.64+i)*.08;
   }else if(/spine|abdomen|body|pelvis/.test(role)){
    node.rotation.y=original.y+(slithering?.12:.025)*Math.sin(phase*.50+i*.5);
   }
  }
  root.userData.speciesMotionState={
   speciesId:blueprint.id,action:current,source:'manual-procedural-fallback',
   jointCount:bones.length,progress,phase:phase%TAU
  };
 }
 const result={...handle,play,update,dispose(){
  if(disposed)return;
  disposed=true;
  restore();
  originalDispose();
  for(const material of ownedOriginalMaterials)material.dispose();
 }};
 root.userData.speciesRefinement={
  speciesId:blueprint.id,feature:blueprint.feature,
  anatomy:blueprint.anatomy,donorSource:root.userData.externalSourceId,
  repaintedMeshes:repainted,clonedMaterials:clones.size,
  UVsAndSkinningPreserved:true,qualityApproved:false,
  proceduralAnimationAvailable:true,
  requiredActionSlots:[...blueprint.actionSlots]
 };
 // Starting idle must not advance any procedural fallback before update.
 play('idle',{restart:true});
 return result;
}
