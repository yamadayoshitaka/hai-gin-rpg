import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const catalog=read('src/object-catalog.js');
const game=read('tactics-wireframe.html');
const viewer=read('src/tree-seasons.js');
const preview=read('world-quality-preview.html');
const staticCode=read('src/stage-static-instancing.js');
// A physical object needs meaningful supporting geometry in the same runtime
// factory as the published game, not a separate 2D reference proposal.
const targets={
 cottage_table_001:['Four working aprons','b(1.68*c'],
 cottage_chair_001:['for(const y of [.91,1.37])','b(.065*c,.41*c'],
 cottage_bed_001:['b(1.51*c,.18*c','for(const x of [-.45,-.15,.15,.45])'],
 cottage_shelf_001:['for(const y of [.56,1.48,2.4])','b(1.79*c,.1*c'],
 cottage_barrel_001:['coopered_barrel_body','new THREE.LatheGeometry','ironHoop'],
 town_well_001:['Windlass','spindle.rotation.z','new THREE.TorusGeometry'],
 town_crate_001:['inclined beams','brace.rotation.z'],
 town_water_trough_001:['for(const x of [-1.40,1.40])','box(2.67*c'],
 town_signpost_001:['directional tips','tip.rotation.z']
};
for(const [id,markers] of Object.entries(targets)){
 const start=catalog.indexOf("if(id==='"+id+"'){");
 assert(start>=0, 'No production 3D construction for '+id);
 const next=catalog.indexOf("  if(id==='",start+1);
 const scope=catalog.slice(start,next<0?start+1800:next);
 for(const marker of markers)assert(scope.includes(marker),id+' missing physical part '+marker);
}
for(const id of ['cottage_table_001','cottage_chair_001','cottage_bed_001','cottage_shelf_001','cottage_barrel_001'])
 assert(catalog.includes("'"+id+"'"),id+' is absent from baked furniture list');
assert.match(catalog,/mesh\.name='optimized_physical_furniture'/);
assert.match(catalog,/root\.userData\.optimizedPhysicalBOM=true/);
assert.match(catalog,/if\(!combined\)continue/);
assert(!catalog.includes("'treasure_chest_001']).has(id)"),'Animated chest lid must never be baked');
for(const id of ['town_well_001','town_crate_001','town_water_trough_001','town_signpost_001'])
 assert(staticCode.includes("'"+id+"'"),id+' lacks static stage eligibility');
assert.match(catalog,/town_well_001','town_crate_001'/);
assert.match(game,/OBJECT_CATALOG,createCatalogObject/);
assert.match(game,/const meta=OBJECT_CATALOG\[id\]/);
assert.match(viewer,/createCatalogObject\(selected\)/);
assert.match(preview,/createCatalogObject\(asset\)/);
assert.match(game,/object-catalog\.js\?v=world60-physical-20261117/);
assert.match(preview,/object-catalog\.js\?v=world60-physical-20261117/);
console.log('PASS: 9 source-level physical BOM improvements in one real-game renderer; static GPU batches and game footprints remain shared. Android FPS and visual acceptance remain unverified.');
