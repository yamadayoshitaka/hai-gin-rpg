import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {cameraSegmentHitsBox,selectCameraOccluders,shouldRevealBuildingInterior,safeSelectedInteriorFloor} from '../src/battle-camera-occlusion.js';

const camera={x:0,y:8,z:0},focus={x:0,y:1,z:-20};
const foreground={key:'tree',bounds:{minX:-5,maxX:5,minY:0,maxY:11,minZ:-10,maxZ:-3}};
const farSide={key:'house',bounds:{minX:10,maxX:17,minY:0,maxY:10,minZ:-12,maxZ:-5}};
const behind={key:'behind-camera',bounds:{minX:-3,maxX:3,minY:0,maxY:12,minZ:3,maxZ:10}};
const beyond={key:'beyond-target',bounds:{minX:-3,maxX:3,minY:0,maxY:12,minZ:-32,maxZ:-24}};
assert.notEqual(cameraSegmentHitsBox(camera,focus,foreground.bounds),null,
  'A tree canopy between the eye and selected target must fade');
for(const candidate of [farSide,behind,beyond]){
 assert.equal(cameraSegmentHitsBox(camera,focus,candidate.bounds),null,
  candidate.key+' must remain opaque outside the camera-to-target segment');
}
const obstructors=selectCameraOccluders(camera,focus,[beyond,farSide,foreground,behind]);
assert.deepEqual(obstructors.map(o=>o.key),['tree']);
const closer={key:'near-eye',bounds:{minX:-2,maxX:2,minY:0,maxY:10,minZ:-2,maxZ:0}};
assert.deepEqual(selectCameraOccluders(camera,focus,[foreground,closer],{limit:1}).map(o=>o.key),['near-eye'],
 'Close camera blockers take priority when transparency has a budget');
assert.equal(cameraSegmentHitsBox(camera,camera,foreground.bounds),null,
 'A stationary camera does not fade distant objects');

assert.equal(shouldRevealBuildingInterior({cameraDistance:60.6,near:true,occupied:true,occluded:true}),false,
 'Strategic zoom restores opaque roofs even when camera targets a populated house');
assert.equal(shouldRevealBuildingInterior({cameraDistance:60.6,selectedInside:true}),false,
 'A selected upstairs soldier must not make a distant building transparent');
assert.equal(shouldRevealBuildingInterior({cameraDistance:22,near:true}),true,
 'Close inspection reveals the inside of a house');
assert.equal(shouldRevealBuildingInterior({cameraDistance:22,occluded:true}),true,
 'Near-camera obstructing houses may become transparent');
assert.equal(shouldRevealBuildingInterior({cameraDistance:22}),false,
 'Unrelated houses remain opaque even while zoomed in');
assert.equal(shouldRevealBuildingInterior({cameraDistance:37,near:true}),false,
 'New cutaways require entering the close-up band');
assert.equal(shouldRevealBuildingInterior({cameraDistance:37,near:true,wasCutaway:true}),true,
 'Already-open cutaways remain stable through the hysteresis band');
assert.equal(shouldRevealBuildingInterior({cameraDistance:41,near:true,wasCutaway:true}),false,
 'Zooming back out always restores opaque exterior shells');

// Regression: selecting a squad/waypoint can reveal the building without
// selecting an individual soldier. This previously threw at indoorFloor.
assert.equal(safeSelectedInteriorFloor({selectedInside:true,selected:null,cameraFloor:1}),1);
assert.equal(safeSelectedInteriorFloor({selectedInside:true,selected:undefined,cameraFloor:2}),2);
assert.equal(safeSelectedInteriorFloor({selectedInside:true,selected:{indoorFloor:3},cameraFloor:1}),3);
assert.equal(safeSelectedInteriorFloor({selectedInside:false,selected:{indoorFloor:3},cameraFloor:1}),1);
assert.equal(safeSelectedInteriorFloor({selectedInside:true,selected:{defeated:true,indoorFloor:3},cameraFloor:2}),2);
assert.equal(safeSelectedInteriorFloor({selectedInside:true,selected:{indoorFloor:null},cameraFloor:2}),2);

const game=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
assert.match(game,/updateCameraObstructions\(\);updateTownInteriorVisibility\(\)/,
 'Camera obstruction runs before the existing house cutaway update');
assert.match(game,/stageBatchStats\.setDecorationOccludedAt\(/,
 'Only obstructing tree instances are swapped for ghosts');
assert.match(game,/cameraOccludedBuildings\.has\(b\.model\)/,
 'Buildings blocking the view reuse the transparent per-building cutaway');
assert.match(game,/shouldRevealBuildingInterior\(\{cameraDistance:zoomDistance,near,/,
 'Town shell cutaways are gated by camera zoom, not just ground-plane focus');
assert.match(game,/roof\.visible=!shouldRevealBuildingInterior\(/,
 'Standalone stone huts restore their roofs when the camera pulls away');
assert.match(game,/limit:closeup\?48:6,padding:closeup\?6:\.5/,
 'Close-up views clear nearby trees across a wider frustum while distant views keep the six-tree budget');
assert.match(game,/setDecorationOccludedAt\(tree.id,tree.x,tree.z,true,\{hide\}\)/,
 'Close-up camera cutaways hide obstructing trunks and branches as well as foliage');
assert.match(game,/safeSelectedInteriorFloor\(\{selectedInside,selected,cameraFloor\}\)/,
 'Squad command popup must not crash when selected actor is null');
assert.doesNotMatch(game,/selectedInside\?selected\.indoorFloor:1/,
 'Remove unguarded indoorFloor access introduced by camera goal cutaway');
assert.match(game,/function cameraGoalFocuses\(\)/,
 'Occlusion rays also focus the selected squad and its destination');
assert.match(game,/selectedCircleSquad\?\?\(selectedSquadId==null\?null:/,
 'Tap-selected circle is used to keep its squad visible');
assert.match(game,/function updateGoalIndoorOcclusion\(\)/,
 'Room furniture is considered when shielding the camera from the active goal');
assert.match(game,/indoorGhostMaterials=new WeakMap\(\)/,
 'Only blocking interior material groups are rendered transparently');
assert.match(game,/updateTownInteriorVisibility\(\);updateGoalIndoorOcclusion\(\)/,
 'Furniture cutaways run after floor visibility is established');
assert.match(game,/routeOccludedByTerrain\(a.cell,finalGoalCell,a\)/,
 'Skirmish movement detects intervening obstacles rather than guessing at directions');
console.log('Camera tree/building occlusion, GPU batching and restoration regression PASS');
