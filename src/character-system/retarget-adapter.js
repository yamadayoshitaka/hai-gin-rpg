// Explicit humanoid adapter. This module only transfers rotations; it does not
// implement contacts, IK, physics, or guarantee that dissimilar bind poses match.
// Verified against Mannequin_Medium.glb: 21 skin joints.
const KAYKIT_JOINTS={root:'root',hips:'pelvis',spine:'spine',chest:'chest',head:'head',
 'upperarm.l':'left.upperArm','lowerarm.l':'left.lowerArm','hand.l':'left.hand',
 'upperleg.l':'left.thigh','lowerleg.l':'left.calf','foot.l':'left.foot','toes.l':'left.toe',
 'upperarm.r':'right.upperArm','lowerarm.r':'right.lowerArm','hand.r':'right.hand',
 'upperleg.r':'right.thigh','lowerleg.r':'right.calf','foot.r':'right.foot','toes.r':'right.toe'};
export function sourceBoneKey(name){
 const n=name.toLowerCase();if(KAYKIT_JOINTS[n])return KAYKIT_JOINTS[n];
 // GLTFLoader sanitizes dots in animation node names: upperarm.l -> upperarml.
 const compact=n.match(/^(upperarm|lowerarm|wrist|hand|upperleg|lowerleg|foot|toes|handslot)([lr])$/);
 if(compact){const side=compact[2]==='l'?'left':'right';const part={upperarm:'upperArm',lowerarm:'lowerArm',wrist:'hand',hand:'hand',upperleg:'thigh',lowerleg:'calf',foot:'foot',toes:'toe'}[compact[1]];return part?side+'.'+part:null}
 // Retain fallback for non-KayKit sources, never infer a side from a bare arm.
 const m=n.match(/^([a-z0-9]+)[._-]([lr])$/);if(m){const side=m[2]==='l'?'left':'right';const part={upperarm:'upperArm',lowerarm:'lowerArm',hand:'hand',upperleg:'thigh',lowerleg:'calf',foot:'foot',toes:'toe'}[m[1]];return part?side+'.'+part:null}
 return null;
}
export function targetNames(profile){const b=profile.boneNames;return {pelvis:b.pelvis,spine:b.spine[0],chest:b.spine[b.spine.length-1],neck:b.neck,head:b.head,...Object.fromEntries(['left','right'].flatMap(side=>Object.entries(b[side]).map(([part,name])=>[side+'.'+part,name])))} }
// Bind-pose calibrated retargeting. All source deltas are measured in
// source-parent rest coordinates, then transformed into target-parent rest
// coordinates. Animated parent transforms must never enter calibration.
export function buildRigPairs(THREE,source,target,profile){
 const src=new Map(),dst=new Map();
 source.traverse(o=>{if(o.isBone){const key=sourceBoneKey(o.name);if(key&&!src.has(key))src.set(key,o)}});
 target.traverse(o=>{if(o.isBone)dst.set(o.name,o)});
 const mapping=targetNames(profile),pairs=[],missing=[];
 source.updateMatrixWorld(true);target.updateMatrixWorld(true);
 for(const [key,name] of Object.entries(mapping)){
  const from=src.get(key),to=dst.get(name);
  if(!from||!to){missing.push({key,source:!!from,target:!!to});continue}
  const sourceRestLocal=from.quaternion.clone();
  const targetRestLocal=to.quaternion.clone();
  const sourceParentRestWorld=from.parent?.getWorldQuaternion(new THREE.Quaternion())||new THREE.Quaternion();
  const targetParentRestWorld=to.parent?.getWorldQuaternion(new THREE.Quaternion())||new THREE.Quaternion();
  const basis=targetParentRestWorld.clone().invert().multiply(sourceParentRestWorld);
  pairs.push({key,from,to,sourceRestLocal,targetRestLocal,basis});
 }
 return {pairs,missing,coverage:pairs.length/Object.keys(mapping).length};
}
export function applyRigPairs(THREE,pairs,maxRadians=Math.PI/2){
 // Local deltas are independent of current parent pose, preventing feedback
 // from one frame's animation into the next. No root translation is copied.
 for(const p of pairs){
  const delta=p.from.quaternion.clone().multiply(p.sourceRestLocal.clone().invert());
  const converted=p.basis.clone().multiply(delta).multiply(p.basis.clone().invert());
  const angle=2*Math.acos(Math.min(1,Math.abs(converted.w)));
  const limit=/^(left|right)\.(thigh|calf|foot|toe)$/.test(p.key)?Math.PI/3:maxRadians;
  if(angle>limit)converted.slerp(new THREE.Quaternion(),1-limit/angle);
  p.to.quaternion.copy(converted.multiply(p.targetRestLocal)).normalize();
 }
}
