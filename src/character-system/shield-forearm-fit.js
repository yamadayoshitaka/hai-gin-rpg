import * as THREE from 'three';

/**
 * Place the shield's REAR plane completely ahead of BOTH the elbow and wrist
 * on the body-forward axis. The old mount evaluated the bind pose once:
 * during a dash, guard or heavy strike the forearm rotated into the painted
 * shield. Recompute only two joint world coordinates and 3 scalar products
 * per equipped shield, never a skin-vertex search or collision physics loop.
 *
 * Source shield is a flat XY prop with the decorated front along local +Z.
 * Its unscaled geometry's lowest Z is the back surface used for clearance.
 */
export const SHIELD_FOREARM_CLEARANCE_VERSION='forearm-animated-rear-plane-v1';
export const SHIELD_FOREARM_CLEARANCE_METERS=.075;
export function fitShieldAheadOfForearm({
 elbow,wrist,forward,sourceBackZ=0,scale=1,blend=.48,
 clearance=SHIELD_FOREARM_CLEARANCE_METERS,out=new THREE.Vector3()
}={}){
 if(!elbow?.isVector3||!wrist?.isVector3||!forward?.isVector3)
  throw Error('Actual elbow, wrist and body-forward world vectors required');
 const lengthSquared=forward.lengthSq();
 if(lengthSquared<.00001)throw Error('Invalid shield-forward vector');
 // The caller supplies unit forward (the body's world +Z direction).
 const norm=lengthSquared>1.0001||lengthSquared<.9999?
  forward.clone().normalize():forward;
 out.copy(elbow).lerp(wrist,THREE.MathUtils.clamp(blend,0,1));
 const furthestSkin=Math.max(elbow.dot(norm),wrist.dot(norm));
 const rearPlaneTarget=furthestSkin+Math.max(.04,clearance);
 const backOfShield=Number.isFinite(sourceBackZ)?sourceBackZ*scale:0;
 // The XY shield center is mounted so the entire shield back is in front
 // of the two limb joints. Keep the same orientation and world-X/Y anchor
 // even when the warrior raises or twists the forearm during combat.
 out.addScaledVector(norm,rearPlaneTarget-out.dot(norm)-backOfShield);
 return {
  center:out,
  rearPlaneWorld:out.dot(norm)+backOfShield,
  forwardClearance:out.dot(norm)+backOfShield-furthestSkin,
  bindSafe:out.dot(norm)+backOfShield>=furthestSkin+.039,
  version:SHIELD_FOREARM_CLEARANCE_VERSION
 };
}
