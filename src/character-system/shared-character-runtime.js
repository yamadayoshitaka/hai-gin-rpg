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
export async function createCharacter({job='剣士',sex='male',height=.95,jobs}={}){
 const [body,rigProfile]=await Promise.all([load(CHARACTER_MODEL_REGISTRY[sex].url),profile()]);
 const object3D=new THREE.Group(),model=clone(body.scene);object3D.add(model);
 const bounds=new THREE.Box3().setFromObject(model),h=bounds.getSize(new THREE.Vector3()).y;
 if(h>0){model.scale.multiplyScalar(height/h);model.updateMatrixWorld(true);model.position.y-=new THREE.Box3().setFromObject(model).min.y}
 model.traverse(o=>{if(o.isSkinnedMesh)o.frustumCulled=false});
 const bindings=new Map();let current=null,active=null,request=0;
 async function play(state){
  const id=++request,row=resolveJobMotion(jobs,job,state);
  if(!row)return false;
  let b=bindings.get(row.asset);
  if(!b){
   const gltf=await load(row.asset);if(id!==request)return false;
   const source=clone(gltf.scene);
   source.traverse(o=>{if(o.isSkinnedMesh&&o.skeleton)o.skeleton.pose()});
   model.traverse(o=>{if(o.isSkinnedMesh&&o.skeleton)o.skeleton.pose()});
   const pairs=buildRigPairs(THREE,source,model,rigProfile).pairs;
   if(pairs.length<10)throw Error('Rig mapping insufficient: '+pairs.length);
   b={source,pairs,mixer:new THREE.AnimationMixer(source),clips:gltf.animations};bindings.set(row.asset,b);
  }
  if(id!==request)return false;
  const clip=b.clips.find(c=>c.name===row.clip);if(!clip)throw Error('Missing clip '+row.clip);
  for(const prev of bindings.values())prev.mixer.stopAllAction();
  active=b;current=b.mixer.clipAction(clip);current.reset().setLoop(['attack','jump'].includes(state)?THREE.LoopOnce:THREE.LoopRepeat);current.clampWhenFinished=true;current.play();
  return true;
 }
 function update(dt){
  if(!active)return;
  active.mixer.update(dt);
  active.source.updateMatrixWorld(true);
  model.traverse(o=>{if(o.isSkinnedMesh&&o.skeleton)o.skeleton.pose()});
  model.updateMatrixWorld(true);
  applyRigPairs(THREE,active.pairs);
  model.updateMatrixWorld(true);
 }
 function dispose(){request++;for(const b of bindings.values())b.mixer.stopAllAction();bindings.clear()}
 return {object3D,model,play,update,dispose};
}
