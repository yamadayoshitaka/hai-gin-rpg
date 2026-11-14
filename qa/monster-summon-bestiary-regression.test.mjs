import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {MONSTER_CATALOG,MONSTER_BY_ID} from '../src/monster-catalog.js';
import {COMBAT_OBJECT_SPECS,COMBAT_JOB_SPECS,availableCombatSkills,COMBAT_RULES}
 from '../src/combat-action-spec.js';
import {creatureSize,LARGE_SUMMON_IDS,SUMMON_WORLD_SCALE}
 from '../src/combat-creature-performance.js';
import {MONSTER_SUMMON_ENTRIES,MONSTER_SUMMON_BY_TYPE,MONSTER_SUMMON_SPECS,
 MONSTER_SUMMON_SKILLS,MONSTER_SUMMON_MODEL_HEIGHT,MONSTER_SUMMON_MAX_ACTIVE,
 isMonsterSummonType,monsterSummonSource,monsterSummonWorldScale}
 from '../src/monster-summon-registry.js';

assert.equal(SUMMON_WORLD_SCALE,10);
assert.equal(MONSTER_SUMMON_MODEL_HEIGHT,17);
assert.equal(MONSTER_CATALOG.length,50);
assert.equal(MONSTER_SUMMON_ENTRIES.length,50);
assert.equal(MONSTER_SUMMON_SKILLS.length,50);
assert.equal(Object.keys(MONSTER_SUMMON_SPECS).length,50);
assert.equal(LARGE_SUMMON_IDS.length,57);
assert.ok(MONSTER_SUMMON_MAX_ACTIVE>=20&&MONSTER_SUMMON_MAX_ACTIVE<=36,
 '10-v-10 armies need at least 20, mobile should never eagerly render 72');
assert.equal(COMBAT_RULES.maximumSummonsPerCaster,1);
const unique=new Set();
for(const m of MONSTER_CATALOG){
 const id='summon_'+m.id,e=MONSTER_SUMMON_BY_TYPE[id];
 assert.equal(isMonsterSummonType(id),true);
 assert.equal(monsterSummonSource(id),m);
 assert.equal(e.monsterId,m.id);
 assert.equal(e.objectSpec.sourceMonsterId,m.id);
 assert.equal(e.objectSpec.category,'summon');
 assert.equal(COMBAT_OBJECT_SPECS[id],e.objectSpec);
 assert.equal(COMBAT_OBJECT_SPECS[id].name,m.name);
 assert.ok(COMBAT_OBJECT_SPECS[id].hp>0);
 assert.ok(e.skillSpec.name.includes(m.name));
 assert.ok(e.skillSpec.objectType===id);
 assert.ok(COMBAT_JOB_SPECS.summoner.skills.includes(e.skillSpec));
 assert.ok(creatureSize(id)>=10);
 assert.ok(e.size>=1);
 assert.ok(e.rank=== (m.rarity==='UR'?'UR':
   ['R','SR'].includes(m.rarity)?'R':'N'));
 assert.ok(monsterSummonWorldScale(id,1.7)>=10);
 assert.ok(monsterSummonWorldScale(id,3.4)>=5);
 assert.equal(e.flying,m.family==='avian'||id==='summon_m042');
 assert.ok(!unique.has(id));unique.add(id);
}
assert.equal(unique.size,50);
assert.equal(availableCombatSkills('summoner','UR').filter(s=>s.objectType?.startsWith('summon_m')).length,50);
assert.equal(availableCombatSkills('summoner','N').filter(s=>s.objectType?.startsWith('summon_m')).length,
 MONSTER_SUMMON_ENTRIES.filter(e=>e.rank==='N').length);
assert.equal(isMonsterSummonType('horse'),false);
assert.equal(isMonsterSummonType('wolf'),false);
assert.equal(monsterSummonSource('horse'),null);
assert.throws(()=>monsterSummonWorldScale('summon_m020',0));
assert.equal(COMBAT_OBJECT_SPECS.horse.category,'mount');
assert.equal(creatureSize('horse'),1);

const gallery=readFileSync(new URL('../summon-showcase.html',import.meta.url),'utf8');
const battleRenderer=readFileSync(new URL('../src/combat-world-object-renderer.js',import.meta.url),'utf8');
const originalGeometry=readFileSync(new URL('../src/monster-geometry.js',import.meta.url),'utf8');
assert.match(gallery,/MONSTER_CATALOG\.filter\(m=>m\.family===family\)/);
assert.match(gallery,/monsterSourceModel\(previewObject\.id\)/);
assert.match(battleRenderer,/createMonsterSummonRenderer\(scene/);
assert.match(battleRenderer,/filter\(type=>\s*!isMonsterSummonType\(type\)\)/);
assert.match(originalGeometry,/spec\.id==='m020'\?seaSerpent/);
assert.equal(MONSTER_BY_ID.m005.name,'翠森の古狼');
assert.equal(MONSTER_BY_ID.m006.name,'黒爪パンサー');

let THREE;
try{THREE=await import('three');}catch(e){
 if(e?.code!=='ERR_MODULE_NOT_FOUND')throw e;
}
if(THREE){
 const {createMonsterSummonRenderer}=await import('../src/monster-summon-renderer.js');
 const scene=new THREE.Scene();
 const camera=new THREE.PerspectiveCamera();
 camera.position.set(0,9,70);
 const renderer=createMonsterSummonRenderer(scene,{
  camera,cellSize:1.12,offset:6,terrainY:()=>0,highDetailDistance:25
 });
 assert.equal(renderer.stats().created,0,'No eager construction of 50 models');
 assert.equal(scene.children.length,0);
 for(const id of ['m001','m012','m018','m020','m030','m045','m050']){
  const source=MONSTER_BY_ID[id],type='summon_'+id;
  const o={id:'qa-'+id,type,x:6,z:6,alive:true,
    flying:COMBAT_OBJECT_SPECS[type].flying};
  renderer.sync([o],0);
  const actor=renderer.actualModel(o.id);
  assert.ok(actor?.isGroup,'No real original sculpture for '+id);
  assert.equal(actor.userData.speciesId,id);
  const bb=new THREE.Box3().setFromObject(actor),sz=new THREE.Vector3();
  bb.getSize(sz);
  const reference=MONSTER_SUMMON_MODEL_HEIGHT*MONSTER_SUMMON_BY_TYPE[type].size;
  assert.ok(Math.abs(sz.y-reference)<reference*.06,
   id+' must appear about 10 human heights; actual '+sz.y+' expected '+reference);
  const pivots=actor.userData.pivots;
  assert.ok(Object.keys(pivots).length>0,'Original joint rig missing '+id);
  o.attackStartedAt=0.15;
  renderer.sync([o],.32);
  assert.ok(Number.isFinite(actor.rotation.x+actor.position.y));
  renderer.sync([],1);
  assert.equal(renderer.activeCount(),0);
 }
 assert.equal(renderer.stats().created,7);
 assert.equal(renderer.stats().disposed,7);
 renderer.dispose();
 assert.equal(scene.children.length,0);
}
console.log('50 independently summonable source monsters, 57 catalog species, 10x sizes and no eager 50-mesh scene: PASS');
