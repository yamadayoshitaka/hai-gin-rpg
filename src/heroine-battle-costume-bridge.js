import * as THREE from 'three';
import {createCharacter} from './character-system/shared-character-runtime.js?v=4.6.36';
import {buildRiggedJobOutfit} from './character-system/rigged-outfit-runtime.js?v=41';
import {loadJobMotionMap} from './character-system/job-motion-source.js?v=4.6.36';
import {measureHeadLocalBounds} from './character-system/hair-attachment-runtime.js?v=4.4.89';
import {createHeroineBattleActionVfx} from './heroine-battle-action-vfx.js?v=40';

/**
 * Reuse EXACT game battle clothing: Female_Ranger / Female_Peasant skinned GLTF,
 * per-job armor/cloth/gear and the 65-bone Quaternius motion rig.
 * The authoring studio supplies ONLY the independent face and wig.
 */
/**
 * Studio-only proportion correction. Scale the complete combat actor
 * (body, armor, cloth and hand-held gear) as one unit, then counter-scale
 * the independently authored face. This is NEVER applied in battle.
 */
export const HEROINE_STUDIO_BODY_SCALE=.84;
export const HEROINE_STUDIO_HEAD_LIFT=.44;
export const HEROINE_STUDIO_HEAD_FORWARD=.16;

export function fitStudioFaceAboveArmor({actorRoot,faceRoot,faceFit,bodyScale=HEROINE_STUDIO_BODY_SCALE}){
 if(!actorRoot?.isObject3D||!faceRoot?.isObject3D||!faceFit?.targetSize)
  throw Error('Real actor, independent face and measured head required');
 if(!Number.isFinite(bodyScale)||bodyScale<=.5||bodyScale>1)
  throw Error('Invalid preview body scale');
 // Store the initial scale so a new job never accumulates scale factors.
 const original=actorRoot.userData.originalStudioActorScale||
  actorRoot.scale.toArray();
 actorRoot.userData.originalStudioActorScale=[...original];
 actorRoot.scale.set(original[0]*bodyScale,original[1]*bodyScale,original[2]*bodyScale);
 // The face should not shrink along with the breastplate and shoulder armor.
 faceRoot.scale.setScalar(faceFit.scale/bodyScale);
 const headHeight=faceFit.targetSize[1],headDepth=faceFit.targetSize[2];
 const lift=headHeight*HEROINE_STUDIO_HEAD_LIFT/bodyScale;
 const forward=headDepth*HEROINE_STUDIO_HEAD_FORWARD/bodyScale;
 // Re-derive the aligned face position rather than adding offsets on
 // repeated face rebuilds, which previously pushed the head into the collar.
 faceRoot.position.set(
  faceFit.targetCenter[0]-faceFit.sourceCenter[0]*faceRoot.scale.x,
  faceFit.targetCenter[1]-faceFit.sourceCenter[1]*faceRoot.scale.y+lift,
  faceFit.targetCenter[2]-faceFit.sourceCenter[2]*faceRoot.scale.z+forward
 );
 faceRoot.userData.studioBodyScale=bodyScale;
 faceRoot.userData.studioHeadLift=lift;
 faceRoot.userData.studioHeadForward=forward;
 return {bodyScale,faceCompensation:1/bodyScale,
  lift,forward,relativeFaceHeight:faceRoot.scale.y/(faceFit.scale||1),
  appliedToAllCombatJobs:true,previewOnly:true};
}

/**
 * Upgrade materials only for the studio preview. No battle-wide material,
 * shared GLTF, UV, normal map or texture is modified.
 */
