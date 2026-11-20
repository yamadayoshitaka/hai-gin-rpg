import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {bridgeSafetySnapshot} from '../src/battle-bridge-safety.js';
import {CombatActionRuntime} from '../src/combat-action-runtime.js';
import {availableCombatSkills} from '../src/combat-action-spec.js';
import {MassBattleGridSimulation} from '../src/mass-battle-grid-sim.js';

test('every summoner can call a separate familiar in the same squad',()=>{
 const width=64,walkable=new Uint8Array(width*width).fill(1);
 const runtime=new CombatActionRuntime({width,height:width,walkable});
 const casters=[0,1,2].map((id)=>({id,team:0,squadId:'one',jobId:'summoner',
  rarity:'N',x:10+id*3,z:12,hp:100,maxHp:100,mp:100,maxMp:100,alive:true,cooldown:0}));
 const skill=availableCombatSkills('summoner','N').find(s=>s.id==='call_wolf');
 assert.ok(skill);
 for(const caster of casters)assert.equal(runtime.fireSkill(caster,skill,caster,casters),true);
 assert.equal(runtime.getStats().summons,3);
 for(const caster of casters)assert.equal(runtime.summonOf(caster).length,1);
 const owners=new Set(runtime.objects.filter(o=>o.category==='summon').map(o=>o.ownerId));
 assert.deepEqual([...owners].sort(),[0,1,2]);
 assert.equal(runtime.fireSkill(casters[1],skill,casters[1],casters),false,'skill cooldown is preserved');
});

test('mass squad summon fills all free owner slots without resummoning existing ones',()=>{
 const width=232,walkable=new Uint8Array(width*width).fill(1);
 const sim=new MassBattleGridSimulation(50,20261120,{width,height:width,walkable,bridges:[],riverXAt:()=>116});
 const first=sim.units.find(u=>u.team===0&&u.jobId==='summoner'&&!u.isStrategist);
 assert.ok(first);
 const second=sim.units.find(u=>u.team===0&&u.squadId===first.squadId&&u.id!==first.id&&!u.isStrategist);
 assert.ok(second);
 second.jobId='summoner';first.mp=100;second.mp=100;
 assert.equal(sim.summonSquadCreature(first.squadId,0),true);
 assert.equal(sim.actions.summonOf(first).length,1);
 assert.equal(sim.actions.summonOf(second).length,1);
 assert.equal(sim.summonSquadCreature(first.squadId,0),false,'repeat order preserves both summoned familiars');
});

test('bridge safety checks actual deck cells, HP and fire before offering retreat',()=>{
 const wood={id:'world-bridge-0',type:'bridge',category:'structure',alive:true,
  maxHp:260,hp:80,fireDamagePerSecond:18,burningUntil:0,
  bounds:{minX:10,maxX:18,minZ:20,maxZ:20}};
 const defs=new Map([['world-bridge-0',{source:{type:'timber',cells:new Set(['12,20','13,20'])}}]]);
 const units=[{id:1,team:0,squadId:'A',x:12,z:20,alive:true,hp:80},
  {id:2,team:0,squadId:'B',x:14,z:20,alive:true,hp:80},
  {id:3,team:1,squadId:'enemy',x:13,z:20,alive:true,hp:80}];
 let [result]=bridgeSafetySnapshot([wood],defs,units,10);
 assert.equal(result.danger,true);
 assert.deepEqual(result.affectedSquads,['A'],'do not retreat squads merely near the bridge');
 assert.equal(result.name,'木橋');
 wood.hp=250;
 [result]=bridgeSafetySnapshot([wood],defs,units,10);
 assert.equal(result.danger,false);
 assert.deepEqual(result.affectedSquads,[]);
 wood.burningUntil=42;
 [result]=bridgeSafetySnapshot([wood],defs,units,10);
 assert.equal(result.caution,true);
 wood.hp=180;
 [result]=bridgeSafetySnapshot([wood],defs,units,10);
 assert.equal(result.danger,true,'imminent burn collapse raises alarm before HP threshold');
 wood.alive=false;wood.hp=0;
 [result]=bridgeSafetySnapshot([wood],defs,units,10);
 assert.equal(result.collapsed,true);
 assert.deepEqual(result.affectedSquads,[]);
});

test('live bridge display and emergency retreat are connected to the battle UI',()=>{
 const html=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
 assert.match(html,/bridgeSafetySnapshot\(/);
 assert.match(html,/bridgeEvacuateButton\.addEventListener\('click'/);
 assert.match(html,/issueIndividualSquadOrder\('retreat',null,true\)/);
});
