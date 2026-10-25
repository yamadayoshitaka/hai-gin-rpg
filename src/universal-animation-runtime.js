/** CC0 Universal Animation Library integration. Never mixes procedural bone rotation with imported animation. */
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import * as THREE from 'three';
const SOURCE='./assets/animations/UAL1_Standard.glb';
let libraryRequest=null;
let missingAssetUntilReload=false;
const JOB_ATTACK={swordsman:'Sword_Attack',knight:'Sword_Attack',rogue:'Punch_Cross',monk:'Punch_Jab',merchant:'Interact',traveler:'Sword_Attack',smith:'Sword_Attack',chef:'Sword_Attack',herbalist:'Spell_Simple_Shoot',bard:'Dance_Loop',farmer:'Sword_Attack',scholar:'Spell_Simple_Shoot',innkeeper:'Punch_Jab',priest:'Spell_Simple_Shoot',mage:'Spell_Simple_Shoot',archer:'Pistol_Shoot',paladin:'Sword_Attack',assassin:'Punch_Cross',samurai:'Sword_Attack',ranger:'Pistol_Shoot'};
const ACTION_CLIPS={idle:'Idle_Loop',walk:'Walk_Loop',run:'Sprint_Loop',guard:'Sword_Idle',hit:'Hit_Chest',dead:'Death01'};
function selectClip(clips,name){return clips.find(c=>c.name===name);}
function getAsset(){if(missingAssetUntilReload)throw Error('UAL GLB missing from GitHub assets');if(!libraryRequest)libraryRequest=new GLTFLoader().loadAsync(SOURCE).catch(e=>{libraryRequest=null;missingAssetUntilReload=true;throw e});return libraryRequest;}
export async function installLibraryMotion(host,job='swordsman'){
 if(!host?.userData?.chibi)return false;
 const lib=await getAsset();
 const visible=host.children.find(child=>child.userData?.sourceModelId)||host.children.find(child=>child.type==='Group'&&child!==host.userData.chibi.root&&child.children.some(x=>x.isSkinnedMesh));
 // An external Quaternius skin must be present. No silent procedural 'success'.
 if(!visible)throw Error('External rig unavailable; not enabling UAL animation');
 const bones=new Map();visible.traverse(x=>{if(x.isBone&&!bones.has(x.name))bones.set(x.name,x)});
 const essential=['upperarm_l','upperarm_r','lowerarm_l','lowerarm_r','thigh_l','thigh_r','pelvis'];
 const missing=essential.filter(k=>!bones.has(k));if(missing.length)throw Error('UAL rig incompatible '+missing.join(','));
 const animationClips={};
 const jobAttackClips={};
 for(const action of [...Object.keys(ACTION_CLIPS),'attack']){
  const clipName=action==='attack'?(JOB_ATTACK[job]||'Sword_Attack'):ACTION_CLIPS[action];
  const source=selectClip(lib.animations,clipName);if(!source)continue;
  const tracks=[];
  for(const track of source.tracks){
   const dot=track.name.lastIndexOf('.');
   if(dot<0)continue;
   const name=track.name.slice(0,dot).replace(/^.*[\/]/,'').replace(/^.*:/,'');
   const target=bones.get(name);if(!target)continue;
   const field=track.name.slice(dot+1);
   // Root location is owned by the game's movement system, not the imported clip.
   if(name==='root'&&field==='position')continue;
   // Use UUID binding so duplicate imported names cannot hijack animation.
   const clone=track.clone();clone.name=target.uuid+'.'+field;tracks.push(clone);
  }
  if(tracks.length)animationClips[action]=new THREE.AnimationClip(clipName,source.duration,tracks);
 }
 for(const [jobId,attackName] of Object.entries(JOB_ATTACK)){
  const src=selectClip(lib.animations,attackName);if(!src)continue;
  const mapped=src.tracks.filter(t=>bones.has(t.name.slice(0,t.name.lastIndexOf('.')).replace(/^.*[\\/]/,'').replace(/^.*:/,''))).map(t=>{const clone=t.clone(),name=t.name.slice(0,t.name.lastIndexOf('.')).replace(/^.*[\\/]/,'').replace(/^.*:/,'');clone.name=bones.get(name).uuid+'.'+t.name.slice(t.name.lastIndexOf('.')+1);return clone;});
  if(mapped.length)jobAttackClips[jobId]=new THREE.AnimationClip(attackName,src.duration,mapped);
 }
 if(!animationClips.idle||!animationClips.walk||!animationClips.run||!animationClips.attack)throw Error('Missing compatible critical UAL clips');
 const mixer=new THREE.AnimationMixer(visible),actions=Object.fromEntries(Object.entries(animationClips).map(([k,clip])=>[k,mixer.clipAction(clip)]));
 for(const [key,act] of Object.entries(actions)){act.setLoop(['attack','hit','dead'].includes(key)?THREE.LoopOnce:THREE.LoopRepeat);if(['attack','hit','dead'].includes(key))act.clampWhenFinished=true;}
 host.userData.universalMotion={mixer,actions,current:'idle',job,jobAttackClips,clipCount:lib.animations.length,boneCount:bones.size};
 host.userData.externalNpcSync=null;
 host.userData.chibi.root.traverse(x=>{if(x.isMesh&&!/equipment-grip|blade|shield|staff|sword/i.test(x.name||''))x.visible=false});
 host.userData.characterVisualSource='ual-external-motion';
 actions.idle.play();
 return true;
}
export function tickLibraryMotion(host,dt,action,job){
 const motion=host.userData?.universalMotion;if(!motion)return false;
 if(motion.job!==job){
  motion.job=job;
  const clip=motion.jobAttackClips?.[job];
  if(clip){motion.actions.attack.stop();motion.actions.attack=motion.mixer.clipAction(clip);motion.actions.attack.setLoop(THREE.LoopOnce);motion.actions.attack.clampWhenFinished=true;}
 }
 const next=motion.actions[action]||motion.actions.idle;
 if(next&&motion.current!==action){
  const previous=motion.actions[motion.current];if(previous&&previous!==next)previous.fadeOut(.15);
  next.reset().fadeIn(.15).play();motion.current=action;
 }
 motion.mixer.update(Math.min(.05,Math.max(0,dt)));
 return true;
}
export const UAL_ASSET_PATH=SOURCE;
