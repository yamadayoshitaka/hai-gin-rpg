import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {MONSTER_CATALOG} from '../src/monster-catalog.js';
import {MONSTER_SUMMON_ENTRIES} from '../src/monster-summon-registry.js';
import {HUMAN_MONSTER_IDS} from '../src/monster-character-cosplay-manifest.js';
import {CREATURE_MASTER_ENTRIES,CREATURE_MASTER_BY_ID,CREATURE_MASTER_COUNTS,
 MASTER_RENDER_TIERS,MASTER_LOD_DISTANCES,chooseCreatureLod,
 validateCreatureMasterLibrary} from '../src/creature-master-library.js';
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');

test('all 108 original monsters and summons have separate generator contracts',()=>{
 assert.equal(validateCreatureMasterLibrary(),true);
 assert.deepEqual([CREATURE_MASTER_COUNTS.total,CREATURE_MASTER_COUNTS.monsters,
  CREATURE_MASTER_COUNTS.summons,CREATURE_MASTER_COUNTS.dedicated],[108,50,50,8]);
 assert.equal(MONSTER_CATALOG.length,50);
 assert.equal(MONSTER_SUMMON_ENTRIES.length,50);
 assert.equal(new Set(CREATURE_MASTER_ENTRIES.map(e=>e.id)).size,108);
 for(const m of MONSTER_CATALOG){
  const master=CREATURE_MASTER_BY_ID[m.id];
  const summon=CREATURE_MASTER_BY_ID['summon_'+m.id];
  assert.ok(master&&summon,m.id);
  assert.equal(master.baseId,m.id);
  assert.equal(summon.baseId,m.id);
  assert.equal(master.family,m.family);
  assert.equal(summon.family,m.family);
  assert.equal(master.kind,'monster');
  assert.equal(summon.kind,'summon');
  assert.equal(master.template,summon.template);
  assert.equal(master.stage,'master-generator');
  assert.equal(summon.stage,'master-generator');
 }
});
test('human monsters and special female summons use the canonical skinned actor path',()=>{
 for(const id of HUMAN_MONSTER_IDS){
  assert.equal(CREATURE_MASTER_BY_ID[id].engine,'canonical-human-rig',id);
  assert.equal(CREATURE_MASTER_BY_ID['summon_'+id].engine,'canonical-human-rig',id);
 }
 assert.equal(CREATURE_MASTER_BY_ID.forest_archer.engine,'canonical-female-rig');
 assert.equal(CREATURE_MASTER_BY_ID.seraph_guardian.engine,'canonical-female-rig');
 assert.equal(CREATURE_MASTER_COUNTS.humanoid,34);
});
test('source master is independently exportable in the viewer, and photoreal success is never fabricated',()=>{
 const kinds=Object.keys(MASTER_RENDER_TIERS);
 assert.deepEqual(kinds,['master','near','mid','far']);
 assert.equal(MASTER_RENDER_TIERS.master.geometry,'source');
 assert.equal(MASTER_RENDER_TIERS.near.geometry,'high');
 assert.equal(MASTER_RENDER_TIERS.mid.geometry,'medium');
 assert.equal(MASTER_RENDER_TIERS.far.geometry,'low');
 assert.equal(CREATURE_MASTER_COUNTS.exportedFiles,0);
 assert.equal(CREATURE_MASTER_COUNTS.photorealCertified,0);
 for(const entry of CREATURE_MASTER_ENTRIES){
  assert.equal(entry.photorealCertified,false,entry.id);
  assert.equal(entry.sourceGlbReady,false,entry.id);
 }
 const html=read('../creature-master-studio.html');
 assert.match(html,/data-tier="master"/);
 assert.match(html,/data-tier="near"/);
 assert.match(html,/data-tier="mid"/);
 assert.match(html,/data-tier="far"/);
 assert.match(html,/GLTFExporter/);
 assert.match(html,/for\(const e of entries\.filter/);
 assert.match(html,/new THREE\.WebGLRenderer/);
 assert.match(html,/onchange=load/);
 assert.match(html,/animationExportReady:false|モーション未埋込/);
 const code=html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
 assert.ok(code);
 assert.doesNotThrow(()=>new Function(code.replace(
  /^import[\s\S]*?from\s+['"][^'"]+['"];\s*/gm,'')));
});
test('source-level geometry is not generated for every summoned mob on scene startup',()=>{
 const code=read('../src/monster-summon-renderer.js');
 assert.match(code,/chooseCreatureLod/);
 assert.match(code,/sourceCount>=1/);
 assert.match(code,/MONSTER_SUMMON_MAX_HIGH_DETAIL/);
 assert.match(code,/detail==='source'/);
 assert.match(code,/protectedCreature/);
 assert.match(code,/source:m\.detail==='source'/);
 assert.match(code,/\.slice\(\)\.sort\(\(a,b\)=>distSq/);
 assert.match(code,/createMonsterModel\(spec,\{detail\}\)/);
});
test('dedicated creatures receive a lazy third GPU LOD without eager 108 asset instantiation',()=>{
 const code=read('../src/combat-world-object-renderer.js');
 assert.match(code,/ensureMediumLod\(type\)/);
 assert.match(code,/subdivideDedicatedSource\(original,\{maxTriangles:90000\}\)/);
 assert.match(code,/lods\.medium/);
 assert.match(code,/distance<cutoff\*\.55\?'high':distance<cutoff\?'medium':'low'/);
 assert.match(code,/if\(lods\.medium\)lods\.medium\.count=0/);
 assert.match(code,/buildCombatObjectGeometry\(type,\{detail:'low'\}\)/);
});
test('source geometry is deliberately finer than near and mid and preserves data-driven materials',()=>{
 const sculpt=read('../src/monster-shape-kit.js');
 assert.match(sculpt,/source:Object\.freeze\(\{sphere:\[112,80\]/);
 assert.match(sculpt,/high:Object\.freeze\(\{sphere:\[38,26\]/);
 assert.match(sculpt,/medium:Object\.freeze\(\{sphere:\[27,19\]/);
 assert.match(sculpt,/low:Object\.freeze\(\{sphere:\[14,10\]/);
 assert.match(read('../src/creature-master-runtime.js'),/creature-source-subdivision/);
 assert.match(read('../src/creature-source-subdivision.js'),/export function subdivideDedicatedSource/);
});
test('LOD thresholds are deterministic and protect distant army scenes',()=>{
 assert.equal(MASTER_LOD_DISTANCES.near,16);
 assert.equal(MASTER_LOD_DISTANCES.mid,52);
 assert.equal(chooseCreatureLod(0),'near');
 assert.equal(chooseCreatureLod(15.99),'near');
 assert.equal(chooseCreatureLod(16),'mid');
 assert.equal(chooseCreatureLod(51.9),'mid');
 assert.equal(chooseCreatureLod(52),'far');
 assert.equal(chooseCreatureLod(Infinity),'far');
 assert.equal(chooseCreatureLod(-3),'far');
 assert.equal(chooseCreatureLod(20,{near:12,mid:25}),'mid');
});
test('m005/m006 now expose true high-detail m001-derived source and never auto-adopt external GLB',()=>{
 for(const id of ['m005','m006','summon_m005','summon_m006']){
  assert.equal(CREATURE_MASTER_BY_ID[id].protected,false);
 }
 for(const id of ['m001','summon_m001','wolf'])
  assert.equal(CREATURE_MASTER_BY_ID[id].protected,false);
 const runtime=read('../src/creature-master-runtime.js');
 assert.match(runtime,/entry\.protected\?'high'/);
 assert.match(runtime,/fromDedicatedMeshes/);
 assert.match(runtime,/createCosplayedHumanoidMonster/);
 assert.match(runtime,/createMonsterModel\(spec,\{detail\}\)/);
 assert.match(runtime,/measureMasterMesh/);
 assert.match(runtime,/exportKind:'source-mesh-and-materials'/);
});
