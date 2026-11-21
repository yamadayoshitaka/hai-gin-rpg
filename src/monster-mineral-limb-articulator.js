/**
 * Per-instance humanoid shell articulation. All skeleton/mesh references are
 * from the current loaded actor. No shared GLB, other species or source rig
 * is mutated. Refit between adjacent JOINT positions after AnimationMixer.
 * Prevents forearms being absorbed into the torso by crossed-arm poses.
 */
import * as THREE from 'three';
export const MONSTER_LIMB_FIT_REVISION='bone-to-bone-shell-20261121-v1';
const down=new THREE.Vector3(0,-1,0);
const worldStart=new THREE.Vector3(),worldEnd=new THREE.Vector3();
const delta=new THREE.Vector3(),target=new THREE.Vector3();
const candidateQ=new THREE.Quaternion(),parentQ=new THREE.Quaternion(),
 correctionQ=new THREE.Quaternion(),modelQ=new THREE.Quaternion();
const epsilon=.055;
const pairs=[
 ['upper-arm-shell','arms','forearms',.45],
 ['forearm-shell','forearms','hands',.47],
 ['thigh-shell','legs','calves',.55],
 ['shin-shell','calves','feet',.53],
];
const candidates={
 arms:['upperarm_l','upperarm_r'],forearms:['lowerarm_l','lowerarm_r'],
 hands:['hand_l','hand_r'],legs:['thigh_l','thigh_r'],
 calves:['calf_l','calf_r'],feet:['foot_l','foot_r']
};
const findByName=(model,needle)=>{
 let found=null;
 model.traverse(obj=>{
  if(obj.isBone&&obj.name.toLowerCase()===needle)found=obj;
 });
 return found;
};
function aimBone(bone,next,model,side,{strength=.92,forearm=false}={}){
 if(!bone?.isBone||!next?.isBone)return false;
 bone.updateWorldMatrix(true,false);
 next.updateWorldMatrix(true,false);
 bone.getWorldPosition(worldStart);next.getWorldPosition(worldEnd);
 const source=worldEnd.sub(worldStart).normalize();
 model.getWorldQuaternion(modelQ);
 const dest=target.set(side*(forearm?.28:.46),-.86,.10)
  .normalize().applyQuaternion(modelQ);
 // Get rotation from current segment direction to relaxed combat stance.
 const angle=source.angleTo(dest);
 if(angle<.04)return false;
 correctionQ.setFromUnitVectors(source,dest);
 const qParent=bone.parent.getWorldQuaternion(parentQ).clone();
 const localCorrection=qParent.invert().multiply(correctionQ).multiply(qParent);
 candidateQ.copy(bone.quaternion).premultiply(localCorrection);
 bone.quaternion.slerp(candidateQ,strength);
 bone.updateWorldMatrix(true,false);
 return true;
}
export function createMineralLimbArticulator({model,frames,id}={}){
 if(!model||!frames||!id)throw Error('Mineral articulator missing rig');
 const joints=Object.fromEntries(Object.entries(candidates).map(([key,names])=>
  [key,names.map(name=>findByName(model,name))]));
 const segments=[];
 for(const [part,startName,endName,nominal] of pairs){
  for(let side=0;side<2;side++){
   const frame=frames[startName]?.[side];
   const nextFrame=frames[endName]?.[side];
   if(!frame||!nextFrame)continue;
   const mesh=frame.children.find(o=>o.userData?.golemPart===part+'-'+side);
   if(!mesh)throw Error('Missing animated mineral limb '+id+'/'+part+'/'+side);
   segments.push({part,side,frame,nextFrame,mesh,nominal});
  }
 }
 // All 8 continuous segment shells should exist for a fully covered actor.
 if(segments.length!==8)throw Error('Missing articulated arm or leg for '+id);
 let updates=0;
 return {
  segments,revision:MONSTER_LIMB_FIT_REVISION,
  update(action='idle'){
   const relaxed=action==='idle'||action==='guard';
   if(relaxed){
    for(let side=0;side<2;side++){
     aimBone(joints.arms[side],joints.forearms[side],model,
      side===0?1:-1,{strength:.88});
     aimBone(joints.forearms[side],joints.hands[side],model,
      side===0?1:-1,{strength:.77,forearm:true});
    }
   }
   model.updateMatrixWorld(true);
   let corrected=0;
   for(const {frame,nextFrame,mesh,nominal} of segments){
    frame.getWorldPosition(worldStart);
    nextFrame.getWorldPosition(worldEnd);
    frame.worldToLocal(worldEnd);
    delta.copy(worldEnd);
    const span=delta.length();
    if(span<epsilon||!Number.isFinite(span))continue;
    const scale=span/(nominal*1.08);
    // The authored mesh flows from the bone origin toward local -Y.
    // Reorient it to the real articulated child joint, not the old
    // straight T-pose. Skin/cloth source is not required to remain visible.
    mesh.position.set(0,0,0);
    mesh.quaternion.setFromUnitVectors(down,delta.multiplyScalar(1/span));
    mesh.scale.y=THREE.MathUtils.clamp(scale,.26,1.7);
    mesh.userData.limbBoneFit=true;
    mesh.userData.boneDistance=span;
    corrected++;
   }
   updates++;
   return corrected;
  },
  get updates(){return updates;}
 };
}
