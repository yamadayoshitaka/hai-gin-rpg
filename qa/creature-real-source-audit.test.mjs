import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {MONSTER_CATALOG} from '../src/monster-catalog.js';
import {CREATURE_MASTER_ENTRIES} from '../src/creature-master-library.js';
import {REAL_BASE_CRITERIA,REAL_SOURCE_ACCEPTANCE,REAL_SOURCE_AUDIT,
 REAL_SOURCE_SUMMARY,realSourceAuditFor} from '../src/creature-real-source-audit.js';
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');

test('all 108 source masters have a species anatomy contract, with no false pass',()=>{
 assert.equal(REAL_SOURCE_SUMMARY.total,108);
 assert.equal(REAL_SOURCE_SUMMARY.protected,0);
 assert.equal(REAL_SOURCE_SUMMARY.pending,104);
 assert.equal(REAL_SOURCE_SUMMARY.realSourceApproved,0);
 assert.equal(REAL_SOURCE_AUDIT.length,CREATURE_MASTER_ENTRIES.length);
 assert.equal(new Set(REAL_SOURCE_AUDIT.map(x=>x.id)).size,108);
 assert.equal(Object.keys(REAL_BASE_CRITERIA).length,10);
 assert.ok(REAL_SOURCE_ACCEPTANCE.length>=7);
 for(const master of CREATURE_MASTER_ENTRIES){
  const audit=realSourceAuditFor(master.id);
  assert.ok(audit,master.id);
  assert.equal(audit.name,master.name);
  assert.equal(audit.family,master.family);
  assert.equal(audit.realSourceApproved,false,master.id);
  assert.equal(audit.photoQualityCertified,false,master.id);
  assert.equal(audit.rigVerified,false,master.id);
  assert.ok(audit.criteria.anatomy&&audit.criteria.surface&&audit.criteria.motion,master.id);
  assert.equal(audit.requiredChecks,REAL_SOURCE_ACCEPTANCE);
 }
 for(const monster of MONSTER_CATALOG){
  assert.equal(realSourceAuditFor(monster.id).baseId,
    realSourceAuditFor('summon_'+monster.id).baseId);
  assert.notEqual(realSourceAuditFor(monster.id).kind,
    realSourceAuditFor('summon_'+monster.id).kind);
 }
});
test('m005/m006 now use m001 geometry, with external adoption still explicitly locked',()=>{
 const ids=['m005','m006','summon_m005','summon_m006'];
 for(const id of ids){
  assert.equal(realSourceAuditFor(id).protected,false);
  assert.equal(realSourceAuditFor(id).modifiable,false);
  assert.equal(realSourceAuditFor(id).realSourceApproved,false);
 }
 assert.equal(realSourceAuditFor('m020').protected,false);
 const sculpt=read('../src/monster-geometry.js');
 assert.match(sculpt,/s\.id==='m006'/);
 assert.match(sculpt,/M001_CRANIUM_RINGS/);
 assert.match(sculpt,/s\.id==='m015'\)g\.sphere/);
});
test('source silhouettes use authored anatomical cross-sections, never subdivision KPI',()=>{
 const source=read('../src/monster-shape-kit.js');
 const geometry=read('../src/monster-geometry.js');
 assert.match(source,/const axialLoft=\(parent,shade,stations/);
 assert.match(source,/mesh\.userData\.axialAnatomy=true/);
 assert.match(source,/Anatomical stations|anatomical stations/i);
 assert.match(geometry,/species-shoulder-rib-pelvis-/);
 assert.match(geometry,/avian-keel-rib-cavity-/);
 assert.match(geometry,/segmented-thorax-/);
 assert.match(geometry,/marine-axial-cranial-abdominal-/);
 assert.match(geometry,/marine-posterior-spine-/);
 assert.match(geometry,/marine-caudal-muscle-/);
 assert.match(geometry,/marine-tail-tip-muscle-/);
 assert.doesNotMatch(source,/mesh\.userData\.photorealCertified=true/);
});
test('viewer distinguishes source diagnostics from qualified real 3D bases',()=>{
 const ui=read('../creature-master-studio.html');
 assert.match(ui,/id="realismGate"/);
 assert.match(ui,/realSourceAuditFor/);
 assert.match(ui,/未認定/);
});
