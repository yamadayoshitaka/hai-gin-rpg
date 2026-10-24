import assert from 'node:assert/strict';
import {STARTER_TOWN} from '../src/starter-town.js';
import {getBuildingLayouts} from '../src/interior-scenes.js';
import {createInteriorAreaGraph,AreaPortalSystem} from '../src/interior-areas.js';
const graph=createInteriorAreaGraph(STARTER_TOWN.buildings,getBuildingLayouts);
assert.equal(Object.keys(graph.areas).length,STARTER_TOWN.buildings.length*2);
const portal=new AreaPortalSystem();
for(const building of STARTER_TOWN.buildings){
 const one=building.id+':floor:1',two=building.id+':floor:2';
 assert.equal(graph.areas[one].floor,1);
 assert.equal(graph.areas[two].floor,2);
 assert.ok(graph.areas[one].layouts.every(l=>l.floor===1));
 assert.ok(graph.areas[two].layouts.every(l=>l.floor===2));
 assert.equal(portal.execute({graph,currentAreaId:one,portalId:building.id+':upstairs'}).to,two);
 assert.equal(portal.execute({graph,currentAreaId:two,portalId:building.id+':downstairs'}).to,one);
 assert.equal(portal.execute({graph,currentAreaId:one,portalId:building.id+':entrance'}).to,'town');
 assert.throws(()=>portal.execute({graph,currentAreaId:one,portalId:building.id+':downstairs'}),/Portal not present/);
}
console.log('Separate interior floor areas and ID portal tests passed');
