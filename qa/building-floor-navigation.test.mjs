import assert from 'node:assert/strict';
import {createSpiralStairPlan} from '../src/spiral-staircase.js';
import {buildFloorTravelRoute,floorTravelEntryPoint} from '../src/building-floor-navigation.js';

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
console.log('Reversible stair routes connect ground, second, and castle third floors with height-accurate walk paths');
