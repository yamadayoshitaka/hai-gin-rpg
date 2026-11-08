/**
 * Keep 1000v1000 GPU/LOD RUN poses on the same fore-aft arm plane as the
 * 50v50 skinned RUN. This is baked once per job, never run per soldier/frame.
 * The imported pose sometimes has nearly horizontal arms: crossing its
 * shoulder-to-hand vector with "forward" then swings them SIDEWAYS instead.
 * Rotate the real shoulder bones toward a stable forward/back hand target.
 * Forearms, armour, clothing and held weapons still inherit those real bones.
 */
export function runArmSwingComponents(side,phase){
  const wave=Math.sin(Number.isFinite(phase)?phase:0);
  return {outward:(side<0?-1:1)*0.14,down:1,
    forward:(side<0?-1:1)*wave*0.46};
}

export function applyCapturedRunArmSwing(THREE,model,phase){
  if(!model)return false;
  const left=model.getObjectByName('upperarm_l');
  const right=model.getObjectByName('upperarm_r');
  if(!left||!right)return false;

  // Subtle counter-rotation of the real torso, retained from the running rig.
  const wave=Math.sin(Number.isFinite(phase)?phase:0);
  const torso=model.getObjectByName('spine_02');
  if(torso&&Math.abs(wave)>1e-5)
    torso.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0,1,0),wave*0.045));
  model.updateMatrixWorld(true);

  // Shoulder-to-shoulder defines the side direction regardless of mesh
  // facing, mirrored skeletons and importer bone-local axes.
  const leftShoulder=left.getWorldPosition(new THREE.Vector3());
  const rightShoulder=right.getWorldPosition(new THREE.Vector3());
  const modelWorld=model.getWorldQuaternion(new THREE.Quaternion());
  const up=new THREE.Vector3(0,1,0).applyQuaternion(modelWorld).normalize();
  const across=rightShoulder.clone().sub(leftShoulder);
  across.addScaledVector(up,-across.dot(up));
  if(across.lengthSq()<1e-8)return false;
  across.normalize();
  const forward=new THREE.Vector3().crossVectors(across,up).normalize();
  const modelForward=new THREE.Vector3(0,0,1).applyQuaternion(modelWorld);
  if(forward.dot(modelForward)<0)forward.negate();

  let changed=false;
  for(const [upper,handName,side] of [
    [left,'hand_l',-1],[right,'hand_r',1]
  ]){
    const hand=model.getObjectByName(handName);
    if(!hand||!upper.parent)continue;
    const shoulder=upper.getWorldPosition(new THREE.Vector3());
    const palm=hand.getWorldPosition(new THREE.Vector3());
    const current=palm.sub(shoulder);
    if(current.lengthSq()<1e-8)continue;
    current.normalize();

    // Opposite arms travel along ±forward, not outward/inward. A persistent
    // downward component prevents T-posed imports from flaring sideways at
    // neutral (0 and PI) phases; elbows retain their authored flexion.
    const targetComponents=runArmSwingComponents(side,phase);
    const target=up.clone().multiplyScalar(-targetComponents.down)
      .addScaledVector(across,targetComponents.outward)
      .addScaledVector(forward,targetComponents.forward).normalize();
    const worldDelta=new THREE.Quaternion().setFromUnitVectors(current,target);
    const parentWorld=upper.parent.getWorldQuaternion(new THREE.Quaternion());
    const localDelta=parentWorld.clone().invert().multiply(worldDelta)
      .multiply(parentWorld);
    upper.quaternion.premultiply(localDelta);
    upper.updateMatrixWorld(true);
    changed=true;
  }
  model.updateMatrixWorld(true);
  return changed;
}
