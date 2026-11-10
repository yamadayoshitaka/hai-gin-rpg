import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
 TOWN_ADULT_HEIGHT,TOWN_BODY_RADIUS,TOWN_HEIGHT_LIMIT,TOWN_SCENE_MODE,
 townVisualCorrection,townCapsuleClear,townCameraOccluders
} from '../src/town-scene-policy.js';

assert.equal(TOWN_SCENE_MODE,'peaceful-exploration');
assert.ok(TOWN_BODY_RADIUS>.2);
assert.ok(TOWN_HEIGHT_LIMIT<2.2);
assert.equal(townVisualCorrection({x:.5,y:1.74,z:.5},TOWN_ADULT_HEIGHT.male),1);
assert.ok(townVisualCorrection({x:1,y:15,z:1},TOWN_ADULT_HEIGHT.male)<.15,
 'a fifteen-metre giant must be reduced to human size');
assert.ok(townVisualCorrection({x:20,y:1.74,z:2},TOWN_ADULT_HEIGHT.male)<.15,
 'oversized imported costume accessories are also bounded');
assert.throws(()=>townVisualCorrection({x:1,y:0,z:1}),/invalid bounds/);

const crowd=[{x:3,z:4,radius:.34},{x:10,z:12,radius:.34}];
assert.equal(townCapsuleClear(3,4,crowd),false,'citizen has real collision');
assert.equal(townCapsuleClear(3.5,4,crowd),false,'player cannot clip a shoulder through a resident');
assert.equal(townCapsuleClear(5,4,crowd),true,'walking past the person is allowed');
assert.equal(townCapsuleClear(5,4,[]),true,'empty space remains traversable');
const canopy=[
 {id:'tree_deciduous_001'}, {id:'flower_tree_001'},
 {id:'wood_fence'}, {id:'town_planter_001'}
];
assert.deepEqual(townCameraOccluders(canopy,true).map(o=>o.id),
 ['tree_deciduous_001'],'the town keeps cherry blossoms, flowers and fences');
assert.deepEqual(townCameraOccluders(canopy,false).map(o=>o.id),
 ['tree_deciduous_001','flower_tree_001'],
 'battle zoom continues to hide pink canopies obscuring characters');

const game=fs.readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
assert.match(game,/townCameraOccluders\(stageBatchStats\.occlusionCandidates,TOWN_MODE\)/);
assert.match(game,/if\(!townCapsuleClear\(px,pz,townObstacles,\.01\*CELL\)\)return false/);
assert.match(game,/fitTownHumanScale\(actor\.root,TOWN_ADULT_HEIGHT\[actor\.sex\]/);
assert.match(game,/fitTownHumanScale\(citizen\.root,TOWN_ADULT_HEIGHT\[citizen\.sex\]/);
assert.match(game,/root\.userData\.townCitizenId='street-'\+i;root\.userData\.nonColliding=false/);
assert.match(game,/actor\.townRegisteredModel=model;/,
 'An oversized shopkeeper must replace malformed combat garments with a registered civilian mesh');
assert.match(game,/if\(\(actor\.root\.userData\.townHeight\|\|0\)>\.75\)continue;/,
 'Only physically broken imported outfits use the replacement');

assert.match(game,/const focuses=TOWN_MODE\?\[controls\.target\]:cameraGoalFocuses\(\)/);
assert.match(game,/if\(TOWN_MODE\)\{elapsed\+=dt;updateTownAvatar\(dt\);simAccumulator=0;/,
 'town uses a separate non-combat tick instead of battle simulation');
console.log('PASS peaceful town scale, physical crowd collision and independently scoped blossom cutaways');
