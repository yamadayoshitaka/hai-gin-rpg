// The metal helmet is authored for a generic head, so its size must be
// measured against the actual actor's (world-space) head, not a fixed scale.
// In particular, a tight original helmet must be allowed to grow beyond the
// old 1.55x cap; otherwise the actor's scalp sticks out on every side.
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));

export function helmetFitForHead(headSize,helmetSize){
  const ratio=(head,helmet,clearance,min,max)=>
    clamp(head*clearance/Math.max(.01,helmet),min,max);
  return [
    // Width/depth include the real haircut, lining and side padding rather
    // than fitting metal flush against the skull. The old profile read as a
    // tiny cap in battle and revealed a bald ring around the face.
    ratio(headSize.x,helmetSize.x,1.43,1.12,3.35),
    ratio(headSize.y,helmetSize.y,1.25,1.09,2.65),
    ratio(headSize.z,helmetSize.z,1.44,1.13,3.35)
  ];
}
