/**
 * Shared preview -> skinned battle -> mass GPU quality contract.
 * Keep decisions based on actual attached meshes, not inferred job names.
 * No meshes, shaders, fetches, animations or per-frame allocations are added.
 */
export const BATTLE_CHARACTER_PIPELINE_VERSION='face-hair-back-20261117-v1';
export function battleClosedBackCoverage({quality='battle',panel,opaqueLining=0,preserveBody=false}={}){
 const skinned=Boolean(panel?.isSkinnedMesh&&panel.visible!==false&&
   panel.geometry?.getAttribute?.('position')?.count>=100);
 const closed=quality==='battle'&&skinned&&!preserveBody;
 return Object.freeze({
  closed,forceCoveredRegions:closed?['torso']:[],
  preserveRegions:quality==='battle'&&!closed&&!opaqueLining?['torso']:[],
  reason:closed?'real-skinned-opaque-back-panel':opaqueLining?'source-photo-lining':'unverified-back'
 });
}
export function battleScalpCoverageState(actor){
 const head=actor?.masterHead;
 const wig=head?.studioWig;
 const studioReady=Boolean(head?.attached&&head.face?.visible!==false&&
  wig?.root&&wig.root.visible!==false&&wig.root.parent);
 const fitted=actor?.outfit?.getHairState?.()??{attached:false,visible:false};
 const fallbackReady=Boolean(fitted.attached&&fitted.visible);
 return {
  source:studioReady?'studio-scalp':fallbackReady?'fitted-source':'missing',
  studioReady,fallbackReady,attached:Boolean(fitted.attached),
  fittedVisible:Boolean(fitted.visible),headAttached:Boolean(head?.attached),
  hairStyle:actor?.studioPattern?.hairStyleId||fitted.style||null,
  job:actor?.job?.name||null,actorId:actor?.id??null
 };
}
/** Repair only a missing visible hair layer; never display two wigs at once. */
export function ensureBattleScalpCoverage(actor){
 const before=battleScalpCoverageState(actor);
 if(before.studioReady){
  if(before.fittedVisible)actor.outfit?.setHairVisible?.(false);
  return {before,after:battleScalpCoverageState(actor),repaired:false};
 }
 if(before.fallbackReady)return {before,after:before,repaired:false};
 if(before.attached&&actor?.outfit?.setHairVisible){
  actor.outfit.setHairVisible(true);
  const after=battleScalpCoverageState(actor);
  return {before,after,repaired:after.fallbackReady};
 }
 return {before,after:before,repaired:false,reason:'no-hair-source-available'};
}
export function auditBattleCharacterPipeline(actors=[],{mass=false}={}){
 const rows=actors.filter(a=>!!a.character&&!a.monsterSpec).map(a=>{
  const hair=battleScalpCoverageState(a);
  const outfit=a.outfit?.diagnostics||{};
  const face=a.masterHead?.face;
  return {
   id:a.id,team:a.team,job:a.job?.name,sex:a.sex,
   recipe:a.masterRecipe?.recipeVersion??null,
   sourceModel:a.masterHead?.sourceAsset??null,
   faceVersion:a.masterHead?.version??null,
   faceLightVersion:face?.material?.userData?.battleFaceLightResponseVersion??null,
   expressionRig:!!a.masterHead?.expressions,
   hair,backPanel:outfit.closedBackPanelSkinned??false,
   torsoForcedCovered:outfit.torsoForcedCovered??false,
   sourceBodyPreserved:outfit.bareTorsoPreserved??false,
   attire:outfit.concept??null,
   mode:mass?'real-rig-gpu-source':'individual-skinned-rig'
  };
 });
 return {
  version:BATTLE_CHARACTER_PIPELINE_VERSION,total:rows.length,mass,
  baldRisk:rows.filter(r=>r.hair.source==='missing').map(r=>r.id),
  unclosedBack:rows.filter(r=>!r.backPanel&&!r.torsoForcedCovered).map(r=>r.id),
  missingFacePbr:rows.filter(r=>!r.faceLightVersion).map(r=>r.id),
  sourceSteps:['hero-production-character-factory','shared-character-runtime',
   'battle-artist-head-graft','rigged-outfit-runtime',
   'battle-studio-groom / hair-attachment-runtime',
   mass?'mass-battle-real-army':'individual-skinning'],
  rows
 };
}
