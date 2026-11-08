/**
 * Additive, reversible upper-body RUN motion for the original 7-head rig.
 *
 * In the 1000v1000 GPU renderer the run clip is baked to only two poses to
 * stay within WebGL's 16-vertex-attribute limit. Some supplied Running_* clips
 * animate boots but almost no upper-arm/shoulder rotations. Add the missing
 * counter-swing to the ACTUAL bones before photographing/baking each pose.
 * The full fitted outfit, hair, weapons and skin are sampled together.
 *
 * This is loading-time-only. No per-soldier CPU bones, draw calls or extra
 * per-instance GPU attributes are introduced.
 */
export function applyCrowdRunUpperBodyOverlay(character,phase,{strength=1}={}){
 const model=character?.model;
 if(!model?.traverse||!Number.isFinite(phase)||!Number.isFinite(strength))
  return {count:0,restore:()=>{}};
 const swing=Math.sin(phase)*Math.max(0,Math.min(strength,1.4));
 const settle=Math.cos(phase)*Math.max(0,Math.min(strength,1.4));
 const rules={
  // Bend in the same local X axis used by the shared action/test rig.
  // Opposing arms counter the right/left foot strikes.
  upperarm_l:[-.43*swing,0,.03*settle],
  upperarm_r:[ .43*swing,0,-.03*settle],
  lowerarm_l:[ .075*Math.max(0,swing),0,0],
  lowerarm_r:[ .075*Math.max(0,-swing),0,0],
  spine_01:[.035*settle,.095*swing,0],
  spine_02:[.018*settle,.04*swing,0]
 };
 const originals=[];
 model.traverse(bone=>{
  if(!bone.isBone)return;
  const rule=rules[bone.name?.toLowerCase?.()];
  if(!rule)return;
  const [x,y,z]=rule;
  if(!bone.quaternion?.clone||!bone.quaternion?.copy)return;
  originals.push({bone,quaternion:bone.quaternion.clone()});
  if(x)bone.rotateX(x);
  if(y)bone.rotateY(y);
  if(z)bone.rotateZ(z);
 });
 if(originals.length)model.updateMatrixWorld?.(true);
 let restored=false;
 return {count:originals.length,restore:()=>{
  if(restored)return;restored=true;
  for(const {bone,quaternion} of originals)bone.quaternion.copy(quaternion);
  if(originals.length)model.updateMatrixWorld?.(true);
 }};
}

/**
 * Check the real anatomical vertices, excluding loose weapon/accessory parts.
 * A good 2-frame dash should change the arm/chest silhouette measurably.
 */
export function auditCrowdUpperBodyFrames(sources,{minY=.82,maxSamples=4500}={}){
 let total=0,samples=0,maxDistance=0;
 for(const {geometry,isHumanBody} of sources||[]){
  if(!isHumanBody||!geometry?.getAttribute)continue;
  const a=geometry.getAttribute('crowdWalkA')?.array;
  const b=geometry.getAttribute('crowdWalkB')?.array;
  if(!a||!b||a.length!==b.length)continue;
  const stride=Math.max(3,Math.ceil(a.length/(maxSamples*3))*3);
  for(let i=0;i<a.length;i+=stride){
   if(a[i+1]<minY&&b[i+1]<minY)continue;
   const dx=a[i]-b[i],dy=a[i+1]-b[i+1],dz=a[i+2]-b[i+2];
   const d=Math.hypot(dx,dy,dz);
   if(!Number.isFinite(d))continue;
   total+=d;samples++;maxDistance=Math.max(maxDistance,d);
  }
 }
 return {samples,averageDelta:samples?+(total/samples).toFixed(4):0,
  maxDelta:+maxDistance.toFixed(4),animated:samples>0&&total/samples>=.012};
}
