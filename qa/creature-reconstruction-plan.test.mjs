import test from 'node:test';
import assert from 'node:assert/strict';
import {MONSTER_CATALOG} from '../src/monster-catalog.js';
import {HUMAN_MONSTER_IDS} from '../src/monster-character-cosplay-manifest.js';
import {MONSTER_SUMMON_ENTRIES} from '../src/monster-summon-registry.js';
import {CREATURE_RECONSTRUCTION_WORK,CREATURE_RECONSTRUCTION_BY_ID,
 CREATURE_RECONSTRUCTION_SUMMARY,RECONSTRUCTION_ACTIONS,
 FAMILY_REUSE_PARTS,validateReconstructionPlan} from '../src/creature-reconstruction-plan.js';

test('108-entry reconstruction worklist is complete, unique and does not claim 3D completion',()=>{
 assert.equal(validateReconstructionPlan(),true);
 assert.equal(CREATURE_RECONSTRUCTION_SUMMARY.total,108);
 assert.equal(CREATURE_RECONSTRUCTION_SUMMARY.monster,50);
 assert.equal(CREATURE_RECONSTRUCTION_SUMMARY.summon,50);
 assert.equal(CREATURE_RECONSTRUCTION_SUMMARY.dedicated,8);
 assert.equal(CREATURE_RECONSTRUCTION_SUMMARY.humanMonster,16);
 assert.equal(CREATURE_RECONSTRUCTION_SUMMARY.protectedMonster,2);
 assert.equal(CREATURE_RECONSTRUCTION_SUMMARY.qualityPassed,0);
 assert.equal(CREATURE_RECONSTRUCTION_SUMMARY.completed,0);
 assert.equal(new Set(CREATURE_RECONSTRUCTION_WORK.map(x=>x.id)).size,108);
 assert.equal(HUMAN_MONSTER_IDS.length,16);
 assert.equal(MONSTER_CATALOG.length,50);
 assert.equal(MONSTER_SUMMON_ENTRIES.length,50);
 for(const actor of CREATURE_RECONSTRUCTION_WORK){
  assert.equal(actor.rebuiltGLBComplete,false,actor.id);
  assert.equal(actor.kpiPass,false,actor.id);
  assert.equal(actor.originalPreserved,true,actor.id);
  assert.ok(actor.reusedParts.length>=4,actor.id);
  assert.ok(actor.instructions,actor.id);
  assert.ok(actor.strategy,actor.id);
 }
 assert.deepEqual(RECONSTRUCTION_ACTIONS,
  ['idle','walk','run','attack','roar','hit','defeat']);
});
test('all 50 summon versions inherit the same anatomy with separate acceptance and finish',()=>{
 for(const m of MONSTER_CATALOG){
  const enemy=CREATURE_RECONSTRUCTION_BY_ID[m.id];
  const summon=CREATURE_RECONSTRUCTION_BY_ID['summon_'+m.id];
  assert.ok(enemy&&summon,m.id);
  assert.equal(enemy.archetype,summon.archetype,m.id);
  assert.deepEqual(enemy.candidateSources,summon.candidateSources,m.id);
  assert.notEqual(enemy.variant,summon.variant,m.id);
  assert.equal(enemy.kind,'monster');
  assert.equal(summon.kind,'summon');
 }
});
test('previously protected old wolf and panther stay excluded from all rewrite work',()=>{
 for(const id of ['m005','m006','summon_m005','summon_m006']){
  const item=CREATURE_RECONSTRUCTION_BY_ID[id];
  assert.ok(item,id);
  assert.equal(item.stage,'protected');
  assert.equal(item.canModify,false);
  assert.equal(item.candidateSources.length,0);
  assert.equal(item.anatomyReferences.length,0);
 }
});
test('rig and species anatomy are respected: do not replace owl, lion, hydra or spider with unrelated GLB',()=>{
 for(const id of ['m008','m012','m013','m014','m016']){
  const item=CREATURE_RECONSTRUCTION_BY_ID[id];
  assert.equal(item.stage,'anatomy',id);
  assert.equal(item.candidateSources.length,0,id);
  assert.ok(item.anatomyReferences.length>0,id);
 }
 for(const id of ['m018','m020','m026','m027','m028','m029','m030','m047','m048','m049']){
  const item=CREATURE_RECONSTRUCTION_BY_ID[id];
  assert.equal(item.stage,'missing',id);
  assert.equal(item.candidateSources.length,0,id);
 }
 for(let n=21;n<=25;n++){
  const id='m'+String(n).padStart(3,'0');
  assert.equal(CREATURE_RECONSTRUCTION_BY_ID[id].candidateSources.length,0,id);
  assert.ok(CREATURE_RECONSTRUCTION_BY_ID[id].reusedParts.includes('節'));
 }
 assert.ok(FAMILY_REUSE_PARTS.arachnid.includes('8脚'));
});
test('human-type monster rigs, and humanoid golems, never inherit animal donors',()=>{
 for(const id of HUMAN_MONSTER_IDS){
  const actor=CREATURE_RECONSTRUCTION_BY_ID[id];
  assert.equal(actor.stage,'human',id);
  assert.equal(actor.baseMesh,'current-human-rig',id);
  assert.equal(actor.candidateSources.length,0,id);
  assert.equal(actor.modelSelectable,false,id);
 }
 for(const id of ['m036','m037','m038','m039','m040'])
  assert.equal(CREATURE_RECONSTRUCTION_BY_ID[id].stage,'human',id);
});
test('r-wolf is the only existing three-wolf adopted visual baseline',()=>{
 assert.equal(CREATURE_RECONSTRUCTION_BY_ID.m001.baseMesh,'r-wolf');
 assert.equal(CREATURE_RECONSTRUCTION_BY_ID.summon_m001.baseMesh,'r-wolf');
 assert.equal(CREATURE_RECONSTRUCTION_BY_ID.wolf.baseMesh,'r-wolf');
 for(const id of ['m002','m003','m004']){
  assert.equal(CREATURE_RECONSTRUCTION_BY_ID[id].baseMesh,'legacy',id);
  assert.deepEqual(CREATURE_RECONSTRUCTION_BY_ID[id].candidateSources,['r-wolf']);
 }
 assert.equal(CREATURE_RECONSTRUCTION_BY_ID.horse.candidateSources.length,0);
 assert.equal(CREATURE_RECONSTRUCTION_BY_ID.dragon_lord.archetype,'dragon-lord');
 assert.equal(CREATURE_RECONSTRUCTION_BY_ID.seraph_guardian.archetype,'humanoid-angel');
});
