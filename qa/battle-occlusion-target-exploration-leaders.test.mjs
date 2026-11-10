import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {chooseEnemyOrder} from '../src/battle-tactical-policy.js';
import {MassBattleGridSimulation} from '../src/mass-battle-grid-sim.js';

const soldier=(id,team,hp,x,z)=>({id,team,squadId:'0',alive:hp>0,hp,maxHp:100,x,z,jobId:'warrior'});
const tired=Array.from({length:5},(_,i)=>soldier(i,1,36,30+i,30));
const foes=Array.from({length:9},(_,i)=>soldier(100+i,0,90,32+i,30));
const friendlyArmy=Array.from({length:32},(_,i)=>soldier(200+i,1,65,30+i%8,30+i%4));
assert.equal(chooseEnemyOrder(tired,foes,'defend').mode,'defend',
 'A tired squad with no evidence of wider strength may defend');
const advantage=chooseEnemyOrder(tired,foes,'defend',{friendlyArmy,defenseElapsed:125});
assert.equal(advantage.mode,'charge',
 'A tired enemy squad MUST countercharge when its army is clearly winning');
assert.match(advantage.reason,/反攻|優勢/);
assert.equal(chooseEnemyOrder(tired.map(u=>({...u,hp:18})),foes,'defend',{friendlyArmy}).mode,'retreat',
 'No suicidal countercharge below critical health');
assert.equal(chooseEnemyOrder(tired,foes,'defend',{friendlyArmy:foes.map(u=>({...u,team:1})),defenseElapsed:125}).mode,'defend',
 'No unreasonable charge solely because the 120s timer elapsed');
const walkable=new Uint8Array(120*120).fill(1);
for(let z=51;z<=69;z++)for(let x=51;x<=69;x++)walkable[z*120+x]=0;
const sim=new MassBattleGridSimulation(50,20261110,{
 width:120,height:120,walkable,bridges:[],riverXAt:()=>60
});
const id=String(sim.units.find(u=>u.team===0&&!u.isStrategist).squadId);
assert.equal(sim.setSquadExploration(id,'distant-castle',60,60,0),true,
 'Large castle loot 10 tiles from entrance must still be selectable');
const goal=sim.explorationOrders.get('0:'+id);
assert.ok(goal&&Math.hypot(goal.x-60,goal.z-60)>5,
 'The target must use a passable perimeter approach, not blocked castle interior');
assert.ok(goal.x>=0&&goal.x<120&&goal.z>=0&&goal.z<120);
assert.equal(sim.setSquadExploration(id,'unavailable',-1,-1,0),false,
 'Out of bounds is rejected rather than silently queued');

const battle=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
for(const token of [
 "item.id==='tree_deciduous_001'||item.id==='flower_tree_001'",
 'const hide=closeup;',
 'isSquadCircleTargetActionable(id,team,action)',
 "label.classList.toggle('eligible-target',Boolean(actionable))",
 "const message='現在選べる対象部隊がありません",
 "if(!isSquadCircleTargetActionable(id,team,action)){",
 'isSquadCircleTargetActionable(row.id,team,pendingCircleTarget)',
 'if(pendingCircleTarget&&!(targetTeam===0?squadIds:enemySquadIds).some',
 "id=\"showAllSquadLeaderLines\"",
 'const showLeader=Boolean(line)&&(chosen||showAllSquadLeaders)',
 "leader.style.display=showLeader?'':'none';",
 'Math.hypot(nearest.p.x-x,nearest.p.z-z)>32',
 'const choice=chooseEnemyOrder(own,allies,previous,{friendlyArmy,defenseElapsed});'
])assert.ok(battle.includes(token),'Missing connected behavior: '+token);
assert.match(battle,/\.squadScreenLabel\.eligible-target:not\(\.defeated\)/,
 'Pulse only verified actionable targets, never dead or cooldown units');
assert.doesNotMatch(battle,/\.squadScreenLabel\.ally:not\(\.defeated\),/,
 'Do not pulse ALL friendly labels regardless of eligibility');
console.log('PASS flowering tree view, executable-only target pulse, distant exploration, adaptive enemy attack and de-cluttered connector lines');
