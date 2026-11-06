import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {cameraSegmentHitsBox,selectCameraOccluders} from '../src/battle-camera-occlusion.js';

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

const game=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
assert.match(game,/updateCameraObstructions\(\);updateTownInteriorVisibility\(\)/,
 'Camera obstruction runs before the existing house cutaway update');
assert.match(game,/stageBatchStats\.setDecorationOccludedAt\(/,
 'Only obstructing tree instances are swapped for ghosts');
assert.match(game,/cameraOccludedBuildings\.has\(b\.model\)/,
 'Buildings blocking the view reuse the transparent per-building cutaway');
assert.match(game,/limit:6,padding:\.5/,
 'Keep no more than six ghost trees on screen at a time');
console.log('Camera tree/building occlusion, GPU batching and restoration regression PASS');
