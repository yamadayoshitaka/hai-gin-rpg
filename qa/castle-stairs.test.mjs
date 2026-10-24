import assert from 'node:assert/strict';
import {stairCollision,stairContactReady} from '../src/stair-collision.js';
import {STARTER_TOWN,resolveTownBuilding,townHouseStructures,townBuildingPosition} from '../src/starter-town.js';
import {exteriorLayout} from '../src/exterior-layouts.js';
const stair={x:0,z:-8,width:3,run:5.6};
assert.equal(stairCollision(stair,{x:0,z:-8}).blocked,false);
assert.equal(stairCollision(stair,{x:1.6,z:-8}).blocked,true);
assert.equal(stairContactReady(stair,{x:0,z:-8}),true);
assert.equal(stairContactReady(stair,{x:15,z:-8}),false);
const castle=exteriorLayout(resolveTownBuilding(STARTER_TOWN.buildings.find(b=>b.id==='castle')));
assert.ok(castle.objects.filter(o=>o.id.startsWith('battlement-')).length>=10);
assert.ok(castle.objects.some(o=>o.id==='castle-arch'));
assert.ok(castle.objects.some(o=>o.type==='gate-arch'));
assert.equal(castle.objects.filter(o=>/^castle-front-tower-(?:-1|1)$/.test(o.id)).length,2);
console.log('Castle and stairs data validation passed');

const houses=townHouseStructures(STARTER_TOWN);
assert.equal(houses.length,STARTER_TOWN.buildings.length);
for(const [i,b] of STARTER_TOWN.buildings.entries()){
 assert.deepEqual(houses[i].slice(0,2),townBuildingPosition(b));
}
const castleDefinition=STARTER_TOWN.buildings.find(b=>b.id==='castle');
assert.deepEqual(townBuildingPosition(castleDefinition),[0,-115.75]);
assert.equal(castleDefinition.grid[2],26);
