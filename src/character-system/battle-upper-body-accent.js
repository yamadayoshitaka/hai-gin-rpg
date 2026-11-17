/**
 * Lightweight upper-body contact accents for a moving, realistically rigged
 * soldier. The legs continue their distance-driven gait; only existing
 * clavicle/upper-arm/chest bones receive small additive rotations.
 * No new meshes, bones, animation tracks or additional draw calls.
 */
const clamp01=n=>Math.max(0,Math.min(1,Number(n)||0));
export function battleCombatAccent(action,progress=0,moving=false){
 if(!moving||!['attack','skill','hit'].includes(action))
  return {weight:0,left:0,right:0,chest:0};
 const t=clamp01(progress);
 // Zero rotation at either end prevents hard discontinuities as the running
 // clip takes over after a strike/guard gesture.
 const pulse=Math.sin(Math.PI*t);
 const weight=Math.max(0,pulse);
 if(action==='hit')
  return {weight,left:-.10*weight,right:-.10*weight,chest:-.10*weight};
 if(action==='skill')
  return {weight,left:-.30*weight,right:-.30*weight,chest:.06*weight};
 return {weight,left:-.08*weight,right:.38*weight,chest:.085*weight};
}
export function createBattleUpperBodyAccent(model){
 const keys=[['upperarm_l','left'],['upperarm_r','right'],['spine_02','chest']];
 const entries=keys.map(([name,key])=>({
  key,node:model?.getObjectByName?.(name)??null,before:null
 })).filter(x=>x.node?.quaternion&&typeof x.node.rotateX==='function');
 // Preallocate the snapshot quaternions once, not on every soldier frame.
 for(const e of entries)e.before=e.node.quaternion.clone();
 let applied=false;
 function restore(){
  if(!applied)return;
  for(const e of entries)e.node.quaternion.copy(e.before);
  applied=false;
 }
 function apply({action=null,progress=0,moving=false,mounted=false}={}){
  restore();
  const accent=battleCombatAccent(action,progress,Boolean(moving)&&!mounted);
  if(accent.weight<.001)return false;
  for(const e of entries){
   const radians=accent[e.key];
   if(!radians)continue;
   e.before.copy(e.node.quaternion);
   if(e.key==='chest')e.node.rotateY(radians);
   else e.node.rotateX(radians);
  }
  applied=true;
  return true;
 }
 return {apply,restore,get active(){return applied},get boneCount(){return entries.length}};
}
