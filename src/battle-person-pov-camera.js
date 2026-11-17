/** Camera follows the selected individual's FACE/FORWARD vector, not
 * a fixed world compass direction. No THREE dependency or frame allocations.
 * Yaw follows the game's +Z-facing convention.
 */
export function personFacingYaw(unit){
 const smooth=unit?._visualMotion?.yaw;
 if(Number.isFinite(smooth))return smooth;
 const rigYaw=unit?.root?.rotation?.y;
 if(Number.isFinite(rigYaw))return rigYaw;
 const x=Number(unit?.facingX),z=Number(unit?.facingZ);
 if(Number.isFinite(x)&&Number.isFinite(z)&&Math.abs(x)+Math.abs(z)>0.0001)
  return Math.atan2(x,z);
 return unit?.team===1?-Math.PI/2:Math.PI/2;
}
export function writePersonPovOffset(unit,out,distance=9,height=3.6,shoulder=.75){
 const yaw=personFacingYaw(unit),s=Math.sin(yaw),c=Math.cos(yaw);
 // Behind, to the character's right shoulder, and slightly above eye level.
 out.set(c*shoulder-s*distance,height,-s*shoulder-c*distance);
 return out;
}
