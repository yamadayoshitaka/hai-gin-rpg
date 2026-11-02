import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone as cloneSkinned} from 'three/addons/utils/SkeletonUtils.js';
import {buildRigPairs,applyRigPairs} from './retarget-adapter.js';
import {loadJobMotionMap,resolveJobMotion} from './job-motion-source.js';
const loader=new GLTFLoader();
const assets=new Map();
const BASE='./motions/external/kaykit/KayKit_Character_Animations_1.1/Mannequin Character/characters/Mannequin_Medium.glb';
function load(path){
 if(!assets.has(path))assets.set(path,loader.loadAsync(encodeURI(path)).catch(e=>{assets.delete(path);throw e}));
 return assets.get(path);
}
let profilePromise;
const profile=()=>profilePromise??=fetch('./data/character-system/rig-profiles.json').then(r=>{if(!r.ok)throw Error('rig profile '+r.status);return r.json()}).then(j=>j.profiles['quaternius-humanoid']);
/** A separate invisible source rig is required per actor. No mesh is added to the scene. */
export async function createJobMotionController(THREE,target,job){
 const [jobs,rigProfile,base]=await Promise.all([loadJobMotionMap(),profile(),load(BASE)]);
 const source=cloneSkinned(base.scene);
 source.updateMatrixWorld(true);
 target.updateMatrixWorld(true);
 const rig=buildRigPairs(THREE,source,target,rigProfile);
 if(rig.coverage<.65)throw Error('Retarget coverage too low: '+rig.coverage);
 const mixer=new THREE.AnimationMixer(source);
 let state='',current=null,active=null,generation=0,disposed=false;
 async function select(next){
  if(disposed)return false;
  const spec=resolveJobMotion(jobs,job,next);
  if(!spec)return false;
  if(state===next&&current===spec.clip)return true;
  const ticket=++generation;
  try{
   const asset=await load('./'+spec.asset.replace(/^\.\//,''));
   if(disposed||ticket!==generation)return false;
   const clip=asset.animations.find(c=>c.name===spec.clip);
   if(!clip)throw Error('Missing exact clip '+spec.clip);
   if(active)active.fadeOut(.12);
   active=mixer.clipAction(clip);active.reset().fadeIn(.12).play();
   state=next;current=spec.clip;
   return true;
  }catch(e){console.warn('Job motion unavailable:',job,next,e);return false}
 }
 return {
  get state(){return state},get clip(){return current},get coverage(){return rig.coverage},
  select,
  update(dt){if(disposed||!active)return false;mixer.update(dt);source.updateMatrixWorld(true);target.updateMatrixWorld(true);applyRigPairs(THREE,rig.pairs);return true},
  dispose(){disposed=true;generation++;mixer.stopAllAction();mixer.uncacheRoot(source)}
 };
}