export function enhanceStudioCombatMaterials(wardrobeRoot){
 if(!wardrobeRoot?.traverse)throw Error('Real outfit root required');
 let armorMaterials=0,fabricMaterials=0,preservedTextures=0;
 wardrobeRoot.traverse(mesh=>{
  if(!mesh.isMesh||!mesh.material)return;
  const source=Array.isArray(mesh.material)?mesh.material:[mesh.material];
  const mapped=source.map(material=>{
   if(!material?.isMeshStandardMaterial)return material;
   const name=(mesh.name+' '+(material.name||'')).toLowerCase();
   if(/(^|[^a-z])(skin|face|head|eye|hand)([^a-z]|$)/.test(name))
    return material;
   const metallic=/armor|armour|plate|mail|steel|metal|shield|helm|pauldron|sword|blade|brass|silver/.test(name)||
    Number(material.metalness)>.24;
   const fabric=/fabric|cloth|robe|gambeson|leather|linen|cotton|tunic|cape|skirt|sleeve/.test(name);
   if(!metallic&&!fabric)return material;
   const upgraded=material.clone();
   if(upgraded.map||upgraded.normalMap||upgraded.roughnessMap)
    preservedTextures++;
   if(metallic){
    upgraded.roughness=THREE.MathUtils.clamp(upgraded.roughness*.83,.25,.48);
    upgraded.metalness=THREE.MathUtils.clamp(Math.max(upgraded.metalness,.35),.35,.72);
    if(upgraded.isMeshPhysicalMaterial){
     upgraded.clearcoat=Math.max(upgraded.clearcoat||0,.16);
     upgraded.clearcoatRoughness=.29;
    }
    armorMaterials++;
   }else{
    upgraded.roughness=THREE.MathUtils.clamp(upgraded.roughness,.69,.91);
    fabricMaterials++;
   }
   upgraded.needsUpdate=true;
   return upgraded;
  });
  mesh.material=Array.isArray(mesh.material)?mapped:mapped[0];
 });
 return {armorMaterials,fabricMaterials,preservedTextures,sourceAssetsPreserved:true};
}


/**
 * Costume-only fitting pass. The source GLTFs remain intact:
 * the studio narrows overly massive female plate limbs, and removes
 * disconnected *spherical* rivet objects that look like floating marbles.
 */
export function refineHeroineCostumeSilhouette(wardrobeRoot,{gender='female',job='swordsman'}={}){
 if(!wardrobeRoot?.traverse)throw Error('Outfit root required');
 let taperedLegPieces=0,narrowedCuirass=0,hiddenLooseStuds=0,
   loweredTassets=0,skinnedTrousers=0,collarClearancePieces=0;
 wardrobeRoot.updateWorldMatrix(true,true);
 wardrobeRoot.traverse(mesh=>{
  if(!mesh.isMesh)return;
  if(mesh.visible&&mesh.isSkinnedMesh&&/_(?:ranger|peasant)_legs/i.test(mesh.name))
   skinnedTrousers++;
  const slot=mesh.userData?.equipmentSlot||'';
  if(gender==='female'&&mesh.userData?.equipmentClass==='armor'){
   const factor=slot==='chest'?.93:slot==='shoulder'?.91:
    ['thigh','knee','shin','boot-upper'].includes(slot)?.87:
    slot==='boot-foot'?.95:1;
   if(factor!==1){
    mesh.scale.x*=factor;
    mesh.scale.z*=factor;
    if(slot==='chest'){
     // Stop a large breastplate's high neck rim swallowing the face.
     mesh.scale.y*=.94;mesh.position.y-=.012;collarClearancePieces++;
    }
    if(slot==='chest'||slot==='shoulder')narrowedCuirass++;
    else taperedLegPieces++;
   }
  }
  if(gender==='female'&&/(?:neckguard|neck-plate|standing-collar|cuirass-collar)/i.test(mesh.name)
    &&!mesh.isSkinnedMesh){
   mesh.scale.y*=.81;mesh.position.y-=.014;collarClearancePieces++;
  }
  if(gender==='female'&&/cuirass-thigh-tasset/i.test(mesh.name)){
   // Half-width leather/steel panels instead of boxy vertical drainpipes.
   mesh.scale.x*=.82;mesh.scale.z*=.87;
   mesh.scale.y*=.86;loweredTassets++;
  }
  const deliberatelyFloating=job==='summoner'&&
   /(?:summon|orbit|floating|hover|magic-circle|halo|aura)/i.test(mesh.name);
  if(deliberatelyFloating)return;
  if(/(?:cuirass-fastener|armor-rivet|harness-pin|hand-sewn-hem-stud|mantle-clasp|cuirass-suspension-bead)/i.test(mesh.name)){
   mesh.visible=false;hiddenLooseStuds++;
   return;
  }
  // Imported plates may have unlabeled, isolated ball-shaped submeshes.
  // Avoid disabling complex plate shells or the sword's guard by checking
  // both near-spherical proportions and their actual armor slot.
  if(!['chest','shoulder'].includes(slot)||!mesh.geometry?.getAttribute('position')||
     /helmet|shield|weapon/i.test(mesh.name))return;
  mesh.geometry.computeBoundingBox();
  const b=mesh.geometry.boundingBox,local=b.getSize(new THREE.Vector3());
  const world=mesh.getWorldScale(new THREE.Vector3());
  const size=new THREE.Vector3(local.x*Math.abs(world.x),
   local.y*Math.abs(world.y),local.z*Math.abs(world.z));
  const min=Math.min(size.x,size.y,size.z),max=Math.max(size.x,size.y,size.z);
  if(min>.0015&&max<.064&&max/min<1.55){
   mesh.visible=false;hiddenLooseStuds++;
  }
 });
 return {gender,job,taperedLegPieces,narrowedCuirass,hiddenLooseStuds,
  loweredTassets,skinnedTrousers,collarClearancePieces,onlyStudioPreview:true,
  sourceGeometryUnmodified:true};
}

