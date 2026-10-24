/** CC0 Quaternius real rigged fantasy outfit visuals for the 15 starter-town NPCs.
 * No procedural dummy replacement until all mesh, textures and skeleton have loaded.
 * Each visual is separate from the logical BOM (job/behavior/palette).
 */
import {clone as cloneSkinned} from 'three/addons/utils/SkeletonUtils.js';
import {ACTOR_VISUAL_TUNING,resolveActorVisualTuning} from './actor-visual-tuning.js';
const root='./assets/characters/quaternius-outfits/';
const names=['Male_Peasant','Female_Peasant','Male_Ranger','Female_Ranger'];
const loading=new Map();
function choice(preset){
 if(preset.role==='guard'||preset.job==='冒険者'||preset.job==='旅人')return 'Male_Ranger';
 if(['町娘','子ども','道具屋','案内役'].includes(preset.job)||['town-maiden','child','item-merchant','castle-guide'].includes(preset.id))return 'Female_Peasant';
 if(preset.role==='royal')return 'Male_Ranger';
 return 'Male_Peasant';
}
export async function attachTownOutfitNpc({host,rig,preset,loader,THREE}){
 if(!preset||!rig?.root)return false;
 const id=choice(preset),url=root+id+'.gltf';
 if(!loading.has(id))loading.set(id,loader.loadAsync(url).catch(e=>{loading.delete(id);throw e}));
 try{
  const model=cloneSkinned((await loading.get(id)).scene);
  if(!host.parent||!rig.root.parent)return false;
  const tuning=resolveActorVisualTuning(preset,host.userData?.indoorResident?'indoor':'outdoor');
  const targetHeight=Math.min(ACTOR_VISUAL_TUNING.bounds.maxRenderedHeight,tuning.targetHeight*tuning.scaleMultiplier);
  // A precise skinned-mesh bound is required; default cached bounds can reflect bind pose.
  const measure=()=>{model.updateMatrixWorld(true);return new THREE.Box3().setFromObject(model,true);};
  const sourceBounds=measure(),sourceHeight=sourceBounds.max.y-sourceBounds.min.y;
  if(!Number.isFinite(sourceHeight)||sourceHeight<=0)throw Error('Invalid asset geometry: '+id);
  model.scale.setScalar(targetHeight/sourceHeight);
  model.updateMatrixWorld(true);
  const normalized=measure();
  model.position.y-=normalized.min.y;
  model.position.add(new THREE.Vector3(...tuning.offset));
  // Enforce the data contract on the actual rendered/skinned geometry, not only on a formula.
  const actual=measure(),actualHeight=actual.max.y-actual.min.y;
  if(Math.abs(actualHeight-targetHeight)>targetHeight*0.08){
   throw Error('BOM height mismatch '+id+': actual='+actualHeight+' expected='+targetHeight);
  }
  host.userData.characterVisualTuning=tuning;
  host.userData.characterVisualTargetHeight=targetHeight;
  host.userData.characterVisualMeasuredHeight=actualHeight;
  // retain existing humanoid simulation but hide old visible geometry only after loaded.
  // Quaternius's standard outfits intentionally have no head geometry:
  // combine the imported skinned body with the existing face/hair/neck BOM.
  const faceNodes=new Set();
  rig.joints.head?.traverse(x=>{if(x.isMesh)faceNodes.add(x);});
  rig.root.traverse(x=>{if(x.isMesh){
    const id=x.userData?.partId||'';
    const semantic=String(id)+' '+String(x.name||'');
    x.visible=faceNodes.has(x)||id==='neck'||/equipment-grip|blade|shield|staff|sword/i.test(semantic);
  }});
  const standaloneHead=[...faceNodes].filter(x=>x.userData?.partId==='head');
  for(const x of standaloneHead)x.visible=true;
  model.traverse(x=>{if(x.isMesh){x.castShadow=true;x.receiveShadow=true;}});
  host.add(model);
  const boneMap=new Map();model.traverse(x=>{if(x.isBone)boneMap.set(x.name,x);});
  const mapping=[['upperarm_l',rig.joints.shoulders[0]],['upperarm_r',rig.joints.shoulders[1]],['lowerarm_l',rig.joints.elbows[0]],['lowerarm_r',rig.joints.elbows[1]],['thigh_l',rig.joints.hips[0]],['thigh_r',rig.joints.hips[1]],['shin_l',rig.joints.knees[0]],['shin_r',rig.joints.knees[1]],['spine_01',rig.joints.spine],['neck_01',rig.joints.neck]];
  const sync=mapping.filter(([name,joint])=>boneMap.has(name)&&joint).map(([name,joint])=>({bone:boneMap.get(name),joint,base:boneMap.get(name).quaternion.clone()}));
  const assetSpec=ACTOR_VISUAL_TUNING.assetProfiles[id];
  const bindRotations=new Map(sync.map(({bone})=>[bone.name,bone.quaternion.clone()]));
  const poseDelta=new THREE.Quaternion(),motionDelta=new THREE.Quaternion();
  host.userData.externalNpcSync=()=>{
   for(const {bone,joint} of sync){
    bone.quaternion.copy(bindRotations.get(bone.name));
    const rotation=assetSpec?.restPose?.[bone.name];
    if(rotation)bone.quaternion.multiply(poseDelta.setFromEuler(new THREE.Euler(...rotation)));
    bone.quaternion.multiply(motionDelta.setFromEuler(joint.rotation));
   }
  };
  host.userData.externalNpcSync();
  host.userData.characterVisualSource='quaternius-cc0-outfit';
  host.userData.characterVisualId=id;
  host.userData.characterVisualSourceUrl=url;
  host.userData.characterVisualBones=sync.length;
  return true;
 }catch(e){
  host.userData.characterVisualError=String(e?.message||e);
  console.warn('CC0 outfit unavailable; preserving anatomical character BOM:',id,e);
  return false;
 }
}
