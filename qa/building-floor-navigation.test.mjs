import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createSpiralStairPlan} from '../src/spiral-staircase.js';
import {buildFloorTravelRoute,floorTravelEntryPoint,spiralStairGroundCells,stairGroundEntryPoint} from '../src/building-floor-navigation.js';

function testStructure(floors,rise){
 return {floors:Array.from({length:floors},(_,i)=>({index:i+1})),
  stair:createSpiralStairPlan({type:'spiral',x:5,z:-4,innerRadius:.6,outerRadius:3.5,
   steps:40,turns:.75,rise,startAngle:Math.PI/2,clockwise:true},{floors})};
}
const home=testStructure(2,6),origin={x:200,y:8,z:-100};
const up=buildFloorTravelRoute(home,origin,1,2),down=buildFloorTravelRoute(home,origin,2,1);
assert.equal(up.length,45);
assert.equal(up[0].y,origin.y);
assert.equal(up.at(-1).y,origin.y+6);
assert.deepEqual(down,up.slice().reverse(),'Descending exactly reverses the climb');
assert.ok(up.every((p,i)=>i===0||p.y>=up[i-1].y));
assert.ok(up.every((p,i)=>i===0||Math.hypot(p.x-up[i-1].x,p.y-up[i-1].y,p.z-up[i-1].z)<2));
const castle=testStructure(3,12);
for(const [from,to] of [[1,2],[2,3],[3,2],[2,1]]){
 const route=buildFloorTravelRoute(castle,origin,from,to);
 assert.ok(route.length>=45);
 assert.equal(route[0].y,origin.y+(from-1)*12);
 assert.equal(route.at(-1).y,origin.y+(to-1)*12);
 assert.ok(route.every((p,i)=>i===0||Math.hypot(p.x-route[i-1].x,p.y-route[i-1].y,p.z-route[i-1].z)<2),from+' to '+to+' staircase continuity');
}
assert.throws(()=>buildFloorTravelRoute(castle,origin,1,3),/adjacent/);
assert.deepEqual(floorTravelEntryPoint({data:{x:40,z:70,d:10}}),{x:40,z:77});
// Ground-level pathfinding cannot treat a spiral's solid centre support and
// elevated treads as empty 2D ground. The 3D stair controller enters from
// a reachable perimeter tile and preserves all authored tread heights.
const blocked=spiralStairGroundCells(home,origin);
assert.ok(blocked.length>=6,'The physical stair occupies multiple nav cells');
const centerX=origin.x+home.stair.stair.x,centerZ=origin.z+home.stair.stair.z;
assert.ok(blocked.some(c=>Math.hypot((c.x-6)*2.2-centerX,(c.z-6)*2.2-centerZ)<home.stair.stair.innerRadius+1),
 'The collision mask protects the supporting central pole');
const entry=stairGroundEntryPoint(home,origin,up);
assert.ok(entry&&Number.isFinite(entry.x)&&Number.isFinite(entry.z));
assert.ok(Math.hypot(entry.x-centerX,entry.z-centerZ)>home.stair.stair.outerRadius+1.5,
 'The initial floor-grid target must lie outside the spiral treads');
assert.ok(Math.hypot(entry.x-up[0].x,entry.z-up[0].z)<home.stair.stair.outerRadius+2.2,
 'After reaching the perimeter the character can walk onto the actual first tread');
const stageGrid={x:Math.round(entry.x/2.2+6),z:Math.round(entry.z/2.2+6)};
assert.ok(!blocked.some(c=>c.x===stageGrid.x&&c.z===stageGrid.z),
 'The stage cell itself must be passable by ordinary ground pathfinding');
assert.equal(spiralStairGroundCells(null,origin).length,0,'Buildings without stairs remain unaffected');
assert.equal(stairGroundEntryPoint(null,origin,up),null,'Buildings without stairs do not stage a climb');
const battle=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
assert.match(battle,/solidStairCells\.has\(key\)/,'Ordinary movement and large-army nav must avoid the stair footprint');
assert.match(battle,/stairStage:stairStage\?/,'Physical stair routes store a stable ground entry');
assert.match(battle,/travel\.stairStage\?\?travel\.waypoints\[0\]/,
 'The approach path does not try to A-star through the solid staircase');
console.log('Reversible 3D stair routes, solid navigation footprint and safe first-tread entry PASS');
