/** CC0 Quaternius real rigged fantasy outfit visuals for the 15 starter-town NPCs.
 * No procedural dummy replacement until all mesh, textures and skeleton have loaded.
 * Each visual is separate from the logical BOM (job/behavior/palette).
 */
import {clone as cloneSkinned} from 'three/addons/utils/SkeletonUtils.js';
import {bindHumanoidSkeleton} from './humanoid-skeleton-adapter.js?v=112.0';
import {ACTOR_VISUAL_TUNING,resolveActorVisualTuning} from './actor-visual-tuning.js';
import {checkHumanoidManifest,checkArmDirections} from './humanoid-visual-contract.js';
import {retainSkinnedHead,attachFittedHeadHair} from './quaternius-head-bom.js';
const root='./assets/characters/quaternius-outfits/';
const names=['Male_Peasant','Female_Peasant','Male_Ranger','Female_Ranger'];
const loading=new Map();
const baseLoading=new Map();
function assertSkinnedBones(root,label){
 const nodes=new Set();root.traverse(n=>nodes.add(n));
 let skins=0;
 root.traverse(n=>{
  if(!n.isSkinnedMesh)return;
  skins++;
  if(!n.skeleton?.bones?.length||n.skeleton.bones.some(b=>!b?.isBone||!nodes.has(b)))
   throw Error('Incomplete skeleton in '+label+' ('+n.name+')');
 });
 if(!skins)throw Error('No skinned meshes in '+label);
}
function choice(preset){
 const id=preset?.modelId;
 if(!names.includes(id))throw Error('Missing or unsupported character BOM modelId: '+String(id));
 return id;
}
export async function attachTownOutfitNpc({host,rig,preset,loader,THREE}){
 if(!preset||!rig?.root)return false;
 const id=choice(preset),url=root+id+'.gltf';
 if(!loading.has(id))loading.set(id,loader.loadAsync(url).catch(e=>{loading.delete(id);throw e}));
 try{
  const outfitSource=(await loading.get(id)).scene;
  assertSkinnedBones(outfitSource,id+' source');
  const model=cloneSkinned(outfitSource);
  assertSkinnedBones(model,id+' clone');
  const baseId=id.startsWith('Female')?'Superhero_Female_FullBody':'Superhero_Male_FullBody';
  if(!baseLoading.has(baseId)){
   baseLoading.set(baseId,loader.loadAsync('./assets/characters/quaternius-base/'+baseId+'.gltf').catch(e=>{baseLoading.delete(baseId);throw e;}));
  }
  const baseSource=(await baseLoading.get(baseId)).scene;
  assertSkinnedBones(baseSource,baseId+' source');
  const base=cloneSkinned(baseSource);
  assertSkinnedBones(base,baseId+' clone');
  const headInfo=retainSkinnedHead(base);
  model.add(base);
  if(!host.parent||!rig.root.parent)return false;
  const tuning=resolveActorVisualTuning(preset,host.userData?.indoorResident?'indoor':'outdoor');
  const isChild=preset.body==='child'||preset.id==='child';
  const targetHeight=Math.max(isChild?1.35:1.57,Math.min(ACTOR_VISUAL_TUNING.bounds.maxRenderedHeight,tuning.targetHeight*tuning.scaleMultiplier));
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
  // Do not hide the existing human until the imported humanoid is verified.
  const bones=new Map(),skinned=[],allBones=[];
  model.traverse(node=>{if(node.isBone){allBones.push(node);if(!bones.has(node.name))bones.set(node.name,node);}if(node.isSkinnedMesh)skinned.push(node);});
  const mapping=[['upperarm_l',rig.joints.shoulders[0]],['upperarm_r',rig.joints.shoulders[1]],['lowerarm_l',rig.joints.elbows[0]],['lowerarm_r',rig.joints.elbows[1]],['thigh_l',rig.joints.hips[0]],['thigh_r',rig.joints.hips[1]],['shin_l',rig.joints.knees[0]],['shin_r',rig.joints.knees[1]],['spine_01',rig.joints.spine],['neck_01',rig.joints.neck]];
  const sync=mapping.flatMap(([name,joint])=>allBones.filter(b=>b.name===name&&joint).map(bone=>({bone,joint,base:bone.quaternion.clone()})));
  const skeletonAdapter=bindHumanoidSkeleton({THREE,model,joints:rig.joints});
  if(!skeletonAdapter.valid)throw Error('Skeleton adapter: '+skeletonAdapter.reason);
  host.userData.skeletonAdapterBindings=skeletonAdapter.count;
  // A rendered external actor must be driven by the rig, not merely possess bones.
  if(sync.length<6||!sync.some(x=>x.bone.name==='upperarm_l')||!sync.some(x=>x.bone.name==='upperarm_r'))throw Error('External character missing required animation bone bindings: '+id+' ('+sync.length+')');
  // Hair and face silhouettes are data-driven additions to the four base outfit meshes.
  // The original downloaded bundle contains no broad hairstyle variation.
  const headBone=bones.get('Head')||bones.get('head')||bones.get('head_01');
  const palette=[0x30211b,0x7c4427,0xbca26d,0x4e3b32,0x39394d,0xa86d45];
  const seed=String(host.userData.actorId||preset.id||id).split('').reduce((n,c)=>((n*31+c.charCodeAt(0))>>>0),17);
  const hairRoot=attachFittedHeadHair(THREE,headBone,{seed,palette});
  host.userData.hairProfile={style:seed%3,color:seed%palette.length,source:'head-bone-bom'};
  const assetSpec=ACTOR_VISUAL_TUNING.assetProfiles[id];
  const poseDelta=new THREE.Quaternion(),motionDelta=new THREE.Quaternion(),euler=new THREE.Euler();
  const applyPose=()=>{
   host.userData.motionShoulderDelta=0;
   for(const {bone,joint,base} of sync){
    bone.quaternion.copy(base);
    const target=assetSpec?.poseTargets?.[bone.name];
    if(target&&bones.has(target.child)){
     const direction=bones.get(target.child).position.clone().normalize();
     // Target is specified in world coordinates; bones rotate in their parent's local frame.
     const parentWorld=bone.parent.getWorldQuaternion(new THREE.Quaternion());
     const desired=new THREE.Vector3(...target.direction).applyQuaternion(parentWorld.invert()).normalize();
     const originalDirection=direction.applyQuaternion(base);
     poseDelta.setFromUnitVectors(originalDirection,desired);
     bone.quaternion.premultiply(poseDelta);
    }
    // Retarget articulated rotation into the bone's local basis.
    // Walking shoulder swings are never allowed to vanish into a static bind pose.
    const q=motionDelta.setFromEuler(joint.rotation);
    bone.quaternion.multiply(q);
    if((bone.name==='upperarm_l'||bone.name==='upperarm_r')&&host.userData?.chibi?.moving){
     host.userData.motionShoulderDelta=Math.max(host.userData.motionShoulderDelta||0,Math.abs(joint.rotation.x));
    }
   }
   model.updateMatrixWorld(true);

  };
  applyPose();
  // The data contract evaluates the same skinned geometry used by the renderer.
  let boxAfterPose=measure(),poseHeight=boxAfterPose.max.y-boxAfterPose.min.y;
  const manifest=checkHumanoidManifest({boneNames:[...bones.keys()],skinnedMeshCount:skinned.length,modelHeight:poseHeight,targetHeight});
  const arms=checkArmDirections(bones,b=>b.getWorldPosition(new THREE.Vector3()));
  if(!manifest.valid||!arms.valid)throw Error('Humanoid asset contract: '+[...manifest.problems,...arms.problems].join(','));
  // External meshes are accepted only after skeleton and arm-pose tests pass.
  // Imported base supplies a correctly skinned head and facial textures.
  // The placeholder's head/skin must not be drawn over the imported meshes.
  rig.root.traverse(x=>{if(x.isMesh){
   const semantic=String(x.userData?.partId||'')+' '+String(x.name||'');
   x.visible=/equipment-grip|blade|shield|staff|sword/i.test(semantic);
  }});
  model.traverse(x=>{if(x.isMesh){x.castShadow=true;x.receiveShadow=true;}});
  model.userData.sourceModelId=id;
  host.add(model);
  // World-metre sized weapon: imported GLTF bones can have non-unit bind
  // scales, so bone-local weapon geometry may become too small to see.
  if(preset.role==='hero'){
   const worldWeapon=new THREE.Group();worldWeapon.name='hero-visible-weapon-meters';
   const metal=new THREE.MeshStandardMaterial({color:0xcbd9e6,metalness:.66,roughness:.26});
   const gripMat=new THREE.MeshStandardMaterial({color:0x55371f,roughness:.85});
   const blade=new THREE.Mesh(new THREE.BoxGeometry(.064,.60,.026),metal);
   blade.position.y=.43;worldWeapon.add(blade);
   const grip=new THREE.Mesh(new THREE.CylinderGeometry(.025,.026,.21,10),gripMat);
   grip.position.y=.025;worldWeapon.add(grip);
   const guard=new THREE.Mesh(new THREE.BoxGeometry(.22,.035,.055),metal);
   guard.position.y=.15;worldWeapon.add(guard);
   host.add(worldWeapon);
   const hand=bones.get('hand_r')||bones.get('wrist_r')||bones.get('lowerarm_r');
   const handPosition=new THREE.Vector3();
   host.userData.syncVisibleWeapon=()=>{
    const armed=['swordsman','knight'].includes(host.userData.characterBOM?.jobId);
    worldWeapon.visible=armed;
    if(!armed)return;
    if(hand){
     host.updateMatrixWorld(true);
     hand.getWorldPosition(handPosition);
     host.worldToLocal(handPosition);
     // Retain sensible rig-metre fallback when skeleton scaling is atypical.
     if(handPosition.lengthSq()<16&&handPosition.y>.35&&handPosition.y<2.4)worldWeapon.position.copy(handPosition);
     else worldWeapon.position.set(.36,1.07,.08);
    }else worldWeapon.position.set(.36,1.07,.08);
   };
   host.userData.syncVisibleWeapon();
  }
  // The procedural rig is hidden after GLTF acceptance. Its weapon mount
  // would disappear too, so mirror its geometry on the visible hand bone.
  // UAL can later replace this with its own asset-driven attachment.
  const visibleHand=bones.get('hand_r')||bones.get('wrist_r')||bones.get('lowerarm_r');
  const proxyWeapon=rig.root.getObjectByName('weapon-bom-mount');
  if(visibleHand&&proxyWeapon&&preset.role==='hero'){
   const attachment=proxyWeapon.clone(true);
   attachment.name='visible-job-weapon-fallback';
   attachment.scale.setScalar(.55);
   visibleHand.add(attachment);
   host.userData.visibleJobWeapon=attachment;
  }
  // Job appearance updates the visible glTF clothing, not the hidden procedural proxy.
  const clothes=[];
  model.traverse(node=>{
   if(!node.isMesh)return;
   const tag=(node.name+' '+(node.material?.name||'')).toLowerCase();
   if(/skin|face|eye|hair|brow|teeth|mouth|tongue/.test(tag))return;
   if(Array.isArray(node.material))return;
   if(node.material?.color){
    node.material=node.material.clone();
    clothes.push({mesh:node,base:node.material.color.clone(),roughness:node.material.roughness});
   }
  });
  host.userData.applyJobAppearance=(style,identity)=>{
   const cloth=new THREE.Color(style.cloth),accent=new THREE.Color(style.accent);
   for(let i=0;i<clothes.length;i++){
    const item=clothes[i],name=item.mesh.name.toLowerCase();
    const surface=/metal|armor|plate|helm|shield/.test(name)?accent:cloth;
    item.mesh.material.color.copy(item.base).lerp(surface,/metal|armor|plate/.test(name)?.72:.87);
    if(typeof item.mesh.material.roughness==='number')item.mesh.material.roughness=identity.finish==='steel'?.36:identity.finish==='leather'?.87:identity.finish==='silk'?.68:.79;
   }
   host.userData.appearanceJob=identity.primary;
  };
  rig.visualJob=null; // Force material application when asynchronous glTF resolves.
  // Compatibility phase: validated adapter is mounted beside the existing
  // retarget operation. Only one authority may write the visible bones.
  host.userData.skeletonAdapterVersion='112.0';
  host.userData.externalNpcSync=applyPose;
  // Keep the weapon in scale with the displayed external mesh, never with the hidden proxy.
  rig.root.traverse(node=>{if(node.name==='weapon-bom-mount')node.scale.setScalar(.43);});
  host.userData.characterVisualBones=sync.length;
  host.userData.motionRetargetVersion='v87-live-bone-diagnostics';
  host.userData.characterVisualContract={valid:true,measuredHeight:poseHeight,targetHeight,armDirectionValid:true,headTriangles:headInfo.headTriangles};
  host.userData.characterVisualSource='quaternius-cc0-outfit';
  host.userData.characterVisualId=id;
  host.userData.characterVisualSourceUrl=url;
  return true;
 }catch(e){
  host.userData.characterVisualError=String(e?.message||e);
  console.warn('CC0 outfit unavailable; preserving anatomical character BOM:',id,e);
  return false;
 }
}
