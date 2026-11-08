import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
import {MASTER_MODEL_CATALOG,MASTER_SOURCE_POLICY,createMasterModelCatalog,masterCatalogStats} from '../src/master-model-catalog.js';
import {JOB_CATALOG} from '../src/job-catalog.js';
import {MONSTER_CATALOG} from '../src/monster-catalog.js';
import {CREATURE_VISUAL_SPECS} from '../src/combat-creature-geometry.js';
import {CHARACTER_MODEL_REGISTRY} from '../src/character-model-registry.js';
import {createFaceProfile} from '../src/facial-feature-profiles.js';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
test('master registry includes every job in both sexes and all registered monsters and summons',()=>{
 const expectedHuman=Object.keys(JOB_CATALOG).length*2;
 const expectedMonster=MONSTER_CATALOG.length;
 const expectedSummon=Object.keys(CREATURE_VISUAL_SPECS).length;
 assert.equal(expectedHuman,100);
 assert.equal(expectedMonster,50);
 assert.equal(expectedSummon,8);
 const stats=masterCatalogStats();
 assert.deepEqual(stats.counts,{human:expectedHuman,monster:expectedMonster,summon:expectedSummon});
 assert.equal(stats.registered,158);
 assert.equal(new Set(MASTER_MODEL_CATALOG.map(x=>x.id)).size,stats.registered);
 assert.deepEqual(createMasterModelCatalog().map(x=>x.id),MASTER_MODEL_CATALOG.map(x=>x.id));
});
test('high fidelity SOURCE data is not secretly downsampled or exposed in battle',()=>{
 assert.equal(MASTER_SOURCE_POLICY.optimizeOnRegistration,false);
 assert.equal(MASTER_SOURCE_POLICY.maxTriangles,null);
 assert.equal(MASTER_SOURCE_POLICY.maxBytes,null);
 assert.equal(MASTER_SOURCE_POLICY.enableInBattle,false);
 for(const record of MASTER_MODEL_CATALOG){
  assert.equal(record.policy,MASTER_SOURCE_POLICY);
  assert.equal(record.registration,'reference-only');
  assert.equal(record.face.id,record.kind==='human'?record.jobId:record.id.split(':')[1]);
 }
});
test('each human entry refers to the existing real GLTF and a stable real-mesh face profile',()=>{
 const humans=MASTER_MODEL_CATALOG.filter(x=>x.kind==='human');
 for(const human of humans){
  assert.equal(human.sourceKind,'existing-gltf');
  assert.equal(human.sourcePath,CHARACTER_MODEL_REGISTRY[human.sex].url);
  assert.ok(existsSync(resolve(root,human.sourcePath.replace(/^\.\//,''))),
   human.id+' missing existing GLTF source '+human.sourcePath);
  assert.deepEqual(human.face,createFaceProfile({kind:'human',id:human.jobId,sex:human.sex}));
  for(const property of ['eyes','nose','mouth','blink','speech'])
   assert.ok(human.faceControls.includes(property),human.id+' missing '+property);
 }
});
test('summon and monster source factories are registered as references without pretending GLBs were generated',()=>{
 for(const row of MASTER_MODEL_CATALOG.filter(x=>x.kind!=='human')){
  assert.equal(row.sourceKind,'registered-procedural');
  // Monster creators expose SOURCE; summons currently only support high/low.
  // Highest available summon detail is registered honestly as "high".
  assert.equal(row.sourceDetail,row.kind==='monster'?'source':'high');
  assert.ok(row.sourceFactory==='createMonsterModel'||row.sourceFactory==='buildCombatObjectGeometry');
  assert.ok(!Object.hasOwn(row,'sourcePath'));
  assert.ok(row.face&&row.face.id);
 }
 const summary=masterCatalogStats();
 assert.equal(summary.validated,false);
 assert.equal(summary.photorealismVerified,false);
});
