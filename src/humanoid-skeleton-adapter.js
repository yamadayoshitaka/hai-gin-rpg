/**
 * Canonical character BOM -> external skeleton adapter (v112).
 * Animation is owned by one canonical joint tree; imported skins never run a
 * second mixer. Bone orientations and rest quaternions are captured once.
 */
export const HUMANOID_BONE_BINDINGS=Object.freeze([
 ['upperarm_l','shoulders',0],['upperarm_r','shoulders',1],
 ['lowerarm_l','elbows',0],['lowerarm_r','elbows',1],
 ['thigh_l','hips',0],['thigh_r','hips',1],
 ['shin_l','knees',0],['shin_r','knees',1],
 ['spine_01','spine',null],['neck_01','neck',null]
]);
export function bindHumanoidSkeleton({THREE,model,joints}){
 const nodes=new Map();
 model.traverse(n=>{if(n.isBone){if(!nodes.has(n.name))nodes.set(n.name,[]);nodes.get(n.name).push(n);}});
 const bindings=HUMANOID_BONE_BINDINGS.flatMap(([name,part,index])=>{
  const joint=index===null?joints[part]:joints[part]?.[index];
  return (nodes.get(name)||[]).filter(()=>joint).map(bone=>({
   bone,joint,rest:bone.quaternion.clone(),jointRest:joint.quaternion.clone()
  }));
 });
 const required=['upperarm_l','upperarm_r','thigh_l','thigh_r'];
 if(required.some(name=>!bindings.some(b=>b.bone.name===name)))
  return {valid:false,reason:'missing canonical limb bindings',count:bindings.length};
 const dq=new THREE.Quaternion(),inverse=new THREE.Quaternion();
 const tick=()=>{
  for(const binding of bindings){
   // Relative rotation from canonical rest; never overwrite the imported bind
   // quaternion with absolute euler angles (different local bone axes).
   inverse.copy(binding.jointRest).invert();
   dq.copy(inverse).multiply(binding.joint.quaternion);
   binding.bone.quaternion.copy(binding.rest).multiply(dq);
  }
  model.updateMatrixWorld(true);
 };
 return {valid:true,count:bindings.length,tick};
}
