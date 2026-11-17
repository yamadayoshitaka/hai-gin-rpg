/**
 * Animation retarget transitions for human skinned rigs.
 * Blend only while an authored state changes; never apply an idle overlay to
 * the real run cycle, and never alter the authoritative world-space movement.
 * Sampling/baking of LOD reference frames must opt out.
 */
export function rigMotionBlendDuration(previous,next){
 if(!previous||!next||previous===next)return 0;
 if(next==='dead'||next==='death')return .065;
 if(next==='hit'||next==='guard')return .09;
 if(next==='attack'||next==='skill'||next==='cast')return .105;
 if((previous==='idle'&&next==='run')||(previous==='run'&&next==='idle'))
  return .18;
 if(next==='jump'||previous==='jump')return .09;
 return .14;
}
export function rigMotionBlendProgress(elapsed,duration){
 if(!(Number.isFinite(duration)&&duration>0))return 1;
 const t=Math.max(0,Math.min(1,Number(elapsed)/duration||0));
 return t*t*(3-2*t);
}
