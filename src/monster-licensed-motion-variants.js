/**
 * Real CC0 Quaternius UAL2 motions ALREADY BUNDLED as
 * assets/characters/quaternius-base/animations.glb.
 * The animations use the same donor skeleton; no cross-rig retargeting,
 * unlicensed web fetch, fabricated clip or runtime neural training.
 *
 * The battle/bestiary triggers preserve the 11 original action IDs while
 * rotating verified compatible authored clips for more natural variation.
 */
export const MONSTER_LICENSED_MOTION_REVISION='ual2-source-clips-action-variants-v1-20261121';
export const MONSTER_NATIVE_MOTION_SETS=Object.freeze({
 idle:Object.freeze(['Idle_No_Loop','Idle_FoldArms_Loop',
  'Idle_Lantern_Loop','Zombie_Idle_Loop']),
 walk:Object.freeze(['Walk_Carry_Loop','Zombie_Walk_Fwd_Loop']),
 run:Object.freeze(['Sword_Dash','Shield_Dash']),
 attack:Object.freeze(['Sword_Regular_A','Sword_Regular_B',
  'Sword_Regular_C','Sword_Regular_Combo',
  'Sword_Heavy_Combo','Melee_Hook']),
 guard:Object.freeze(['Sword_Block','Idle_Shield_Loop','Shield_OneShot']),
 hit:Object.freeze(['Hit_Knockback','Idle_Shield_Break']),
 dodge:Object.freeze(['Slide_Start','Slide_Loop','Slide_Exit']),
 leap:Object.freeze(['NinjaJump_Start','NinjaJump_Idle_Loop','NinjaJump_Land']),
 special:Object.freeze(['OverhandThrow','Yes','Chest_Open']),
 roar:Object.freeze(['Zombie_Scratch','Idle_Rail_Call'])
});
const permitted=(clipName,profile)=>{
 const weapon=profile?.equipment||'';
 if(/^Sword_/.test(clipName))
  return ['sword','dagger','guard','fists'].includes(weapon);
 if(/^Shield_/.test(clipName))
  return ['sword','guard','fists'].includes(weapon);
 if(/^Zombie_/.test(clipName))
  return profile?.costume==='skeleton'||profile?.costume==='mummy'||
    profile?.costume==='lich';
 if(clipName==='Melee_Hook')return weapon!=='staff';
 return true;
};
export function buildMonsterNativeMotionVariants(THREE,{clips=[],targetNames,
 mixer,profile}={}){
 if(!mixer||!targetNames||!Array.isArray(clips))return Object.freeze({});
 const bank={};
 for(const [action,names] of Object.entries(MONSTER_NATIVE_MOTION_SETS)){
  const variants=[];
  for(const name of names){
   if(!permitted(name,profile))continue;
   const clip=clips.find(c=>c?.name===name);
   if(!clip)continue;
   // Reuse the exact canonical imported-skeleton rotation policy; never
   // apply mismatched translations/root motion to monster footprints.
   const tracks=clip.tracks.filter(t=>t.name.endsWith('.quaternion')&&
      targetNames.has(t.name.slice(0,-11)));
   if(tracks.length<4)continue;
   const safe=new THREE.AnimationClip('monster-licensed-'+name,
      clip.duration,tracks);
   variants.push(Object.freeze({
    key:'licensed-'+name,name,action:mixer.clipAction(safe),
    duration:clip.duration
   }));
  }
  if(variants.length)bank[action]=Object.freeze(variants);
 }
 return Object.freeze(bank);
}
export function selectMonsterMotionVariant(bank,action,sequence=0){
 const choices=bank?.[action];
 if(!choices?.length)return null;
 return choices[Math.abs(Math.trunc(sequence))%choices.length];
}
export function monsterMotionCoverage(bank){
 const byAction=Object.fromEntries(Object.keys(MONSTER_NATIVE_MOTION_SETS).map(
  action=>[action,bank?.[action]?.map(x=>x.name)??[]]));
 return Object.freeze({
  source:'Quaternius UAL2 Standard (CC0), existing donor GLB',
  actionKinds:Object.values(byAction).filter(x=>x.length>0).length,
  namedClips:Object.values(byAction).flat().length,
  byAction:Object.freeze(byAction)
 });
}
