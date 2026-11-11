import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createCatalogBuildingStructure,createUpperFloorDecorationPlan,createUpperFloorLootPlan} from '../src/building-structure.js';
import {openTreasureChestModel,syncTreasureChestState} from '../src/treasure-chest-state.js';

const buildings=[['castle_001',100,100,3],['town_house_001',10,10,2],
 ['stone_hut_001',20,20,2],['manor_noble_001',17,15,2],
 ['manor_merchant_001',16,14,2],['church_001',16,14,2]];
for(const [id,widthCells,depthCells,count] of buildings){
 const structure=createCatalogBuildingStructure({id,widthCells,depthCells});
 assert.equal(structure.floors.length,count,id+' floor count');
 const details=createUpperFloorDecorationPlan(structure);
 const loot=createUpperFloorLootPlan(structure);
 assert.equal(details.length,count-1+(id==='castle_001'?1:0),id+' castle ground floor plus occupied upper floors');
 assert.ok(loot.length >= (count-1)*2,id+' upper floors must retain multiple collectible room items');
 assert.equal(new Set(loot.map(item=>item.id)).size,loot.length,id+' item IDs must remain unique');
 for(const floor of structure.floors.slice(1)){
  const floorItems=loot.filter(item=>item.floor===floor.index);
  assert.ok(floorItems.length>=2,id+' floor '+floor.index+' must have genuine item pickups');
  assert.ok(floorItems.some(item=>item.itemId==='healing_potion'),id+' floor '+floor.index+' keeps a healing item');
 }
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
assert.match(tactical,/if\(marker\)openTreasureChestModel\(marker\)/,
 'Collected chest remains open and empty rather than vanishing');
const lid={rotation:{x:0}};
const chest={visible:true,userData:{opened:false},
 getObjectByName(name){return name==='treasure_chest_lid'?lid:null;}};
assert.equal(syncTreasureChestState(chest,'placed'),false,'Untouched chest stays closed');
assert.equal(openTreasureChestModel(chest),true,'Pickup opens the lid exactly once');
assert.equal(chest.userData.empty,true,'Opened chest is explicitly empty');
assert.equal(chest.visible,true,'Opened chest stays visible as a world object');
assert.ok(lid.rotation.x< -1,'A real hinge rotation opens the lid');
assert.equal(openTreasureChestModel(chest),false,'An already opened chest cannot reopen');
assert.match(tactical,/requestUnitFloor\(a,1,travel\.building\)/,'Castle ascends to 3F after 2F pickup');
assert.doesNotMatch(tactical,/requestUnitFloor\(a,-1\)/,'The upper-floor attacker does not abandon the window');
console.log('Window-cut walls, furnished 2F/3F, spiral-safe chests and automatic pickup path');
