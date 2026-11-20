import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {CombatActionRuntime} from '../src/combat-action-runtime.js';
import {availableCombatSkills,COMBAT_RULES} from '../src/combat-action-spec.js';
import {MassBattleGridSimulation} from '../src/mass-battle-grid-sim.js';
import {snapshotMassStats,applyMassStats} from '../src/mass-battle-worker-protocol.js';

test('summon -> attack spawns a real familiar and chases the selected enemy squad beyond ordinary aggro',()=>{
 const size=100,walkable=new Uint8Array(size*size).fill(1);
 const actions=new CombatActionRuntime({width:size,height:size,walkable});
 const caster={id:0,team:0,squadId:'summoners',jobId:'summoner',rarity:'N',
  x:12,z:20,hp:100,maxHp:100,mp:100,maxMp:100,alive:true,cooldown:0};
 const enemy={id:1,team:1,squadId:'enemy-3',jobId:'sword',rarity:'N',
  x:67,z:20,hp:800,maxHp:800,mp:0,maxMp:0,alive:true,cooldown:0};
 const units=[caster,enemy];
 const sectors=()=>new Map(units.filter(u=>u.alive).map(u=>[
   Math.floor(u.x/5)+':'+Math.floor(u.z/5),[u]
 ]));
 actions.beginTick(.1,units,{sectors:sectors()});
 const spell=availableCombatSkills('summoner','N').find(s=>s.id==='call_wolf');
 assert.ok(spell,'a normal-rarity summoner has a real creature spell');
 assert.equal(actions.fireSkill(caster,spell,caster,units),true);
 assert.equal(actions.getStats().summons,1,'manual command really creates a live world object');
 const summoned=actions.summonOf(caster)[0],spawnX=summoned.x;
 assert.ok(Math.hypot(enemy.x-summoned.x,enemy.z-summoned.z)>
   COMBAT_RULES.summonLeashTiles+summoned.spec.range,'enemy starts beyond autonomous tracking range');
 assert.equal(actions.commandSummonAttack('summoners','enemy-3',units,0),true);
 assert.equal(summoned.commandTargetSquadId,'enemy-3');
 let moved=false,hit=false;
 for(let i=0;i<360;i++){
   actions.beginTick(.1,units,{sectors:sectors()});
   if(summoned.x!==spawnX)moved=true;
   if(enemy.hp<enemy.maxHp){hit=true;break;}
 }
 assert.ok(moved,'summon moves toward the distant nominated squad');
 assert.ok(hit,'summon actually damages the nominated living enemy');
 assert.equal(actions.commandSummonAttack('summoners','missing',units,0),false);
});

test('mass/worker squad summoning keeps explicit attack target in the snapshot',()=>{
 const size=232,walkable=new Uint8Array(size*size).fill(1);
 const make=()=>new MassBattleGridSimulation(50,20261120,{
   width:size,height:size,walkable:walkable.slice(),bridges:[],riverXAt:()=>116
 });
 const sim=make();
 const caster=sim.units.find(u=>u.team===0&&!u.isStrategist&&u.jobId==='summoner');
 const enemy=sim.units.find(u=>u.team===1&&u.alive);
 assert.ok(caster&&enemy,'both teams have live troops including a summoner');
 caster.mp=COMBAT_RULES.maxMp;
 assert.equal(sim.summonSquadCreature(caster.squadId,0),true,'one familiar is actually spawned');
 assert.equal(sim.commandSquadSummonAttack(caster.squadId,enemy.squadId,0),true);
 const live=sim.actions.objects.find(o=>o.alive&&o.category==='summon'&&
   o.team===0&&String(o.squadId)===String(caster.squadId));
 assert.ok(live,'real active summon object exists');
 assert.equal(live.commandTargetSquadId,String(enemy.squadId));
 const mirror=make();
 applyMassStats(mirror,snapshotMassStats(sim));
 const copied=mirror.actions.objects.find(o=>o.id===live.id);
 assert.ok(copied,'worker state transfers the summoned creature to the visible mirror');
 assert.equal(copied.commandTargetSquadId,String(enemy.squadId));
});

test('special command UI wires both 50v50 and Worker 1000v1000 to creature orders',()=>{
 const html=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
 const worker=readFileSync(new URL('../src/mass-battle-worker-runtime.js',import.meta.url),'utf8');
 const client=readFileSync(new URL('../src/mass-battle-worker-client.js',import.meta.url),'utf8');
 assert.match(html,/massSim\.commandSquadSummonAttack\(id,target\.squadId,0\)/);
 assert.match(html,/skirmishActions\.commandSummonAttack\(id,target\.squadId,actors,0\)/);
 assert.match(html,/massWorker\.commandSquadSummonAttack\(id,target\.squadId,0\)/);
 assert.match(worker,/case 'squadSummonAttack'/);
 assert.match(client,/type:'squadSummonAttack'/);
});
