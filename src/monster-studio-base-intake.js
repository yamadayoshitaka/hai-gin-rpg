/**
 * Artist-approved 2D -> studio-human-model -> humanoid monster intake gate.
 *
 * Do NOT treat a face-studio preview or a browser-exported face+clothes GLB
 * as a game-ready full-body skinned actor. v59 is a studio improvement, not
 * a verified replacement for the Superhero full-body and retargeted actions.
 *
 * The current game deliberately remains on its known-good canonical actors
 * until a separately versioned, fully-tested studio actor package exists.
 */
import {inspectStudioSkinnedActor}
 from './monster-studio-skinned-rig-audit.js';
export const STUDIO_ACTOR_PACKAGE_SCHEMA='hai-gin/studio-skinned-actor/v1';
export const STUDIO_MODEL_PREVIEW_REVISION='v59';

export const HUMANLIKE_SUMMON_PILOT_IDS=Object.freeze([
 'forest_archer','seraph_guardian','dragon_lord'
]);
export const HUMANOID_COSPLAY_TARGET_IDS=Object.freeze([
 'm015',...Array.from({length:15},(_,i)=>'m'+String(i+31).padStart(3,'0'))
]);
export const REQUIRED_SKINNED_BONE_SLOTS=Object.freeze([
 'head','neck','spine','hips',
 'upperArmL','upperArmR','lowerArmL','lowerArmR',
 'thighL','thighR','calfL','calfR'
]);
export const REQUIRED_MOTION_SLOTS=Object.freeze([
 'idle','walk','run','attack','hit','dead'
]);
export const REQUIRED_VIEW_ANGLES=Object.freeze([
 'front','side','back','top'
]);
export const COSPLAY_HUMAN_BASE_RELEASE_POLICY=Object.freeze({
 defaultSource:'canonical-fullbody',
 plannedSource:'studio-unified-human',
 pilotSummons:HUMANLIKE_SUMMON_PILOT_IDS,
 applyUnverifiedStudioModel:false,
 maxHeightErrorRatio:.08,
 minMappedJoints:12,
 requireFaceNeckContinuity:true,
 requireAnimatedEyesAndMouth:true,
 requireWigAndWardrobeClearance:true,
 requireAndroidBrowserQA:true,
 releaseState:'studio-v59-preview-only'
});

const uniqueStrings=x=>Array.isArray(x)&&x.every(y=>
 typeof y==='string'&&y.length>0)&&new Set(x).size===x.length;
const validPath=p=>typeof p==='string'&&
 /^\.\/assets\/[a-z0-9_./-]+\.glb$/i.test(p)&&!p.includes('../')&&!p.includes('//');
const hasAll=(record,names)=>record&&typeof record==='object'&&
 names.every(k=>typeof record[k]==='string'&&record[k].length>0);
const checked=(x)=>x===true;

/**
 * Pure readiness audit, suitable for CI and for future producer/consumer
 * handoff. It does NOT load or activate a new model.
 */
