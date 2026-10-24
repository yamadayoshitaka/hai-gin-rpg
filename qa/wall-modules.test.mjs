import assert from 'node:assert/strict';
import {compileWallModules} from '../src/wall-plan-compiler.js';
import {originalWallModule} from '../src/wall-module-library.js';
import {createFloorArchitecture} from '../src/interior-architecture.js';
for(const height of [4.2,5.85,7]){
 const plan=createFloorArchitecture({buildingId:'sample',width:42,depth:39,floor:1,wallHeight:height});
 assert.ok(plan.wallModules.length>15);
 assert.ok(plan.wallModules.every(m=>m.size[1]===height));
 for(const unit of plan.wallModules){
  const stock=originalWallModule(unit.moduleId.split('@')[0],height);
  assert.deepEqual(unit.size,[stock.length,stock.height,stock.thickness]);
  assert.ok(plan.walls.some(w=>w.id===unit.id&&w.w===unit.collision.w&&w.d===unit.collision.d));
 }
 const south=plan.wallModules.filter(x=>x.segmentId==='south');
 assert.ok(south.every(m=>Math.abs(m.position[0])>=2.2-0.025),'Door opening must remain empty');
}
const vertical=compileWallModules([{id:'vertical',from:[0,0],to:[0,7],height:5.85}],{areaId:'test'});
assert.ok(vertical.every(m=>m.rotationY===Math.PI/2));
assert.throws(()=>originalWallModule('wall_1',8),/No original-size wall height/);
console.log('Original-size wall catalog, tiling and shared collision verified');
