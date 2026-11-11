import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {BATTLE_TACTIC_PRESETS,TACTIC_DEFINITIONS,tacticAvailability,buildTacticPlan,rotationOrders} from '../src/battle-tactics-preset-policy.js';
import {objectiveForStage,evaluateBattleObjective} from '../src/battle-stage-objective.js';

const squads=(...jobs)=>jobs.map((jobId,i)=>({squadId:String(i),jobId,total:10}));
const mission=(type,team=1,id='b1',x=50,z=20)=>({id,x,z,team,type,category:'structure',alive:true,hp:100,maxHp:100});
const structures=[mission('bridge',undefined,'bridge',35,20),mission('building',1,'house',62,20),
 mission('door',1,'gate',62,18),mission('door',0,'our-gate',12,15)];
structures[2].locked=true;structures[3].lockLevel=1;
const routes=[{team:0,kind:'window',access:{x:48,z:32}}];
const defense=objectiveForStage({kind:'defend',difficulty:1});
const capture=objectiveForStage({kind:'capture',difficulty:1});
const siege=objectiveForStage({kind:'siege',difficulty:1});
const allJobs=squads('sword','shield','fighter','ninja','thief','archer','mage','priest','summoner','lancer');
const available=tacticAvailability({squads:allJobs,structures,highGroundRoutes:routes,objective:siege});
assert.ok(BATTLE_TACTIC_PRESETS.length>=12,'tactic catalog should be extensible');
assert.equal(new Set(TACTIC_DEFINITIONS.map(x=>x.id)).size,TACTIC_DEFINITIONS.length);
assert.ok(TACTIC_DEFINITIONS.every(x=>x.version===1&&x.steps.length>1));
assert.ok(available.every(x=>x.enabled),'all features available for full-job army with terrain');
assert.equal(available.filter(x=>x.recommended).length,1);
const noJobs=tacticAvailability({squads:squads('sword'),objective:defense,structures:[],highGroundRoutes:[]});
for(const id of ['highground','siege_break','bridge_denial','rotation','infiltration']){
 assert.equal(noJobs.find(x=>x.id===id).enabled,false,id+' must lock without required jobs/terrain');
}
assert.ok(noJobs.find(x=>x.id==='balanced').enabled);
assert.equal(tacticAvailability({squads:allJobs,objective:defense,structures,highGroundRoutes:routes})
 .find(x=>x.id==='objective_rush').enabled,false,'rush is not a defend objective');
assert.equal(tacticAvailability({squads:allJobs,objective:capture,structures,highGroundRoutes:routes})
 .find(x=>x.id==='objective_rush').enabled,true);
assert.equal(tacticAvailability({squads:squads('archer'),objective:siege,structures,highGroundRoutes:[]})
 .find(x=>x.id==='highground').enabled,false,'cannot exploit non-existing high ground');
const allies=[{squadId:'0',x:12,z:18},{squadId:'1',x:13,z:17}];
const enemies=[{squadId:'0',x:74,z:18}];
const state={squads:allJobs,objective:siege,structures,allyPositions:allies,enemyPositions:enemies,
 enemyZone:{x:74,z:20},enemyCommanders:[{team:1,isStrategist:true,alive:true,hp:100,id:999,squadId:0,x:70,z:20}]};
const run=id=>buildTacticPlan({...state,tacticId:id});
assert.equal(run('balanced').orders.length,10);
assert.equal(run('fortress_defense').orders.find(x=>x.jobId==='shield').order,'hold');
assert.equal(run('highground').orders.find(x=>x.jobId==='archer').highGround,true);
assert.equal(run('highground').orders.find(x=>x.jobId==='mage').highGround,true);
const siegePlan=run('siege_break');
assert.equal(siegePlan.orders.find(x=>x.jobId==='thief').mission.type,'unlock_door');
assert.equal(siegePlan.orders.find(x=>x.jobId==='ninja').mission.type,'demolish_structure');
assert.equal(siegePlan.orders.find(x=>x.jobId==='mage').mission.type,'burn_building');
const bridgePlan=run('bridge_denial');
assert.equal(bridgePlan.orders.filter(x=>x.mission?.type==='destroy_bridge').length,1);
assert.equal(bridgePlan.orders.find(x=>x.mission?.type==='destroy_bridge').mission.targetId,'bridge');
const unsafe=buildTacticPlan({...state,tacticId:'bridge_denial',allyPositions:[...allies,{squadId:'9',x:55,z:20}]});
assert.equal(unsafe.orders.some(x=>x.mission?.type==='destroy_bridge'),false,
 'Do not destroy a bridge with friendlies on the enemy bank');
const noBridge=buildTacticPlan({...state,tacticId:'bridge_denial',structures:structures.filter(o=>o.type!=='bridge')});
assert.equal(noBridge.orders.some(x=>x.mission?.type==='destroy_bridge'),false);
const rush=run('objective_rush');
assert.ok(rush.orders.some(x=>x.jobId==='ninja'&&x.order==='move'&&x.destination.x===74));
assert.equal(run('anti_siege').orders.find(x=>x.jobId==='thief').mission.type,'fortify_lock');
assert.equal(run('arcane_barrage').orders.find(x=>x.jobId==='mage').order,'charge');
assert.equal(run('commander_hunt').orders.find(x=>x.jobId==='fighter').mission?.type??'none','none');
assert.equal(run('commander_hunt').orders.find(x=>x.jobId==='ninja').mission.type,'eliminate_commander');
assert.equal(run('infiltration').orders.find(x=>x.jobId==='thief').mission.type,'unlock_door');
assert.equal(run('rear_guard').orders.find(x=>x.jobId==='shield').order,'hold');
assert.ok(run('rotation').orders.filter(x=>x.order==='charge').length>0);
const phased=rotationOrders({tacticId:'rotation',squads:allJobs,seconds:30});
assert.equal(phased[0].order,'retreat');
assert.equal(rotationOrders({tacticId:'balanced',squads:allJobs,seconds:30}).length,0);

// Battle victory rules remain authoritative for any selected tactic.
for(const spec of [defense,capture,siege]){
 const result=evaluateBattleObjective(spec,{allyAlive:3,enemyAlive:0,elapsedSeconds:4});
 assert.equal(result.winnerTeam,0);
 assert.equal(result.loserTeam,1);
}

const html=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
for(const id of ['openingTacticDefinitions','openingTacticChoices','openingTacticSelection']){
 assert.ok(html.includes(id),id+' shown in mobile opening UI');
}
assert.match(html,/for\(const definition of TACTIC_DEFINITIONS\)/);
assert.match(html,/tacticAvailability\(/);
assert.match(html,/refreshTacticChoices\(\)/);
assert.match(html,/buildTacticPlan\(/);
assert.match(html,/massSim\.setSquadMission\(task\.id,target\.type,target\)/);
assert.match(html,/massWorker\?\.setSquadMission\(task\.id,target\.type,target\)/);
assert.match(html,/updateBattleTacticRotation\(\)/);
assert.match(html,/orderSelect\.dataset\.manuallyChanged='true'/);
assert.match(html,/lastSquadOrderAt\.has\(row\.id\)/);
const script=html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
assert.ok(script);
const syntax=spawnSync(process.execPath,['--check','--input-type=module'],{input:script,encoding:'utf8',timeout:20000});
assert.equal(syntax.status,0,syntax.stderr||'main module must compile');
console.log('PASS data-driven battle tactics, job gates, high-ground, real demolition, bridge safety, manual override, worker wiring');