export function validateStudioHumanActorPackage(pkg,{sex='female'}={}){
 const errors=[];
 if(!pkg||typeof pkg!=='object')
  return {ready:false,errors:['studio-actor-package-missing'],modelId:null};
 if(pkg.schema!==STUDIO_ACTOR_PACKAGE_SCHEMA)errors.push('schema');
 if(pkg.sex!==sex||!['male','female'].includes(pkg.sex))errors.push('sex');
 if(!pkg.modelId||typeof pkg.modelId!=='string'||
  /^Superhero_/.test(pkg.modelId))errors.push('new-model-id');
 if(!validPath(pkg.modelUrl))errors.push('versioned-game-glb');
 if(!/^v\d+(?:\.\d+)*$/.test(pkg.revision??''))
  errors.push('revision');
 if(pkg.productionSkinnedActor!==true)errors.push('skinned-actor');
 if(pkg.sourceFaceNeckContinuous!==true)errors.push('face-neck-unified');
 if(!hasAll(pkg.bones,REQUIRED_SKINNED_BONE_SLOTS))
  errors.push('anatomical-bone-anchors');
 if(!hasAll(pkg.motions,REQUIRED_MOTION_SLOTS))
  errors.push('game-action-mapping');
 if(!uniqueStrings(pkg.mappedBoneNames)||pkg.mappedBoneNames.length<
  COSPLAY_HUMAN_BASE_RELEASE_POLICY.minMappedJoints)
  errors.push('retarget-joint-coverage');
 if(!Number.isFinite(pkg.measuredHeightM)||
  !Number.isFinite(pkg.targetHeightM)||pkg.targetHeightM<=0||
  Math.abs(pkg.measuredHeightM-pkg.targetHeightM)>
   pkg.targetHeightM*COSPLAY_HUMAN_BASE_RELEASE_POLICY.maxHeightErrorRatio)
  errors.push('height-compatibility');
 if(!checked(pkg.face?.eyes)||!checked(pkg.face?.eyelids))
  errors.push('eyes-missing');
 if(!checked(pkg.face?.blink))errors.push('blink');
 if(!checked(pkg.face?.mouth))errors.push('mouth-expression');
 if(!checked(pkg.face?.jaw) || !checked(pkg.face?.neck))
  errors.push('jaw-neck-continuity');
 if(!checked(pkg.fitting?.wigBaseMasked))
  errors.push('wig-source-scalp-overlap');
 if(!checked(pkg.fitting?.armorAndCostumeNoClips))
  errors.push('armor-cloth-clearance');
 if(!checked(pkg.fitting?.wingAndHornRoots))
  errors.push('wings-horns-attachment');
 if(!REQUIRED_VIEW_ANGLES.every(v=>checked(pkg.visualQA?.[v])))
  errors.push('2d-four-view-comparison');
 if(!checked(pkg.visualQA?.androidWebGL))
  errors.push('android-webgl-qa');
 if(!checked(pkg.visualQA?.battleRegression))
  errors.push('battle-regression');
 return {ready:errors.length===0,errors,modelId:pkg.modelId??null,
  pilot:sex==='female'?HUMANLIKE_SUMMON_PILOT_IDS:[],
  sourceRevision:pkg.revision??null};
}

/** Preserve known-good actors even if a future studio package is submitted.
 * Runtime activation belongs to a separate verified adapter implementation.
 * Purely records what is missing; it does not turn studio files into actors. */
export function planHumanoidCosplayBase(profile,{
 studioPackage=null,studioScene=null,studioAnimations=[]
}={}){
 const id=profile?.id??null,sex=profile?.sex??null;
 const isPilot=sex==='female'&&HUMANLIKE_SUMMON_PILOT_IDS.includes(id);
 const isMappedMonster=HUMANOID_COSPLAY_TARGET_IDS.includes(id);
 const actorPackage=validateStudioHumanActorPackage(studioPackage,{
  sex:sex==='male'?'male':'female'
 });
 // A metadata-valid package is not enough. Demand actual weighted meshes,
 // a complete Head/Spine/Limb hierarchy and real bound animation clips.
 const rigAudit=actorPackage.ready&&studioScene?
  inspectStudioSkinnedActor(studioScene,studioPackage,{
   animations:studioAnimations
  }):null;
 return Object.freeze({
  requestedId:id,
  sex,
  rollout:isPilot?'female-summon-pilot':
   isMappedMonster?'humanoid-monster-next':'unmapped',
  studioPackageReady:actorPackage.ready,
  studioRigReady:!!rigAudit?.ready,
  studioRigErrors:rigAudit?.errors??(actorPackage.ready?
   ['studio-scene-not-audited']:[]),
  studioRigSkinnedMeshes:rigAudit?.skinnedMeshes??0,
  errors:actorPackage.errors,
  activeModelId:profile?.modelId??null,
  liveSource:COSPLAY_HUMAN_BASE_RELEASE_POLICY.defaultSource,
  studioPreviewRevision:STUDIO_MODEL_PREVIEW_REVISION,
  activationAllowed:false,
  // Do not accidentally replace a production skinned animation rig merely
  // because a package exists in a separate studio scene.
  nextAction:rigAudit?.ready?'implement-and-test-actor-loader':
   actorPackage.ready?'audit-loaded-studio-skeleton-and-motion':
   'finish-game-rigged-studio-asset'
 });
}
