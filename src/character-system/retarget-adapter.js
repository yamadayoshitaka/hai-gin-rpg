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
export function buildRigPairs(THREE,source,target,profile){
 const src=new Map(),dst=new Map();source.traverse(o=>{if(o.isBone){const k=sourceBoneKey(o.name);if(k&&!src.has(k))src.set(k,o)}});target.traverse(o=>{if(o.isBone)dst.set(o.name,o)});
 const mapping=targetNames(profile),pairs=[],missing=[];
 source.updateMatrixWorld(true);target.updateMatrixWorld(true);
 for(const [key,name] of Object.entries(mapping)){const from=src.get(key),to=dst.get(name);if(!from||!to){missing.push({key,source:!!from,target:!!to});continue}pairs.push({key,from,to,sourceRestWorld:from.getWorldQuaternion(new THREE.Quaternion()),targetRestWorld:to.getWorldQuaternion(new THREE.Quaternion()),targetRestLocal:to.quaternion.clone()})}
 return {pairs,missing,coverage:pairs.length/Object.keys(mapping).length};
}
export function applyRigPairs(THREE,pairs,maxRadians=Math.PI/2){
 // Parents must be evaluated before children. Every delta is expressed in world space.
 for(const p of pairs){const now=p.from.getWorldQuaternion(new THREE.Quaternion());const delta=now.multiply(p.sourceRestWorld.clone().invert());const desired=delta.multiply(p.targetRestWorld.clone());const parent=p.to.parent?.getWorldQuaternion(new THREE.Quaternion())||new THREE.Quaternion();const local=parent.invert().multiply(desired);const angle=p.targetRestLocal.angleTo(local);if(angle>maxRadians)local.slerp(p.targetRestLocal,1-maxRadians/angle);p.to.quaternion.copy(local);p.to.updateMatrixWorld(true)}
}
