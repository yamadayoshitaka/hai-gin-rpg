import assert from 'node:assert/strict';
import { STARTER_TOWN,townHouseStructures,townNpcInfo,resolveTownBuilding,BUILDING_RECIPES,composeBuildingLayouts,resolveObjectDefinition } from '../src/starter-town.js';
const town=STARTER_TOWN;
assert.equal(town.buildings.length,12);
assert.equal(new Set(town.buildings.map(b=>b.id)).size,town.buildings.length);
for(const kind of ['home','weapons','armor','items','inn','merchant','church','manor'])assert.ok(town.buildings.some(b=>b.kind===kind),kind);
const houses=townHouseStructures();
assert.equal(houses.length,town.buildings.length);
assert.ok(houses.every(h=>h.length===7&&h.every(Number.isFinite)));
const castle=town.buildings.find(b=>b.id==='castle');
assert.ok(castle.grid[1]<-40,'castle should be north of the town');
assert.equal(townNpcInfo().length,15);
assert.equal(new Set(town.citizens.map(n=>n.id)).size,town.citizens.length);
assert.deepEqual(townHouseStructures(),houses,'town structure transform should be deterministic');
assert.ok(town.citizens.every(n=>Number.isFinite(n.x)&&Number.isFinite(n.z)&&n.name&&n.line));
for(const building of town.buildings){
 const resolved=resolveTownBuilding(building);
 assert.ok(resolved.rooms.length>=2,building.id+' rooms');
 assert.ok(resolved.exterior.roofRiseRatio>0,building.id+' roof pitch');
 assert.ok(resolved.rooms.every(r=>Number.isInteger(r.floor)&&r.floor>0));
}
assert.equal(resolveTownBuilding(town.buildings.find(b=>b.id==='castle')).recipe,'castle');
assert.ok(BUILDING_RECIPES.castle.rooms.some(r=>r.id==='throne'));
assert.equal(resolveTownBuilding({...town.buildings[0],exterior:{roofRiseRatio:.5}}).exterior.roofRiseRatio,.5);
for(const building of town.buildings){
 const data=composeBuildingLayouts(building);
 assert.ok(data.layouts.length>0,building.id);
 assert.ok(data.layouts.every(layout=>Array.isArray(layout.objects)),building.id);
}
const door=resolveObjectDefinition({id:'test-door',type:'door',modelKey:'oak-door',position:[0,0,0]});
assert.equal(door.interactionKey,'toggle');
assert.equal(door.actions.toggle.updates.open.op,'toggle');
assert.throws(()=>resolveObjectDefinition({type:'door',interactionKey:'missing'}),/Unknown interaction key/);
const custom=composeBuildingLayouts({id:'test',kind:'home',layouts:[{id:'hall',floor:1,objects:[{id:'entry',type:'door',interactionKey:'toggle'}]}]});
assert.equal(custom.layouts[0].objects[0].actions.toggle.updates.open.op,'toggle');
console.log('Starter town data checks passed');
