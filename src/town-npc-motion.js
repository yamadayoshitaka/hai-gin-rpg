/**
 * Peaceful town-only rig driver for registered civilian GLTFs.
 *
 * The Quaternius Male/Female_Peasant GLTF assets have skeletons but NO
 * embedded animations. Their exported bind pose is a T pose. Playing a
 * nonexistent idle/walk clip or swinging bones around that bind pose leaves
 * villagers walking with both arms spread. Lower the shoulders once in world
 * space and animate around that newly corrected natural rest pose.
 *
 * This module never touches the tactical battle character/motion runtime.
 */
export function selectTownNpcClip(clips,movement='idle'){
 const wanted=movement==='walk'?/(?:walk|run|locomotion)/i:/(?:idle|stand|breath)/i;
 return (clips||[]).find(clip=>{
  if(!clip?.name||!wanted.test(clip.name)||!clip.tracks?.length)return false;
  const tracks=clip.tracks.map(t=>String(t.name||'').toLowerCase());
  const arms=tracks.some(t=>/(upperarm|upper_arm|shoulder|clavicle|leftarm|rightarm)/.test(t));
  const legs=tracks.some(t=>/(thigh|upleg|upper_leg|leftleg|rightleg|calf)/.test(t));
  return arms&&(movement!=='walk'||legs);
 })||null;
}

export function townNpcGait(seconds,{walking=false,phase=0,speed=1}={}){
 const t=(seconds*2.6+phase)*Math.max(.65,Math.min(1.5,speed));
 const sine=Math.sin(t),step=walking?sine:0;
 return {
  leftLeg:step*.35,rightLeg:-step*.35,
  leftKnee:walking?Math.max(0,-sine)*.19:0,
  rightKnee:walking?Math.max(0,sine)*.19:0,
  leftArm:-step*.25,rightArm:step*.25,
  breathing:Math.sin(seconds*1.4+phase)*.012
 };
}

export function createTownNpcProceduralPose(THREE,model){
 if(!THREE||!model)throw Error('Town NPC pose needs THREE and a skinned model');
 const bones=new Map();
 model.traverse(node=>{if(node.isBone)bones.set(node.name.toLowerCase(),node);});
 for(const name of ['upperarm_l','upperarm_r','lowerarm_l','lowerarm_r','thigh_l','thigh_r']){
  if(!bones.has(name))throw Error('Registered NPC is missing '+name);
 }
 model.updateMatrixWorld(true);
 const pose=new Map();
 // GLTF bones extend from shoulder -> elbow in their bind orientation.
 // Compute world-space anatomical directions rather than assuming model-axis
 // conventions. Convert the world-space correction into the parent bone frame.
 const modelWorldQ=model.getWorldQuaternion(new THREE.Quaternion());
 for(const side of ['l','r']){
  const shoulder=bones.get('upperarm_'+side),elbow=bones.get('lowerarm_'+side);
  const a=shoulder.getWorldPosition(new THREE.Vector3());
  const b=elbow.getWorldPosition(new THREE.Vector3());
  const bindDirection=b.sub(a).normalize();
  if(bindDirection.lengthSq()<.1)throw Error('Invalid arm bind direction: '+side);
  const desired=new THREE.Vector3(side==='l'?.19:-.19,-1,.055)
   .normalize().applyQuaternion(modelWorldQ);
  const correction=new THREE.Quaternion().setFromUnitVectors(bindDirection,desired);
  const parentQ=shoulder.parent.getWorldQuaternion(new THREE.Quaternion());
  const parentInverse=parentQ.clone().invert();
  const deltaLocal=parentInverse.multiply(correction).multiply(parentQ);
  shoulder.quaternion.premultiply(deltaLocal);
 }
 model.updateMatrixWorld(true);
 for(const name of ['upperarm_l','upperarm_r','lowerarm_l','lowerarm_r',
  'thigh_l','thigh_r','calf_l','calf_r','spine_01']){
  const bone=bones.get(name);
  if(bone)pose.set(name,{bone,rest:bone.quaternion.clone()});
 }
 const axisX=new THREE.Vector3(1,0,0);
 const delta=new THREE.Quaternion();
 const setSwing=(name,angle)=>{
  const item=pose.get(name);if(!item)return;
  item.bone.quaternion.copy(item.rest).multiply(delta.setFromAxisAngle(axisX,angle));
 };
 const update=(seconds,options={})=>{
  const gait=townNpcGait(seconds,options);
  setSwing('upperarm_l',gait.leftArm);
  setSwing('upperarm_r',gait.rightArm);
  setSwing('lowerarm_l',-.10);
  setSwing('lowerarm_r',-.10);
  setSwing('thigh_l',gait.leftLeg);
  setSwing('thigh_r',gait.rightLeg);
  setSwing('calf_l',gait.leftKnee);
  setSwing('calf_r',gait.rightKnee);
  setSwing('spine_01',gait.breathing);
  model.updateMatrixWorld(true);
 };
 const report=()=>{
  model.updateMatrixWorld(true);
  const armDirection=(side)=>{
   const shoulder=bones.get('upperarm_'+side),elbow=bones.get('lowerarm_'+side);
   const a=shoulder.getWorldPosition(new THREE.Vector3());
   const b=elbow.getWorldPosition(new THREE.Vector3());
   return b.sub(a).normalize().y;
  };
  const left=armDirection('l'),right=armDirection('r');
  return {mode:'procedural',leftArmY:left,rightArmY:right,
   armsLowered:left<-.45&&right<-.45,rigBones:bones.size};
 };
 update(0);
 return {mode:'procedural',update,report};
}
