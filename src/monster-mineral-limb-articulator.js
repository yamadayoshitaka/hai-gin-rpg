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
   // Never override the GLTF's authored idle/guard/attack shoulder pose.
   // Forced world-space shoulder aiming caused fists to fly above the head.
   // Instead, solve every mesh FROM the actual two moving joints.
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
