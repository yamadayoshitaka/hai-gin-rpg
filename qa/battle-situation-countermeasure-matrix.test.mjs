import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {BATTLE_SITUATION_DEFINITIONS,BATTLE_COUNTERMEASURE_DEFINITIONS,
 countermeasureById,scanBattleSignals,getCountermeasureOptions,validateResponseIsNotRoute}
 from '../src/battle-countermeasure-situation-matrix.js';
import {TACTIC_DEFINITIONS} from '../src/battle-tactics-preset-policy.js';
import {objectiveForStage,evaluateBattleObjective} from '../src/battle-stage-objective.js';

const categories=new Set(BATTLE_SITUATION_DEFINITIONS.map(s=>s.category));
assert.ok(BATTLE_SITUATION_DEFINITIONS.length>=60,'60+ specific combat situations');
assert.deepEqual([...categories].sort(),[
 'enemy','force','object','objective','result','status','terrain','visibility']);
assert.equal(new Set(BATTLE_SITUATION_DEFINITIONS.map(s=>s.id)).size,
 BATTLE_SITUATION_DEFINITIONS.length);
const types=new Set(BATTLE_COUNTERMEASURE_DEFINITIONS.map(a=>a.id));
assert.ok(types.size>=18);
for(const scenario of BATTLE_SITUATION_DEFINITIONS){
 assert.ok(scenario.actions.length>=1,scenario.id);
 for(const action of scenario.actions)assert.ok(types.has(action),
  scenario.id+' references unregistered action '+action);
}
assert.ok(TACTIC_DEFINITIONS.every(t=>t.routeAuthority==='prebattle_strategy'));
assert.ok(TACTIC_DEFINITIONS.every(t=>t.changesRouteDuringCombat===false));
assert.ok(BATTLE_COUNTERMEASURE_DEFINITIONS.every(a=>a.changesRoute===false));
assert.ok(BATTLE_COUNTERMEASURE_DEFINITIONS.filter(a=>a.status==='planned')
 .every(a=>!validateResponseIsNotRoute(a)));
assert.ok(BATTLE_COUNTERMEASURE_DEFINITIONS.filter(a=>a.status==='supported')
 .every(validateResponseIsNotRoute));
assert.equal(countermeasureById('summon_rescue').status,'planned');
assert.equal(countermeasureById('summon_vanguard').status,'planned');
assert.equal(countermeasureById('burn_building').status,'supported');

const mage={id:1,team:0,jobId:'mage',squadId:'0',hp:55,maxHp:100,x:5,z:5};
const priest={id:2,team:0,jobId:'priest',squadId:'1',hp:95,maxHp:100,x:6,z:5};
const enemy={id:3,team:1,jobId:'sword',squadId:'0',hp:100,maxHp:100,x:25,z:5};
const house={id:'house1',category:'structure',team:1,type:'building',hp:100,maxHp:100,alive:true,x:22,z:6};
const door={id:'door1',category:'structure',team:1,type:'door',locked:true,hp:100,maxHp:100,alive:true,x:23,z:5};
const base={members:[mage],units:[mage,priest,enemy],enemySquads:[
 {id:'a',mode:'charge',soldiers:10},{id:'b',mode:'charge',soldiers:10}
],structures:[house,door],
 objective:objectiveForStage({kind:'defend'}),massBattle:true,
 commanderAlive:true,squadCenter:{x:5,z:5},elapsedSeconds:14};
const options=getCountermeasureOptions(base);
assert.ok(options.activeSituations.some(s=>s.id==='rushing'));
assert.ok(options.options.filter(o=>o.enabled).length>=3,'multiple countermeasure buttons');
const burning=options.options.find(o=>o.id==='burn_building');
assert.ok(burning.enabled,'Mage can burn an actual enemy structure');
assert.equal(burning.type,'burn_building');
assert.equal(burning.target.targetId,'house1');
assert.equal(burning.target.x,22);
assert.equal(burning.changesRoute,false);
const ninja={...mage,id:8,jobId:'ninja'};
const ninjaOptions=getCountermeasureOptions({...base,members:[ninja],units:[ninja,priest,enemy],
 signals:['enemy_building']});
