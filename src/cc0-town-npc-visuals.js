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
  const box=new THREE.Box3().setFromObject(model);
  const height=box.max.y-box.min.y;
  if(!(height>.08&&height<5))throw Error('Invalid character bounds '+height);
  const tuning=resolveActorVisualTuning(preset,host.userData?.indoorResident?'indoor':'outdoor');
  const targetHeight=Math.min(ACTOR_VISUAL_TUNING.bounds.maxRenderedHeight,tuning.targetHeight*tuning.scaleMultiplier);
  model.scale.setScalar(targetHeight/height);
  model.updateMatrixWorld(true);
  const placed=new THREE.Box3().setFromObject(model);
  model.position.y-=placed.min.y;
  model.position.add(new THREE.Vector3(...tuning.offset));
  host.userData.characterVisualTuning=tuning;
  host.userData.characterVisualTargetHeight=targetHeight;
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
  const q=new THREE.Quaternion();
  host.userData.externalNpcSync=()=>{for(const {bone,joint,base} of sync){q.setFromEuler(joint.rotation);bone.quaternion.copy(base).multiply(q);}};
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
