/** KayKit -> Quaternius gameplay motion bridge. Source and target bones are independent. */
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone as cloneSkinned} from 'three/addons/utils/SkeletonUtils.js';
import {buildRigPairs,applyRigPairs} from './character-system/retarget-adapter.js?v=3.4.2';
const ROOT='./motions/external/kaykit/KayKit_Character_Animations_1.1/Animations/gltf/Rig_Medium/';
const FILES=['Rig_Medium_MovementBasic.glb','Rig_Medium_CombatMelee.glb','Rig_Medium_General.glb'];
const cache=new Map();
const loader=new GLTFLoader();
function asset(file){if(!cache.has(file))cache.set(file,loader.loadAsync(ROOT+file).catch(e=>{cache.delete(file);throw e}));return cache.get(file)}
let profilePromise;
function profile(){return profilePromise??=fetch('./data/character-system/rig-profiles.json?v=3.4.2').then(r=>{if(!r.ok)throw Error('Rig profile HTTP '+r.status);return r.json()}).then(j=>j.profiles['quaternius-humanoid'])}
const CHOICES={
 idle:['Melee_2H_Idle','Idle_A','Idle_B'],
 walk:['Walking_A','Walking_B'],run:['Running_A','Running_B'],
 attack:['Melee_1H_Attack_Slice_Horizontal','Melee_1H_Attack_Slice_Diagonal'],
 hit:['Hit_A','Hit_B'],dead:['Death_A','Death_B'],
 guard:['Melee_2H_Idle'],dodge:['Dodge_A','Roll_A']
};
function findClip(loaded,names){for(const name of names){for(const entry of loaded){const clip=entry.animations.find(a=>a.name===name);if(clip)return {entry,clip}}}return null}
export async function installKaykitGameplayMotion(host,job='swordsman'){
 if(!host?.userData?.chibi)return false;
 const visible=host.children.find(x=>x.userData?.sourceModelId);
 if(!visible)return false;
 const [rigProfile,...loaded]=await Promise.all([profile(),...FILES.map(asset)]);
 const definitions={};for(const [key,names] of Object.entries(CHOICES)){const found=findClip(loaded,names);if(found)definitions[key]=found}
 if(!definitions.idle||!definitions.walk||!definitions.run||!definitions.attack)return false;
 const source=cloneSkinned(definitions.idle.entry.scene);
 const pairs=buildRigPairs(THREE,source,visible,rigProfile);
 if(pairs.pairs.length<15)throw Error('KayKit bone coverage '+pairs.pairs.length+'/21');
 // Different animation files use the same Rig_Medium skeleton names.
 const mixer=new THREE.AnimationMixer(source);
 const actions={};for(const [key,item] of Object.entries(definitions)){actions[key]=mixer.clipAction(item.clip);actions[key].setLoop(['attack','hit','dead','dodge'].includes(key)?THREE.LoopOnce:THREE.LoopRepeat);actions[key].clampWhenFinished=key==='dead'}
 source.visible=false;host.add(source);
 host.userData.kaykitGameplayMotion={source,mixer,actions,pairs:pairs.pairs,current:null,job,lastAttackSequence:-1,coverage:pairs.coverage};
 host.userData.kaykitRigCoverage=Math.round(pairs.coverage*100);
 return true;
}
export function tickKaykitGameplayMotion(host,dt,action){
 const m=host.userData?.kaykitGameplayMotion;if(!m)return false;
 const key=m.actions[action]?action:(action==='backwalk'||action==='sidestep'?'walk':'idle');
 const seq=host.userData.attackSequence||0;
 const restart=key==='attack'&&m.lastAttackSequence!==seq;
 if(restart)m.lastAttackSequence=seq;
 if(m.current!==key||restart){
  if(m.current&&m.actions[m.current])m.actions[m.current].fadeOut(.12);
  const next=m.actions[key];next.reset().fadeIn(.12).play();m.current=key;
 }
 m.mixer.update(Math.max(0,Math.min(.05,dt)));
 m.source.updateMatrixWorld(true);
 applyRigPairs(THREE,m.pairs);
 return true;
}
