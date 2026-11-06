// The wardrobe studio imports a T-pose. In profile, the outstretched hand
// carries its sword through the face silhouette even though the prop is
// correctly gripped. Lower both arms for a natural *inspection-only* pose;
// battle/actions keep their own motion clips and are not affected.
import * as THREE from 'three';

const restPoses=new WeakMap();

function armsByName(model){
  const arms=new Map();
  model.traverse(node=>{
    if(node.isBone&&/^upperarm_[lr]$/.test(node.name.toLowerCase()))
      arms.set(node.name.toLowerCase(),node);
  });
  return arms;
}

export function restoreWardrobeInspectionPose(model){
  const rest=restPoses.get(model);
  if(!rest)return false;
  for(const [bone,quaternion] of rest)bone.quaternion.copy(quaternion);
  model.updateMatrixWorld(true);
  return true;
}

export function applyWardrobeInspectionPose(model){
  let rest=restPoses.get(model);
  const arms=armsByName(model);
  if(!rest){
    rest=new Map([...arms.values()].map(bone=>[bone,bone.quaternion.clone()]));
    restPoses.set(model,rest);
  }
  restoreWardrobeInspectionPose(model);
  const directions={};
  for(const [name,shoulder] of arms){
    const elbow=shoulder.children.find(n=>n.isBone&&/^lowerarm_[lr]$/.test(n.name.toLowerCase()));
    if(!elbow)continue;
    model.updateMatrixWorld(true);
    const from=shoulder.getWorldPosition(new THREE.Vector3());
    const to=elbow.getWorldPosition(new THREE.Vector3());
    const current=to.sub(from).normalize();
    if(current.lengthSq()<.9)continue;
    const side=current.x<0?-1:1;
    const target=new THREE.Vector3(side*.29,-.95,.10).normalize();
    const delta=new THREE.Quaternion().setFromUnitVectors(current,target);
    const shoulderWorld=shoulder.getWorldQuaternion(new THREE.Quaternion());
    const parentInverse=shoulder.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
    shoulder.quaternion.copy(parentInverse.multiply(delta).multiply(shoulderWorld));
    model.updateMatrixWorld(true);
    directions[name]=target.toArray();
  }
  return directions;
}
