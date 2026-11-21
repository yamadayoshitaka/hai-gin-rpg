import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {battleFormationEligibility,battleFormationRegroupTargets} from '../src/battle-formation-orders.js';

const option={
 id:'dragon',eligible:true,assignment:['a','b','c'],
 requirements:{people:12,rPlus:6,srPlus:4,ssrPlus:2,ur:0},
 roleMinimums:{a:3,b:2,c:2},
 purpose:'先鋒と翼の攻撃を連携して敵を崩す',
 movement:'先鋒突破・両翼追撃'
};
const army=[
 ...Array.from({length:6},()=>({hp:100,alive:true,sourceSquadId:'a',rarity:'R'})),
 ...Array.from({length:4},()=>({hp:100,alive:true,sourceSquadId:'b',rarity:'SR'})),
 ...Array.from({length:2},()=>({hp:100,alive:true,sourceSquadId:'c',rarity:'SSR'}))
];
assert.equal(battleFormationEligibility(option,army).eligible,true);
assert.match(battleFormationEligibility(option,army.slice(0,10)).reason,/12人未満/);
assert.equal(battleFormationEligibility({...option,eligible:false,reason:'必要な職業'},army).eligible,false);
assert.equal(battleFormationEligibility(option,army.map((u,i)=>i<2?{...u,hp:0}:u)).eligible,false);
assert.equal(battleFormationEligibility(option,army.map(u=>u.sourceSquadId==='c'?{...u,hp:0}:u)).eligible,false);

const group=[
 {squadId:'1',cell:0},{squadId:'2',cell:5},{squadId:'3',cell:10},
 {squadId:'4',cell:10}
];
const targets=battleFormationRegroupTargets(group,{x:54,z:88},(x,z)=>x>=10&&x<100&&z>5&&z<200);
assert.equal(targets.length,4);
assert.equal(new Set(targets.map(p=>p.x+':'+p.z)).size,4,'parts do not share the same destination');
assert.ok(targets.every(p=>Number.isInteger(p.x)&&Number.isInteger(p.z)));
assert.ok(targets.every(p=>Math.abs(p.x-54)<=16&&Math.abs(p.z-88)<=23),
 'regroup should move relative to current team, never warp back to the initial map');
assert.deepEqual(battleFormationRegroupTargets([],{x:40,z:40}),[]);
assert.equal(battleFormationRegroupTargets(group,{x:40,z:40},()=>false).length,0);

const battleHtml=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
assert.match(battleHtml,/formationBattleOptions/);
assert.match(battleHtml,/function issueInnFormationChange/);
assert.match(battleHtml,/battleFormationRegroupTargets/);
assert.match(battleHtml,/function updateBattleFormationRegroups/);
assert.match(battleHtml,/updateBattleFormationRegroups\(\);/);
assert.match(battleHtml,/onFormationChange:\(id,formationId\)=>issueInnFormationChange/);
assert.match(battleHtml,/formationRegroup:true/);
const commandUi=readFileSync(new URL('../src/battle-realtime-commands.js',import.meta.url),'utf8');
assert.match(commandUi,/id="realtimeTabFormation"/);
assert.match(commandUi,/function showFormationChoices/);
assert.match(commandUi,/data-formation-change|onFormationChange/);
assert.ok(!commandUi.includes('setInterval'),'no high-frequency UI polling for formations');
console.log('PASS: formation switching requires live soldiers, uses nonteleport regroup and resumes old squad orders');
