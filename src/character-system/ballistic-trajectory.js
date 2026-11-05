// Quadratic world-space arrow flight: the vertical acceleration is constant.
// Inputs are immutable plain XYZ coordinates so game rules and rendering can
// share this without depending on Three.js or WebGL.
export function sampleArrowArc(from,to,progress,arcHeight){
  if(![from?.x,from?.y,from?.z,to?.x,to?.y,to?.z,progress,arcHeight].every(Number.isFinite))
    throw Error('Arrow trajectory needs finite XYZ, progress and arc height');
  if(arcHeight<0)throw Error('Arrow trajectory height must be nonnegative');
  const t=Math.max(0,Math.min(1,progress)),lift=4*arcHeight*t*(1-t);
  return {x:from.x+(to.x-from.x)*t,y:from.y+(to.y-from.y)*t+lift,z:from.z+(to.z-from.z)*t};
}
export function arrowArcVelocity(from,to,progress,arcHeight){
  const t=Math.max(0,Math.min(1,progress));
  return {x:to.x-from.x,y:to.y-from.y+4*arcHeight*(1-2*t),z:to.z-from.z};
}
export function chooseArrowFlight(from,to){
  const dx=to.x-from.x,dz=to.z-from.z,distance=Math.hypot(dx,dz);
  return {duration:Math.max(.32,Math.min(1.55,distance/19)),arcHeight:Math.max(.42,Math.min(7,distance*.12))};
}
