import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {MONSTER_CATALOG} from '../src/monster-catalog.js';
import {
 MONSTER_DETAIL_LEVELS,monsterResolutionFor,monsterSculptCacheStats,
} from '../src/monster-shape-kit.js';
import {createMonsterModel,disposeMonsterSculpture} from '../src/monster-geometry.js';
import {
 NONHUMAN_QUALITY_PROGRESS,NONHUMAN_QUALITY_LIMITS,nonhumanMonsterStage,
} from '../src/nonhuman-model-quality.js';
import {createCatalogBuildingStructure,createUpperFloorDecorationPlan}
 from '../src/building-structure.js';
import {buildCanineFurRibbonGeometry} from '../src/canine-fur-ribbons.js';

// Human/near-human anatomy must be untouched even after all scheduled stages.
const excluded=MONSTER_CATALOG.filter(spec=>
 ['undead','fiend','golem'].includes(spec.family)||spec.id==='m015');
assert.ok(excluded.length>=15,'Keep near-human monster families in the exclusion set');
for(const spec of excluded){
 assert.equal(nonhumanMonsterStage(spec),0,spec.id+' must never auto-refine');
 for(const detail of ['source','high','low']){
  assert.deepEqual(monsterResolutionFor(spec,detail),MONSTER_DETAIL_LEVELS[detail],
   spec.id+' must retain its original geometry resolution');
 }
}
const nonhuman=MONSTER_CATALOG.filter(spec=>!excluded.includes(spec));
assert.ok(nonhuman.length>=30,'Real animals and creatures remain eligible');
for(const spec of nonhuman){
 const level=nonhumanMonsterStage(spec);
 assert.equal(level,NONHUMAN_QUALITY_PROGRESS[spec.family]);
 const high=monsterResolutionFor(spec,'high');
 const source=monsterResolutionFor(spec,'source');
 const low=monsterResolutionFor(spec,'low');
 assert.deepEqual(low,MONSTER_DETAIL_LEVELS.low,'Never change low-LOD mesh density');
 assert.ok(high.sphere[0]>=MONSTER_DETAIL_LEVELS.high.sphere[0]);
 assert.equal(high.sphere[0],MONSTER_DETAIL_LEVELS.high.sphere[0]+level,
   'Animal resolution must advance exactly one bounded step');
 assert.equal(source.sphere[0],MONSTER_DETAIL_LEVELS.source.sphere[0]+2*level);
}
// Render one high-detail sculpture per family with finite vertices, UVs,
// and proper material disposal; this is geometry QA, not aesthetic approval.
for(const family of Object.keys(NONHUMAN_QUALITY_LIMITS).filter(key=>
 !['buildingDetails','canineCoat'].includes(key))){
 const specimen=nonhuman.find(spec=>spec.family===family);
 assert.ok(specimen,'Missing allowed nonhuman family '+family);
 const mesh=createMonsterModel(specimen,{detail:'high'});
 let triangleCount=0,meshes=0;
 mesh.traverse(node=>{
  if(!node.isMesh)return;
  meshes++;
  const p=node.geometry.getAttribute('position');
  const uv=node.geometry.getAttribute('uv');
  assert.ok(p?.count>0&&uv?.count===p.count,specimen.id+' UV/vertices invalid');
  assert.ok(p.array.every(Number.isFinite),specimen.id+' nonfinite model geometry');
  triangleCount+=node.geometry.index?node.geometry.index.count/3:p.count/3;
 });
 assert.ok(meshes>10&&triangleCount>1000,specimen.id+' must retain real 3D parts');
 assert.ok(triangleCount<350000,specimen.id+' playable LOD triangle budget exceeded');
 disposeMonsterSculpture(mesh);
 assert.equal(monsterSculptCacheStats().activeMaterials,0,
  specimen.id+' leaked material references');
}
const castle=createCatalogBuildingStructure({
 id:'castle_001',widthCells:100,depthCells:100,
});
const decoration=createUpperFloorDecorationPlan(castle);
const names=new Set(decoration.flatMap(floor=>floor.parts.map(p=>p.name)));
const expected=[
 [1,'table_carved_apron'],
 [2,'bed_carved_footboard'],
 [3,'book_gold_spine'],
 [4,'lamp_glass_brace'],
 [5,'stair_carved_post_cap'],
 [6,'bench_carved_arm'],
];
for(const [stage,name] of expected){
 if(NONHUMAN_QUALITY_PROGRESS.buildingDetails>=stage)
  assert.ok(names.has(name),'Missing actual building mesh detail stage '+stage+': '+name);
}
// The first additional detail MUST be concrete 3D, not a metadata-only counter.
const guides=[{
 root:[0,0,0],mid:[0,.05,-.06],tip:[0,.07,-.12],
 normal:[0,1,0],width:.02,
}];
const coat=buildCanineFurRibbonGeometry(guides);
assert.equal(coat.getAttribute('position').count,5,'Do not increase crowd GPU vertices');
assert.equal(coat.index.count,9,'Do not increase crowd triangles');
const lifted=coat.getAttribute('position').getY(2);
const ridge=.13+NONHUMAN_QUALITY_PROGRESS.canineCoat*.007;
assert.ok(Math.abs(lifted-(.05+.02*ridge))<1e-5,
 'The real hair polygon must respond to the scheduled canine stage');
coat.dispose();
const program=readFileSync(new URL('../scripts/advance-nonhuman-quality.mjs',import.meta.url),'utf8');
assert.ok(program.includes("fileURLToPath(new URL('../src/nonhuman-model-quality.js'"),
 'Scheduler may only edit the nonhuman quality profile');
console.log('Nonhuman animal geometry, building furnishing meshes and wolf hair: PASS');
console.log('Humanoid character models and near-human monster families: FROZEN');
