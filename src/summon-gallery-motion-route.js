/**
 * Frame-rate independent smooth route for inspecting real walking/running.
 * The original showroom changed grid cells 15-27 times a second while the
 * canonical human model never followed its coordinates. This loop makes both
 * the shared creature renderer and the skinned GLB follow the same path.
 * Its orientation is taken from the actual displacement tangent.
 */
export const SUMMON_PREVIEW_ROUTE=Object.freeze([
 Object.freeze({x:0,z:0}),
 Object.freeze({x:1,z:0}),
 Object.freeze({x:2,z:0}),
 Object.freeze({x:2,z:1}),
 Object.freeze({x:1,z:1}),
 Object.freeze({x:0,z:1}),
 Object.freeze({x:-1,z:1}),
 Object.freeze({x:-2,z:1}),
 Object.freeze({x:-2,z:0}),
 Object.freeze({x:-1,z:0})
]);
export function sampleSummonPreviewRoute(elapsed,{running=false}={}){
 const secondsPerMetre=running?.32:.66;
 const p=Math.max(0,Number(elapsed)||0)/secondsPerMetre;
 const section=Math.floor(p)%SUMMON_PREVIEW_ROUTE.length;
 const a=SUMMON_PREVIEW_ROUTE[section],
  b=SUMMON_PREVIEW_ROUTE[(section+1)%SUMMON_PREVIEW_ROUTE.length];
 const f=p-Math.floor(p),dx=b.x-a.x,dz=b.z-a.z;
 return {x:a.x+dx*f,z:a.z+dz*f,yaw:Math.atan2(dx,dz),
  section,phase:f,action:running?'run':'walk'};
}
