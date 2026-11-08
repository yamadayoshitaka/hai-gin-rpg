import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {MassBattleGridSimulation} from '../src/mass-battle-grid-sim.js';
import {packMassUnits,applyMassUnits} from '../src/mass-battle-worker-protocol.js';
import {massLocomotionKind} from '../src/mass-dash-parity.js';
import {CrowdPerformanceBudget} from '../src/crowd-performance-budget.js';
import {useCrowdImpostor} from '../src/crowd-lod-policy.js';

const width=232,walkable=new Uint8Array(width*width).fill(1);
const sim=new MassBattleGridSimulation(100,2041,{
 width,height:width,walkable,bridges:[],riverXAt:()=>116
});
const route={id:'test-second-floor',kind:'window',buildingIndex:9,
 team:1,level:2,access:{x:110,z:117},
 points:[{x:(110-6)*2.2,y:0,z:(117-6)*2.2},
  {x:(110-6)*2.2,y:2.7,z:(117-6)*2.2},
  {x:(110-6)*2.2+1,y:6,z:(117-6)*2.2}],
 window:{aperture:{x:110,z:117},normal:{x:-1,z:0},inset:.4,halfWidth:4}};
sim.configureHighGroundRoutes([route]);
const defender=sim.units.find(u=>u.alive&&u.team===1&&u.jobId==='archer');
const attacker=sim.units.find(u=>u.alive&&u.team===0&&u.jobId==='sword');
assert.ok(defender&&attacker,'test has opposing ranged and melee classes');
// A fully constructed, already occupied real 2F, plus an unmounted melee
// soldier at the physical ground entrance. No teleport assignment allowed.
for(const u of sim.units)if(u!==defender&&u!==attacker)u.alive=false;
defender.x=110;defender.z=117;
defender.fromX=110;defender.fromZ=117;
defender.highGroundRouteIndex=0;
defender.highGroundPhase=2;defender.highGroundFloor=2;
defender.highGroundStep=route.points.length-1;defender.highGroundT=0;
defender.cooldown=3;defender.action='idle';
attacker.x=110;attacker.z=117;
attacker.fromX=110;attacker.fromZ=117;
attacker.moveDuration=0;attacker.moveElapsed=0;attacker.cooldown=0;
sim._highGroundClaims.set('9:1',defender.id);
const duplicate={...defender,team:0,id:-5};
duplicate.highGroundFloor=3;
assert.equal(sim._canSee(attacker,defender),false,
 'a sword fighter on ground cannot damage a 2F enemy through the ceiling');
assert.equal(sim._canSee(defender,attacker),false,
 'upper-floor attacker needs an actual window line of sight');
sim._assignUpperFloorPursuits();
assert.equal(attacker.highGroundRouteIndex,0,
 'melee soldier must select the real stair route to the enemy floor');
assert.equal(attacker.upperPursuitTargetId,defender.id);
assert.equal(sim._highGroundClaims.get('9:0'),attacker.id,
 'opposing teams can use a staircase without overwriting the defender claim');
const copy=new MassBattleGridSimulation(100,2041,{
 width,height:width,walkable,bridges:[],riverXAt:()=>116
});
applyMassUnits(copy.units,packMassUnits(sim.units).buffer);
assert.equal(copy.units[attacker.id].upperPursuitTargetId,defender.id,
 'Worker snapshots preserve target ownership during stair pursuit');

let arrived=false,hit=false;
const initialHp=defender.hp;
for(let i=0;i<150;i++){
 sim.step(.1);
 if(attacker.highGroundPhase===1){
   assert.equal(massLocomotionKind(attacker),'walk','physical stair steps remain walk');
 }
 if(attacker.highGroundPhase===2){
  arrived=true;
  assert.equal(attacker.highGroundFloor,2);
  assert.equal(sim._canSee(attacker,defender),true,
   'opponents at the same building and floor can fight');
 }
 if(defender.hp<initialHp){hit=true;break;}
}
assert.ok(arrived,'melee soldier climbs real stair treads, not a vertical warp');
assert.ok(hit,'melee soldier hits the originally unreachable 2F target');
assert.ok(attacker.hp>0,'assault soldier survives scripted approach');
sim._markDead(defender);
let descended=false;
for(let i=0;i<150;i++){
 sim.step(.1);
 if(attacker.highGroundPhase===3)assert.equal(
  massLocomotionKind(attacker),'walk','return travel must play a stair gait');
 if(attacker.highGroundRouteIndex<0){descended=true;break;}
}
assert.ok(descended,'after victory pursuer takes authored stairs back to ground');
assert.equal(attacker.highGroundFloor,1);
assert.equal(attacker.upperPursuitTargetId,-1);
assert.equal(sim._highGroundClaims.has('9:0'),false,'stair reservation freed');
assert.equal(sim._canSee({...attacker,highGroundPhase:0},{...defender,alive:true}),false,
 'ground-level melee still does not attack a live upper-floor target');

const fast=new CrowdPerformanceBudget();
for(let i=0;i<40;i++)fast.sample({fps:18,fullMeshVisible:160,drawCalls:1061});
assert.equal(fast.enterPx,60,'quality loss is bounded: never use photos for 92px characters');
assert.equal(useCrowdImpostor(66,true,60),false,
 'any inspectable nearby soldier is displayed using the real 3D model');
assert.equal(useCrowdImpostor(20,false,60),true,'tiny distant troops can still use GPU photos');
const page=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
const atlas=readFileSync(new URL('../src/crowd-impostor-atlas.js',import.meta.url),'utf8');
const gpu=readFileSync(new URL('../src/mass-battle-real-army.js',import.meta.url),'utf8');
assert.match(page,/const BATTLE_RESOLUTION_SCALE=\.92/,'preserve a sharper Android viewport');
assert.match(page,/Math\.max\(terrainY\(out\.x,out\.z\)\+\.04,upperPoint\.y\+\.04\)/,
 'upper-storey casualties must stay on their actual deck');
assert.match(atlas,/const TILE=224/,'capture higher-resolution real-model distant photos');
assert.match(gpu,/Math\.max\(36,Math\.min\(60,Number\(pixels\)\|\|36\)\)/,
 'GPU LOD pressure may not replace near soldiers with blurry photographs');
console.log('PASS: 2F melee pursuit, actual stair climb/return, same-floor combat, Worker target sync, near-3D fidelity and corpse floor');
