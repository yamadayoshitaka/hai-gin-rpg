import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {MONSTER_CATALOG,MONSTER_BY_ID} from '../src/monster-catalog.js';
import {COMBAT_OBJECT_SPECS,COMBAT_JOB_SPECS,availableCombatSkills,COMBAT_RULES}
 from '../src/combat-action-spec.js';
import {CombatActionRuntime} from '../src/combat-action-runtime.js';
import {creatureSize,LARGE_SUMMON_IDS,SUMMON_WORLD_SCALE}
 from '../src/combat-creature-performance.js';
import {combatEffectDirective} from '../src/combat-effect-directives.js';
import {MONSTER_SUMMON_ENTRIES,MONSTER_SUMMON_BY_TYPE,MONSTER_SUMMON_SPECS,
 MONSTER_SUMMON_SKILLS,MONSTER_SUMMON_MODEL_HEIGHT,MONSTER_SUMMON_MAX_ACTIVE,
 isMonsterSummonType,monsterSummonSource,monsterSummonWorldScale}
 from '../src/monster-summon-registry.js';

assert.equal(SUMMON_WORLD_SCALE,1);
assert.equal(MONSTER_SUMMON_MODEL_HEIGHT,1.7);
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
 assert.deepEqual(COMBAT_OBJECT_SPECS[id],e.objectSpec);
 assert.equal(COMBAT_OBJECT_SPECS[id].name,m.name);
 assert.equal(COMBAT_OBJECT_SPECS[id].element,m.element);
 assert.equal(COMBAT_OBJECT_SPECS[id].sourceSkill,m.skill);
 assert.ok(COMBAT_OBJECT_SPECS[id].hp>0);
 assert.ok(e.skillSpec.name.includes(m.name));
 assert.ok(e.skillSpec.objectType===id);
 assert.ok(COMBAT_JOB_SPECS.summoner.skills.some(skill=>
   skill.id===e.skillSpec.id&&skill.objectType===id),
  'Actual summoner skill must refer to original monster '+id);
 assert.ok(creatureSize(id)>=1);
 assert.ok(e.size>=1);
 assert.ok(e.rank=== (m.rarity==='UR'?'UR':
   ['R','SR'].includes(m.rarity)?'R':'N'));
 assert.ok(monsterSummonWorldScale(id,1.7)>=1);
 assert.ok(monsterSummonWorldScale(id,3.4)>=.5,'natural size preserves source dimensions');
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
// Attribute-specific visual feedback must survive the summon bridge.
for(const [type,element] of [
 ['summon_m020','water'],['summon_m018','nature'],
 ['summon_m017','earth'],['summon_m013','fire']
]){
 const vfx=combatEffectDirective({
  type:'objectAttack',objectType:type,
  sourceMonsterId:type.slice(7),effect:element,radius:8
 });
 assert.equal(vfx.kind,'area');
 assert.equal(vfx.element,element);
}
assert.equal(COMBAT_OBJECT_SPECS.horse.category,'mount');
assert.equal(creatureSize('horse'),1);
// These are genuine battle skills, not catalog-only thumbnails. The real
// action runtime must spawn and replace independent water/nature/earth objects.
{
 const owner={id:0,team:0,jobId:'summoner',squadId:'alpha',
  x:9,z:10,hp:200,maxHp:200,mp:500,maxMp:500,
  rarity:'UR',alive:true,cooldown:0};
 const enemy={id:1,team:1,jobId:'fighter',squadId:'beta',
  x:13,z:10,hp:200,maxHp:200,mp:0,maxMp:0,
  rarity:'N',alive:true,cooldown:0};
 const units=[owner,enemy],tiles=new Uint8Array(32*32).fill(1);
 const runtime=new CombatActionRuntime({width:32,height:32,walkable:tiles});
 runtime.beginTick(.1,units,{walkable:tiles});
 for(const [id,element] of [
  ['m020','water'],['m018','nature'],['m017','earth']
 ]){
  const skill=availableCombatSkills('summoner','UR')
   .find(s=>s.id==='call_'+id);
  assert.ok(skill,'Missing real battle skill '+id);
  assert.equal(runtime.fireSkill(owner,skill,owner,units),true);
  const summoned=runtime.summonOf(owner);
  assert.equal(summoned.length,1,
   'Summoner must not exceed its existing one-familiar rule');
  assert.equal(summoned[0].type,'summon_'+id);
  assert.equal(summoned[0].spec.element,element);
  assert.equal(summoned[0].spec.sourceMonsterId,id);
  assert.equal(summoned[0].category,'summon');
 }
}


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
  if(id==='m045'){
   assert.equal(actor.userData.sourceKind,'canonical-character-cosplay');
   assert.equal(actor.userData.legacyGeometryDisabled,true);
   assert.equal(actor.userData.speciesId,id);
   // An asynchronous humanoid GLB must NOT temporarily show the old
   // pre-cosplay body. Rendering resumes when the skinned actor is ready.
   const placeholder=actor.children.filter(c=>c.isMesh);
   assert.equal(placeholder.length,1,'Only the non-character status marker is allowed');
   assert.equal(placeholder[0].name,'canonical-human-loading-marker');
   renderer.sync([o],.32);
   renderer.sync([],1);
   assert.equal(renderer.activeCount(),0);
   continue;
  }
  const bb=new THREE.Box3().setFromObject(actor),sz=new THREE.Vector3();
  bb.getSize(sz);
  const reference=MONSTER_SUMMON_MODEL_HEIGHT*MONSTER_SUMMON_BY_TYPE[type].size;
  if(id==='m020')assert.ok(sz.z>12*1.12*.82,
   'Leviathan summon must keep most of its twelve-cell span in the initial pose');
  else if(id==='m018')assert.ok(Math.abs(sz.z-4*1.12)<.08,
   'hydra summon must span four cells nose-to-tail');
  else assert.ok(Math.abs(sz.y-reference)<reference*.06,
   id+' must retain its source species height; actual '+sz.y+' expected '+reference);
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
console.log('50 independently summonable source monsters, 57 catalog species, restored natural sizes and no eager 50-mesh scene: PASS');
