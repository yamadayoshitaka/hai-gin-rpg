// Explicit humanoid adapter. This module only transfers rotations; it does not
// implement contacts, IK, physics, or guarantee that dissimilar bind poses match.
export function sourceBoneKey(name){
  const raw=name.toLowerCase().replace(/^(mixamorig|armature|rigmedium|rig|bip001|bip01)[_:.-]*/,'');
  const n=raw.replace(/[^a-z0-9]/g,'');
  const side=/(?:left|_l$)/.test(raw)||/^(?:l)(?:upper|lower|hand|foot|toe|thigh|shin|arm|leg|shoulder)/.test(n)?'left':/(?:right|_r$)/.test(raw)||/^(?:r)(?:upper|lower|hand|foot|toe|thigh|shin|arm|leg|shoulder)/.test(n)?'right':null;
  let part=null;
  for(const [re,key] of [[/hips|pelvis/,'pelvis'],[/upperchest|chest|spine2/,'chest'],[/spine1|spine/,'spine'],[/neck/,'neck'],[/head/,'head'],[/clavicle|shoulder/,'clavicle'],[/forearm|lowerarm/,'lowerArm'],[/upperarm|arm/,'upperArm'],[/hand|wrist/,'hand'],[/upleg|upperleg|thigh/,'thigh'],[/lowerleg|shin|calf/,'calf'],[/foot|ankle/,'foot'],[/toe|ball/,'toe']])if(re.test(n)){part=key;break}
  return part?(side?side+'.'+part:part):null;
}
export function targetNames(profile){const b=profile.boneNames;return {pelvis:b.pelvis,spine:b.spine[0],chest:b.spine[b.spine.length-1],neck:b.neck,head:b.head,...Object.fromEntries(['left','right'].flatMap(side=>Object.entries(b[side]).map(([part,name])=>[side+'.'+part,name])))} }
export function buildRigPairs(THREE,source,target,profile){
 const src=new Map(),dst=new Map();source.traverse(o=>{if(o.isBone){const k=sourceBoneKey(o.name);if(k&&!src.has(k))src.set(k,o)}});target.traverse(o=>{if(o.isBone)dst.set(o.name,o)});
 const mapping=targetNames(profile),pairs=[],missing=[];
 source.updateMatrixWorld(true);target.updateMatrixWorld(true);
 for(const [key,name] of Object.entries(mapping)){const from=src.get(key),to=dst.get(name);if(!from||!to){missing.push({key,source:!!from,target:!!to});continue}pairs.push({key,from,to,sourceRestWorld:from.getWorldQuaternion(new THREE.Quaternion()),targetRestWorld:to.getWorldQuaternion(new THREE.Quaternion()),targetRestLocal:to.quaternion.clone(),sourceRestLocal:from.quaternion.clone(),sourceParentRestWorld:from.parent?.getWorldQuaternion(new THREE.Quaternion())||new THREE.Quaternion(),targetParentRestWorld:to.parent?.getWorldQuaternion(new THREE.Quaternion())||new THREE.Quaternion()})}
 return {pairs,missing,coverage:pairs.length/Object.keys(mapping).length};
}
export function applyRigPairs(THREE,pairs,maxRadians=Math.PI/2){
 // Each bone's local rotation is independent of its animated parent. Using the
 // animated world quaternion here would apply ancestor rotations twice.
 for(const p of pairs){
   const localDelta=p.from.quaternion.clone().multiply(p.sourceRestLocal.clone().invert());
   // Express source-local rotation in the source bind-parent frame, then
   // convert that rotation into the target bind-parent coordinate frame.
   const worldDelta=p.sourceParentRestWorld.clone().multiply(localDelta).multiply(p.sourceParentRestWorld.clone().invert());
   const targetDelta=p.targetParentRestWorld.clone().invert().multiply(worldDelta).multiply(p.targetParentRestWorld);
   const desired=targetDelta.multiply(p.targetRestLocal.clone());
   const angle=p.targetRestLocal.angleTo(desired);
   if(angle>maxRadians)desired.copy(p.targetRestLocal).slerp(desired,maxRadians/angle);
   p.to.quaternion.copy(desired);
 }
 // Update the complete hierarchy once after all local joint rotations.
 if(pairs.length)pairs[0].to.updateMatrixWorld(true);
}
