// Shared runtime for the external motion tester and tactical game.
// The game owns only world position and command selection; this module owns model and animation.
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {CHARACTER_MODEL_REGISTRY} from '../character-model-registry.js';
import {buildRigPairs,applyRigPairs} from './retarget-adapter.js';
import {resolveJobMotion} from './job-motion-source.js';
const loader=new GLTFLoader(),assets=new Map();
function load(path){if(!assets.has(path))assets.set(path,loader.loadAsync(path).catch(e=>{assets.delete(path);throw e}));return assets.get(path)}
let profilePromise;
function profile(){return profilePromise??=fetch('./data/character-system/rig-profiles.json').then(r=>{if(!r.ok)throw Error('rig profile HTTP '+r.status);return r.json()}).then(j=>j.profiles['quaternius-humanoid'])}
export async function createCharacter({job='剣士',sex='male',height=.95,jobs,jumpLift=.55}={}){
 const [body,rigProfile]=await Promise.all([load(CHARACTER_MODEL_REGISTRY[sex].url),profile()]);
 const object3D=new THREE.Group(),model=clone(body.scene);object3D.add(model);
 const bounds=new THREE.Box3().setFromObject(model),h=bounds.getSize(new THREE.Vector3()).y;
 if(h>0){model.scale.multiplyScalar(height/h);model.updateMatrixWorld(true);model.position.y-=new THREE.Box3().setFromObject(model).min.y}
 model.traverse(o=>{if(o.isSkinnedMesh)o.frustumCulled=false});
 const footNames=[rigProfile.boneNames.left.foot,rigProfile.boneNames.right.foot,rigProfile.boneNames.left.toe,rigProfile.boneNames.right.toe];
 const feet=[];model.traverse(o=>{if(o.isBone&&footNames.includes(o.name))feet.push(o)});
 model.updateMatrixWorld(true);
 const baselineY=model.position.y;
 const footPoint=new THREE.Vector3();
 function lowestFoot(){let lowest=Infinity;for(const foot of feet){foot.getWorldPosition(footPoint);lowest=Math.min(lowest,footPoint.y)}return lowest}
 const restFootY=lowestFoot();
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
  active=b;stateName=state;if(state==='jump'){jumpTime=0;jumpDuration=Math.max(.55,clip.duration)}current=b.mixer.clipAction(clip);current.reset().setLoop(['attack','jump'].includes(state)?THREE.LoopOnce:THREE.LoopRepeat);current.clampWhenFinished=true;current.play();
  return true;
 }
 function update(dt){
  if(!active)return;
  if(stateName==='jump'){jumpTime=Math.min(jumpDuration,jumpTime+dt);object3D.position.y=Math.sin(Math.PI*jumpTime/jumpDuration)*jumpLift}else object3D.position.y=0;
  active.mixer.update(dt);
  active.source.updateMatrixWorld(true);
  // Avoid resetting the target skeleton each frame; mapped joints receive
  // absolute rotations from their immutable bind pose.
  applyRigPairs(THREE,active.pairs);
  model.updateMatrixWorld(true);
  if(feet.length&&Number.isFinite(restFootY)&&stateName!=='jump'){
   const difference=restFootY-lowestFoot();
   const correction=THREE.MathUtils.clamp(difference,-height*.12,height*.12);
   model.position.y=THREE.MathUtils.lerp(model.position.y,baselineY+correction,Math.min(1,dt*12));
   model.updateMatrixWorld(true);
  }else if(stateName==='jump'){
   model.position.y=THREE.MathUtils.lerp(model.position.y,baselineY,Math.min(1,dt*12));
  }
 }
 function dispose(){request++;for(const b of bindings.values())b.mixer.stopAllAction();bindings.clear()}
 return {object3D,model,play,playCommand,update,dispose};
}
