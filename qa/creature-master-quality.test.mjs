import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {MONSTER_CATALOG,MONSTER_FAMILIES} from '../src/monster-catalog.js';
import {CREATURE_SURFACE_SOURCES,CREATURE_FAMILY_SURFACE} from '../src/monster-photo-pbr.js?v=4.4.81';
import {MONSTER_DETAIL_LEVELS,monsterSculptCacheStats} from '../src/monster-shape-kit.js?v=4.4.81';
import {createMonsterModel,disposeMonsterSculpture} from '../src/monster-geometry.js?v=4.4.81';
import {startMonsterAction,animateMonsterModel,MONSTER_ACTIONS} from '../src/monster-animation.js';

assert.deepEqual(Object.keys(MONSTER_DETAIL_LEVELS),['source','high','low']);
assert.equal(MONSTER_CATALOG.length,50);
assert.equal(Object.keys(MONSTER_FAMILIES).length,10);
for(const [id,source] of Object.entries(CREATURE_SURFACE_SOURCES)){
  assert.ok(source.albedo.startsWith('../assets/'),id+' must be a locally bundled asset');
  for(const name of ['albedo','normal']){
    if(!source[name])continue;
    const path=new URL('../src/'+source[name],import.meta.url);
    assert.ok(existsSync(path),'Missing '+id+' '+name+': '+path);
  }
}
for(const family of Object.keys(MONSTER_FAMILIES))
  assert.ok(Object.hasOwn(CREATURE_FAMILY_SURFACE,family));

const meshes=[];
function metrics(model){
 let triangles=0,vertices=0,meshCount=0,hasUv=true,invalid=0;
 model.traverse(n=>{
   if(!n.isMesh)return;
   meshCount++;
   const geometry=n.geometry,p=geometry.getAttribute('position');
   if(!p)throw Error('Missing positions');
   triangles+=(geometry.getIndex()?.count??p.count)/3;
   vertices+=p.count;
   if(!geometry.getAttribute('uv'))hasUv=false;
   for(let i=0;i<p.count;i++){
     if(!Number.isFinite(p.getX(i)+p.getY(i)+p.getZ(i)))invalid++;
   }
 });
 return {triangles,vertices,meshCount,hasUv,invalid};
}
// Every species, including translucent and deformable ones, must have finite
// deforming materials, UVs and enough geometry to read as a 3D sculpture.
for(const spec of MONSTER_CATALOG){
 const model=createMonsterModel(spec,{detail:'high'});
 assert.ok(monsterSculptCacheStats().activeMaterials>0,
   spec.id+' inspector must observe the actual rendered material module');
 const stats=metrics(model);
 assert.equal(stats.invalid,0,spec.id+' invalid vertices');
 assert.ok(stats.meshCount>=18,spec.id+' expected a detailed sculpture');
 assert.ok(stats.triangles>1000,spec.id+' not enough high LOD geometry');
 assert.ok(stats.triangles<500_000,spec.id+' high LOD mobile triangle budget exceeded');
 assert.ok(stats.hasUv,spec.id+' requires UV for photo PBR');
 for(const [action] of MONSTER_ACTIONS){
   startMonsterAction(model,action,10);
   const pose=animateMonsterModel(model,10.4);
   assert.equal(pose.action,action);
 }
 meshes.push(stats.meshCount);
 disposeMonsterSculpture(model);
 assert.equal(monsterSculptCacheStats().activeMaterials,0,
   spec.id+' released materials must not accumulate');
}
// Source-to-playable and playable-to-distant complexity must be monotonic.
for(const family of Object.keys(MONSTER_FAMILIES)){
 const spec=MONSTER_CATALOG.find(m=>m.family===family);
 const counts={};
 for(const detail of ['source','high','low']){
   const model=createMonsterModel(spec,{detail});
   counts[detail]=metrics(model).triangles;
   assert.ok(counts[detail]>100,detail+' geometry missing: '+spec.id);
   disposeMonsterSculpture(model);
 }
 assert.ok(counts.source>counts.high*1.7,
   spec.id+' source sculpt should have much smaller polygon grains');
 assert.ok(counts.high>counts.low*1.5,
   spec.id+' low LOD should reduce triangles');
 assert.ok(counts.source<2_000_000,
   spec.id+' source preview should not exhaust mobile GPU memory');
}
assert.ok(new Set(meshes).size>=10,'All 50 variants should not have identical silhouettes');

const html=readFileSync(new URL('../monster-manager.html',import.meta.url),'utf8');
for(const contract of ['id="quality"','value="source"','value="high"','value="low"',
   'id="geometryStats"','__monsterQualityQA','meshQualityStats'])
 assert.ok(html.includes(contract),'Missing quality inspector: '+contract);

const shape=readFileSync(new URL('../src/monster-shape-kit.js',import.meta.url),'utf8');
assert.match(shape,/Continuous|continuous|tapered/);
assert.match(shape,/releaseMaterial/,'mesh/material disposal must be bounded');
const monster=readFileSync(new URL('../src/monster-geometry.js',import.meta.url),'utf8');
assert.match(monster,/g\.bridge\(/,'family junctions must be smoothed');
console.log('50 monsters + 10 master/high/low LODs, local PBR sources, finite UVs, pose regression & bounded cache: PASS');
