/**
 * Stage-1 high-fidelity SOURCE inventory, not a playable/optimized LOD.
 * Preserves original humanoid donor meshes and independent face identities.
 * Procedural monsters/summons refer to their registered SOURCE generators;
 * registering an entry does NOT mean a new asset was downloaded or validated.
 * No triangle, file-size, or texture-resolution limits are imposed here.
 */
import {JOB_CATALOG} from './job-catalog.js';
import {MONSTER_CATALOG} from './monster-catalog.js';
import {CREATURE_VISUAL_SPECS} from './combat-creature-geometry.js';
import {CHARACTER_MODEL_REGISTRY} from './character-model-registry.js';
import {createFaceProfile} from './facial-feature-profiles.js';

export const MASTER_SOURCE_POLICY=Object.freeze({
 quality:'source', target:'high-fidelity-master', maxBytes:null,
 maxTriangles:null, optimizeOnRegistration:false, enableInBattle:false,
 assetProvenanceRequired:true, realismRequiresVisualReview:true
});
const entry=(data)=>Object.freeze({...data,policy:MASTER_SOURCE_POLICY});
export function createMasterModelCatalog(){
 const rows=[];
 for(const [jobId,job] of Object.entries(JOB_CATALOG)){
  for(const sex of ['male','female']){
   rows.push(entry({
    id:'human:'+jobId+':'+sex,kind:'human',name:job.name,jobId,sex,
    sourceKind:'existing-gltf',sourcePath:CHARACTER_MODEL_REGISTRY[sex].url,
    face:createFaceProfile({kind:'human',id:jobId,sex}),
    faceControls:['eyes','nose','mouth','blink','speech'],
    renderMode:'hero',registration:'reference-only'
   }));
  }
 }
 for(const monster of MONSTER_CATALOG){
  rows.push(entry({
   id:'monster:'+monster.id,kind:'monster',name:monster.name,
   sourceKind:'registered-procedural',sourceCatalog:'MONSTER_CATALOG',
   sourceFactory:'createMonsterModel',sourceDetail:'source',
   face:createFaceProfile({kind:'monster',id:monster.id}),
   faceControls:['eyes','nose','mouth','jaw'],
   registration:'reference-only'
  }));
 }
 for(const type of Object.keys(CREATURE_VISUAL_SPECS)){
  rows.push(entry({
   id:'summon:'+type,kind:'summon',name:type,
   sourceKind:'registered-procedural',sourceCatalog:'CREATURE_VISUAL_SPECS',
   sourceFactory:'buildCombatObjectGeometry',sourceDetail:'source',
   face:createFaceProfile({kind:'summon',id:type}),
   faceControls:['eyes','nose','mouth'],
   registration:'reference-only'
  }));
 }
 return Object.freeze(rows);
}
export const MASTER_MODEL_CATALOG=createMasterModelCatalog();
export function masterCatalogStats(rows=MASTER_MODEL_CATALOG){
 const kinds={human:0,monster:0,summon:0};
 for(const row of rows)if(Object.hasOwn(kinds,row.kind))kinds[row.kind]++;
 return Object.freeze({registered:rows.length,counts:kinds,
  sourceOnly:true,validated:false,photorealismVerified:false});
}
