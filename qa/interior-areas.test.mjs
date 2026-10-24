import {createFloorArchitecture} from '../src/interior-architecture.js';
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

for(const b of STARTER_TOWN.buildings){
 for(const floor of [1,2]){
  const layout=createFloorArchitecture({buildingId:b.id,width:42,depth:39,stair:{x:0,z:-9,width:3,run:5.6},floor,usage:b.kind==='manor'?'castle':b.kind});
  assert.equal(layout.id,b.id+':floor:'+floor);
  assert.ok(layout.walls.length>=5);
  assert.ok(layout.walls.every(w=>w.w>0&&w.d>0&&w.collision));
  assert.equal(layout.stair.portalId,b.id+':'+(floor===1?'upstairs':'downstairs'));
  assert.ok(layout.walls.some(w=>w.segmentId==='west'));
  assert.ok(layout.walls.some(w=>w.segmentId==='north'));
 }
}

for(const height of [4.2,5.85,7.0]){
 const floor=createFloorArchitecture({buildingId:'audit',width:42,depth:39,floor:1,wallHeight:height});
 assert.ok(floor.walls.every(w=>w.height===height&&w.baseY===0),'All walls must use the authored floor height');
}
assert.throws(()=>createFloorArchitecture({buildingId:'bad',width:42,depth:39,floor:1,wallHeight:0}),/Invalid wall height/);

for(const floor of [1,2]){
 const plan=createFloorArchitecture({buildingId:'example',width:42,depth:39,floor,wallHeight:5.85});
 assert.ok(plan.segments.every(segment=>segment.from.length===2&&segment.to.length===2));
 assert.ok(plan.walls.every(w=>w.height===5.85&&w.collision));
 const south=plan.walls.filter(w=>w.segmentId==='south');
 assert.equal(south.length,floor===1?2:1,'Only the first-floor outer wall has an entrance');
}
