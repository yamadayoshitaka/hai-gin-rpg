/**
 * Correct the almost-static upper arms of the imported Running_A clip
 * BEFORE photographing/baking the original skinned 65-bone character.
 * This runs only when creating GPU poses/atlases (per profession), never
 * per soldier per frame. Hands, garments, armour and held weapons all follow
 * the actual bones; there is no synthetic vertex mask or independent prop.
 */
export function applyCapturedRunArmSwing(THREE,model,phase){
  const wave=Math.sin(Number.isFinite(phase)?phase:0);
  if(!model||Math.abs(wave)<1e-5)return false;
  const torso=model.getObjectByName('spine_02');
  const rotation=new THREE.Quaternion();
  if(torso)torso.quaternion.multiply(rotation.setFromAxisAngle(
    new THREE.Vector3(0,1,0),wave*.055));
  model.updateMatrixWorld(true);
  const shoulderWorld=new THREE.Vector3(),handWorld=new THREE.Vector3();
  const forward=new THREE.Vector3(0,0,1),axis=new THREE.Vector3();
  const parentRotation=new THREE.Quaternion();
  let changed=false;
  for(const [name,handName,side] of [
    ['upperarm_l','hand_l',1],['upperarm_r','hand_r',-1]
  ]){
    const upper=model.getObjectByName(name),hand=model.getObjectByName(handName);
    if(!upper||!hand||!upper.parent)continue;
    upper.getWorldPosition(shoulderWorld);
    hand.getWorldPosition(handWorld);
    // The axis is computed from the actual upper-arm -> palm vector, rather
    // than assuming that all imported humamoids have the same rest axes.
    // Rotate towards/away from the character's forward direction.
    axis.copy(handWorld).sub(shoulderWorld).cross(forward);
    if(axis.lengthSq()<1e-8)axis.set(1,0,0);
    axis.normalize();
    upper.parent.getWorldQuaternion(parentRotation);
    axis.applyQuaternion(parentRotation.invert()).normalize();
    upper.quaternion.premultiply(rotation.setFromAxisAngle(
      axis,side*wave*.38));
    upper.updateMatrixWorld(true);
    changed=true;
  }
  model.updateMatrixWorld(true);
  return changed;
}
