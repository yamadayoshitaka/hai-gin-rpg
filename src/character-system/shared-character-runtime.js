// Shared runtime for the external motion tester and tactical game.
// The game owns only world position and command selection; this module owns model and animation.
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {CHARACTER_MODEL_REGISTRY} from '../character-model-registry.js';
import {buildRigPairs,applyRigPairs} from './retarget-adapter.js';
import {resolveJobMotion} from './job-motion-source.js';
import {clipTimeForStepPhase,groundedModelY,footfallAtPhase,footPlantWeight} from './locomotion-sync.js';
import {fitEyebrowMeshesToFace} from './eyebrow-fit-runtime.js?v=4.4.56';
const loader=new GLTFLoader(),assets=new Map();
function load(path){if(!assets.has(path))assets.set(path,loader.loadAsync(path).catch(e=>{assets.delete(path);throw e}));return assets.get(path)}
let profilePromise;
function profile(){return profilePromise??=fetch('./data/character-system/rig-profiles.json').then(r=>{if(!r.ok)throw Error('rig profile HTTP '+r.status);return r.json()}).then(j=>j.profiles['quaternius-humanoid'])}
// The imported skinned GLTF's cached object bounds can be calculated before its
// bind matrices are synchronized, shrinking a 1.8m person to ~0.45m on paper.
// Use the real unposed vertices when normalizing character height and feet.
function restGeometryBounds(model){
 const bounds=new THREE.Box3();model.updateMatrixWorld(true);
 model.traverse(mesh=>{
  if(!mesh.isSkinnedMesh||!mesh.geometry?.attributes?.position)return;
  const piece=new THREE.Box3().setFromBufferAttribute(mesh.geometry.attributes.position);
  piece.applyMatrix4(mesh.matrixWorld);bounds.union(piece);
 });
 return bounds.isEmpty()?new THREE.Box3().setFromObject(model):bounds;
}
export async function createCharacter({job='剣士',sex='male',height=.95,jobs,jumpLift=.55}={}){
 const [body,rigProfile]=await Promise.all([load(CHARACTER_MODEL_REGISTRY[sex].url),profile()]);
 const object3D=new THREE.Group(),model=clone(body.scene);object3D.add(model);
 fitEyebrowMeshesToFace(model);
 const bounds=restGeometryBounds(model),h=bounds.getSize(new THREE.Vector3()).y;
 if(h>0){model.scale.multiplyScalar(height/h);model.updateMatrixWorld(true);model.position.y-=restGeometryBounds(model).min.y}
 model.traverse(o=>{if(o.isSkinnedMesh)o.frustumCulled=false});
 const footNames=[rigProfile.boneNames.left.foot,rigProfile.boneNames.right.foot,rigProfile.boneNames.left.toe,rigProfile.boneNames.right.toe];
 const feet=[];model.traverse(o=>{if(o.isBone&&footNames.includes(o.name))feet.push(o)});
 model.updateMatrixWorld(true);
 const baselineY=model.position.y;
 const footPoint=new THREE.Vector3();
 const inverseCharacterWorld=new THREE.Matrix4();
 function lowestFoot(){
  // The rest-foot reference is LOCAL to this character. A world-space foot
  // reading subtracts terrain elevation when the entire soldier climbs,
  // causing the foot correction to bury boots into slopes and steps.
  object3D.updateWorldMatrix(true,false);
  inverseCharacterWorld.copy(object3D.matrixWorld).invert();
  let lowest=Infinity;
  for(const foot of feet){
   foot.getWorldPosition(footPoint);
   footPoint.applyMatrix4(inverseCharacterWorld);
   lowest=Math.min(lowest,footPoint.y);
  }
  return lowest;
 }
 const restFootY=lowestFoot();
 // Traverse order can be foot→toe→opposite foot. Select both actual ankles
 // by name instead of accidentally locking the left ankle and left toe.
 const plantedFeet=[rigProfile.boneNames.left.foot,rigProfile.boneNames.right.foot]
   .map(name=>feet.find(foot=>foot.name===name)).filter(Boolean);
 const plantAnchor=new THREE.Vector3();
 const plantedPosition=new THREE.Vector3(),footA=new THREE.Vector3(),footB=new THREE.Vector3();
 const lockRotation=new THREE.Quaternion(),lockDelta=new THREE.Vector3();
 let locomotionPhase=null,plantStep=-1,plantedFoot=null;
 let stateName='idle',jumpTime=0,jumpDuration=.9;
 const bindings=new Map();let current=null,active=null,request=0;
 // Keep a stable bind pose for the entire character lifetime, across assets.
 model.traverse(o=>{if(o.isSkinnedMesh&&o.skeleton)o.skeleton.pose()});
 model.updateMatrixWorld(true);
 const targetRest=new Map(),targetParentRestWorld=new Map();model.traverse(o=>{if(o.isBone){targetRest.set(o.name,o.quaternion.clone());targetParentRestWorld.set(o.name,o.parent.getWorldQuaternion(new THREE.Quaternion()))}});
 async function play(state){
  return playRow(resolveJobMotion(jobs,job,state),state);
 }
 async function playCommand(command){
  const row=(jobs?.[job]||[]).find(r=>r.command===command&&r.available===true);
  return playRow(row,command);
 }
 function syncLocomotionPhase(phase){locomotionPhase=Number.isFinite(phase)?phase:null;}
 async function playRow(row,state){
  const id=++request;
  if(!row)return false;
  let b=bindings.get(row.asset);
  if(!b){
   const gltf=await load(row.asset);if(id!==request)return false;
   const source=clone(gltf.scene);
   source.traverse(o=>{if(o.isSkinnedMesh&&o.skeleton)o.skeleton.pose()});
   // Do not pose the visible character during an asynchronous clip switch.
   const pairs=buildRigPairs(THREE,source,model,rigProfile).pairs;
   for(const p of pairs){
    p.targetRestLocal.copy(targetRest.get(p.to.name)||p.targetRestLocal);
    const restParent=targetParentRestWorld.get(p.to.name);
    if(restParent)p.basis.copy(restParent).invert().multiply(p.from.parent.getWorldQuaternion(new THREE.Quaternion()));
   }
   if(pairs.length<10)throw Error('Rig mapping insufficient: '+pairs.length);
   b={source,pairs,mixer:new THREE.AnimationMixer(source),clips:gltf.animations};bindings.set(row.asset,b);
  }
  if(id!==request)return false;
  const clip=b.clips.find(c=>c.name===row.clip);if(!clip)throw Error('Missing clip '+row.clip);
  for(const prev of bindings.values())prev.mixer.stopAllAction();
  active=b;stateName=state;if(state==='jump'){jumpTime=0;jumpDuration=Math.max(.55,clip.duration)}current=b.mixer.clipAction(clip);current.reset().setLoop(['attack','jump','dead','death','hit'].includes(state)?THREE.LoopOnce:THREE.LoopRepeat);current.clampWhenFinished=true;current.play();
  return true;
 }
 function update(dt){
  if(!active)return;
  if(stateName==='jump'){jumpTime=Math.min(jumpDuration,jumpTime+dt);object3D.position.y=Math.sin(Math.PI*jumpTime/jumpDuration)*jumpLift}else object3D.position.y=0;
  const distanceDriven=(stateName==='walk'||stateName==='run')&&locomotionPhase!=null;
  if(distanceDriven&&current){
   current.time=clipTimeForStepPhase(locomotionPhase,current.getClip().duration);
   active.mixer.update(0);
  }else active.mixer.update(dt);
  active.source.updateMatrixWorld(true);
  // Avoid resetting the target skeleton each frame; mapped joints receive
  // absolute rotations from their immutable bind pose.
  applyRigPairs(THREE,active.pairs);
  model.updateMatrixWorld(true);
  if(feet.length&&Number.isFinite(restFootY)&&stateName!=='jump'){
   const desiredY=groundedModelY(model.position.y,baselineY,restFootY,lowestFoot(),height);
   model.position.y=THREE.MathUtils.lerp(model.position.y,desiredY,Math.min(1,dt*16));
   model.updateMatrixWorld(true);
  }else if(stateName==='jump'){
   model.position.y=THREE.MathUtils.lerp(model.position.y,baselineY,Math.min(1,dt*12));
  }
  // A short, bounded world-space stance constraint prevents the boot from
  // skating under the moving actor root. Keep collision and pathfinding at the
  // authoritative root, and release the correction during the swing phase.
  if(distanceDriven&&plantedFeet.length===2){
   const {step,progress}=footfallAtPhase(locomotionPhase);
   if(step!==plantStep){
    plantStep=step;
    plantedFeet[0].getWorldPosition(footA);plantedFeet[1].getWorldPosition(footB);
    plantedFoot=footA.y<=footB.y?plantedFeet[0]:plantedFeet[1];
    plantedFoot.getWorldPosition(plantAnchor);
   }
   const weight=footPlantWeight(progress);
   if(weight>0&&plantedFoot){
    plantedFoot.getWorldPosition(plantedPosition);
    object3D.getWorldQuaternion(lockRotation).invert();
    lockDelta.copy(plantAnchor).sub(plantedPosition).applyQuaternion(lockRotation);
    model.position.x=THREE.MathUtils.clamp(model.position.x+lockDelta.x*weight,-height*.15,height*.15);
    model.position.z=THREE.MathUtils.clamp(model.position.z+lockDelta.z*weight,-height*.15,height*.15);
   }else{
    model.position.x=THREE.MathUtils.lerp(model.position.x,0,Math.min(1,dt*15));
    model.position.z=THREE.MathUtils.lerp(model.position.z,0,Math.min(1,dt*15));
   }
   model.updateMatrixWorld(true);
  }else{
   plantStep=-1;plantedFoot=null;
   model.position.x=THREE.MathUtils.lerp(model.position.x,0,Math.min(1,dt*15));
   model.position.z=THREE.MathUtils.lerp(model.position.z,0,Math.min(1,dt*15));
  }
 }
 function dispose(){request++;for(const b of bindings.values())b.mixer.stopAllAction();bindings.clear()}
 return {object3D,model,play,playCommand,syncLocomotionPhase,update,dispose,diagnostics:()=>({state:stateName,active:!!active,clip:current?.getClip()?.name||null,playing:!!current?.isRunning(),rigPairs:active?.pairs?.length||0,boneCount:(()=>{let n=0;model.traverse(o=>{if(o.isBone)n++});return n})()})};
}