assert.ok(ninjaOptions.options.find(o=>o.id==='demolish')?.enabled,
 'Ninja can demolish an actual structure');
assert.equal(getCountermeasureOptions({...base,members:[priest],units:[priest,enemy]}).
 options.find(o=>o.id==='burn_building')?.enabled,false,
 'Priest cannot burn a building');
const thief={...mage,id:11,jobId:'thief'};
const thieves=getCountermeasureOptions({...base,members:[thief],units:[thief,mage,enemy]});
assert.ok(thieves.options.find(o=>o.id==='unlock_door')?.enabled);
const noTarget=getCountermeasureOptions({...base,structures:[]});
assert.ok(!noTarget.options.find(o=>o.id==='burn_building')?.enabled);
const healing=getCountermeasureOptions({...base,signals:['wounded_with_priest']});
assert.ok(healing.options.find(o=>o.id==='heal')?.enabled);
assert.equal(getCountermeasureOptions({...base,units:[mage,enemy],
 signals:['wounded_with_priest']}).options.find(o=>o.id==='heal')?.enabled,false);

const flying={id:'dragon1',team:0,category:'summon',type:'dragon',
 flying:true,hp:80,maxHp:80,alive:true,x:5,z:5};
const summoner={...mage,id:20,jobId:'summoner'};
const rescue=getCountermeasureOptions({...base,members:[summoner],
 units:[summoner,priest,enemy],structures:[...base.structures,flying],
 signals:['ally_rooftop_isolated','summon_ready']});
const rescueChoice=rescue.options.find(o=>o.id==='summon_rescue');
assert.ok(rescueChoice);
assert.equal(rescueChoice.enabled,false,'Do not activate unimplemented airborne extraction');
assert.equal(rescueChoice.status,'planned');
assert.equal(rescue.options.find(o=>o.id==='summon_vanguard').enabled,false);
assert.ok(rescue.options.some(o=>o.enabled),'still offer existing counterorders');

assert.ok(!scanBattleSignals({...base}).has('night_visibility'),
 'Do not invent night/weather state from missing telemetry');
assert.ok(scanBattleSignals({...base,signals:['night_visibility']}).has('night_visibility'));
const noCommander=getCountermeasureOptions({...base,commanderAlive:false});
assert.ok(noCommander.options.every(o=>!o.enabled));
const noMass=getCountermeasureOptions({...base,signals:['enemy_commander'],
 units:[...base.units,{...enemy,id:4,isStrategist:true}],
 massBattle:false});
assert.equal(noMass.options.find(o=>o.id==='focus_commander').enabled,false);
assert.ok(getCountermeasureOptions({members:[mage],units:[mage],structures:[]}).options.length>=4,
 'Unknown situation still offers standard tactical options');
for(const kind of ['defend','capture','siege']){
 const win=evaluateBattleObjective(objectiveForStage({kind}),{
  allyAlive:10,enemyAlive:0,elapsedSeconds:30});
 assert.equal(win.winnerTeam,0);
}

const html=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
for(const expected of ['getCountermeasureOptions(', 'BATTLE_SITUATION_DEFINITIONS.length',
 '🎯 状況別の複数対抗号令', 'validateResponseIsNotRoute(option)',
 "option.channel==='mission'", "option.channel==='support'",
 "issueSquadOrder('mission',{...point,type:option.type})"])
 assert.ok(html.includes(expected),expected);
const match=html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
assert.ok(match);
const syntax=spawnSync(process.execPath,['--check','--input-type=module'],
 {input:match,encoding:'utf8',timeout:30000});
assert.equal(syntax.status,0,syntax.stderr);
console.log('PASS all coded situations and countermeasure availability, options, UI, route ownership and supported/planned boundary');
