import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {MassBattleGridSimulation} from '../src/mass-battle-grid-sim.js';
import {ROOM_ITEM_TYPES,createRoomItemPlan} from '../src/room-item-registry.js';

const sideCount=20,width=64,height=64,walkable=new Uint8Array(width*height).fill(1);
const sim=new MassBattleGridSimulation(sideCount,9901,{width,height,walkable,bridges:[]});
for(const team of [0,1]){
 const squadId='0',key=team+':'+squadId;
 assert.equal(sim.setSquadExploration(squadId,'house-1',30,30,team),true,
  'Both armies can receive an explicit building exploration target');
 assert.equal(sim.explorationOrders.get(key).buildingId,'house-1');
 assert.ok(sim.explorationFlows.has(key),'One shared flow per side/squad');
 assert.equal((team===0?sim.squadCommands:sim.enemySquadCommands).get(squadId),'explore');
 assert.equal(sim.setSquadCommand(squadId,'defend',team),true);
 assert.equal((team===0?sim.squadCommands:sim.enemySquadCommands).get(squadId),'defend');
 assert.equal(sim.explorationOrders.has(key),false,'Explicit later command cancels exploration');
}
assert.equal(sim.setSquadExploration('0','bad',-10,-10,0),false,'Invalid destinations are refused');
assert.equal(sim.setSquadExploration('999','house-1',30,30,1),false,'No phantom squads');
assert.ok(sim.setSquadExploration('0','castle',31,31,1));
sim.step(.1);
assert.equal(sim.enemySquadCommands.get('0'),'explore','Enemy order survives authoritative AI tick');
assert.equal(sim.explorationFlows.get('1:0').regular.length,width*height);
assert.equal(sim.setSquadCommand('0','charge',1),true);
assert.equal(sim.enemySquadCommands.get('0'),'charge');
const items=Object.values(ROOM_ITEM_TYPES);
assert.ok(items.length>=23,'Loot catalog contains many more than the initial ten types');
for(const kind of ['heal','squad_buff','key','material','quest'])
 assert.ok(items.some(type=>type.kind===kind));
const building={id:'house-test',floors:[{index:1,baseY:0,footprint:{width:12,depth:12}}]};
const plan=createRoomItemPlan(building);
assert.equal(plan.length,2,'One potion plus one distinct chest per room');
assert.ok(plan.some(x=>x.itemId==='healing_potion'));
assert.ok(plan.some(x=>x.itemId!=='healing_potion'));
assert.ok(Math.hypot(plan[0].x-plan[1].x,plan[0].z-plan[1].z)>.55,
 'Two rewards are not accidentally de-duplicated by the nearby-marker rule');
const html=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
const worker=readFileSync(new URL('../src/mass-battle-worker-runtime.js',import.meta.url),'utf8');
assert.match(html,/id='openingSquadOrders'/,'Pre-battle selection is visible');
assert.match(html,/for\(const team of \[0,1\]\)/,'Both armies are configurable');
assert.match(html,/INITIAL_ORDER_LABELS=\{charge:/,'Starting commands are explicit');
assert.match(html,/explore:'🔎 探索'/);
assert.match(html,/queueSquadExplorations\(team,id,buildingPicker\.getIds\(\),\{beforeBattle:true\}\)/);
assert.match(html,/function createExplorationPicker\(defaultIds=\[\]\)/,'Exploration uses the map picker');
assert.match(html,/function queueSquadExplorations\(team,id,ids/,'Several buildings can be explored sequentially');
assert.match(html,/function issueBuildingExploration\(team,squadId,buildingId/);
assert.match(html,/function checkCompletedExplorations\(\)/);
assert.match(html,/function updateEnemyItemDecisions\(\)/,'Enemy AI also uses obtained items');
assert.match(worker,/case 'squadExplore'/);
console.log('PASS initial allied/enemy orders, real building exploration, more room loot and enemy item AI');
