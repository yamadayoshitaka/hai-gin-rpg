// The metal helmet is authored for a generic head, so its size must be
// measured against the actual actor's (world-space) head, not a fixed scale.
// In particular, a tight original helmet must be allowed to grow beyond the
// old 1.55x cap; otherwise the actor's scalp sticks out on every side.
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));

export function helmetFitForHead(headSize,helmetSize){
  const ratio=(head,helmet,clearance,min,max)=>
    clamp(head*clearance/Math.max(.01,helmet),min,max);
  return [
    ratio(headSize.x,helmetSize.x,1.32,1.09,2.9),
    ratio(headSize.y,helmetSize.y,1.17,1.07,2.25),
    ratio(headSize.z,helmetSize.z,1.34,1.10,2.9)
  ];
}
