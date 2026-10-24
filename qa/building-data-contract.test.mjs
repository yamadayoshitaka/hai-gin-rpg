import assert from 'node:assert/strict';
import {STARTER_TOWN} from '../src/starter-town.js';
import {getBuildingLayouts} from '../src/interior-scenes.js';
import {buildingInteriorFootprint,fitInteriorLayouts,BUILDING_WORLD_SCALE} from '../src/interior-dimensions.js';
import {floorTileLayout,FLOOR_TILE_CATALOG} from '../src/floor-tiles.js';
import {createFloorArchitecture} from '../src/interior-architecture.js';
for(const building of STARTER_TOWN.buildings){
 const size=buildingInteriorFootprint(building);
 assert.deepEqual(size,building.grid.slice(2,4).map(x=>x*BUILDING_WORLD_SCALE));
 const authored=getBuildingLayouts(building);
 const planned=fitInteriorLayouts(authored,size);
 for(const floor of [1,2]){
  const area=planned.filter(l=>l.floor===floor);
  assert.ok(area.length>0,building.id+' floor '+floor);
  const architecture=createFloorArchitecture({buildingId:building.id,width:size[0],depth:size[1],floor});
  assert.ok(architecture.walls.length>0);
  for(const layout of area)for(const o of layout.objects){
   assert.ok(Math.abs(o.position[0])<=size[0]/2);
   assert.ok(Math.abs(o.position[2])<=size[1]/2);
  }
  const tiles=floorTileLayout(...architecture.floorSurface.size,'stone');
  assert.ok(tiles.count>0);
  assert.equal(tiles.count,tiles.columns*tiles.rows);
 }
}
assert.equal(Object.keys(FLOOR_TILE_CATALOG).length,3);
console.log('All authored building footprints, floor tiles and object placements validate');
