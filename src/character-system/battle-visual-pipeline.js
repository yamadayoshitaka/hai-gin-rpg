/**
 * Shared preview -> skinned battle -> mass GPU quality contract.
 * Keep decisions based on actual attached meshes, not inferred job names.
 * No meshes, shaders, fetches, animations or per-frame allocations are added.
 */
export const BATTLE_CHARACTER_PIPELINE_VERSION='face-hair-back-20261117-v2-visible-ancestor';
function visibleInside(node,root){
 if(!node)return false;
 for(let p=node;p;p=p.parent){
  if(p.visible===false)return false;
  if(root&&p===root)return true;
 }
 return !root;
}
export function battleClosedBackCoverage({quality='battle',panel,opaqueLining=0,preserveBody=false}={}){
 const skinned=Boolean(panel?.isSkinnedMesh&&panel.visible!==false&&
   panel.geometry?.getAttribute?.('position')?.count>=100);
 // An opaque, full source skinned torso is stronger evidence than a
 // procedural rear sheet. Keep clipping covered anatomy when that sheet is
 // suppressed, otherwise the old naked back returns under the costume.
 const sourceBack=quality==='battle'&&opaqueLining>0&&!preserveBody;
 const closed=quality==='battle'&&(skinned||sourceBack)&&!preserveBody;
 return Object.freeze({
  closed,forceCoveredRegions:closed?['torso']:[],
  preserveRegions:quality==='battle'&&!closed&&!opaqueLining?['torso']:[],
  reason:sourceBack?'opaque-source-skinned-tunic':closed?'real-skinned-opaque-back-panel':'unverified-back'
 });
}
export function battleScalpCoverageState(actor){
 const head=actor?.masterHead;
 const wig=head?.studioWig;
 // A visible Group containing only a scalp cap is still a bald soldier.
 // The actual rooted-lock mesh must survive every model/LOD swap.
 const locks=wig?.root?.getObjectByName?.('SINGLE_MESH_NORMAL_LAYERED_HAIR')||
  wig?.root?.getObjectByName?.('REAL_ROOTED_SWEPT_HAIR_LOCKS');
 const rootedVertices=Number(locks?.geometry?.getAttribute?.('position')?.count)||0;
 const studioReady=Boolean(head?.attached&&head.face?.visible!==false&&
  wig?.root&&wig.root.parent&&rootedVertices>300&&
  visibleInside(locks,actor?.character?.object3D||null));
 const fitted=actor?.outfit?.getHairState?.()??{attached:false,visible:false};
 const fallbackReady=Boolean(fitted.attached&&fitted.visible);
 return {
  source:studioReady?'studio-scalp':fallbackReady?'fitted-source':'missing',
  studioReady,fallbackReady,rootedVertices,attached:Boolean(fitted.attached),
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
