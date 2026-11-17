import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 BATTLE_PLAN_ORDERS,BATTLE_DIRECT_ORDERS,allowedBattlePlanOrders,
 battleOrderSpeedMultiplier,createBattleSquadCommandBridge
} from '../src/battle-shared-command-rules.js';

const html=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
const grid=readFileSync(new URL('../src/mass-battle-grid-sim.js',import.meta.url),'utf8');
const orderText=readFileSync(new URL('../src/battle-order-message.js',import.meta.url),'utf8');
for(const size of [50,100,200,500,1000]){
 assert.deepEqual(allowedBattlePlanOrders(),BATTLE_PLAN_ORDERS,
  size+' must offer the same strategy modes');
 assert.equal(battleOrderSpeedMultiplier('charge'),1.25);
 assert.equal(battleOrderSpeedMultiplier('defend'),.65);
 assert.equal(battleOrderSpeedMultiplier('retreat'),1);
}
assert.deepEqual(allowedBattlePlanOrders(['charge']),['charge'],
 'story-specific role restrictions must survive the shared default');
assert.deepEqual(BATTLE_DIRECT_ORDERS,['charge','defend','hold','retreat']);
assert.match(html,/armySelector\.innerHTML=.*100 対 100.*1000 対 1000/);
assert.match(html,/const battleCommandBridge=createBattleSquadCommandBridge\(/);
assert.match(html,/battleCommandBridge\.issue\(\{squadId:id,team:0,mode,point\}\)/);
assert.match(html,/battleCommandBridge\.issue\(\{squadId:id,team:side,mode\}\)/);
assert.match(html,/battleCommandBridge\.issue\(\{squadId:id,team:side,mode:'explore'/);
assert.match(html,/const allowed=allowedBattlePlanOrders\(storyRequest\?\.availableSquadOrders\?\.\[String\(id\)\]\)/);
assert.match(html,/const multiplier=battleOrderSpeedMultiplier\(order\)/);
assert.match(grid,/const multiplier=battleOrderSpeedMultiplier\(order\)/);
assert.match(grid,/!BATTLE_DIRECT_ORDERS\.includes\(command\)/);
assert.doesNotMatch(orderText,/massBattle\s*\?/);

const calls=[],replicas=[];
const mass={
 setSquadCommand:(id,mode,team)=>{calls.push(['command',id,mode,team]);return true;},
 setSquadDestination:(id,x,z)=>{calls.push(['move',id,x,z]);return true;},
 clearSquadDestination:id=>{calls.push(['clear',id]);},
 setSquadMission:(id,kind,point)=>{calls.push(['mission',id,kind,point.x,point.z]);return true;},
 setSquadExploration:(id,buildingId,x,z,team)=>{calls.push(['explore',id,buildingId,x,z,team]);return true;}
};
const worker={active:true,
 setSquadCommand:(...a)=>replicas.push(['command',...a]),
 setSquadDestination:(...a)=>replicas.push(['move',...a]),
 clearSquadDestination:(...a)=>replicas.push(['clear',...a]),
 setSquadMission:(...a)=>replicas.push(['mission',...a]),
 setSquadExploration:(...a)=>replicas.push(['explore',...a])};
let massMode=true;
const bridge=createBattleSquadCommandBridge({
 getMassSimulation:()=>massMode?mass:null,
 getWorkerSimulation:()=>massMode?worker:null,
 isWalkable:(x,z)=>x>=0&&x<100&&z>=0&&z<100
});
assert.equal(bridge.issue({squadId:'2',mode:'charge'}),true);
assert.equal(bridge.issue({squadId:'2',team:1,mode:'defend'}),true);
assert.equal(bridge.issue({squadId:'2',mode:'move',point:{x:20,z:21}}),true);
assert.equal(bridge.issue({squadId:'2',mode:'mission',point:{x:20,z:21,type:'eliminate_squad'}}),true);
assert.equal(bridge.issue({squadId:'2',mode:'explore',point:{x:20,z:21,buildingId:'house1'}}),true);
assert.equal(bridge.issue({squadId:'2',mode:'clear'}),true);
assert.equal(calls.length,6);
assert.equal(replicas.length,6,'each successful order is mirrored to Worker exactly once');
assert.deepEqual(calls[0],['command','2','charge',0]);
assert.deepEqual(calls[1],['command','2','defend',1]);
assert.deepEqual(replicas[4],['explore','2','house1',20,21,0]);
for(const invalid of [
 {squadId:'1',mode:'teleport'},
 {squadId:'1',mode:'move',point:{x:-1,z:3}},
 {squadId:'1',mode:'mission',point:null},
 {squadId:'1',mode:'explore',point:{x:1,z:2}},
 {squadId:'1',mode:'move',point:{x:1.5,z:2}}
])assert.equal(bridge.issue(invalid),false);
assert.equal(calls.length,6);
assert.equal(replicas.length,6);
mass.setSquadCommand=()=>false;
assert.equal(bridge.issue({squadId:'1',mode:'charge'}),false);
assert.equal(replicas.length,6,'a rejected local order must not reach Worker');
massMode=false;
assert.equal(bridge.issue({squadId:'1',mode:'charge'}),true,
 '50-person scene uses the identical command validation');
assert.equal(bridge.issue({squadId:'1',mode:'move',point:{x:20,z:21}}),true);
assert.equal(bridge.issue({squadId:'1',mode:'move',point:{x:120,z:21}}),false);
assert.equal(replicas.length,6,'50-person scene does not touch Worker');
console.log('Battle command contract parity: 50/100/200/500/1000 PASS');
