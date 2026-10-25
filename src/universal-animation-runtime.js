/** CC0 Universal Animation Library integration. Never mixes procedural bone rotation with imported animation. */
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import * as THREE from 'three';
import {COMBAT_PRESENTATION,equipmentVisual} from './combat-presentation-bom.js?v=114.2';
import {BATTLE_RULES} from './battle-controller.js?v=115.5';
const SOURCE='./assets/animations/UAL1_Standard.glb';
const EQUIPMENT_ASSET_ROOT='./assets/props/fantasy-megakit/';
const equipmentLoads=new Map();
function equipmentAsset(id){
 if(!equipmentLoads.has(id))equipmentLoads.set(id,new GLTFLoader().loadAsync(EQUIPMENT_ASSET_ROOT+id+'.gltf').catch(e=>{equipmentLoads.delete(id);throw e;}));
 return equipmentLoads.get(id);
}
let libraryRequest=null;
let missingAssetUntilReload=false;
const JOB_ATTACK={swordsman:'Sword_Attack',knight:'Sword_Attack',rogue:'Punch_Cross',monk:'Punch_Jab',merchant:'Interact',traveler:'Sword_Attack',smith:'Sword_Attack',chef:'Sword_Attack',herbalist:'Spell_Simple_Shoot',bard:'Dance_Loop',farmer:'Sword_Attack',scholar:'Spell_Simple_Shoot',innkeeper:'Punch_Jab',priest:'Spell_Simple_Shoot',mage:'Spell_Simple_Shoot',archer:'Pistol_Shoot',paladin:'Sword_Attack',assassin:'Punch_Cross',samurai:'Sword_Attack',ranger:'Pistol_Shoot'};
// Data-driven motion recipes. Fallbacks are guaranteed existing job clips.
const JOB_COMBO_RECIPES={
 swordsman:['Sword_Attack','Punch_Cross'],knight:['Sword_Attack','Sword_Attack'],
 rogue:['Punch_Jab','Punch_Cross'],monk:['Punch_Jab','Punch_Cross'],
 merchant:['Interact','Punch_Jab'],traveler:['Sword_Attack','Punch_Jab'],
 smith:['Sword_Attack','Punch_Cross'],chef:['Sword_Attack','Punch_Jab'],
 herbalist:['Spell_Simple_Shoot','Punch_Jab'],bard:['Dance_Loop','Punch_Cross'],
 farmer:['Sword_Attack','Punch_Jab'],scholar:['Spell_Simple_Shoot','Punch_Jab'],
 innkeeper:['Punch_Jab','Punch_Cross'],priest:['Spell_Simple_Shoot','Sword_Attack'],
 mage:['Spell_Simple_Shoot','Spell_Simple_Shoot'],archer:['Pistol_Shoot','Punch_Cross'],
 paladin:['Sword_Attack','Spell_Simple_Shoot'],assassin:['Punch_Cross','Punch_Jab'],
 samurai:['Sword_Attack','Sword_Attack'],ranger:['Pistol_Shoot','Punch_Jab']
};
// Each job provides ordered middle / lower / special attack clip candidates.
const JOB_STRIKE_CANDIDATES=Object.fromEntries(Object.entries(JOB_COMBO_RECIPES).map(([job,clips])=>[job,[clips[0],['Kick_Low','Kick_Front','Kick','Leg_Sweep',clips[1]],JOB_ATTACK[job]||clips[0]]]));
const ACTION_CLIPS={idle:'Idle_Loop',walk:'Walk_Loop',run:'Sprint_Loop',guard:'Sword_Idle',crouch:'Idle_Loop',backwalk:'Walk_Loop',sidestep:'Walk_Loop',hit:'Hit_Chest',dead:'Death01',dodge:'Roll',heal:'Spell_Simple_Shoot'};
function selectClip(clips,name){return clips.find(c=>c.name===name);}
function getAsset(){if(missingAssetUntilReload)throw Error('UAL GLB missing from GitHub assets');if(!libraryRequest)libraryRequest=new GLTFLoader().loadAsync(SOURCE).catch(e=>{libraryRequest=null;missingAssetUntilReload=true;throw e});return libraryRequest;}
export async function installLibraryMotion(host,job='swordsman'){
 if(!host?.userData?.chibi)return false;
 const lib=await getAsset();
 const visible=host.children.find(child=>child.userData?.sourceModelId)||host.children.find(child=>child.type==='Group'&&child!==host.userData.chibi.root&&child.children.some(x=>x.isSkinnedMesh));
 // An external Quaternius skin must be present. No silent procedural 'success'.
 if(!visible)throw Error('External rig unavailable; not enabling UAL animation');
 const bones=new Map(),boneCopies=new Map();visible.traverse(x=>{if(x.isBone){if(!bones.has(x.name))bones.set(x.name,x);if(!boneCopies.has(x.name))boneCopies.set(x.name,[]);boneCopies.get(x.name).push(x);}});
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
   const targets=boneCopies.get(name);if(!targets?.length)continue;
   const field=track.name.slice(dot+1);
   // Root location is owned by the game's movement system, not the imported clip.
   if(name==='root'&&field==='position')continue;
   // Use UUID binding so duplicate imported names cannot hijack animation.
   for(const target of targets){const clone=track.clone();clone.name=target.uuid+'.'+field;tracks.push(clone);}
  }
  if(tracks.length)animationClips[action]=new THREE.AnimationClip(clipName,source.duration,tracks);
 }
 for(const [jobId,attackName] of Object.entries(JOB_ATTACK)){
  const src=selectClip(lib.animations,attackName);if(!src)continue;
  const mapped=src.tracks.flatMap(t=>{const name=t.name.slice(0,t.name.lastIndexOf('.')).replace(/^.*[\\/]/,'').replace(/^.*:/,'');return (boneCopies.get(name)||[]).map(b=>{const clone=t.clone();clone.name=b.uuid+'.'+t.name.slice(t.name.lastIndexOf('.')+1);return clone;});});
  if(mapped.length)jobAttackClips[jobId]=new THREE.AnimationClip(attackName,src.duration,mapped);
 }
 const comboClips={};
 for(const [jobId,names] of Object.entries(JOB_STRIKE_CANDIDATES)){
  comboClips[jobId]=names.map(name=>{
   const candidates=Array.isArray(name)?name:[name];
   const src=candidates.map(candidate=>selectClip(lib.animations,candidate)).find(Boolean);
   if(!src)return null;
   const tracks=src.tracks.flatMap(t=>{
    const dot=t.name.lastIndexOf('.');if(dot<0)return [];
    const boneName=t.name.slice(0,dot).replace(/^.*[\\/]/,'').replace(/^.*:/,'');
    return (boneCopies.get(boneName)||[]).map(b=>{const q=t.clone();q.name=b.uuid+'.'+t.name.slice(dot+1);return q;});
   });
   return tracks.length?new THREE.AnimationClip(name,src.duration,tracks):null;
  });
 }
 if(!animationClips.idle||!animationClips.walk||!animationClips.run||!animationClips.attack)throw Error('Missing compatible critical UAL clips');
 // A late async asset must not replace the actor's pose halfway through a strike.
 // Preserve the procedural retargeting until an idle handover is safe.
 const actor=host.userData.chibi;
 if(actor.attack||actor.hit||actor.dead||host.userData.hitKnockback){
  host.userData.ualDeferred='actor-busy-at-load';
  return false;
 }
 const mixer=new THREE.AnimationMixer(visible),actions=Object.fromEntries(Object.entries(animationClips).map(([k,clip])=>[k,mixer.clipAction(clip)]));
 for(const [key,act] of Object.entries(actions)){act.setLoop(['attack','hit','dead','dodge','heal'].includes(key)?THREE.LoopOnce:THREE.LoopRepeat);if(['attack','hit','dead'].includes(key))act.clampWhenFinished=true;}
 const rightHand=bones.get('hand_r')||bones.get('wrist_r')||bones.get('lowerarm_r');
 if(rightHand){
  // Weapons must follow the actual visible animated skeleton, never the inactive proxy rig.
  const weaponMount=new THREE.Group();weaponMount.name='ual-visible-weapon-attachment';rightHand.add(weaponMount);
  const steel=new THREE.MeshStandardMaterial({color:0xb5c6d4,metalness:.72,roughness:.3});
  const wood=new THREE.MeshStandardMaterial({color:0x60442a,roughness:.85});
  const leftHand=bones.get('hand_l')||bones.get('wrist_l')||bones.get('lowerarm_l');
  let equipmentVersion=0;
  const typeByJob={swordsman:'sword',knight:'sword',rogue:'dagger',monk:'none',merchant:'none',traveler:'sword',smith:'hammer',chef:'dagger',herbalist:'staff',bard:'none',farmer:'staff',scholar:'staff',innkeeper:'none',priest:'staff',mage:'staff',archer:'bow',paladin:'sword',assassin:'dagger',samurai:'katana',ranger:'bow'};
  const equip=(jobId)=>{
   const version=++equipmentVersion;
   while(weaponMount.children.length){const o=weaponMount.children[0];weaponMount.remove(o);if(o.geometry&&!o.userData.realAsset)o.geometry.dispose();}
   host.userData.equipmentSource='procedural';
   const type=typeByJob[jobId]||'sword';if(type==='none')return;
    const presentation=equipmentVisual(type);
    weaponMount.position.set(0,0,0);weaponMount.rotation.set(0,0,0);
    weaponMount.scale.setScalar(COMBAT_PRESENTATION.weaponMountScale);
   const add=(geo,mat,x,y,z)=>{const o=new THREE.Mesh(geo,mat);o.position.set(x,y,z);weaponMount.add(o);return o;};
   add(new THREE.CylinderGeometry(.022,.024,.19,10),wood,0,-.07,0);
   if(type==='sword'||type==='katana'){add(new THREE.BoxGeometry(type==='katana'?.031:.07,.032,.12),steel,0,-.19,0);const blade=add(new THREE.CylinderGeometry(.004,type==='katana'?.036:.052,type==='katana'?.70:.56,4,1),steel,0,type==='katana'?-.56:-.49,0);blade.rotation.y=Math.PI/4;blade.rotation.z=type==='katana'?.07:0;add(new THREE.BoxGeometry(.065,.045,.04),wood,0,-.15,0);}
   else if(type==='dagger'){add(new THREE.BoxGeometry(.06,.02,.09),steel,0,-.16,0);add(new THREE.ConeGeometry(.04,.26,4),steel,0,-.34,0).rotation.z=Math.PI;}
   else if(type==='staff'){add(new THREE.CylinderGeometry(.018,.023,.93,9),wood,0,-.43,0);add(new THREE.OctahedronGeometry(.066),steel,0,-.86,0);}
   else if(type==='hammer'){add(new THREE.CylinderGeometry(.022,.025,.55,10),wood,0,-.25,0);const head=add(new THREE.CylinderGeometry(.095,.11,.3,8),steel,0,-.60,0);head.rotation.z=Math.PI/2;}
   else if(type==='bow'){const bow=add(new THREE.TorusGeometry(.41,.023,6,20,Math.PI),wood,0,-.42,0);bow.rotation.z=Math.PI/2;const string=add(new THREE.CylinderGeometry(.005,.005,.79,6),steel,.11,-.42,0);string.rotation.z=-.04;}
   // Real textured equipment replaces a placeholder only after GLTF, BIN and atlases load.
   const sourceId=presentation.asset;
   if(sourceId){
    const fallback=[...weaponMount.children];
    equipmentAsset(sourceId).then(asset=>{
     if(version!==equipmentVersion)return;
     const mesh=asset.scene.clone(true),bounds=new THREE.Box3().setFromObject(mesh);
     const dims=bounds.getSize(new THREE.Vector3());
     if(!Number.isFinite(dims.length())||dims.length()<.1)return;
     const dimension=sourceId==='Axe_Bronze'?dims.x:dims.y;
     const scale=presentation.length/Math.max(.001,dimension);
     mesh.scale.setScalar(scale);
     mesh.rotation.set(...presentation.rotation);
     mesh.position.set(...presentation.offset);
     mesh.userData.realAsset=true;
     weaponMount.add(mesh);
     for(const placeholder of fallback)placeholder.visible=false;
     host.userData.equipmentSource='quaternius-megakit:'+sourceId;
    }).catch(err=>{host.userData.weaponAssetError=String(err?.message||err);});
   }
  };
  equip(job);
  host.userData.ualEquip=equip;
  weaponMount.scale.setScalar(COMBAT_PRESENTATION.weaponMountScale);
  host.userData.ualWeaponMount=weaponMount;
  const old=host.userData.chibi.root;
  old.traverse(x=>{if(x.name==='weapon-bom-mount')x.visible=false;});
 }
 // Additive chest impact is relative to the animation itself; feet and actor position stay planted.
 const chestBones=[...(boneCopies.get('spine_02')||[]),...(boneCopies.get('spine_01')||[])];
 const chestOriginal=new Map(chestBones.map(b=>[b,b.quaternion.clone()]));
 host.userData.universalMotion={mixer,actions,current:'idle',job,jobAttackClips,comboClips,lastAttackSequence:0,clipCount:lib.animations.length,boneCount:bones.size,facialRigCopies:(boneCopies.get('Head')||[]).length,chestBones,chestOriginal,hitClock:0,crouchWeight:0,crouchVisual:visible,crouchBaseScale:visible.scale.clone(),pelvisBone:bones.get('pelvis')||null,pelvisBaseY:(bones.get('pelvis')?.position.y||0),legBones:{leftThigh:boneCopies.get('thigh_l')||[],rightThigh:boneCopies.get('thigh_r')||[],leftShin:boneCopies.get('shin_l')||[],rightShin:boneCopies.get('shin_r')||[]}};
 // Prime imported bind pose before disabling the existing animation authority.
 actions.idle.play();
 mixer.update(0);
 host.userData.externalNpcSync=null;
 host.userData.chibi.root.traverse(x=>{if(x.isMesh)x.visible=false});
 host.userData.characterVisualSource='ual-external-motion';
 return true;
}
export function tickLibraryMotion(host,dt,action,job){
 const motion=host.userData?.universalMotion;if(!motion)return false;
 if(motion.job!==job){
  motion.job=job;
  host.userData.ualEquip?.(job);
  const clip=motion.jobAttackClips?.[job];
  if(clip){motion.actions.attack.stop();motion.actions.attack=motion.mixer.clipAction(clip);motion.actions.attack.setLoop(THREE.LoopOnce);motion.actions.attack.clampWhenFinished=true;}
 }
 if(action==='attack'){
  const sequence=host.userData.attackSequence||1;
  if(sequence!==motion.lastAttackSequence){
   motion.lastAttackSequence=sequence;
   const recipe=motion.comboClips?.[job]||[];
   const style=host.userData.attackStyle||'quick';
   const pick=style==='special'?2:style==='low'?1:style==='mid'?0:(sequence-1)%Math.max(1,recipe.length);
   const clip=recipe[Math.max(0,pick)]||motion.jobAttackClips?.[job];
   if(clip){
    motion.actions.attack.stop();
    motion.actions.attack=motion.mixer.clipAction(clip);
    motion.actions.attack.setLoop(THREE.LoopOnce);
    motion.actions.attack.clampWhenFinished=true;
   }
   motion.current='attack-restart';
  }
 }
 // Use a stationary stance if locomotion was not confirmed by the movement controller.
 const next=motion.actions[action]||motion.actions.idle;
 if(action==='backwalk'||action==='sidestep')next.setEffectiveTimeScale(action==='backwalk'?BATTLE_RULES.guard.backwalkPlayback:.85);
 else next.setEffectiveTimeScale(1);
 if(next&&motion.current!==action){
  const previous=motion.actions[motion.current];
  if(previous&&previous!==next)previous.fadeOut(.12);
  if(previous!==next)next.reset().fadeIn(.12).play();
  motion.current=action;
 }
 // Shared clip aliases can leave a faded locomotion action playing at rest.
 if(action==='idle'||action==='guard'||action==='crouch'){
  for(const key of ['walk','run','backwalk','sidestep']){
   const movingAction=motion.actions[key];
   if(movingAction&&movingAction!==next){movingAction.stop();movingAction.setEffectiveWeight(0);}
  }
  next.setEffectiveWeight(1);
  if(!next.isRunning())next.play();
 }
 motion.mixer.update(Math.min(.05,Math.max(0,dt)));
 // Only the animation mixer owns the base pose; overlays are recalculated from it.
 // Never accumulate previous-frame crouch rotations or move the actor collision root.
 const crouching=action==='crouch';
 motion.crouchWeight=THREE.MathUtils.damp(motion.crouchWeight,crouching?1:0,12,dt);
 const crouch=motion.crouchWeight;
 const rotate=(bones,angle)=>{
  const offset=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),angle);
  for(const bone of bones||[])bone.quaternion.multiply(offset);
 };
 if(crouch>.001){
  // Low compact fighting stance, not the deep squat that lifts both feet.
  rotate(motion.legBones.leftThigh,-.55*crouch);
  rotate(motion.legBones.rightThigh,-.55*crouch);
  rotate(motion.legBones.leftShin,.85*crouch);
  rotate(motion.legBones.rightShin,.85*crouch);
  rotate(motion.chestBones,.075*crouch);
 }
 // Pelvis displacement is restored to bind height on each frame when standing.
 // Keep a modest offset to avoid detached feet on imported character skeletons.
 if(motion.pelvisBone)motion.pelvisBone.position.y=motion.pelvisBaseY-.20*crouch;
 // Whole-character compression is a fallback for differing GLB bone axes: the fighter must visibly crouch.
 // Preserve original import dimensions for fully reversible neutral stance.
 if(motion.crouchVisual)motion.crouchVisual.scale.y=motion.crouchBaseScale.y*(1-.23*crouch);
 if(action==='backwalk')rotate(motion.chestBones,.12);
 // Distinct backward flinch: quick impact, brief arch, recovery. No sideways translation.
 if(action==='hit'&&motion.current==='hit')motion.hitClock=Math.min(.52,motion.hitClock+dt);
 else motion.hitClock=0;
 const t=motion.hitClock;
 const bend=t>0&&t<.52?Math.sin(Math.PI*Math.pow(t/.52,.68))*.21:0;
 const impactQuat=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),-bend);
 for(const bone of motion.chestBones||[])bone.quaternion.multiply(impactQuat);
 // Rear recovery step, synchronized with the collision-aware knockback.
 // A planted support leg bends while the other thigh swings backwards and knee lifts.
 if(t>0&&t<.52){
  const p=t/.52;
  const lift=Math.sin(Math.PI*Math.min(1,p/.67));
  const plant=Math.sin(Math.PI*p);
  const side=(host.userData?.hitRecoilSide||1)>0?1:-1;
  const legs=motion.legBones;
  const rotate=(bones,angle)=>{const q=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),angle);for(const b of bones||[])b.quaternion.multiply(q);};
  rotate(side>0?legs.rightThigh:legs.leftThigh,-.35*lift);
  rotate(side>0?legs.rightShin:legs.leftShin,.48*lift);
  rotate(side>0?legs.leftThigh:legs.rightThigh,.12*plant);
  rotate(side>0?legs.leftShin:legs.rightShin,.20*plant);
 }
 return true;
}
export const UAL_ASSET_PATH=SOURCE;
