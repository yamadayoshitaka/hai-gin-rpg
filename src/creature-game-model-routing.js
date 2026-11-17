/**
 * Single, revisioned model-selection policy for editor, enemy battle and
 * summon renderers. Procedural models are shipped source code. Browser-local
 * adoptions are device previews, NOT globally published assets.
 *
 * A registered baseline is NOT a claim that Android visual/FPS QA passed.
 * External candidates only render after explicit opt-in, source validation,
 * and a successful load. Protected m005/m006 must never be replaced.
 */
import {MONSTER_BY_ID,MONSTER_CATALOG} from './monster-catalog.js';
import {HUMAN_MONSTER_IDS} from './monster-character-cosplay-manifest.js';
import {adoptedCreatureMesh,protectedCreature,baseMonsterId}
 from './creature-mesh-adoption.js';

const humanoids=new Set(HUMAN_MONSTER_IDS);
export const MODEL_REFERENCE_REVISION='m001-sweptback-nose-v20-20261117';
const firstWave=new Set(['m002','m003','m004']);
const locked=new Set(['m005','m006']);
export const GAME_MONSTER_MODEL_REGISTRY=Object.freeze(Object.fromEntries(
 MONSTER_CATALOG.map(spec=>[spec.id,Object.freeze({
  speciesId:spec.id,name:spec.name,family:spec.family,
  model:'procedural:'+spec.id,
  version:spec.id==='m001'?MODEL_REFERENCE_REVISION:
   firstWave.has(spec.id)?'canine-wave-one-20261117':'catalog-baseline',
  stage:locked.has(spec.id)?'protected':
   humanoids.has(spec.id)?'separate-humanoid-pipeline':
   spec.id==='m001'?'reference-implementation':
   firstWave.has(spec.id)?'wave-one-in-progress':'pending-review',
  // Releasing a model does not mean its visual QA has been approved.
  mobileVisualApproved:false,
  gameplayFallback:'procedural:'+spec.id
 })])
));
export const MONSTER_REFRESH_PRIORITY=Object.freeze([
 'm002','m003','m004','m007','m008','m009','m010',
 ...MONSTER_CATALOG.map(s=>s.id).filter(id=>
  !['m001','m002','m003','m004','m005','m006',
     'm007','m008','m009','m010'].includes(id))
]);
export const registeredMonsterModel=id=>
 GAME_MONSTER_MODEL_REGISTRY[baseMonsterId(id)]||null;

/** Route with explicit origin and bounded detail. No automatic use of
 * comparison-only GLBs, mismatched species or unverified remote masters. */
export function resolveRegisteredMonsterModel(id,{
 storage=globalThis.localStorage,detail='low',allowExternal=false
}={}){
 const record=registeredMonsterModel(id);
 if(!record)return Object.freeze({
  id:String(id),registered:false,detail:'low',
  selected:'legacy',externalSource:null,model:null
 });
 const locked=protectedCreature(id);
 const selected=locked?'legacy':adoptedCreatureMesh(id,storage);
 const d=['source','high','medium','low'].includes(detail)?detail:'low';
 return Object.freeze({
  id:String(id),registered:true,record,detail:d,
  protected:locked,selected,
  // Never allocate an independent GLB for the 1000v1000 low LOD crowd.
  externalSource:!locked&&allowExternal&&d!=='low'&&
   !humanoids.has(record.speciesId)&&selected!=='legacy'?selected:null,
  model:record.model,
  kind:humanoids.has(record.speciesId)?'canonical-humanoid':'procedural-monster',
  fallback:record.gameplayFallback
 });
}
