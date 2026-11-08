import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {MassBattleGridSimulation} from '../src/mass-battle-grid-sim.js';
import {CombatActionRuntime} from '../src/combat-action-runtime.js';
import {resolveRidingJointName} from '../src/character-system/riding-pose.js';
import {isHeightTactician} from '../src/tactical-height-priority.js';
import {formatSquadIntent} from '../src/battle-squad-intent.js';

// The same pre-battle strategy choices must run on the main thread and Worker.
const walkable=new Uint8Array(232*232).fill(1);
const sim=new MassBattleGridSimulation(50,20261108,{width:232,height:232,walkable,
 bridges:[{x:116,z:55,type:'stone'},{x:116,z:116,type:'stone'}],
 riverXAt:()=>116});
assert.ok(sim.squadStrategies.size>=1);
const id=[...sim.squadStrategies.keys()][0];
for(const strategy of ['eliminate','environment_prepare','recovery'])
 assert.equal(sim.setSquadStrategy(id,strategy),true, 'All three strategies available before combat');
assert.equal(sim.setSquadStrategy(id,'environment_destroy'),false,'Destruction is an occupational action, not a fourth strategy');
assert.equal(sim.setSquadStrategy(id,'environment_prepare'),true);
sim.step(.1);
assert.equal(sim.setSquadStrategy(id,'recovery'),false,'Strategy locked after the first live tick');
const alive=sim.units.filter(u=>u.team===0&&!u.isStrategist&&u.alive&&String(u.squadId)===id);
assert.ok(alive.length>1);
for(const soldier of alive.slice(1))sim._markDead(soldier);
assert.equal(sim.squadStrategies.get(id),'eliminate','One regular survivor forces elimination');

// Environmental restoration affects actual registered structure HP and fire.
const actions=new CombatActionRuntime({width:32,height:32,walkable:new Uint8Array(32*32).fill(1)});
const tower=actions.registerStructure({id:'qa-tower',type:'building',x:7,z:8,hp:130});
assert.equal(actions.hitStructure(tower,50,'physical'),50);
assert.equal(tower.hp,80);
assert.equal(actions.repairStructure('qa-tower',25),25);
assert.equal(tower.hp,105);
assert.equal(actions.repairStructure('qa-tower',200),25,'Never exceed max durability');
assert.equal(actions.repairStructure('qa-tower',20),0,'No fake repairs at full HP');
assert.equal(actions.igniteStructure('qa-tower'),true);
assert.ok(tower.burningUntil>0);
assert.equal(actions.extinguishStructure('qa-tower'),true);
assert.equal(tower.burningUntil,0,'Water skill immediately stops continuous fire damage');
assert.equal(actions.extinguishStructure('qa-tower'),false,'Cannot extinguish an inactive fire');

// Fixed environment-preparation doctrine distinguishes territory ownership.
// The same decision code is used on the main thread and inside the Worker.
const environmentMock=objects=>{
 const actor=Object.create(MassBattleGridSimulation.prototype);
 Object.assign(actor,{
  width:64,height:64,riverXAt:()=>32,
  units:[{team:0,alive:true,hp:100,isStrategist:false,jobId:'mage',mp:80,squadId:0,x:12,z:16},
   {team:0,alive:true,hp:100,isStrategist:false,jobId:'swordsman',squadId:0,x:14,z:16}],
  actions:{time:1},objects,
  squadStrategies:new Map([['0','environment_prepare']]),
  squadCommands:new Map(),autoStrategySquads:new Set(),
  squadHealTargets:new Map(),squadMissions:new Map(),
  squadDestinations:new Map(),squadFlows:new Map()
 });
 const result=[];
 actor.setSquadMission=(id,type,target)=>{result.push({id,type,target});return true};
 actor.requestSquadHealing=()=>null;
 actor._applyGlobalStrategy();
 return result[0]??null;
};
const building=(id,x,{burning=false,damaged=false,team=-1,type='building'}={})=>({
 id,category:'structure',type,x,z:16,team,alive:true,
 hp:damaged?50:100,maxHp:100,burningUntil:burning?40:0
});
assert.equal(environmentMock([building('friend-fire',14,{burning:true})])?.type,'extinguish_fire',
 'Friendly-side burning house requests water extinguishing, not destruction');
assert.equal(environmentMock([building('friend-damage',14,{damaged:true})])?.type,'repair_structure',
 'Friendly structures are repaired when not burning');
assert.equal(environmentMock([building('hostile-tree',44,{type:'tree'})])?.type,'burn_tree',
 'Enemy-side trees may be ignited by mages');
assert.equal(environmentMock([building('hostile-house',44)])?.type,'burn_building',
 'Enemy-side buildings may be ignited by mages');
assert.equal(environmentMock([building('neutral-house',32)]) ,null,
 'Do not ignite structures in the neutral corridor');
assert.equal(environmentMock([building('friendly-in-enemy-territory',44,{team:0})]),null,
 'Explicit friendly ownership prevents accidental burning');
assert.equal(environmentMock([building('already-burning-enemy',44,{burning:true})]),null,
 'Fire already active on enemy territory is not re-cast');
assert.equal(environmentMock([
 building('damaged-hostile',45,{damaged:true}),
 building('burning-friendly',13,{burning:true})
])?.type,'extinguish_fire',
 'Friendly firefighting takes priority over enemy-side arson');

// A rider keeps independent human thigh, shin and foot bones on imported rigs.
for(const [external,internal] of Object.entries({
 'thigh_l':'thigh_l','thigh_r':'thigh_r','mixamorigLeftUpLeg':'thigh_l',
 'mixamorigRightLeg':'calf_r','LeftFoot':'foot_l','J_Bip_L_UpperLeg':'thigh_l',
 'RightLowerLeg':'calf_r','DEF-thigh.L':'thigh_l'
}))assert.equal(resolveRidingJointName(external),internal,external);
assert.equal(resolveRidingJointName('spine'),null);
for(const id of ['archer','mage','priest','summoner','ninja','thief'])
 assert.equal(isHeightTactician(id),true,id+' seeks a legal upper firing position');
assert.match(formatSquadIntent({strategy:'environment_prepare'}).purpose,/作戦：環境整備/);

const html=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
assert.match(html,/id='openingSquadStrategies'/);
assert.match(html,/STRATEGY_LABELS/);
assert.match(html,/massWorker\.setSquadStrategy\(id,strategy\)/);
assert.match(html,/battleReady=true;loading\.hidden=true/);
assert.match(html,/instant\('⚔ 突撃','charge'\)/);
assert.match(html,/instant\('↘ 退却','retreat'\)/);
console.log('PASS: fixed pre-battle squad strategies, survivor fallback, environment repair, riding bones, elevated ranged AI');
