/** Data contract for imported skinned humanoids; no character-specific conditionals.
 * An asset must satisfy the contract before its visible mesh replaces a fallback.
 */
export const HUMANOID_VISUAL_CONTRACT=Object.freeze({
 requiredBones:['spine_01','neck_01','upperarm_l','upperarm_r','lowerarm_l','lowerarm_r','thigh_l','thigh_r'],
 armChains:[['upperarm_l','lowerarm_l'],['upperarm_r','lowerarm_r']],
 minimumSkinnedMeshes:1,
 maxRelativeHeightError:0.08,
 // Arm vector from shoulder to elbow must point toward ground; T-pose is invalid.
 maxArmHorizontalRatio:0.80,
 maxVerticalSeparationRatio:0.35
});
export function checkHumanoidManifest({boneNames=[],skinnedMeshCount=0,modelHeight=0,targetHeight=1}){
 const missing=HUMANOID_VISUAL_CONTRACT.requiredBones.filter(n=>!boneNames.includes(n));
 const problems=[...missing.map(n=>'missing-bone:'+n)];
 if(skinnedMeshCount<HUMANOID_VISUAL_CONTRACT.minimumSkinnedMeshes)problems.push('missing-skinned-mesh');
 if(!Number.isFinite(modelHeight)||Math.abs(modelHeight-targetHeight)>targetHeight*HUMANOID_VISUAL_CONTRACT.maxRelativeHeightError)problems.push('height-mismatch');
 return {valid:problems.length===0,problems};
}
export function checkArmDirections(bones,getPoint){
 const problems=[];
 for(const [upper,lower] of HUMANOID_VISUAL_CONTRACT.armChains){
  const u=bones.get(upper),l=bones.get(lower);
  if(!u||!l){problems.push('missing-arm:'+upper);continue;}
  const p=getPoint(u),q=getPoint(l),dx=q.x-p.x,dy=q.y-p.y,dz=q.z-p.z;
  const len=Math.hypot(dx,dy,dz);
  if(!(len>1e-6)||dy>=0||Math.hypot(dx,dz)/len>HUMANOID_VISUAL_CONTRACT.maxArmHorizontalRatio)problems.push('invalid-arm-direction:'+upper);
 }
 return {valid:problems.length===0,problems};
}