import {applyHeroineSkinMaterial} from './heroine-skin-material.js?v=41';
export function enhanceHeroineFaceSurface(face){
 return applyHeroineSkinMaterial(face);
}

export const REAL_BATTLE_WARDROBE=Object.freeze([
 {id:'job01',name:'剣士',label:'剣士・銀鋼鎧',heroJob:'swordsman'},
 {id:'job02',name:'格闘家',label:'格闘家・拳帯と稽古着',heroJob:'fighter'},
 {id:'job03',name:'魔法使い',label:'魔法使い・ローブ',heroJob:'mage'},
 {id:'job04',name:'弓使い',label:'弓使い・革装束と矢筒',heroJob:'archer'},
 {id:'job05',name:'盾戦士',label:'盾騎士・重鎧と盾',heroJob:'shield'},
 {id:'job06',name:'盗賊',label:'シーフ・軽装と短剣',heroJob:'thief'},
 {id:'job07',name:'忍者',label:'忍者・忍装束と二刀',heroJob:'ninja'},
 {id:'job08',name:'農民・職人',label:'農民・職人の作業着',heroJob:'farmer'},
 {id:'job09',name:'僧侶',label:'僧侶・修道服と杖',heroJob:'cleric'},
 {id:'job10',name:'召喚士',label:'召喚士・儀式服と杖',heroJob:'summoner'}
]);
/** Only actual, available job clips generate playable studio buttons. */
export function existingJobActions(jobs,selection='knight'){
 const job=realBattleJob(selection);
 return (jobs?.[job.name]||[]).filter(row=>
  row.available===true&&row.command&&row.asset&&row.clip)
  .map(row=>({id:row.command,label:row.command,clip:row.clip,asset:row.asset}));
}
export function effectCategoryForRegisteredMotion(command){
 if(/(?:魔法|詠唱|祈り|回復|召喚|スキル)/.test(command))return 'cast';
 if(/(?:斬|突き|射撃|正拳|蹴り|攻撃|連撃|二刀|ダイナマイト)/.test(command))return 'attack';
 if(/(?:防御|ガード|盾構え)/.test(command))return 'guard';
 if(/(?:ダッシュ|走行|走る)/.test(command))return 'run';
 if(/(?:歩行|忍び歩き|歩く)/.test(command))return 'walk';
 return 'idle';
}
export function realBattleJob(selection='knight'){
 return REAL_BATTLE_WARDROBE.find(j=>j.heroJob===selection)||
  REAL_BATTLE_WARDROBE.find(j=>j.id===selection)||
  REAL_BATTLE_WARDROBE[0];
}
const findHead=model=>{
 let head=null;model.traverse(node=>{
  if(node.isBone&&node.name.toLowerCase()==='head')head=node;
 });
 if(!head)throw Error('戦闘モデルに Head 関節がありません');
 return head;
};
/**
 * Mask ORIGINAL skinned head triangles, not the body or any armor meshes.
 * Keep the neck, hands, torso, skin indices, morphs and 65-bone animation.
 * Original GLTF geometry is cloned so changes never poison cached sources.
 */
