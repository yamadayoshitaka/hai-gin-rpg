import * as THREE from 'three';
import {createCharacter} from './character-system/shared-character-runtime.js?v=4.6.36';
import {buildRiggedJobOutfit} from './character-system/rigged-outfit-runtime.js?v=4.6.15';
import {loadJobMotionMap} from './character-system/job-motion-source.js?v=4.6.36';
import {measureHeadLocalBounds} from './character-system/hair-attachment-runtime.js?v=4.4.89';

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
export const HEROINE_STUDIO_HEAD_LIFT=.30;
export const HEROINE_STUDIO_HEAD_FORWARD=.13;

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
 jobId='knight',outfitId='job',actionId='idle'}={}){
 if(!scene?.add||!faceModel?.root||!faceModel.face)
  throw Error('Real scene and independent face are required');
 const jobs=await loadJobMotionMap();
 let actor=null,outfit=null,headRoot=faceModel.root,face=faceModel.face;
 let currentJob=jobId,currentOutfit=outfitId,currentAction=actionId;
 let hiddenBody=false,outfitShown=true,disposed=false,request=0,headReport=null,headFit=null,proportions=null;
 const chosenOutfit=()=>currentOutfit==='job'?
  realBattleJob(currentJob):realBattleJob(currentOutfit);
 async function install(){
  const serial=++request,job=realBattleJob(currentJob);
  const chosen=chosenOutfit();
  onStatus('戦闘用の実衣装を接続中：'+chosen.label);
  const fresh=await createCharacter({job:job.name,sex:'female',height:1.66,
   jobs,faceQuality:'hero',faceId:'hero-girl-01'});
  let clothing;
  try{
   clothing=await buildRiggedJobOutfit({characterModel:fresh.model,
    parent:fresh.object3D,job:chosen.name,sex:'female',quality:'preview',
    preserveBody:false,rarity:'N'});
   if(serial!==request||disposed){
    clothing.dispose();fresh.dispose();return;
   }
   clothing.setHairVisible(false);clothing.setHelmetVisible(false);
   const cut=hideBattleDonorFace(fresh.model);
   // Only the independent artist face owns eye and lid rendering.
   fresh.face?.setAutoBlink?.(false);
   fresh.face?.holdBlink?.(0);
   for(const lid of fresh.face?.lids||[])lid.visible=false;
   if(actor){
    headRoot.removeFromParent();
    outfit?.dispose();actor.dispose();actor.object3D.removeFromParent();
   }
   actor=fresh;outfit=clothing;headReport=cut;
   // The operator may have changed nose/eye/hair during garment loading.
   // Always graft the newest live face, never an already-disposed preview.
   const latestFace=getFaceModel?.()||faceModel;
   headRoot=latestFace.root;face=latestFace.face;
   scene.add(actor.object3D);
   headFit=attachIndependentFaceToBattleHead({faceRoot:headRoot,
    faceMesh:face,characterModel:actor.model,
    headBounds:headReport.headBounds});
   proportions=fitStudioFaceAboveArmor({actorRoot:actor.object3D,
    faceRoot:headRoot,faceFit:headFit});
   setBodyVisible(!hiddenBody);
   outfit.root.visible=!hiddenBody&&outfitShown;
   await playAction(currentAction);
   onStatus('戦闘の既存衣装を反映：'+chosen.label+'。顔と髪は独立メッシュです。');
  }catch(error){
   clothing?.dispose();fresh.dispose();
   throw error;
  }
 }
 async function playAction(id){
  currentAction=motionByAction[id]?id:'idle';
  if(!actor)return false;
  try{
   const state=motionByAction[currentAction];
   const played=await actor.play(state);
   if(!played&&state!=='idle')await actor.play('idle');
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
  if(actor){
   headFit=attachIndependentFaceToBattleHead({
    faceRoot:headRoot,faceMesh:face,characterModel:actor.model,
    headBounds:headReport.headBounds});
   proportions=fitStudioFaceAboveArmor({actorRoot:actor.object3D,
    faceRoot:headRoot,faceFit:headFit});
  }
  return headFit;
 }
 async function setSelection({jobId:nextJob,outfitId:nextOutfit}={}){
  if(nextJob)currentJob=nextJob;
  if(nextOutfit)currentOutfit=nextOutfit;
  await install();
 }
 function update(dt){
  if(disposed||!actor)return;
  actor.update(dt);outfit?.sync();
 }
 function getState(){return {
  active:!!actor,rigSource:'battle-character-and-real-65-bone-job-outfit',
  jobId:currentJob,outfitId:currentOutfit,actionId:currentAction,
  garment:chosenOutfit().label,
  headReport,headFit,proportions,realOutfit:!!outfit,hasMotion:!!actor?.diagnostics()?.playing
 };}
 function dispose(){
  disposed=true;++request;
  headRoot.removeFromParent();
  outfit?.dispose();actor?.dispose();actor?.object3D?.removeFromParent();
 }
 await install();
 return {getState,getActor:()=>actor?.object3D||null,
  getOutfit:()=>outfit?.root||null,update,attachFace,setBodyVisible,
  setOutfitVisible,playAction,setSelection,dispose};
}
