import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {MassBattleGridSimulation} from '../src/mass-battle-grid-sim.js';
import {CombatActionRuntime} from '../src/combat-action-runtime.js';
import {chooseEnemyOrder} from '../src/battle-tactical-policy.js';

const size=232,walkable=new Uint8Array(size*size).fill(1);
const sim=new MassBattleGridSimulation(50,20261121,{
 width:size,height:size,walkable,bridges:[],riverXAt:()=>116
});
const priest=sim.units.find(u=>u.team===0&&!u.isStrategist&&u.jobId==='priest');
assert.ok(priest,'The mass battle must include a priest');
const allies=sim.units.filter(u=>u.team===0&&u!==priest&&u.alive&&!u.isStrategist);
const nearby=allies.map(u=>({u,dist:Math.hypot(u.x-priest.x,u.z-priest.z)}))
  .sort((a,b)=>a.dist-b.dist)[0];
assert.ok(nearby?.dist<22,'A wounded ally must be within healer triage range');
const patient=nearby.u;
patient.hp=Math.floor(patient.maxHp*.22);
const beforeHp=patient.hp;
assert.equal(sim.setSquadCommand(priest.squadId,'hold'),true);
const formation=priest.formationType;
assert.notEqual(sim.squadCommands.get(String(priest.squadId)),'heal',
 'No explicit healing command should be required');
let healed=false;
for(let step=0;step<180;step++){
 sim.step(.1);
 if(patient.hp>beforeHp){healed=true;break;}
}
assert.ok(healed,'A priest on hold should autonomously restore actual wounded HP');
assert.equal(priest.formationType,formation,'Healing must preserve the inn formation');
assert.equal(sim.squadCommands.get(String(priest.squadId)),'hold',
 'Healing must not overwrite the command');
assert.ok(priest.mp<priest.maxMp,'Real healing consumes MP');

const skills=readFileSync(new URL('../src/combat-action-runtime.js',import.meta.url),'utf8');
assert.match(skills,/skills\.sort\(\(a,b\)=>Number\(b\.kind==='heal'\)/,
 'Priests must prioritize healing magic under fire');
const html=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
assert.match(html,/function updateSkirmishSquadStrategies\(\)/);
assert.match(html,/const medic=fighters\.find\(u=>u\.jobId==='priest'/,
 'Any 50v50 battle formation may auto-triage');
assert.match(html,/Healing works even without a visible enemy/);
assert.match(html,/a\._bridgeAvoidUntil>elapsed&&actor\._bridgeAvoid===b|actor\._bridgeAvoidUntil>elapsed&&actor\._bridgeAvoid===b/,
 'Bridge congestion must allow a safe alternate crossing');
assert.match(html,/const secondsUntilReissue=critical\?8:/,
 'Losing enemy squads reconsider standing orders promptly');
const full=(hp=100,team=1)=>Array.from({length:8},(_,id)=>({
 id,team,squadId:team===1?'enemy':'ally',jobId:'sword',
 x:15+id,z:20,hp,maxHp:100,alive:true
}));
assert.equal(chooseEnemyOrder(full(17),full(95,0),'defend').mode,'retreat',
 'Nearly defeated enemy armies do not stand and watch');
console.log('PASS formation-aware priest triage, MP cost, preserved hold order, bridge and enemy AI contracts');
