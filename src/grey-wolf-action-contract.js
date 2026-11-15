/** Source-clip mapping for the licensed r-wolf with procedural fallback. */
export const WOLF_ACTION_NAMES=Object.freeze([
 'idle','walk','run','attack','roar','special','hit','defeat',
 'guard','dodge','leap'
]);
export const WOLF_ACTION_LIMITS=Object.freeze({
 attack:1.1,roar:1.45,special:1.5,hit:.6,guard:.9,dodge:.75,leap:.9,
 idle:Infinity,walk:Infinity,run:Infinity,defeat:Infinity
});
const clean=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
const hasClip=(clips,expr)=>clips.some(n=>expr.test(clean(n)));
export function resolveWolfAction(clips,action){
 const names=Array.isArray(clips)?clips:[];
 const known=WOLF_ACTION_NAMES.includes(action)?action:'idle';
 if(known==='defeat')return {action:known,sourceAction:
   hasClip(names,/death|defeat|die|sleep/)?'defeat':'idle',
   procedural:'defeat'};
 if(known==='attack'||known==='roar'||known==='special')
  return {action:known,sourceAction:
   hasClip(names,/rrar|roar|attack|bite|growl/)?'roar':'idle',
   procedural:known};
 if(known==='walk'||known==='run')
  return {action:known,sourceAction:
   hasClip(names,known==='run'?/run|sprint|gallop/:/walk|trot/)?
    known:'idle',procedural:known};
 return {action:known,sourceAction:'idle',procedural:known};
}
