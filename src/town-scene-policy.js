/**
 * Non-combat exploration rules. These functions use world metres and are kept
 * outside the tactical AI/Worker, army orders and battle camera state.
 * The scene can reuse registered 3D assets without inheriting battle behavior.
 */
export const TOWN_ADULT_HEIGHT=Object.freeze({male:1.74,female:1.63});
export const TOWN_BODY_RADIUS=0.34;
export const TOWN_HEIGHT_LIMIT=2.05;
export const TOWN_SCENE_MODE='peaceful-exploration';

export function townVisualCorrection(extent,targetHeight=1.74){
 const {x=0,y=0,z=0}=extent||{};
 if(![x,y,z,targetHeight].every(Number.isFinite)||y<=0.01||targetHeight<=0)
  throw Error('Town model has invalid bounds');
 // Cap abnormally large imported meshes/gear rather than allowing giant NPCs.
 // Keep a small pose allowance for helmets, weapons and cloth movement.
 return Math.max(.005,Math.min(1,(targetHeight*1.13)/y,
  (targetHeight*1.6)/Math.max(x,z,.01)));
}

export function townCapsuleClear(x,z,obstacles,radius=TOWN_BODY_RADIUS){
 if(!Number.isFinite(x)||!Number.isFinite(z)||!(radius>0))return false;
 return (obstacles||[]).every(p=>{
  if(!p||!Number.isFinite(p.x)||!Number.isFinite(p.z))return false;
  const combined=radius+(Number.isFinite(p.radius)?Math.max(.01,p.radius):TOWN_BODY_RADIUS);
  return (x-p.x)**2+(z-p.z)**2 >= combined**2;
 });
}

export function townCameraOccluders(items,townMode){
 // Town petals remain visible. Battle close-ups must still clear sakura
 // so a character is not replaced by a solid pink canopy.
 const allowed=townMode?
  new Set(['tree_deciduous_001']):new Set(['tree_deciduous_001','flower_tree_001']);
 return (items||[]).filter(item=>allowed.has(item?.id));
}