export function hideBattleDonorFace(model){
 if(!model?.traverse)throw Error('Rigged character model required');
 model.updateMatrixWorld(true);
 const head=findHead(model),region=measureHeadLocalBounds(model,head);
 const size=region.bounds.getSize(new THREE.Vector3());
 // Include the chin / under-lip perimeter. The previous +18% cut left
 // a brown jaw and moustache-shaped strip over the new heroine face.
 const trimY=region.bounds.min.y-size.y*.025;
 let removedTriangles=0,retainedTriangles=0,hiddenEyeMeshes=0,changedMeshes=0;
 const point=new THREE.Vector3(),sample=new THREE.Vector3();
 model.traverse(mesh=>{
  if(!mesh.isSkinnedMesh)return;
  if(/^(eyes|eyebrows)$/i.test(mesh.name)){
   mesh.visible=false;hiddenEyeMeshes++;return;
  }
  const geometry=mesh.geometry,position=geometry?.getAttribute('position'),
   joints=geometry?.getAttribute('skinIndex'),weights=geometry?.getAttribute('skinWeight');
  const index=mesh.skeleton?.bones.findIndex(b=>b===head);
  if(!position||!joints||!weights||index<0)return;
  const raw=geometry.index,triangleCount=(raw?raw.count:position.count)/3;
  if(triangleCount<1)return;
  const retained=[];
  const pointCache=new Map();
  const belongs=i=>{
   if(pointCache.has(i))return pointCache.get(i);
   let influence=0;
   for(let k=0;k<4;k++)if(joints.getComponent(i,k)===index)
    influence+=weights.getComponent(i,k);
   if(influence<.10){pointCache.set(i,false);return false;}
   mesh.getVertexPosition(i,point);
   sample.copy(point).applyMatrix4(mesh.matrixWorld);
   head.worldToLocal(sample);
   const onFace=sample.y>trimY;
   pointCache.set(i,onFace);return onFace;
  };
  for(let i=0;i<triangleCount;i++){
   const indices=[0,1,2].map(k=>raw?raw.getX(i*3+k):i*3+k);
   // Remove a whole facial triangle when two of its vertices lie on the
   // head bone above the cut. Do not leave original skin in the eye socket.
   const count=indices.filter(belongs).length;
   if(count>=2){removedTriangles++;continue;}
   retained.push(...indices);retainedTriangles++;
  }
  if(retained.length!==triangleCount*3){
   const clone=geometry.clone();
   clone.setIndex(retained);
   mesh.geometry=clone;changedMeshes++;
  }
 });
 if(removedTriangles<1)throw Error('Original rigged face could not be isolated');
 // The existing battle facial accessories are not needed when the independent
 // artist face replaces their original eyes and lids.
 return {removedTriangles,retainedTriangles,hiddenEyeMeshes,changedMeshes,
  preservedRig:true,regionSamples:region.samples,trimY,
  headBounds:{min:region.bounds.min.toArray(),max:region.bounds.max.toArray()}};
}

export function attachIndependentFaceToBattleHead({faceRoot,faceMesh,characterModel,headBounds=null}){
 if(!faceRoot||!faceMesh?.geometry||!characterModel)
  throw Error('Face root, actual face mesh and rigged character are required');
 const bone=findHead(characterModel);
 const target=headBounds?
  new THREE.Box3(new THREE.Vector3(...headBounds.min),
   new THREE.Vector3(...headBounds.max)):
  measureHeadLocalBounds(characterModel,bone).bounds;
 faceMesh.geometry.computeBoundingBox();
 const source=faceMesh.geometry.boundingBox;
 const a=source.getSize(new THREE.Vector3()),b=target.getSize(new THREE.Vector3());
 const srcCenter=source.getCenter(new THREE.Vector3());
 const dstCenter=target.getCenter(new THREE.Vector3());
 if(Math.min(a.x,a.y,a.z)<.01||Math.min(b.x,b.y,b.z)<.01)
  throw Error('Head fitting bounds invalid');
 // A shallow donor head DEEPTH should not shrink its entire skull and
 // leave a tiny face below the armor collar. Fit by brow/temple width and
 // brow-to-chin height; keep depth as a separate post-fit diagnostic.
 const widthFit=b.x/a.x,heightFit=b.y/a.y,depthFit=b.z/a.z;
 const scale=Math.min(widthFit*1.04,heightFit*1.06);
 faceRoot.removeFromParent();
 bone.add(faceRoot);
 faceRoot.rotation.set(0,0,0);
 faceRoot.scale.setScalar(scale);
 faceRoot.position.copy(dstCenter).sub(srcCenter.clone().multiplyScalar(scale));
 faceRoot.userData.attachedToRealBattleHeadBone=true;
 faceRoot.userData.battleHeadScale=scale;
 return {bone:bone.name,scale,widthFit,heightFit,depthFit,
  sourceCenter:srcCenter.toArray(),targetCenter:dstCenter.toArray(),
  sourceSize:a.toArray(),targetSize:b.toArray(),
  attachedToRealHeadBone:true};
}

