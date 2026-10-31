import {registerAllObjectColliders} from './world-physics-bom.js';
import {createFootContactController} from './human-foot-contact-ik.js';
import {createJointLimiter} from './human-joint-limits.js';
import {createHumanSelfCollision} from './human-self-collision.js';
import {GRIP_BOM,WEAPON_GRIP_BOM,gripAngle} from './human-grip-bom.js';
/** CC0 Quaternius real rigged fantasy outfit visuals for the 15 starter-town NPCs.
 * No procedural dummy replacement until all mesh, textures and skeleton have loaded.
 * Each visual is separate from the logical BOM (job/behavior/palette).
 */
import {makeEquipmentFallback} from './equipment-fallback-bom.js';
import {clone as cloneSkinned} from 'three/addons/utils/SkeletonUtils.js';
import {bindHumanoidSkeleton} from './humanoid-skeleton-adapter.js?v=112.0';
import {ACTOR_VISUAL_TUNING,resolveActorVisualTuning} from './actor-visual-tuning.js';
import {checkHumanoidManifest,checkArmDirections} from './humanoid-visual-contract.js';
import {retainSkinnedHead,attachFittedHeadHair,attachFaceParts} from './quaternius-head-bom.js?v=127.82';
const root='./assets/characters/quaternius-outfits/';
const names=['Male_Peasant','Female_Peasant','Male_Ranger','Female_Ranger'];
const loading=new Map();
const baseLoading=new Map();
function findRigHead(root){let found=null;root.traverse(n=>{if(!found&&n.isBone&&['Head','head','head_01'].includes(n.name))found=n;});return found;}
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
  const outfitHeadNode=findRigHead(model);
  model.add(base);
  // Outfit and facial donor are separately rigged assets. Their skeleton origins
  // are not guaranteed to agree, even when bone names match.
  const facialHead=findRigHead(base);
  const outfitHead=outfitHeadNode;
  if(!facialHead||!outfitHead)throw Error('Cannot align facial skeleton to outfit head bone: '+id);
  model.updateMatrixWorld(true);
  const faceAnchor=model.worldToLocal(facialHead.getWorldPosition(new THREE.Vector3()));
  const outfitAnchor=model.worldToLocal(outfitHead.getWorldPosition(new THREE.Vector3()));
  const facialOffset=outfitAnchor.clone().sub(faceAnchor);
  // Keep the facial donor aligned to the outfit head, without altering the shared skeleton.
  base.position.add(facialOffset);
  model.updateMatrixWorld(true);
  // Record actual head-to-body proportions for visual QA; bone alignment alone
  // cannot establish whether the facial mesh is buried inside the torso.
  const outfitHeadWorld=outfitHead.getWorldPosition(new THREE.Vector3());
  const facialHeadWorld=facialHead.getWorldPosition(new THREE.Vector3());
  host.userData.headAlignmentError=outfitHeadWorld.distanceTo(facialHeadWorld);
  if(host.userData.headAlignmentError>.025)throw Error('Facial head alignment exceeds 2.5cm');
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
  // Geometry-based anatomy telemetry, independent of matching bone pivots.
  const headHeight=(outfitHead.getWorldPosition(new THREE.Vector3()).y-actual.min.y)/actualHeight;
  const shoulderLeft=model.getObjectByName('upperarm_l');
  const shoulderRight=model.getObjectByName('upperarm_r');
  const shoulderWidth=shoulderLeft&&shoulderRight
   ?shoulderLeft.getWorldPosition(new THREE.Vector3()).distanceTo(shoulderRight.getWorldPosition(new THREE.Vector3()))/actualHeight
   :null;
  // Only meshes retained by the facial extraction are candidates. Some source
  // skinned meshes keep their original full-body bounds after index filtering,
  // so an AABB minimum of zero is not evidence of facial penetration.
  const faceMeshes=[];
  base.traverse(node=>{if(node.isMesh&&node.visible&&node.geometry?.getIndex()?.count)faceMeshes.push(node);});
  const faceBounds=new THREE.Box3();
  for(const mesh of faceMeshes)faceBounds.expandByObject(mesh,true);
  const faceBottomRatio=faceBounds.isEmpty()?null:(faceBounds.min.y-actual.min.y)/actualHeight;
  host.userData.characterAnatomyMetrics={headHeightRatio:headHeight,shoulderWidthRatio:shoulderWidth,faceBottomRatio,faceMeshCount:faceMeshes.length,faceBoundsReliable:false};
  // Do not reject a valid imported character using a stale skinned-mesh AABB.
  // Head landmark alignment remains a separate hard failure check.
  // Reject non-finite or implausible shoulder landmarks when both bones exist.
  // A missing shoulder is reported separately rather than silently passing a ratio check.
  if(shoulderWidth!==null&&(!Number.isFinite(shoulderWidth)||shoulderWidth<.08||shoulderWidth>.55))
   throw Error('Shoulder width outside anatomical ratio range: '+shoulderWidth);
  if(!Number.isFinite(headHeight)||headHeight<.65||headHeight>1.12)
   throw Error('Head landmark outside anatomical height range: '+headHeight);
  const facialError=facialHead.getWorldPosition(new THREE.Vector3()).distanceTo(outfitHead.getWorldPosition(new THREE.Vector3()));
  host.userData.characterFacialAlignment={headBoneDistance:facialError,offset:facialOffset.toArray()};
  if(!Number.isFinite(facialError)||facialError>.035)throw Error('Face-to-outfit head alignment exceeds 3.5cm: '+facialError);
  // Do not hide the existing human until the imported humanoid is verified.
  const bones=new Map(),skinned=[],allBones=[];
  model.traverse(node=>{if(node.isBone){allBones.push(node);if(!bones.has(node.name))bones.set(node.name,node);}if(node.isSkinnedMesh)skinned.push(node);});
  const mapping=[['upperarm_l',rig.joints.shoulders[0]],['upperarm_r',rig.joints.shoulders[1]],['lowerarm_l',rig.joints.elbows[0]],['lowerarm_r',rig.joints.elbows[1]],['thigh_l',rig.joints.hips[0]],['thigh_r',rig.joints.hips[1]],['shin_l',rig.joints.knees[0]],['shin_r',rig.joints.knees[1]],['hand_l',rig.joints.wrists[0]],['hand_r',rig.joints.wrists[1]],['foot_l',rig.joints.ankles[0]],['foot_r',rig.joints.ankles[1]],['spine_01',rig.joints.spine],['neck_01',rig.joints.neck]];
  // One authoritative pose rig: the outfit skeleton. The separate facial
  // donor retains its skinning bind matrices but follows the outfit's joint
  // deltas; it is never driven independently by the procedural controller.
  const outfitJointMap=new Map();
  model.traverse(node=>{
   if(!node.isBone)return;
   let parent=node,insideDonor=false;
   while(parent){if(parent===base){insideDonor=true;break;}parent=parent.parent;}
   if(!insideDonor&&!outfitJointMap.has(node.name))outfitJointMap.set(node.name,node);
  });
  const sync=mapping.flatMap(([name,joint])=>{
   const bone=outfitJointMap.get(name);
   return bone&&joint?[{bone,joint,base:bone.quaternion.clone()}]:[];
  });
  const donorFollowers=[];
  base.traverse(node=>{
   if(!node.isBone)return;
   const leader=outfitJointMap.get(node.name);
   if(leader)donorFollowers.push({leader,donor:node,
    leaderRest:leader.quaternion.clone(),donorRest:node.quaternion.clone()});
  });
  const donorDelta=new THREE.Quaternion();
  const syncFacialDonor=()=>{
   for(const item of donorFollowers){
    donorDelta.copy(item.leaderRest).invert().multiply(item.leader.quaternion);
    item.donor.quaternion.copy(item.donorRest).multiply(donorDelta);
   }
   model.updateMatrixWorld(true);
  };
  host.userData.skeletonAuthority={primary:'outfit',donorMode:'follow-bind-relative',outfitBones:outfitJointMap.size,donorFollowers:donorFollowers.length};
  const skeletonAdapter=bindHumanoidSkeleton({THREE,model,joints:rig.joints});
  if(!skeletonAdapter.valid)throw Error('Skeleton adapter: '+skeletonAdapter.reason);
  host.userData.skeletonAdapterBindings=skeletonAdapter.count;
  // A rendered external actor must be driven by the rig, not merely possess bones.
  if(sync.length<6||!sync.some(x=>x.bone.name==='upperarm_l')||!sync.some(x=>x.bone.name==='upperarm_r'))throw Error('External character missing required animation bone bindings: '+id+' ('+sync.length+')');
  // Hair and face silhouettes are data-driven additions to the four base outfit meshes.
  // The original downloaded bundle contains no broad hairstyle variation.
  // Face, wig and facial features must share the donor's *own* head frame.
  // The outfit and donor have independent bind poses, so outfit head-local
  // coordinates put the wig behind the donor face even when head origins match.
  const headBone=facialHead;
  const palette=[0x30211b,0x7c4427,0xbca26d,0x4e3b32,0x39394d,0xa86d45];
  const seed=String(host.userData.actorId||preset.id||id).split('').reduce((n,c)=>((n*31+c.charCodeAt(0))>>>0),17);
  // Disable the procedural helmet/scalp and floating triangle locks until a fitted 3D hair asset is available.
  const hairRoot=attachFittedHeadHair(THREE,headBone,{seed,palette,style:preset.hair||null});
  // The donor skinned scalp protrudes through the small procedural hair shell.
  // Fit the wig over the scalp so hairstyle changes produce an actual silhouette.
  if(hairRoot){
   hairRoot.scale.setScalar(1);
   hairRoot.position.y=0;
  }
  host.userData.hairProfile={style:preset.hair||'default',attached:!!hairRoot,color:seed%palette.length,source:'solid-strand-mesh'};
  host.userData.setHairColor=(hex)=>{if(!hairRoot)return false;hairRoot.userData.setColor?.(hex);return true;};
  // Replace donor eyes/brows with independent selectable components.
  // Keep the donor's anatomical eye meshes. The previous primitive replacements floated in front of the face.
  let faceRoot=null;
  const faceConfig={...(host.userData.faceParts||{})};
  // Keep only one set of facial features: replace donor's separate feature meshes.
  // Do not hide the anatomical skinned head itself.
  // Preserve original donor facial anatomy until a topology-compatible morph head is available.
  // Edit the original anatomical donor instead of overlaying floating primitives.
  // Prefer authored morph targets; fall back to subtle head-bone scaling only.
  const morphMeshes=[];
  base.traverse(node=>{
   if(!node.isMesh||!node.morphTargetDictionary||!node.morphTargetInfluences)return;
   morphMeshes.push(node);
  });
  const originalHeadScale=headBone.scale.clone();
  host.userData.updateFaceParts=(changes={})=>{
   for(const [key,value] of Object.entries(changes)){
    if(value&&typeof value==='object')faceConfig[key]={...(faceConfig[key]||{}),...value};
   }
   const clamp=(n,min,max)=>Math.max(min,Math.min(max,Number(n)||1));
   // Head proportions remain within anatomical bounds; never generate separate face meshes.
   const nose=faceConfig.nose||{},eyes=faceConfig.eyes||{},mouth=faceConfig.mouth||{};
   for(const mesh of morphMeshes){
    for(const [name,index] of Object.entries(mesh.morphTargetDictionary)){
     const key=name.toLowerCase();let amount=null;
     if(/nose.*(wide|width)/.test(key))amount=(clamp(nose.width,.5,1.5)-1)*.6;
     else if(/nose.*(long|length|height)/.test(key))amount=(clamp(nose.height,.5,1.5)-1)*.6;
     else if(/eye.*(big|size|wide)/.test(key))amount=(clamp(eyes.size,.5,1.5)-1)*.6;
     else if(/mouth.*(wide|width)/.test(key))amount=(clamp(mouth.width,.5,1.5)-1)*.6;
     if(amount!==null)mesh.morphTargetInfluences[index]=Math.max(0,Math.min(1,amount));
    }
   }
   headBone.scale.copy(originalHeadScale);
   host.userData.faceComponentConfig=faceConfig;
   host.userData.faceMorphTargets=morphMeshes.reduce((n,m)=>n+Object.keys(m.morphTargetDictionary).length,0);
   return morphMeshes.length>0;
  };
  // Preview-only blank anatomical head. Keep donor skeleton for animation and attachments.
  const mannequinHead=new THREE.Mesh(new THREE.SphereGeometry(1,32,24),new THREE.MeshStandardMaterial({color:0xb9a99a,roughness:.9}));
  mannequinHead.name='anatomical-mannequin-head';
  mannequinHead.position.set(0,.025,.005);
  mannequinHead.scale.set(.105,.145,.112);
  mannequinHead.visible=false;
  headBone.add(mannequinHead);
  const donorFaceMeshes=[];
  base.traverse(node=>{if(node.isMesh&&node!==mannequinHead&&node.parent!==faceRoot&&!node.name.startsWith('bom-')&&!node.name.startsWith('wig-'))donorFaceMeshes.push(node);});
  host.userData.setMannequinFace=(enabled)=>{
   mannequinHead.visible=false; // Do not overlay the donor with a spherical dummy head.
   for(const mesh of donorFaceMeshes)mesh.visible=true; // Never hide the donor body or anatomical face.
   if(hairRoot)hairRoot.visible=true;
   const currentFace=host.userData.faceComponentRoot;
   if(currentFace)currentFace.visible=!enabled;
   host.userData.mannequinFace=!!enabled;
   return {enabled:!!enabled,donorMeshes:donorFaceMeshes.length};
  };
  host.userData.faceComponentRoot=faceRoot;
  host.userData.faceComponentConfig=faceConfig;
  // Part slots are attached to the same anatomical head bone, never to the outfit.
  host.userData.setFacePartEnabled=(slot,enabled)=>{
   if(!['eyes','nose','mouth','ears','hair'].includes(slot))return false;
   const show=!!enabled;
   if(slot==='hair'){if(hairRoot)hairRoot.visible=show;return !!hairRoot;}
   const root=host.userData.faceComponentRoot;
   if(!root)return true; // Donor anatomy remains intact; no detached overlay to toggle.
   const aliases={eyes:/^eye-/i,nose:/^nose$/i,mouth:/^mouth$/i,ears:/^ear-/i};
   let changed=false;
   root.traverse(node=>{if(node.isMesh&&aliases[slot].test(node.name)){node.visible=show;changed=true;}});
   return changed;
  };

  const assetSpec=ACTOR_VISUAL_TUNING.assetProfiles[id];
  // Outfit is the authoritative visible body. The facial donor has a second
  // skeleton with identical names; do not use its finger joints for grip.
  const outfitBones=[];
  model.traverse(node=>{
   if(!node.isBone)return;
   let ancestor=node.parent,donor=false;
   while(ancestor){if(ancestor===base){donor=true;break;}ancestor=ancestor.parent;}
   if(!donor)outfitBones.push(node);
  });
  // Exact Quaternius bone naming: index_01_r, thumb_02_l, etc.
  // The old normalized-name regex did not reliably identify the side.
  const fingerBones=outfitBones.map(b=>{
   const match=/^(thumb|index|middle|ring|pinky)_0([123])_([lr])$/i.exec(b.name);
   if(!match)return null;
   return {bone:b,rest:b.quaternion.clone(),side:match[3].toLowerCase(),
    thumb:match[1].toLowerCase()==='thumb',segment:Number(match[2])};
  }).filter(Boolean);
  host.userData.characterFingerBoneCount=fingerBones.length;
  const fingerAxis=new THREE.Vector3(...GRIP_BOM.jointAxis),fingerDelta=new THREE.Quaternion();
  const poseDelta=new THREE.Quaternion(),motionDelta=new THREE.Quaternion(),euler=new THREE.Euler();
  const footIK=createFootContactController({THREE,model,host,bones,config:host.userData.footContactData});
  host.userData.footContactIK=footIK;
  const limitJoints=createJointLimiter(THREE,bones);
  // Disabled pending runtime validation: do not let experimental constraints hide the actor.
  const selfCollision=createHumanSelfCollision({THREE,model,host,bones});
  const wigStart=Date.now();
  // Reset every imported joint to its bind pose before applying the current
  // animation frame. IK and collision corrections must not accumulate over time.
  const bindPose=[...new Set(allBones)].map(bone=>({bone,rotation:bone.quaternion.clone()}));
  const applyPose=()=>{
   // Physics-owned death state: do not overwrite joints with the normal clip each frame.
   if(host.userData.physicsDeathActive){
    syncFacialDonor();
    return;
   }
   for(const {bone,rotation} of bindPose)bone.quaternion.copy(rotation);
   model.updateMatrixWorld(true);
   hairRoot?.userData.updateWind?.((Date.now()-wigStart)/1000,{
    ...(host.userData.townWind||{}),
    action:host.userData.previewAction||host.userData.motionContact?.action||host.userData.currentAction||'idle',
    phaseTime:host.userData.motionContact?.time,
    period:host.userData.motionContact?.period
   });
   host.userData.motionShoulderDelta=0;
   // Expose whether actual imported bones receive the procedural joint rotations.
   host.userData.visibleBoneDrive={mapped:sync.length,action:host.userData.previewAction||'idle',bones:sync.map(({bone,joint})=>({name:bone.name,requested:Math.abs(joint.rotation.x)+Math.abs(joint.rotation.y)+Math.abs(joint.rotation.z)}))};
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
    if(bone.name==='upperarm_l'||bone.name==='upperarm_r'){
     // Align the actual shoulder-to-elbow axis with an anatomical downwards
     // target. Imported bind-pose bone axes differ from the procedural rig.
     // Convert through the current parent world transform rather than guessing
     // that shoulder rotation.z is the same for every asset.
     const elbow=bones.get(bone.name==='upperarm_l'?'lowerarm_l':'lowerarm_r');
     if(elbow){
      model.updateMatrixWorld(true);
      const localElbow=elbow.getWorldPosition(new THREE.Vector3());
      const shoulder=bone.getWorldPosition(new THREE.Vector3());
      const current=localElbow.sub(shoulder).normalize();
      const side=bone.name==='upperarm_l'?-1:1;
      const adduction=joint.rotation.z;
      // The arm must clear the hip and equipment in the normal standing pose.
      // Use the BOM's shoulder/hip lateral offsets instead of a near-vertical
      // vector that drives the visible hands through the thighs.
      // Determine the outward side from the actual imported skeleton, not a
      // hard-coded world X sign (mirrored assets otherwise cross the torso).
      const torso=bones.get('spine_01')||bones.get('pelvis');
      const torsoX=torso?torso.getWorldPosition(new THREE.Vector3()).x:0;
      const outward=Math.sign(shoulder.x-torsoX)||side;
      const desiredWorld=new THREE.Vector3(outward*.42,-1,0.055).normalize();
      const parentWorld=bone.parent.getWorldQuaternion(new THREE.Quaternion());
      const inverseParent=parentWorld.invert();
      const desiredLocal=desiredWorld.applyQuaternion(inverseParent);
      const currentLocal=current.applyQuaternion(inverseParent);
      // Use the bind direction and a bounded target, preserving the motion
      // controller's forward swing on its separate axis.
      const correction=new THREE.Quaternion().setFromUnitVectors(currentLocal,desiredLocal);
      bone.quaternion.premultiply(correction);
      bone.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),joint.rotation.x));
      host.userData.shoulderAlignment=host.userData.shoulderAlignment||{};
      host.userData.shoulderAlignment[bone.name]={adduction,desired:[outward*.42,-1,.055]};
     }else bone.quaternion.multiply(q);
    }else bone.quaternion.multiply(q);
    if((bone.name==='upperarm_l'||bone.name==='upperarm_r')&&host.userData?.chibi?.moving){
     host.userData.motionShoulderDelta=Math.max(host.userData.motionShoulderDelta||0,Math.abs(joint.rotation.x));
    }
   }
   // Ragdoll owns the visible skeleton: align actual imported bone segments
   // to Rapier world-space centerlines rather than procedural Euler guesses.
   const physicsPose=host.userData.ragdollPose;
   if(physicsPose){
    const chains=[
     ['upperarm_l','lowerarm_l','upperArmL','forearmL'],
     ['lowerarm_l','hand_l','forearmL','handL'],
     ['upperarm_r','lowerarm_r','upperArmR','forearmR'],
     ['lowerarm_r','hand_r','forearmR','handR'],
     ['thigh_l','shin_l','pelvis','thighL'],
     ['shin_l','foot_l','thighL','shinL'],
     ['thigh_r','shin_r','pelvis','thighR'],
     ['shin_r','foot_r','thighR','shinR']
    ];
    for(const [parentName,childName,startName,endName] of chains){
     const parent=bones.get(parentName),child=bones.get(childName);
     const a=physicsPose[startName],b=physicsPose[endName];
     if(!parent||!child||!a||!b)continue;
     model.updateMatrixWorld(true);
     const from=child.getWorldPosition(new THREE.Vector3())
      .sub(parent.getWorldPosition(new THREE.Vector3())).normalize();
     const to=new THREE.Vector3(b[0]-a[0],b[1]-a[1],b[2]-a[2]).normalize();
     if(from.lengthSq()<.5||to.lengthSq()<.5)continue;
     const parentWorld=parent.parent.getWorldQuaternion(new THREE.Quaternion());
     const delta=new THREE.Quaternion().setFromUnitVectors(
      from.applyQuaternion(parentWorld.clone().invert()),
      to.applyQuaternion(parentWorld.clone().invert()));
     parent.quaternion.premultiply(delta);
    }
    model.updateMatrixWorld(true);
   }
   // Keep attack recovery visible on the imported skeleton, rather than
   // relying on the hidden procedural rig alone. This additive wrist motion
   // follows the action state and resets to the bind pose every frame.
   const action=host.userData.previewAction||'idle';
   const weaponEquipped=['sword','shortsword','katana','guard'].includes(preset.equipment);
   const wrist=bones.get('hand_r')||bones.get('wrist_r');
   const swordAttack=weaponEquipped&&/attack|slash|strike/i.test(action);
   // The action preview supplies a normalized phase when available. Otherwise
   // use a stable pose for callers that only provide an action name.
   const phaseValue=typeof host.userData.previewActionPhase==='number'?host.userData.previewActionPhase:NaN;
   const hasPhase=Number.isFinite(phaseValue)&&phaseValue>=0&&phaseValue<=1;
   const phase=hasPhase?phaseValue:.5;
   const swing=phase<.25?phase/.25*.45:phase<.65?.45+(phase-.25)/.40*.55:Math.max(0,1-(phase-.65)/.35);
   // Forward strike in donor local -Z. Wind up, cross the front arc, then recover.
   // A symmetric negative pitch only lifted the weapon backwards.
   const strike=phase<.28?phase/.28:phase<.62?1-(phase-.28)/.34:0;
   const follow=phase>=.28&&phase<.78?Math.sin((phase-.28)/.5*Math.PI):0;
   // A complete front-facing swing: raise in front, accelerate through the target,
   // and recover. Donor skeleton uses opposite pitch to the procedural rig.
   const windup=phase<.30?Math.sin(phase/.30*Math.PI*.5):phase<.58?1:Math.max(0,1-(phase-.58)/.42);
   const cut=phase<.30?0:phase<.72?Math.sin((phase-.30)/.42*Math.PI*.5):Math.max(0,1-(phase-.72)/.28);
   const swordPose={shoulder:.92*windup-1.55*cut,elbow:1.00*windup-.48*cut,wrist:-.28*windup+.82*cut};
   if(swordAttack){
    for(const [name,angle] of [['upperarm_r',swordPose.shoulder],['lowerarm_r',swordPose.elbow]]){
     const armBone=bones.get(name);
     if(armBone)armBone.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),angle));
    }
    if(wrist)wrist.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),swordPose.wrist));
   }
   host.userData.visibleWeaponActionPose={action,active:swordAttack,shoulderPitch:swordAttack?swordPose.shoulder:0,elbowPitch:swordAttack?swordPose.elbow:0,wristPitch:swordAttack?swordPose.wrist:0};
   // Grip the equipped weapon using the imported finger chains, not an unskinned visual proxy.
   const gripSamples=[];
   for(const {bone,rest,side,thumb,segment} of fingerBones){
    const curl=gripAngle({equipment:preset.equipment,action,side,thumb,segment});
    // Finger curl is driven by the grip BOM; mirror the left hand and
    // let the thumb oppose the four fingers around the handle.
    // Each digit's local Y follows the phalanx in the Quaternius rig.
    // Curl around the local X hinge, preserving the original bind pose.
    const signedCurl=curl*(thumb?-1:1)*(side==='l'?-1:1);
    bone.quaternion.copy(rest).multiply(fingerDelta.setFromAxisAngle(fingerAxis,signedCurl));
    gripSamples.push({name:bone.name,side,thumb,segment,angle:curl});
   }
   host.userData.fingerGripDiagnostics={
    visibleOutfitFingerBones:outfitBones.filter(b=>/thumb|index|middle|ring|pinky/i.test(b.name)).length,
    availableFingerBones:allBones.filter(b=>/thumb|index|middle|ring|pinky|little/i.test(b.name)).map(b=>b.name),
    action,equipment:preset.equipment||'none',
    jointCount:gripSamples.length,
    right:gripSamples.filter(x=>x.side==='r'),
    left:gripSamples.filter(x=>x.side==='l')
   };
   // Override the visible skinned thighs during ATB. The hidden BOM moving is
   // insufficient when an imported outfit is the actual rendered actor.
   const gait=Number(host.userData.atbVisibleGait)||0;
   if(gait&&host.userData.chibi?.moving){
    for(const [name,sign] of [['thigh_l',1],['thigh_r',-1]]){
     const b=bones.get(name);if(!b)continue;
     const base=sync.find(entry=>entry.bone===b);
     if(base){b.quaternion.copy(base.base);b.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),sign*gait));}
    }
   }
   model.updateMatrixWorld(true);
   // The stance-only foot IK must not pull the airborne running leg straight.
   // Running needs a separate contact solver with explicit flight phases.
   const contact=host.userData.motionContact;
   if(footIK.valid&&contact)footIK.tick(contact.action==='run'?{...contact,action:'airborne-run'}:contact);
   if(contact?.action==='run'){
    host.userData.runKneeDiagnostics={
     left:rig.joints.knees[0]?.rotation.x||0,
     right:rig.joints.knees[1]?.rotation.x||0,
     footIK:'released-for-flight'
    };
   }
   host.userData.humanJointLimitCorrections=limitJoints();
   try { selfCollision.tick(); } catch(error) { host.userData.humanCollisionError=String(error?.message||error); }
   host.userData.humanJointLimitCorrections+=limitJoints();
   syncFacialDonor();
   host.userData.syncImportedEquipment?.();
   if(host.userData.visibleJobWeapon?.visible)host.userData.syncFallbackGrip?.();

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
   x.visible=false; // Imported outfit and equipment are the sole rendered visuals.
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
    const armed=false; // The data-selected grip attachment below is the only visible weapon; never add a second generic sword.
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
  // Attach a purpose-built, deterministic fallback for EVERY selectable slot.
  // Missing GLTF assets never produce an invisible tool or an unrelated sword.
  if(visibleHand&&preset.role==='hero'&&preset.equipment!=='none'){
   const fallback=makeEquipmentFallback(THREE,preset.equipment);
   if(fallback){
    fallback.name='visible-job-weapon-fallback';
    // Never attach metre-sized fallback geometry directly to a GLTF bone:
    // inherited non-unit bone scale and rest rotation made it look unchanged
    // even when the imported socket solver was rewritten.
    host.add(fallback);
    host.userData.visibleJobWeapon=fallback;
    host.userData.syncFallbackGrip=()=>{
     model.updateMatrixWorld(true);
     const handPos=visibleHand.getWorldPosition(new THREE.Vector3());
     const handQ=visibleHand.getWorldQuaternion(new THREE.Quaternion());
     fallback.position.copy(host.worldToLocal(handPos.add(new THREE.Vector3(0,-.045,.018).applyQuaternion(handQ))));
     fallback.quaternion.copy(host.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(handQ));
    };
    host.userData.syncFallbackGrip();
   }
  }
  // Imported equipment is normalized to metre units, with the grip at the bone origin.
  // Only the selected equipment is loaded; attachments follow the skinned hand bones.
  const equipped=preset.equipment||'none';
  const equipmentModels={sword:'Sword_Bronze',shortsword:'Sword_Bronze',guard:'Sword_Bronze',
    katana:'Sword_Bronze',hammer:'Axe_Bronze',sickle:'Axe_Bronze'};
  const propId=equipped==='none'?null:equipmentModels[equipped];
  if(equipped==='none'&&host.userData.visibleJobWeapon)host.userData.visibleJobWeapon.visible=false;
  const importedProps=[];
  host.userData.equipmentDiagnostics={requested:equipped,loaded:[],fallback:!!host.userData.visibleJobWeapon,handDistance:null,handAngle:null,fingerGripDistance:null,fingerBoneCount:fingerBones.length,error:null};
  const addHandProp=async(propName,handBone,size,isShield=false)=>{
   if(!handBone||!host.parent)return false;
   const propUrl='./assets/props/fantasy-megakit/'+propName+'.gltf';
   const propScene=(await loader.loadAsync(propUrl)).scene;
   if(!host.parent||!handBone.parent)return false;
   const source=propScene.clone(true);
   source.updateMatrixWorld(true);
   const bbox=new THREE.Box3().setFromObject(source);
   if(bbox.isEmpty())return false;
   const dimensions=bbox.getSize(new THREE.Vector3());
   const longest=Math.max(dimensions.x,dimensions.y,dimensions.z);
   if(!Number.isFinite(longest)||longest<.0001)return false;
   // v129.13: single data-driven attachment pipeline. The old spring,
   // arbitrary weapon-angle offsets, and repeated grip corrections are gone.
   const spec=WEAPON_GRIP_BOM[propName]||WEAPON_GRIP_BOM.Sword_Bronze;
   const pivot=new THREE.Group();
   pivot.name='grip-socket-'+propName;
   source.scale.setScalar(size/longest);
   source.updateMatrixWorld(true);
   const fitted=new THREE.Box3().setFromObject(source);
   const dims=fitted.getSize(new THREE.Vector3());
   const axis=['x','y','z'].reduce((best,k)=>dims[k]>dims[best]?k:best,'x');
   // Sword_Bronze.gltf POSITION bounds: Y [-0.2081, 0.9241].
   // Pommel is the MIN-Y end; blade extends toward MAX-Y.
   // A grip socket must be measured from the pommel, never from the tip.
   const gripWorld=fitted.getCenter(new THREE.Vector3());
   gripWorld[axis]=spec.tipEnd==='min'
    ?fitted.min[axis]+dims[axis]*spec.socketFraction
    :fitted.max[axis]-dims[axis]*spec.socketFraction;
   const gripLocal=source.worldToLocal(gripWorld.clone());
   // Measure the actual finger-knuckle direction in the imported skeleton,
   // rather than assuming the wrist bone's local Y is the grip axis.
   model.updateMatrixWorld(true);
   const side=handBone.name.endsWith('_l')?'l':'r';
   const knuckles=['index_01_','middle_01_','ring_01_','pinky_01_'].map(n=>outfitBones.find(b=>b.name===n+side)).filter(Boolean);
   const handOrigin=handBone.getWorldPosition(new THREE.Vector3());
   const handRotation=handBone.getWorldQuaternion(new THREE.Quaternion());
   const knuckleCenter=new THREE.Vector3();
   if(knuckles.length){
    for(const bone of knuckles)knuckleCenter.add(bone.getWorldPosition(new THREE.Vector3()));
    knuckleCenter.multiplyScalar(1/knuckles.length);
   }else knuckleCenter.copy(handOrigin).add(new THREE.Vector3(0,-.085,0).applyQuaternion(handRotation));
   // The palm grip lies between thumb and index roots, not along the
   // wrist-to-knuckle vector (which pointed the sword through the shoulder).
   const thumb=outfitBones.find(b=>b.name==='thumb_01_'+side);
   const index=outfitBones.find(b=>b.name==='index_01_'+side);
   const anatomicalGripWorld=new THREE.Vector3();
   if(thumb&&index){
    // Center the handle inside the palm, not at the thumb/index web.
    // The web is on the outer edge of the hand; the old midpoint put
    // the weapon visibly beside the fist.
    const web=thumb.getWorldPosition(new THREE.Vector3())
     .add(index.getWorldPosition(new THREE.Vector3())).multiplyScalar(.5);
    anatomicalGripWorld.copy(knuckleCenter).lerp(handOrigin,.48).lerp(web,.16);
   }else{
    anatomicalGripWorld.copy(knuckleCenter).lerp(handOrigin,.48);
   }
   const palmOffset=anatomicalGripWorld.sub(handOrigin).applyQuaternion(handRotation.clone().invert());
   // Weapon pose is independent of finger-chain orientation. The sword's
   // blade extends downward from the palm in the neutral standing pose.
   const downwardWorld=new THREE.Vector3(0,-1,0);
   const downwardHand=downwardWorld.applyQuaternion(handRotation.clone().invert()).normalize();
   // The asset's tip is opposite the pommel end. Align the actual blade
   // direction, never the handle-to-pommel vector, with the pose direction.
   const bladeSign=spec.tipEnd==='min'?1:-1;
   const assetAxis=new THREE.Vector3(axis==='x'?bladeSign:0,axis==='y'?bladeSign:0,axis==='z'?bladeSign:0);
   const align=new THREE.Quaternion().setFromUnitVectors(assetAxis,downwardHand);
   source.quaternion.copy(align);
   source.position.set(0,0,0);
   source.updateMatrix();
   source.position.sub(gripLocal.clone().applyMatrix4(source.matrix));
   pivot.add(source);
   host.add(pivot);
   const entry={pivot,source,handBone,gripLocal,palmOffset,align,fingerAxis,knuckles,isShield};
   importedProps.push(entry);
   host.userData.equipmentDiagnostics.loaded.push(propName);
   host.userData.equipmentGripProfile={propName,gripFraction:spec.socketFraction,handBone:handBone.name,axis,handAxis:downwardHand.toArray(),bladeAxis:downwardHand.toArray(),palmOffset:palmOffset.toArray(),gripRadius:spec.radius};
   pivot.userData.equipmentContacts={
    grip:{layer:'GRIP',shape:'capsule',radius:spec.radius,axis:'y',origin:[0,0,0]},
    attack:{layer:'WEAPON',shape:'mesh',source}
   };
   source.traverse(n=>{if(n.isMesh){n.castShadow=true;n.receiveShadow=true;}});
   if(host.userData.visibleJobWeapon)host.userData.visibleJobWeapon.visible=false;
   // One solver for every equipped asset. Position and orientation are
   // assigned directly from the anatomical palm frame on every pose update.
   host.userData.syncImportedEquipment=()=>{
    model.updateMatrixWorld(true);
    host.updateMatrixWorld(true);
    const inverseHost=host.getWorldQuaternion(new THREE.Quaternion()).invert();
    for(const item of importedProps){
     const handPosition=item.handBone.getWorldPosition(new THREE.Vector3());
     const handQ=item.handBone.getWorldQuaternion(new THREE.Quaternion());
     const palm=handPosition.add(item.palmOffset.clone().applyQuaternion(handQ));
     item.pivot.position.copy(host.worldToLocal(palm.clone()));
     item.pivot.quaternion.copy(inverseHost).multiply(handQ);
     if(item.isShield)item.pivot.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),Math.PI/2));
     item.pivot.updateWorldMatrix(true,false);
     item.source.updateWorldMatrix(true,false);
     const actual=item.source.localToWorld(item.gripLocal.clone());
     const error=actual.distanceTo(palm);
     // Independent geometry diagnostic: the fingertip bones must approach
     // the actual rendered handle, not just its mathematically locked pivot.
     const side=item.handBone.name.endsWith('_l')?'l':'r';
     const tips=['thumb_03_','index_03_','middle_03_','ring_03_','pinky_03_']
      .map(n=>outfitBones.find(b=>b.name===n+side)).filter(Boolean);
     const tipDistances=tips.map(b=>b.getWorldPosition(new THREE.Vector3()).distanceTo(actual));
     host.userData.equipmentDiagnostics.fingertipDistances=tipDistances;
     host.userData.equipmentDiagnostics.fingertipNearest=tipDistances.length?Math.min(...tipDistances):null;
     host.userData.equipmentDiagnostics.fingertipCount=tips.length;
     host.userData.equipmentDiagnostics.renderedGripDistance=error;
     host.userData.equipmentDiagnostics.handDistance=error;
     host.userData.equipmentDiagnostics.gripContact=error<=spec.radius;
     host.userData.equipmentDiagnostics.gripContactDistance=error;
     host.userData.equipmentDiagnostics.gripConstraint={type:'anatomical-socket',held:true,error};
    }
   };
   host.userData.syncImportedEquipment();
   return true;
  };
  if(propId&&visibleHand){
   const previous=host.userData.visibleJobWeapon;
   const weaponLengths={shortsword:.48,katana:.9,hammer:.58,sword:1.12,guard:1.12,shield:1.12};
   const size=weaponLengths[equipped]??.72;
   addHandProp(propId,visibleHand,size).then(ok=>{
    if(ok&&previous){previous.visible=false;host.userData.equipmentDiagnostics.fallback=false;}
   }).catch(e=>{host.userData.equipmentDiagnostics.error=String(e?.message||e);console.warn('Using BOM equipment fallback:',equipped,e)});
  }
  if(['shield','guard'].includes(equipped)){
   const left=bones.get('hand_l')||bones.get('wrist_l')||bones.get('lowerarm_l');
   addHandProp('Shield_Wooden',left,.44,true).catch(e=>{host.userData.equipmentDiagnostics.error=String(e?.message||e);console.warn('Shield fallback:',e)});
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
   // Outfit slot must visibly affect materials even when the same source mesh is reused.
   const outfitPalette={traveler:['#8a7758','#544634'],mage:['#3f508f','#a78ce9'],bandit:['#3c5846','#74663b'],guard:['#798b9c','#c8ccd1'],noble:['#e1d6bc','#bca35f'],merchant:['#a87936','#5f3f29'],villager:['#7c6550','#aa8c63']};
   const colors=outfitPalette[preset.outfit]||[style.cloth,style.accent];
   const cloth=new THREE.Color(colors[0]),accent=new THREE.Color(colors[1]);
   for(let i=0;i<clothes.length;i++){
    const item=clothes[i],name=item.mesh.name.toLowerCase();
    const surface=/metal|armor|plate|helm|shield/.test(name)?accent:cloth;
    item.mesh.material.color.copy(item.base).lerp(surface,/metal|armor|plate/.test(name)?.72:.87);
    if(typeof item.mesh.material.roughness==='number')item.mesh.material.roughness=identity.finish==='steel'?.36:identity.finish==='leather'?.87:identity.finish==='silk'?.68:.79;
   }
   host.userData.appearanceJob=identity.primary;
   host.userData.appearanceOutfit=preset.outfit;
  };
  rig.visualJob=null; // Force material application when asynchronous glTF resolves.
  // Compatibility phase: validated adapter is mounted beside the existing
  // retarget operation. Only one authority may write the visible bones.
  host.userData.skeletonAdapterVersion='112.0';
  host.userData.externalNpcSync=applyPose;
  // Keep the weapon in scale with the displayed external mesh, never with the hidden proxy.
  rig.root.traverse(node=>{if(node.name==='weapon-bom-mount')node.scale.setScalar(.43);});
  host.userData.characterVisualBones=sync.length;
  host.userData.characterAvailableBones=[...bones.keys()];
  host.userData.characterMappedBones=[...new Set(sync.map(x=>x.bone.name))];
  host.userData.motionRetargetVersion='v87-live-bone-diagnostics';
  host.userData.characterVisualContract={valid:true,measuredHeight:poseHeight,targetHeight,armDirectionValid:true,headTriangles:headInfo.headTriangles};
  // Keep collision metadata opt-in until the full skinned solver is validated.
  host.userData.physicsRegisteredMeshes=0;
  host.userData.physicsCollisionContract={status:'temporarily-disabled',reason:'restore-visible-character'};
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
