import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {CREATURE_RECONSTRUCTION_WORK,CREATURE_RECONSTRUCTION_SUMMARY} from '../src/creature-reconstruction-plan.js';
import {CREATURE_SIX_FAMILY_LANES,taxonomyBatch} from '../src/creature-quality-six-lanes.js';
import {GAME_MONSTER_MODEL_REGISTRY} from '../src/creature-game-model-routing.js';
test('50 enemy + 50 mirrored summons + 8 bespoke: taxonomy six times per hour',()=>{
 assert.equal(CREATURE_RECONSTRUCTION_SUMMARY.total,108);
 assert.equal(CREATURE_SIX_FAMILY_LANES.length,6);
 const seen=new Set();
 for(const category of ['creatureMonster','creatureSummon'])for(let slot=0;slot<6;slot++){
  const {lane,items}=taxonomyBatch(CREATURE_RECONSTRUCTION_WORK,category,slot);
  assert(lane.criteria.length>=5);
  for(const x of items){assert(!seen.has(x.id),'Duplicate creature batch '+x.id);seen.add(x.id)}
 }
 assert.equal(seen.size,108,'Every canonical target must be in one family lane');
 assert.equal(Object.keys(GAME_MONSTER_MODEL_REGISTRY).length,50);
});
test('Protected m005/m006 monster and mirror must not be quality rewrite targets',()=>{
 const set=new Set(CREATURE_RECONSTRUCTION_WORK.filter(x=>!x.canModify).map(x=>x.id));
 for(const id of ['m005','m006','summon_m005','summon_m006'])assert(set.has(id),id+' should remain protected');
});
test('Face hair and wardrobe and creature variants have independent batch switches',()=>{
 const registry=JSON.parse(fs.readFileSync('data/batch-center-switches.json','utf8'));
 for(const k of ['faceHair','outfit','creatureMonster','creatureSummon'])
  assert.equal(registry.groups[k].enabled,true);
 for(const k of ['human','monster'])assert.equal(registry.groups[k].enabled,false);
 for(const k of ['anime','world'])assert.equal(registry.groups[k].enabled,true);
});
test('Enemy and summoned battle renderer both resolve the canonical registered model',()=>{
 const enemy=fs.readFileSync('src/battle-registered-monster-model.js','utf8');
 const summon=fs.readFileSync('src/monster-summon-renderer.js','utf8');
 const route=fs.readFileSync('src/creature-game-model-routing.js','utf8');
 assert.match(route,/GAME_MONSTER_MODEL_REGISTRY/);
 assert.match(route,/resolveRegisteredMonsterModel/);
 assert.match(enemy,/creature-game-model-routing\.js/);
 assert.match(summon,/creature-game-model-routing\.js/);
 assert.match(summon,/monster-summon-registry\.js/);
});
