/**
 * Single, revisioned model-selection policy for editor, enemy battle and
 * summon renderers. Procedural models are shipped source code. Browser-local
 * adoptions are device previews, NOT globally published assets.
 *
 * A registered baseline is NOT a claim that Android visual/FPS QA passed.
 * External candidates only render after explicit opt-in, source validation,
 * and a successful load. m005/m006 now derive m001 locally, but
 * still block unapproved external mesh replacement.
 */
import {MONSTER_BY_ID,MONSTER_CATALOG} from './monster-catalog.js';
import {HUMAN_MONSTER_IDS} from './monster-character-cosplay-manifest.js';
import {adoptedCreatureMesh,protectedCreature,baseMonsterId,
 recommendedMeshSources} from './creature-mesh-adoption.js';
import {hasReptileDetail,REPTILE_DETAIL_REVISION,isSeaDragon,seaDragonRevision} from './reptile-detail-sculpt.js?v=leviathan-abyssal-sea-wyrm-v6-20261121';
import {M050_CORAL_REVISION} from './m050-coral-beast-sculpt.js';
import {M018_HYDRA_REVISION}
 from './m018-hydra-sculpt.js?v=m018-webgl-skin-rooted-horns-v26-20261121';
import {isBeetleLineage,BEETLE_LINEAGE_REVISION}
 from './scarab-beetle-lineage-sculpt.js?v=beetle-four-reference-sculpt-v1-20261121';
import {M024_SCARAB_REVISION} from './m024-poison-scarab-sculpt.js?v=beetle-four-reference-sculpt-v1-20261121';
import {MAGMA_SALAMANDER_REVISION} from './magma-salamander-sculpt.js?v=m019-matched-charcoal-limbs-v20-20261121';
import {salamanderLineageFor} from './salamander-lineage-sculpt.js?v=m016-m017-salamander-quality-v21-20261121';

const humanoids=new Set(HUMAN_MONSTER_IDS);
export const MODEL_REFERENCE_REVISION='m001-sweptback-nose-v20-20261117';
const firstWave=new Set(['m002','m003','m004','m005']);
const felineWave=new Set(['m006','m007','m008','m009','m010']);
const avianWave=new Set(['m011','m012','m013','m014']);
const locked=new Set(['m005','m006']);
export const GAME_MONSTER_MODEL_REGISTRY=Object.freeze(Object.fromEntries(
 MONSTER_CATALOG.map(spec=>[spec.id,Object.freeze({
  speciesId:spec.id,name:spec.name,family:spec.family,
  model:'procedural:'+spec.id,
  version:spec.id==='m001'?MODEL_REFERENCE_REVISION:
   spec.id==='m005'?'m001-forest-wolf-mesh-v14-20261118':
   spec.id==='m006'?'m001-panther-skull-mini-nose-v14-20261118':
   firstWave.has(spec.id)?'m001-compact-wolf-mouth-v10-20261117':
   felineWave.has(spec.id)?'m007-torso-anchor-tail-v12-20261118':
   spec.id==='m018'?M018_HYDRA_REVISION:
   spec.id==='m050'?M050_CORAL_REVISION:
   spec.id==='m024'?M024_SCARAB_REVISION:
   isBeetleLineage(spec.id)?BEETLE_LINEAGE_REVISION:
   isSeaDragon(spec.id)?seaDragonRevision(spec.id):
   hasReptileDetail(spec.id)?REPTILE_DETAIL_REVISION:
   spec.id==='m015'?'phoenix-master-tengu-feathers-v21-20261118':
   avianWave.has(spec.id)?'phoenix-master-bird-plumage-v21-20261118':
   'catalog-baseline',
  stage:locked.has(spec.id)?'m001-source-derivative-external-locked':
   humanoids.has(spec.id)?'separate-humanoid-pipeline':
   spec.id==='m018'?'existing-quadruped-with-three-long-dragon-necks-in-review':
   spec.id==='m050'?'hydra-derived-coral-sea-beast-in-review':
   spec.id==='m024'?'concept-based-poison-scarab-3d-review':
   isBeetleLineage(spec.id)?'m024-donor-beetle-lineage-in-visual-review':
   spec.id==='m019'?'m001-derived-owner-approved-2d-in-visual-review':
   salamanderLineageFor(spec.id)?'m019-anatomy-derivative-visual-review':
   spec.id==='m001'?'reference-implementation':
   firstWave.has(spec.id)?'copied-wolf-king-geometry-in-review':
   felineWave.has(spec.id)?'copied-m007-feline-geometry-in-review':
   avianWave.has(spec.id)?'phoenix-master-bird-anatomy-in-review':
   isSeaDragon(spec.id)?'coiled-sea-dragon-summon-in-review':
   'pending-review',
  // Releasing a model does not mean its visual QA has been approved.
  mobileVisualApproved:false,
  gameplayFallback:'procedural:'+spec.id
 })])
));
// Nonhuman wave remains separate from the independent humanoid cosplay
// workstream. m005/m006 are in the internal physical donor queue
// but remain externally locked. Exclude all manually prioritized IDs from
// the generic tail so a species is never rebuilt twice in one pass.
export const MONSTER_REFRESH_PRIORITY=Object.freeze([
 'm002','m003','m004','m005','m006','m007','m008','m009','m010',
 'm011','m012','m013','m014',
 ...MONSTER_CATALOG.map(s=>s.id).filter(id=>
  !humanoids.has(id)&&
  !['m001','m002','m003','m004','m005','m006',
     'm007','m008','m009','m010','m011','m012','m013','m014'].includes(id))
]);
export const HUMANOID_MONSTER_REVIEW_QUEUE=Object.freeze(
 HUMAN_MONSTER_IDS.filter(id=>!!GAME_MONSTER_MODEL_REGISTRY[id])
);
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
   !humanoids.has(record.speciesId)&&selected!=='legacy'&&
   // An editor-selected donor must match the same animal anatomy.
   // Saved q IDs or reference-only, unrigged assets cannot replace a
   // legitimate game actor simply because localStorage contains them.
   recommendedMeshSources(id).includes(selected)?selected:null,
  model:record.model,
  kind:humanoids.has(record.speciesId)?'canonical-humanoid':'procedural-monster',
  fallback:record.gameplayFallback
 });
}
