import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const catalog=readFileSync(new URL('../src/object-catalog.js',import.meta.url),'utf8');
const viewer=readFileSync(new URL('../src/tree-seasons.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../object-list.html',import.meta.url),'utf8');
const structure=readFileSync(new URL('../src/building-structure.js',import.meta.url),'utf8');

// The catalogue is authoritative; no separate hard-coded preview ID whitelist.
assert.match(viewer,/Object\.values\(OBJECT_CATALOG\)/);
assert.match(viewer,/catalogGroups\.get\(category\)\.appendChild\(option\)/);
assert.doesNotMatch(viewer,/const bridgeIds=/);
assert.match(html,/tree-seasons\.js\?v=world60-20261117/);
assert.match(viewer,/new ObjectStructureDemo\(THREE,scene,view/);
assert.match(viewer,/structureDemo\.show\(selected,definition,catalogPreview,state\)/);

for(const id of ['spiral_stairs_2f_001','spiral_stairs_castle_3f_001']){
 assert.match(catalog,new RegExp(id+String.raw`:\{id:'`+id+String.raw`'`));
}
for(let level=1;level<=5;level++){
 const id=`entry_door_lv${level}_001`;
 assert.match(catalog,new RegExp(id+String.raw`:\{id:'`+id+String.raw`'`));
}
assert.match(catalog,/kind==='building_component'/);
assert.match(catalog,/renderSpiralStairBOM\(THREE,root,structure/);
assert.match(catalog,/entryDoor=\{lockLevel:level,side:'south',entranceOnly:true\}/);
assert.match(viewer,/!o\.userData\.sharedGeometry/);
assert.match(structure,/mesh\.userData\.sharedGeometry=Boolean\(cacheKey\)/);


// Real-world municipal and masonry geometry regression (source-level only).
// WebGL image QA and Android performance are separate acceptance gates.
const section=(id,next)=>{
 const begin=catalog.indexOf("if(id==='"+id+"'){");
 const finish=catalog.indexOf("if(id==='"+next+"'){");
 assert(begin>=0&&finish>begin,'Expected geometry section for '+id);
 return catalog.slice(begin,finish);
};
const refuse=section('town_trash_bin_001','town_handcart_001');
for(const part of ['galvanized_open_wall','pressed_grounded_floor','rolled_support_band','steel_stiffener','lifting_handle_mount'])
 assert(refuse.includes(part),'Municipal bin is missing '+part);
assert.doesNotMatch(refuse,/slot.*wood/,'Metal bin cannot regress to floating timber slats');
const arch=section('stone_archway_001','stone_steps_001');
for(const part of ['arch_radial_voussoir','pier_spread_footing','pier_ashlar_course','arch_keystone'])
 assert(arch.includes(part),'Masonry arch is missing '+part);
assert.match(arch,/new THREE\.ExtrudeGeometry\(shape/,'Arch uses actual 3D wedge-shaped voussoirs');
const steps=section('stone_steps_001','wooden_watchtower_001');
for(const part of ['ground_bearing_riser','individual_tread_slab','stepped_cheek_wall','cheek_cap'])
 assert(steps.includes(part),'Masonry steps are missing '+part);
assert.match(steps,/i<7/,'Seven individually grounded risers');

console.log('Object list registers 2F and 3F spiral staircases + graded entry doors and shows every catalogue item');
