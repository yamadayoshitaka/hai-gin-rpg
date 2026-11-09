import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {FORMATION_TYPES,FORMATION_NAMES,recomposeSquadAssignments,applySquadRecomposition}
 from '../src/battle-squad-recomposition.js';
import {MassBattleGridSimulation} from '../src/mass-battle-grid-sim.js';
import {SQUAD_TYPES} from '../src/mass-battle-formations.js';

assert.deepEqual(FORMATION_TYPES,['attack','balanced','support']);
assert.deepEqual(SQUAD_TYPES,FORMATION_TYPES);
assert.deepEqual(Object.values(FORMATION_NAMES),['攻撃','バランス','支援']);
for(const count of [50,1000]){
 const make=()=>new MassBattleGridSimulation(count,1177,{
  width:232,height:232,walkable:new Uint8Array(232*232).fill(1),bridges:[],
  riverXAt:()=>116
 });
 const sim=make(),worker=make();
 const before=new Map(sim.units.map(u=>[u.id,{
  jobId:u.jobId,jobIndex:u.jobIndex,hp:u.hp,maxHp:u.maxHp,rarity:u.rarity,
  position:u.x+','+u.z
 }]));
 const typeMap=Object.fromEntries(sim.formations[0].map((s,i)=>[
  String(s.id),i===0?'support':i===1?'attack':'balanced'
 ]));
 // Modify one detailed soldier to match the 50v50 representative's existing
 // suit and role. The worker must receive the same class/slot metadata.
 const changed=sim.units.find(u=>u.team===0&&!u.isStrategist);
 changed.jobIndex=7;changed.jobId='priest';changed.hp=changed.maxHp=90;
 const plan=sim.setSquadFormationTypes(typeMap,0);
 assert.ok(plan&&plan.assignments.length>0,count+' selection updates actual soldiers');
 const classes=sim.units.filter(u=>u.team===0&&!u.isStrategist);
 assert.ok(classes.every(u=>u.formationType===typeMap[String(u.squadId)]));
 assert.equal(new Set(sim.units.map(u=>u.x+','+u.z)).size,sim.units.length,
  count+' squads may not overlap any tile or enemy');
 assert.equal(new Set(classes.map(u=>u.id)).size,classes.length,'Soldiers are never minted or lost');
 for(const u of classes){
  assert.equal(u.hp,u.maxHp,'Reassignment retains living soldier HP');
  assert.equal(u.jobId, u.id===changed.id?'priest':before.get(u.id).jobId,
   'Each human preserves their actual profession and equipment');
 }
 const jobs=classes.map(u=>({id:u.id,jobIndex:u.jobIndex,maxHp:u.maxHp,hp:u.hp}));
 assert.ok(worker.setSquadFormationTypes(typeMap,0,plan.assignments,jobs));
 for(const u of sim.units.filter(u=>u.team===0)){
  const clone=worker.units[u.id];
  assert.equal(clone.x,u.x,'Authoritative Worker agrees with render x');
  assert.equal(clone.z,u.z,'Authoritative Worker agrees with render z');
  assert.equal(clone.squadId,u.squadId,'Authoritative Worker agrees with squad identity');
  assert.equal(clone.jobIndex,u.jobIndex,'Worker class agrees with displayed mesh class');
 }
 const support=classes.filter(u=>u.formationType==='support');
 const attack=classes.filter(u=>u.formationType==='attack');
 const frac=arr=>arr.filter(u=>u.jobId==='priest').length/Math.max(1,arr.length);
 assert.ok(frac(support)>frac(attack),'Support draws more healers than attack type');
 sim.step(.1);
 assert.equal(sim.setSquadFormationTypes(typeMap,0),false,
  'A battle in progress cannot secretly change formation type');
}
const html=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
assert.match(html,/openingPlan\.id='openingSquadStrategies'/);
assert.match(html,/for\(const type of FORMATION_TYPES\)/);
assert.match(html,/selectedSquadFormations\.set\('0:'\+id,type\)/);
assert.match(html,/manualRatios\[id\]/);
assert.match(html,/refs\.buttons\.querySelectorAll\('button'\)/);
assert.match(html,/refreshFormationPreview\(\)/);
assert.match(html,/massWorker\?\.setSquadFormationTypes\(types,team,plan\.assignments,jobs\)/);
assert.match(html,/applySquadRecomposition\(actors,plan,\{team\}\)/);
assert.match(html,/formation:selectedSquadType\(key,team\)/);
assert.match(html,/開戦前の隊列編成/);
const moduleCode=html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
assert.ok(moduleCode,'Battle HTML must contain executable game module');
const syntax=spawnSync(process.execPath,['--check','--input-type=module'],{
 input:moduleCode,encoding:'utf8',timeout:15000
});
assert.equal(syntax.status,0,syntax.stderr||'Game module must compile without syntax errors');
console.log('PASS three-type squad selection, real role redistribution, model-safe Worker synchronization and script syntax');
