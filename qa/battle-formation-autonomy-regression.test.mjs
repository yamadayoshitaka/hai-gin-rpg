import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {MassBattleGridSimulation} from '../src/mass-battle-grid-sim.js';
import {CombatActionRuntime} from '../src/combat-action-runtime.js';
import {chooseEnemyOrder,enemyContactResponse} from '../src/battle-tactical-policy.js';
import {shouldCounterNearbyThreat} from '../src/battle-defensive-doctrine.js';

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
// Keep the test deterministic: this is the sole MP-capable priest.
for(const u of sim.units)if(u.team===0&&u.jobId==='priest'&&u!==priest)u.mp=0;
const beforeHp=patient.hp;
const beforeMp=priest.mp;
assert.equal(sim.setSquadCommand(priest.squadId,'hold'),true);
const formation=priest.formationType;
assert.notEqual(sim.squadCommands.get(String(priest.squadId)),'heal',
 'No explicit healing command should be required');
let healed=false,spellEvent=false;
for(let step=0;step<280;step++){
 sim.step(.1);
 if(sim.actionEvents.some(e=>e.type==='groupHeal'&&e.sourceId===priest.id))spellEvent=true;
 if(patient.hp>beforeHp&&spellEvent){healed=true;break;}
}
assert.ok(spellEvent,'The watched priest must cast a real healing spell');
assert.ok(healed,'A priest on hold should autonomously restore actual wounded HP');
assert.equal(priest.formationType,formation,'Healing must preserve the inn formation');
assert.equal(sim.squadCommands.get(String(priest.squadId)),'hold',
 'Healing must not overwrite the command');
assert.ok(priest.mp<beforeMp,'Real healing consumes MP');

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

const hostile=[{id:1,team:1,x:31,z:33,hp:50,maxHp:100,alive:true,jobId:'knight'}];
const invasion=[{id:2,team:0,x:35,z:35,hp:75,maxHp:100,alive:true,jobId:'sword'}];
const contact=enemyContactResponse('defend','defend',hostile,invasion);
assert.equal(contact.inContact,true);
assert.equal(contact.counter,true);
assert.equal(contact.mode,'charge','guarding enemies counterattack when attacked nearby');
assert.equal(enemyContactResponse('defend','retreat',hostile,invasion).mode,'retreat',
 'near-dead enemies must retain their tactical escape option');
assert.equal(enemyContactResponse('defend','defend',hostile,
 [{...invasion[0],x:46,z:33}]).mode,'charge',
 'a live opponent twelve tiles away must wake a guarding enemy without waiting 120 seconds');
assert.equal(enemyContactResponse('hold','defend',hostile,
 [{...invasion[0],x:47,z:33}]).mode,'charge',
 'sixteen-tile guard contact also applies to a waiting enemy');
assert.equal(enemyContactResponse('defend','retreat',hostile,
 [{...invasion[0],x:46,z:33}]).mode,'retreat',
 'contact must not override emergency retreat for near-dead enemies');
assert.equal(enemyContactResponse('defend','defend',hostile,
 [{...invasion[0],x:95,z:95}]).mode,'defend',
 'a distant foe does not pull defensive troops away from their post');
assert.equal(enemyContactResponse('charge','explore',hostile,invasion).mode,'charge',
 'hostile combat AI must not diverge into irrelevant building exploration');
const runtimeSource=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
assert.match(runtimeSource,/setStartingSquadOrder\(1,sid,'charge'\)/,
 'enemy squads receive a real combat start command');
assert.match(runtimeSource,/pendingOpeningFormationGroups\.add/,
 'an eligible inn formation starts its own movement on battle opening');
assert.match(runtimeSource,/issueFormationSignature\(\{groupId:group,squadIds:members,automaticOpening:true\}\)/,
 'the inn-authored movement sequence executes rather than remaining a static preview');
assert.match(runtimeSource,/const threatened=enemyContactResponse\(/,
 'nearby hostile contact bypasses the stale 120-second defensive order cooldown');
assert.match(runtimeSource,/massSim\?\.enemySquadCommands\?\.get\(String\(id\)\)/,
 'enemy strategic AI reads the executed order rather than an outdated opening command');
assert.match(runtimeSource,/automaticOpening:true/,
 'eligible opening formations launch without a manual-order cooldown');
assert.match(runtimeSource,/squadRoster\.some\(a=>a\.team===0/,
 'formation waypoints use authoritative living squads, not only visible detail rigs');


console.log('PASS formation-aware priest triage, MP cost, preserved hold order, bridge and enemy AI contracts');

const nearbyPolicy=shouldCounterNearbyThreat;
assert.equal(nearbyPolicy({order:'hold',enemyDistance:2.7,attackRange:1.2,postDistance:1}),true,
 'A nearby hostile may be intercepted despite a stationary hold order');
assert.equal(nearbyPolicy({order:'defend',enemyDistance:3.1,attackRange:1.2,postDistance:2}),true,
 'Defenders must not be idle against a nearby hostile');
assert.equal(nearbyPolicy({order:'hold',enemyDistance:12,attackRange:1,postDistance:1}),false,
 'Hold never turns into a distant chase');
assert.equal(nearbyPolicy({order:'defend',enemyDistance:2.5,attackRange:1,postDistance:9}),false,
 'Defenders never abandon their post to chase an enemy');
const skirmish=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
const mass=readFileSync(new URL('../src/mass-battle-grid-sim.js',import.meta.url),'utf8');
assert.match(skirmish,/const nearbyCounter=enemy&&shouldCounterNearbyThreat/);
assert.match(skirmish,/if\(order==='hold'&&!nearbyCounter\)/);
assert.match(mass,/const closeThreat=guarding&&nearest&&shouldCounterNearbyThreat/);
assert.match(mass,/const pursuing=\(!reachable\|\|resumeCombat\|\|closeThreat\)/);