const motionByAction=Object.freeze({
 idle:'idle',walk:'walk',run:'run',attack:'attack',
 guard:'guard',cast:'skill',victory:'idle'
});

export async function createRealBattleOutfitStudio({scene,faceModel,getFaceModel=null,onStatus=()=>{},
 jobId='knight',outfitId='job',actionId='idle',gender='female'}={}){
 if(!['female','male'].includes(gender))throw Error('Unknown studio gender');
 if(!scene?.add||!faceModel?.root||!faceModel.face)
  throw Error('Real scene and independent face are required');
 const jobs=await loadJobMotionMap();
 let actor=null,outfit=null,vfx=null,headRoot=faceModel.root,face=faceModel.face;
 let currentJob=jobId,currentOutfit=outfitId,currentAction=actionId;
 let nativeCommand=null,nativeClip=null;
 let hiddenBody=false,outfitShown=true,disposed=false,request=0,headReport=null,headFit=null,proportions=null,finishReport=null;
 const chosenOutfit=()=>currentOutfit==='job'?
  realBattleJob(currentJob):realBattleJob(currentOutfit);
 async function install(){
  const serial=++request,job=realBattleJob(currentJob);
  const chosen=chosenOutfit();
  onStatus('戦闘用の実衣装を接続中：'+chosen.label);
  const fresh=await createCharacter({job:job.name,sex:gender,height:gender==='male'?1.77:1.66,
   jobs,faceQuality:'hero',faceId:'hero-girl-01'});
  let clothing;
  try{
   clothing=await buildRiggedJobOutfit({characterModel:fresh.model,
    parent:fresh.object3D,job:chosen.name,sex:gender,quality:'preview',
    preserveBody:false,rarity:'N',studioPreferSkinnedLegs:true,
    studioPreserveLegAnatomy:true});
   if(serial!==request||disposed){
    clothing.dispose();fresh.dispose();return;
   }
   clothing.setHairVisible(false);clothing.setHelmetVisible(false);
   finishReport=enhanceStudioCombatMaterials(clothing.root);
   const silhouetteReport=refineHeroineCostumeSilhouette(clothing.root,{gender,job:chosen.heroJob});
   finishReport={...finishReport,...silhouetteReport};
   const cut=hideBattleDonorFace(fresh.model);
   // Only the independent artist face owns eye and lid rendering.
   fresh.face?.setAutoBlink?.(false);
   fresh.face?.holdBlink?.(0);
   for(const lid of fresh.face?.lids||[])lid.visible=false;
   if(actor){
    vfx?.dispose();vfx=null;
    headRoot.removeFromParent();
    outfit?.dispose();actor.dispose();actor.object3D.removeFromParent();
   }
   actor=fresh;outfit=clothing;headReport=cut;
   // The operator may have changed nose/eye/hair during garment loading.
   // Always graft the newest live face, never an already-disposed preview.
   const latestFace=getFaceModel?.()||faceModel;
   headRoot=latestFace.root;face=latestFace.face;
   if(gender==='female')enhanceHeroineFaceSurface(face);
   scene.add(actor.object3D);
   headFit=attachIndependentFaceToBattleHead({faceRoot:headRoot,
    faceMesh:face,characterModel:actor.model,
    headBounds:headReport.headBounds});
   proportions=fitStudioFaceAboveArmor({actorRoot:actor.object3D,
    faceRoot:headRoot,faceFit:headFit,
    bodyScale:gender==='male'?.93:HEROINE_STUDIO_BODY_SCALE});
   setBodyVisible(!hiddenBody);
   outfit.root.visible=!hiddenBody&&outfitShown;
   vfx=createHeroineBattleActionVfx({THREE,actorRoot:actor.object3D,
    camera:scene.userData.studioPreviewCamera});
   nativeCommand=null;nativeClip=null;
   await playAction(currentAction);
   onStatus('戦闘の既存衣装を反映：'+chosen.label+'。顔と髪は独立メッシュです。');
  }catch(error){
   clothing?.dispose();fresh.dispose();
   throw error;
  }
 }
 function availableActions(){return existingJobActions(jobs,currentJob)}
 async function playRegisteredCommand(command){
  const candidate=availableActions().find(row=>row.id===command);
  if(!actor||!candidate){
   onStatus('この職業には登録済みモーションがありません：'+command);
   return false;
  }
  try{
   const played=await actor.playCommand(candidate.id);
   if(!played)return false;
   nativeCommand=candidate.id;nativeClip=actor.diagnostics()?.clip||candidate.clip;
   currentAction=effectCategoryForRegisteredMotion(candidate.id);
   vfx?.trigger(currentAction,realBattleJob(currentJob).heroJob);
   onStatus('実モーション '+candidate.id+'（'+nativeClip+'）を再生しました');
   return true;
  }catch(error){
   onStatus('登録済みアクション再生エラー：'+String(error));
   return false;
  }
 }
 async function playAction(id){
  currentAction=motionByAction[id]?id:'idle';
  if(!actor)return false;
  try{
   const state=motionByAction[currentAction];
   const played=await actor.play(state);
   if(played){
    nativeCommand=null;nativeClip=actor.diagnostics()?.clip||null;
    vfx?.trigger(currentAction,realBattleJob(currentJob).heroJob);
   }
   if(!played&&state!=='idle')return actor.play('idle');
   return played;
  }catch(error){
   onStatus('モーション適用エラー：'+String(error));return false;
  }
 }
 function setBodyVisible(show){
  hiddenBody=!show;
  if(!actor)return;
  actor.model.traverse(object=>{
   if(!object.isSkinnedMesh)return;
   if(/^(eyes|eyebrows)$/i.test(object.name)){object.visible=false;return;}
   object.visible=show;
  });
  if(outfit)outfit.root.visible=show&&outfitShown;
 }
 function setOutfitVisible(show){
  outfitShown=!!show;
  if(outfit)outfit.root.visible=!hiddenBody&&outfitShown;
 }
 function attachFace(next){
  if(!next?.root||!next.face)throw Error('Updated face required');
  headRoot=next.root;face=next.face;
  if(gender==='female')enhanceHeroineFaceSurface(face);
  if(actor){
   headFit=attachIndependentFaceToBattleHead({
    faceRoot:headRoot,faceMesh:face,characterModel:actor.model,
    headBounds:headReport.headBounds});
   proportions=fitStudioFaceAboveArmor({actorRoot:actor.object3D,
    faceRoot:headRoot,faceFit:headFit,
    bodyScale:gender==='male'?.93:HEROINE_STUDIO_BODY_SCALE});
  }
  return headFit;
 }
 async function setSelection({jobId:nextJob,outfitId:nextOutfit}={}){
  if(nextJob){
   if(currentJob!==nextJob){currentAction='idle';nativeCommand=null;nativeClip=null;}
   currentJob=nextJob;
  }
  if(nextOutfit)currentOutfit=nextOutfit;
  await install();
 }
 function update(dt){
  if(disposed||!actor)return;
  actor.update(dt);outfit?.sync();vfx?.update(dt);
 }
 function getState(){return {
  active:!!actor,gender,rigSource:'battle-character-and-real-65-bone-job-outfit',
  jobId:currentJob,outfitId:currentOutfit,actionId:currentAction,
  nativeCommand,nativeClip,availableActionCount:availableActions().length,
  garment:chosenOutfit().label,
  headReport,headFit,proportions,finishReport,
  sourceTrousers:outfit?.presentation?.().useSourceSkinnedLegs||false,
  retainedLegAnatomy:outfit?.diagnostics?.studioPreserveLegAnatomy||false,
  preservedLegRegions:outfit?.diagnostics?.preservedUnderGarmentLegRegions||[],
  vfx:vfx?.getState()||null,
  realOutfit:!!outfit,hasMotion:!!actor?.diagnostics()?.playing
 };}
 function dispose(){
  disposed=true;++request;
  headRoot.removeFromParent();
  vfx?.dispose();outfit?.dispose();actor?.dispose();actor?.object3D?.removeFromParent();
 }
 await install();
 return {getState,getActor:()=>actor?.object3D||null,
  getOutfit:()=>outfit?.root||null,update,attachFace,setBodyVisible,
  setOutfitVisible,playAction,playRegisteredCommand,getAvailableActions:availableActions,
  setSelection,dispose};
}
