import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {MONSTER_CATALOG} from '../src/monster-catalog.js';
import {HUMAN_MONSTER_IDS} from '../src/monster-character-cosplay-manifest.js';
import {MESH_ADOPTION_STORAGE_KEY,setAdoptedCreatureMesh}
 from '../src/creature-mesh-adoption.js';
import {GAME_MONSTER_MODEL_REGISTRY,MONSTER_REFRESH_PRIORITY,
 MODEL_REFERENCE_REVISION,registeredMonsterModel,
 resolveRegisteredMonsterModel} from '../src/creature-game-model-routing.js';

const storage=()=>{
 const items=new Map();
 return {
  getItem:key=>items.get(key)||null,
  setItem:(key,val)=>items.set(key,val)
 };
};
test('fifty catalog IDs are registered without inventing visual signoff',()=>{
 assert.equal(MONSTER_CATALOG.length,50);
 assert.equal(Object.keys(GAME_MONSTER_MODEL_REGISTRY).length,50);
 for(const spec of MONSTER_CATALOG){
  const result=registeredMonsterModel(spec.id);
  assert.equal(result.speciesId,spec.id);
  assert.equal(result.model,'procedural:'+spec.id);
  assert.equal(result.mobileVisualApproved,false);
  assert.equal(result.gameplayFallback,'procedural:'+spec.id);
  assert.equal(registeredMonsterModel('summon_'+spec.id),result);
 }
 assert.equal(registeredMonsterModel('m001').version,MODEL_REFERENCE_REVISION);
 assert.equal(registeredMonsterModel('m001').stage,'reference-implementation');
 assert.deepEqual(MONSTER_REFRESH_PRIORITY.slice(0,3),['m002','m003','m004']);
 assert.equal(MONSTER_REFRESH_PRIORITY.length,
   MONSTER_CATALOG.length-HUMAN_MONSTER_IDS.length-3);
 assert.ok(MONSTER_REFRESH_PRIORITY.every(id=>
   !HUMAN_MONSTER_IDS.includes(id)&&!['m005','m006'].includes(id)),
  'the nonhuman batch must not rewrite protected or humanoid sources');
 assert.equal(registeredMonsterModel('m005').stage,'protected');
 assert.equal(registeredMonsterModel('m006').stage,'protected');
 for(const id of HUMAN_MONSTER_IDS)
  assert.equal(registeredMonsterModel(id).stage,'separate-humanoid-pipeline');
});
test('same-origin manual choice reaches the game without changing crowd low LOD',()=>{
 const local=storage();
 const base=resolveRegisteredMonsterModel('m001',{storage:local,detail:'high',allowExternal:true});
 assert.equal(base.selected,'legacy','user-approved procedural sculpt is the game default');
 assert.equal(base.externalSource,null);
 setAdoptedCreatureMesh('m001','r-wolf',local);
 const chosen=resolveRegisteredMonsterModel('m001',{
  storage:local,detail:'high',allowExternal:true
 });
 assert.equal(chosen.selected,'r-wolf');
 assert.equal(chosen.externalSource,'r-wolf');
 assert.equal(chosen.record.version,MODEL_REFERENCE_REVISION);
 assert.equal(resolveRegisteredMonsterModel('m001',{
  storage:local,detail:'low',allowExternal:true
 }).externalSource,null,'1000v1000 crowd never spawns one GLB per creature');
 assert.equal(resolveRegisteredMonsterModel('summon_m001',{
  storage:local,detail:'source',allowExternal:true
 }).externalSource,'r-wolf','summon inherits registered source');
 setAdoptedCreatureMesh('summon_m001','legacy',local);
 assert.equal(resolveRegisteredMonsterModel('summon_m001',{
  storage:local,detail:'high',allowExternal:true
 }).externalSource,null,'summon can independently roll back');
});
test('unmatched donors, protected GLBs and missing IDs never override a model',()=>{
 const local=storage();
 setAdoptedCreatureMesh('m001','q022',local);
 assert.equal(resolveRegisteredMonsterModel('m001',{
  storage:local,detail:'high',allowExternal:true
 }).externalSource,null,'wrong species donor does not reach the game');
 setAdoptedCreatureMesh('m002','r-wolf',local);
 assert.equal(resolveRegisteredMonsterModel('m002',{
  storage:local,detail:'medium',allowExternal:true
 }).externalSource,'r-wolf');
 const forbidden=resolveRegisteredMonsterModel('m005',{
  storage:local,detail:'high',allowExternal:true
 });
 assert.equal(forbidden.protected,true);
 assert.equal(forbidden.externalSource,null);
 assert.equal(forbidden.model,'procedural:m005');
 assert.equal(resolveRegisteredMonsterModel('m999',{storage:local}).registered,false);
 assert.equal(resolveRegisteredMonsterModel('m031',{
  storage:local,detail:'high',allowExternal:true
 }).externalSource,null,'humanoid actor uses separate canonical pipeline');
});
test('battle and summon model factories consume the exact same source policy',()=>{
 const battle=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
 const loader=readFileSync(new URL('../src/battle-registered-monster-model.js',import.meta.url),'utf8');
 const summon=readFileSync(new URL('../src/monster-summon-renderer.js',import.meta.url),'utf8');
 const editor=readFileSync(new URL('../creature-model-adoption.html',import.meta.url),'utf8');
 assert.match(battle,/createRegisteredBattleMonster\(a\.monsterSpec,/);
 assert.match(battle,/registeredHighEnemies<3/);
 assert.match(battle,/registeredExternalEnemies<1/);
 assert.match(battle,/a\.monsterRuntime\.update\(creatureVisualTime,/);
 assert.match(loader,/resolveRegisteredMonsterModel\(spec\.id,/);
 assert.match(loader,/modelLoadStatus='fallback-procedural'/);
 assert.match(loader,/choice\.externalSource/);
 assert.match(summon,/resolveRegisteredMonsterModel\(object\.type,/);
 assert.match(editor,/registeredMonsterModel\(id\)/);
 assert.match(editor,/別端末へ配布するには品質検証後のGitHub公開登録/);
 assert.match(loader,/disposeMonsterSculpture\(native\)/);
 assert.ok(!loader.includes('localStorage.setItem('),
  'battle must read, not overwrite, an editor adoption');
});
console.log('registered 50-species editor-to-game routes, protected rollback, capped LOD PASS');
