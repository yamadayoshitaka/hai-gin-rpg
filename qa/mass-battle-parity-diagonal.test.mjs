import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {MASS_GRID_DIRECTIONS,massDiagonalClear,massStepDuration} from '../src/mass-battle-directional-nav.js';
import {createMassHighGroundRoutes,massHighGroundWorldPoint,advanceMassHighGroundRoute}
 from '../src/mass-battle-highground.js';
import {MassBattleGridSimulation,MASS_MOVEMENT_SCALE} from '../src/mass-battle-grid-sim.js';
import {findStableGridPath} from '../src/battle-stable-grid-route.js';
import {packMassUnits,applyMassUnits} from '../src/mass-battle-worker-protocol.js';
import {createSpiralStairPlan} from '../src/spiral-staircase.js';

assert.equal(MASS_GRID_DIRECTIONS.length,8,'4方向と斜め4方向');
const skirmishWalls=new Set(['2,1','1,2']);
const smallPassable=(x,z)=>x>=0&&z>=0&&x<5&&z<5&&!skirmishWalls.has(x+','+z);
const skirmishRoute=findStableGridPath({x:1,z:1},{x:2,z:2},{walkable:smallPassable});
assert.ok(!skirmishRoute||skirmishRoute[0].x!==2||skirmishRoute[0].z!==2,
 '50対50も地形角の斜め貫通を禁止');

const w=8,map=new Uint8Array(w*w).fill(1),occupied=new Int32Array(w*w).fill(-1);
const idx=(x,z)=>z*w+x;
assert.equal(massDiagonalClear(3,3,1,1,w,map,occupied),true);
map[idx(4,3)]=0;
assert.equal(massDiagonalClear(3,3,1,1,w,map,occupied),false,'壁角の通り抜け禁止');
map[idx(4,3)]=1;occupied[idx(3,4)]=22;
assert.equal(massDiagonalClear(3,3,1,1,w,map,occupied),false,'別兵士の隣接マスを斜め貫通禁止');
occupied[idx(3,4)]=-1;
assert.equal(massDiagonalClear(3,3,1,1,w,map,occupied),true);
assert.equal(MASS_MOVEMENT_SCALE,.88,'50対50の .88 cell speed と共通の速度係数');
const straight=massStepDuration(3,1,0),diagonal=massStepDuration(3,1,1);
assert.ok(Math.abs(diagonal/straight-Math.SQRT2)<1e-9,
 '斜め1マスは距離√2に比例した時間を要する（速度一定）');
assert.ok(straight<1/(3*.70),'従来の大軍低速設定より速い');

const route={points:[{x:0,y:0,z:0},{x:0,y:5,z:0},{x:5,y:5,z:5}]};
const step1=advanceMassHighGroundRoute(route,0,0,2.5);
assert.equal(step1.step,0);assert.equal(step1.t,.5);
const halfway=massHighGroundWorldPoint(route,step1.step,step1.t);
assert.equal(halfway.y,2.5,'螺旋階段の高さを補間する');
const final=advanceMassHighGroundRoute(route,step1.step,step1.t,100);
assert.equal(final.done,true);
assert.deepEqual(massHighGroundWorldPoint(route,final.step,final.t),
 {x:5,y:5,z:5,yaw:0});

const size=232,cellSize=2.2,walkable=new Uint8Array(size*size).fill(1);
const at=(x,z)=>z*size+x;
const stairs=createSpiralStairPlan({
 type:'spiral',x:0,z:0,innerRadius:.6,outerRadius:3.5,
 steps:40,turns:.75,rise:6,startAngle:Math.PI/2,clockwise:true
},{floors:2});
const building={data:{x:94,z:94,d:10},model:{position:{x:(94-6)*cellSize,y:0,z:(94-6)*cellSize}},
 structure:{id:'church_001',floors:[
  {height:6,baseY:0,footprint:{width:20,depth:20}},
  {height:6,baseY:6,footprint:{width:20,depth:20}}
 ],stair:stairs}};
const routes=createMassHighGroundRoutes([building],{
 cellSize,offset:6,passable:walkable,terrainY:()=>0,maxBuildings:2
});
assert.ok(routes.some(r=>r.kind==='window'&&r.level===2),'本物の2階窓がある');
assert.ok(routes.some(r=>r.kind==='roof'&&r.level===3),'本物の屋上経路がある');
assert.ok(routes.every(r=>r.structureId==='world-building-0'));
assert.ok(routes.every(r=>r.points.some(p=>p.y>=5.9)),
 '飛び移りではなく実際の階段を登り切る');
const windowRoute=routes.find(r=>r.kind==='window');
const sim=new MassBattleGridSimulation(100,20261109,{
 width:size,height:size,walkable,bridges:[],riverXAt:()=>116
});
sim.configureHighGroundRoutes([windowRoute]);
const ranged=sim.units.find(u=>u.team===0&&u.jobId==='archer'&&!u.isStrategist);
assert.ok(ranged,'2階に登れる弓使い');
for(const u of sim.units)if(u!==ranged)u.alive=false;
ranged.x=ranged.fromX=windowRoute.access.x;
ranged.z=ranged.fromZ=windowRoute.access.z;
ranged.moveDuration=ranged.moveElapsed=0;
sim._assignHighGroundUnits();
assert.equal(ranged.highGroundRouteIndex,0,'高所へ向かう専門兵を限定割当');
sim.step(.1);
assert.equal(ranged.highGroundPhase,1,'登攀開始');
let climbed=false;
for(let i=0;i<600;i++){
 sim.step(.1);
 if(ranged.highGroundPhase===2){climbed=true;break;}
}
assert.ok(climbed,'大軍モードでも階段を登って2階へ到達する');
assert.equal(ranged.highGroundFloor,2);
assert.equal(ranged.x,windowRoute.access.x,'地上予約マスと3D表示を分離');
const upper=massHighGroundWorldPoint(windowRoute,ranged.highGroundStep,ranged.highGroundT);
assert.ok(upper.y>=5.9,'2階のワールドYを描画へ同期');
const window=windowRoute.window;
const visible={x:Math.round(window.aperture.x+window.normal.x*5),
 z:Math.round(window.aperture.z+window.normal.z*5)};
assert.equal(sim._windowCanSee(windowRoute,visible),true,'2階の実窓から射線が通る');
const melee={...sim.units.find(u=>u.jobId==='sword'),x:visible.x,z:visible.z,jobIndex:0,highGroundPhase:0};
assert.equal(sim._canSee(melee,ranged),false,'1階から近接攻撃は床を貫通しない');
const copy=new MassBattleGridSimulation(100,20261109,{
 width:size,height:size,walkable,bridges:[],riverXAt:()=>116
});
applyMassUnits(copy.units,packMassUnits(sim.units).buffer);
assert.equal(copy.units[ranged.id].highGroundPhase,2,'Worker経由で階層状態を送信する');
assert.equal(copy.units[ranged.id].highGroundFloor,2,'Worker階数を維持する');
const battle=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
assert.match(battle,/highGroundRoutes:massSim\.highGroundRoutes/);
assert.match(battle,/massHighGroundWorldPoint\(upperRoute,u\.highGroundStep,u\.highGroundT\)/);
assert.match(battle,/highGroundFiring:/);
console.log('PASS: 50/1000 dash parity, 8-way collision-safe diagonal, real stair to 2F/roof, elevated sight and Worker sync');
