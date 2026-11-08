import assert from 'node:assert/strict';
import {createCatalogBuildingStructure} from '../src/building-structure.js';
import {buildFloorTravelRoute,buildingWindowFiringPositions,
 targetVisibleFromWindow,roofAccessPlan,buildRoofTravelRoute,buildGrappleRoofRoute,grappleWindowAnchor,buildMountedRoofTransferRoute,shouldUseMountedRoofInsertion,rooftopStandingPosition} from '../src/building-floor-navigation.js';
import {elevatedRangedStats} from '../src/elevation-combat.js';

const fixtures=[
 {id:'town_house_001',widthCells:10,depthCells:10},
 {id:'church_001',widthCells:11,depthCells:13},
 {id:'castle_001',widthCells:100,depthCells:100},
 {id:'manor_noble_001',widthCells:17,depthCells:15},
 {id:'manor_merchant_001',widthCells:16,depthCells:16},
 {id:'manor_garden_001',widthCells:18,depthCells:18}
];
const buildingPosition={x:120,y:2,z:75};
for(const fixture of fixtures){
 const building=createCatalogBuildingStructure(fixture);
 assert.deepEqual(buildingWindowFiringPositions(building,buildingPosition,1),[],fixture.id+' ground-floor windows cannot use upper-floor combat');
 const windows=buildingWindowFiringPositions(building,buildingPosition,2);
 assert.ok(windows.length>=2,fixture.id+' should have real upper-floor firing bays');
 for(const bay of windows){
  assert.ok(targetVisibleFromWindow(bay,{
   x:bay.aperture.x+bay.normal.x*20,z:bay.aperture.z+bay.normal.z*20}),
  fixture.id+' forward target visible through window');
  assert.ok(!targetVisibleFromWindow(bay,{
   x:bay.aperture.x-bay.normal.x*20,z:bay.aperture.z-bay.normal.z*20}),
  fixture.id+' cannot shoot backwards through wall');
  const tangent={x:bay.normal.z,z:-bay.normal.x};
  assert.ok(!targetVisibleFromWindow(bay,{
   x:bay.aperture.x+bay.normal.x*.4+tangent.x*35,
   z:bay.aperture.z+bay.normal.z*.4+tangent.z*35}),
  fixture.id+' cannot shoot obliquely through solid wall');
 }
 const top=building.floors.length;
 const route=buildRoofTravelRoute(building,buildingPosition,top);
 const roof=roofAccessPlan(building);
 const ninjaLaunch={x:buildingPosition.x+building.floors[0].footprint.width/2+3,
  y:buildingPosition.y,z:buildingPosition.z+3};
 const grapple=buildGrappleRoofRoute(building,buildingPosition,ninjaLaunch);
 const frame=grappleWindowAnchor(building,buildingPosition,ninjaLaunch);
 assert.ok(frame,fixture.id+' should select an authored upper-floor window frame');
 assert.equal(grapple.windowSlot,frame.id,fixture.id+' rope is attached to the selected actual window');
 assert.deepEqual(grapple.anchor,frame.anchor,fixture.id+' rope terminates at that frame, not the roof');
 assert.ok(grapple.anchor.y>ninjaLaunch.y+1,fixture.id+' window hook must be above the ninja');
 const riderLaunch={...ninjaLaunch,y:ninjaLaunch.y+5};
 const airborne=buildMountedRoofTransferRoute(building,buildingPosition,riderLaunch);
 assert.ok(airborne.dismountAt>2&&airborne.dismountAt<airborne.waypoints.length,
  fixture.id+' rider must transfer off the summon before the final roof landing');
 assert.ok(airborne.waypoints.every((p,i)=>i===0||Math.hypot(
  p.x-airborne.waypoints[i-1].x,p.y-airborne.waypoints[i-1].y,
  p.z-airborne.waypoints[i-1].z)<1),fixture.id+' mounted path must be continuous');
 assert.ok(airborne.waypoints[airborne.dismountAt-1].y>airborne.exit.y,
  fixture.id+' summon waits above the eaves before the rider jumps');
 assert.ok(Math.abs(airborne.waypoints.at(-1).y-buildingPosition.y-
  roofAccessPlan(building).roofY(roofAccessPlan(building).lookoutX))<.001,
  fixture.id+' rider finishes on the physical roof surface');
 assert.ok(grapple.waypoints.length>12,fixture.id+' ninja hook must really climb');
 assert.ok(grapple.waypoints.every((p,i)=>i===0||
  Math.hypot(p.x-grapple.waypoints[i-1].x,p.y-grapple.waypoints[i-1].y,
    p.z-grapple.waypoints[i-1].z)<1),fixture.id+' ninja climb must be continuous, not fly');
 assert.ok(Math.abs(grapple.waypoints.at(-1).y-buildingPosition.y-
  roofAccessPlan(building).roofY(roofAccessPlan(building).lookoutX))<.001,
  fixture.id+' hook places ninja on the real rooftop plane');
 const lastFlight=buildFloorTravelRoute(building,buildingPosition,top-1,top);
 assert.ok(route.length>20,fixture.id+' visibly ascends physical ladder');
 assert.ok(route.at(-1).y>lastFlight.at(-1).y+1,fixture.id+' roof is above top occupied floor');
 assert.ok(Math.hypot(route[0].x-lastFlight.at(-1).x,route[0].z-lastFlight.at(-1).z)<1,
  fixture.id+' roof route connects to actual spiral landing');
 assert.ok(route.every((p,i)=>i===0||Math.hypot(p.x-route[i-1].x,p.y-route[i-1].y,p.z-route[i-1].z)<1),
  fixture.id+' continuous steps (no teleport)');
 assert.ok(Math.abs(route.at(-1).y-buildingPosition.y-roof.roofY(roof.lookoutX))<.001);
 assert.ok(route.at(-1).z>buildingPosition.z,
  fixture.id+' finishes on the visible front roof surface, not behind the gable');
 const planted=rooftopStandingPosition(building,buildingPosition,route.at(-1));
 assert.ok(Math.abs(planted.y-route.at(-1).y)<.001,fixture.id+' boots rest on real roof plane');
 const drifted={x:999,y:999,z:-999};
 const grounded=rooftopStandingPosition(building,buildingPosition,drifted);
 assert.ok(Math.abs(grounded.x-buildingPosition.x)<roof.roofHalf,
  fixture.id+' roof foot x stays inside the eaves');
 assert.ok(Math.abs(grounded.z-buildingPosition.z)<roof.roofHalfDepth,
  fixture.id+' roof foot z stays inside the eaves');
 assert.ok(Math.abs(grounded.y-buildingPosition.y-roof.roofY(grounded.x-buildingPosition.x))<.001,
  fixture.id+' standing height stays on the roof after pose drift');
 assert.throws(()=>buildRoofTravelRoute(building,buildingPosition,1),/top floor/);
 const roofActor={indoorFloor:top+1,floorTravel:{phase:'roof'}};
 const combat=elevatedRangedStats(roofActor,{range:10,damage:12,radius:2});
 assert.equal(combat.multiplier,2**top,fixture.id+' roof adds one high-ground tier');
 assert.equal(combat.damage,12*2**top);
}
const flying={alive:true,flying:true,category:'summon',mountedBy:7};
assert.ok(shouldUseMountedRoofInsertion({strategy:'environment_prepare',mount:flying}),
 'maintenance squad may infiltrate by flying summon');
assert.ok(shouldUseMountedRoofInsertion({strategy:'objective',mount:flying}),
 'objective squad may deploy riders on roofs');
assert.ok(shouldUseMountedRoofInsertion({strategy:'eliminate',order:{mode:'mission',type:'eliminate_commander'},mount:flying}),
 'commander assassination order authorizes tactical roof insertion');
assert.ok(!shouldUseMountedRoofInsertion({strategy:'recovery',mount:flying}),
 'healing squads remain mounted to support allies');
assert.ok(!shouldUseMountedRoofInsertion({strategy:'environment_prepare',mount:{...flying,flying:false}}),
 'ground wolves and horses must never fly to the roof');
assert.ok(!shouldUseMountedRoofInsertion({strategy:'environment_prepare',mount:{...flying,alive:false}}),
 'defeated summons cannot launch the rider');
console.log('Window-framed ninja grapples and strategy-driven flying summon roof dismounts validated');
