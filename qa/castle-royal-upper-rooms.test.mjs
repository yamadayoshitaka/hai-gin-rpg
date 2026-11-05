import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createCatalogBuildingStructure,createUpperFloorDecorationPlan} from '../src/building-structure.js';
import {createCastleUpperRoomPlan} from '../src/castle-upper-rooms.js';
import {buildingPreviewCamera} from '../src/building-preview-tour.js';

const castle=createCatalogBuildingStructure({id:'castle_001',widthCells:100,depthCells:100});
const rooms=createCastleUpperRoomPlan(castle),furnishings=createUpperFloorDecorationPlan(castle);
assert.equal(rooms.length,3,'All three castle floors need actual rooms');
const [entrance,guard,royal]=rooms;
assert.ok(entrance.rooms.length>=20,'The ground floor needs a complete room layout');
assert.ok(entrance.rooms.some(room=>room.kind==='greatHall'),'The castle entrance needs a proper great hall');
assert.ok(new Set(entrance.rooms.map(room=>room.kind)).size>=8,'Ground-floor rooms serve different purposes');
assert.ok(guard.rooms.length>=25,'The second floor must have a full barracks complex');
assert.ok(royal.rooms.length>=20,'The third floor must have several royal suites');
assert.ok(new Set(guard.rooms.map(room=>room.kind)).size>=8,'Multiple 2F room types');
assert.ok(new Set(royal.rooms.map(room=>room.kind)).size>=7,'Multiple royal 3F room types');
assert.ok(royal.rooms.some(room=>room.label==='王の謁見の間'));
assert.ok(guard.rooms.every(room=>room.door.width>=3.8),'Rooms have door-sized open passageways');
for(const layout of rooms){
 const {x,z,radius}=layout.stairAtrium;
 for(const room of layout.rooms.filter(room=>room.kind!=='royalAudience'&&room.kind!=='greatHall')){
  const {minX,maxX,minZ,maxZ}=room.bounds;
  const nearX=Math.max(minX,Math.min(maxX,x)),nearZ=Math.max(minZ,Math.min(maxZ,z));
  assert.ok(Math.hypot(nearX-x,nearZ-z)>=radius-.001,'No room blocks the spiral stairwell');
 }
 assert.ok(layout.parts.some(part=>part.name==='room_stone_wall'),'Real partition walls exist');
 assert.ok(layout.parts.some(part=>part.name==='door_lintel'),'Open doorways exist');
}
for(const part of ['grand_throne_seat','grand_throne_back','throne_lion_head',
 'royal_crown_ornament','royal_dais_upper','royal_audience_carpet',
 'crystal_chandelier_stem','chandelier_crystal','royal_banner']){
 assert.ok(royal.parts.some(entry=>entry.name===part),'Missing royal audience piece: '+part);
}
assert.ok(royal.parts.filter(part=>part.material==='gold').length>=40,'Gold decoration is substantial');
assert.ok(royal.parts.filter(part=>part.material==='marble').length>=3,'Royal marble is substantial');
assert.ok(furnishings[0].parts.length>=900&&furnishings[1].parts.length>=1000&&furnishings[2].parts.length>=900,
 'Furnishing plan is dense enough for the castle-sized space');
const camera=buildingPreviewCamera(castle,3);
assert.equal(camera.target.x,0,'Royal chamber, not the staircase, is the preview focus');
assert.equal(camera.target.z,0);
const structureSource=readFileSync(new URL('../src/building-structure.js',import.meta.url),'utf8');
const catalogSource=readFileSync(new URL('../src/object-catalog.js',import.meta.url),'utf8');
assert.match(structureSource,/floorMaterials\?\.\[floor\.index\]/,'Upper deck materials are independently assigned');
assert.match(structureSource,/uvTileMetres/,'Texture UV tiling is explicit and world-aligned');
assert.match(catalogSource,/floorMaterials:\{2:cottageMaterial\('stone'/,
 'Real stone PBR/Poly Haven floor surfaces are supplied by catalogue');
assert.match(catalogSource,/groundFloor\.userData\.surface=\{floor:1,uvTileMetres:unit,pbr:true\}/,
 'Ground floor also needs genuinely tiled stone');
assert.match(structureSource,/mergeGeometries\?\.\(geometries,false\)/,
 'Room furniture and walls are baked per material for mobile performance');
console.log(`Castle interiors: 1F ${entrance.rooms.length} rooms, 2F ${guard.rooms.length} rooms, 3F ${royal.rooms.length} rooms, stone PBR floors, royal hall`);
