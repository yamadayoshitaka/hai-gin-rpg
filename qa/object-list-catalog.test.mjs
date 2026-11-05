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
assert.match(html,/tree-seasons\.js\?v=building-quality-40/);

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
console.log('Object list registers 2F and 3F spiral staircases + graded entry doors and shows every catalogue item');
