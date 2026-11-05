import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createCatalogBuildingStructure,createUpperFloorDecorationPlan,createUpperFloorLootPlan} from '../src/building-structure.js';

const buildings=[['castle_001',100,100,3],['town_house_001',10,10,2],
 ['stone_hut_001',20,20,2],['manor_noble_001',17,15,2],
 ['manor_merchant_001',16,14,2],['church_001',16,14,2]];
for(const [id,widthCells,depthCells,count] of buildings){
 const structure=createCatalogBuildingStructure({id,widthCells,depthCells});
 assert.equal(structure.floors.length,count,id+' floor count');
 const details=createUpperFloorDecorationPlan(structure);
 const loot=createUpperFloorLootPlan(structure);
 assert.equal(details.length,count-1+(id==='castle_001'?1:0),id+' castle ground floor plus occupied upper floors');
 assert.equal(loot.length,count-1,id+' every upper floor has a collectible chest');
 for(const [i,floor] of details.entries()){
  assert.equal(floor.floor,i+(id==='castle_001'?1:2));
  assert.ok(floor.parts.length>=40,id+' contains substantive upper-floor furnishings');
  assert.ok(floor.parts.some(part=>part.name==='stair_guardrail'));
  assert.ok(floor.parts.some(part=>part.name==='ceiling_beam')||floor.parts.some(part=>part.name==='bed_frame'));
 }
 for(const item of loot){
  assert.ok(item.item&&item.quantity>0,'Every item has a genuine inventory definition');
  assert.ok(Math.abs(item.x)<widthCells*2.2/2&&Math.abs(item.z)<depthCells*2.2/2,
   id+' chest must stay on the upper storey');
  assert.ok(Math.hypot(item.x-structure.stair.stair.x,item.z-structure.stair.stair.z)>
   structure.stair.stair.outerRadius,'Chest must never block the spiral');
 }
}
const catalog=readFileSync(new URL('../src/object-catalog.js',import.meta.url),'utf8');
const viewer=readFileSync(new URL('../src/tree-seasons.js',import.meta.url),'utf8');
const tactical=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
assert.match(catalog,/open_upper_floor_windows/,'Building facades have actual upper windows');
assert.match(catalog,/if\(!window\)mesh\(walls/,'Window apertures must remove masonry, not cover it with stickers');
assert.match(catalog,/secondStoreyWindow\(/,'Mansions also have real upper storey apertures');
assert.match(viewer,/furnishings:catalogPreview\.getObjectByName/,'3D object list must show furnished floors');
assert.match(tactical,/chest\.visible=false/,'Collected chest is removed from scene');
assert.match(tactical,/requestUnitFloor\(a,1,travel\.building\)/,'Castle ascends to 3F after 2F pickup');
assert.doesNotMatch(tactical,/requestUnitFloor\(a,-1\)/,'The upper-floor attacker does not abandon the window');
console.log('Window-cut walls, furnished 2F/3F, spiral-safe chests and automatic pickup path');
