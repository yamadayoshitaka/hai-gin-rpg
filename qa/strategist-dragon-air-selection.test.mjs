import assert from 'node:assert/strict';
import fs from 'node:fs';
import {MassBattleGridSimulation,STRATEGIST_STATS} from '../src/mass-battle-grid-sim.js';
import {JOBS} from '../src/mass-battle-sim.js';
import {CombatActionRuntime} from '../src/combat-action-runtime.js';
import {creatureFlightHeight} from '../src/combat-creature-performance.js';
import {DRAGON_SEATED_JOINTS,RIDING_JOINTS,ridingStyleForCreature} from '../src/character-system/riding-pose.js';

const size=232,walkable=new Uint8Array(size*size).fill(1);
const options={width:size,height:size,walkable,
  bridges:[{x:116,z:55},{x:116,z:116},{x:116,z:177}],riverXAt:()=>116};
const battle=new MassBattleGridSimulation(1000,20261106,options);
for(const team of [0,1]){
  const commanders=battle.units.filter(u=>u.team===team&&u.isStrategist);
  assert.equal(commanders.length,10,'each 1000-soldier army has one strategist per squad');
  for(const commander of commanders){
    assert.equal(commander.hp,STRATEGIST_STATS.hp);
    assert.equal(commander.strategistStats.damage,0,'strategist cannot inflict damage');
    const horse=battle.objects.find(o=>o.id===commander.mountId);
    assert.ok(horse?.commanderMount&&horse.mountedBy===commander.id,'strategist begins mounted on a unique ceremonial horse');
    assert.equal(horse.expiresAt,Infinity,'ceremonial horse cannot expire before the battle ends');
    assert.ok(commander.formationForward<0,'strategist starts in the rear formation rank');
  }
}
assert.equal(STRATEGIST_STATS.hp,Math.round(JOBS.reduce((total,j)=>total+j.hp,0)/JOBS.length));
const allied=battle.units.find(u=>u.team===0&&u.isStrategist);
const enemy=battle.units.find(u=>u.team===1&&u.isStrategist);
assert.ok(battle.setSquadMission(allied.squadId,'eliminate_commander',{
  targetSquadId:enemy.squadId,x:enemy.x,z:enemy.z}),'enemy strategist assassination order accepted');
assert.equal(battle.squadMissions.get(String(allied.squadId)).type,'eliminate_commander');
const beforeAttacks=battle.attacks;
for(let i=0;i<4;i++)battle.step(.1);
assert.equal(allied.attackElapsed>=0,true,'strategist remains part of normal simulation clock');
assert.equal(allied.action==='attack',false,'strategist must not engage in battle');
assert.ok(battle.attacks>=beforeAttacks,'other soldiers still fight');
enemy.alive=false;enemy.hp=0;battle._refreshSquadObjectives();
assert.equal(battle.squadMissions.has(String(allied.squadId)),false,'kill-the-strategist order completes when target dies');

const flyingRuntime=new CombatActionRuntime({width:30,height:30,walkable:new Uint8Array(900).fill(1)});
flyingRuntime.registerStructure({id:'roof',x:11,z:10,type:'building',hp:500,
  height:12,bounds:{minX:10,maxX:15,minZ:9,maxZ:12}});
const owner={id:0,x:8,z:10,hp:100,alive:true,team:0},enemySoldier={id:1,x:19,z:10,hp:100,alive:true,team:1};
flyingRuntime.beginTick(.1,[owner,enemySoldier]);
const wyvern=flyingRuntime.spawnObject('wyvern',owner,8,10);
assert.ok(wyvern?.flying);
wyvern.x=10;wyvern.z=10;
assert.equal(flyingRuntime.flightRoofHeight(wyvern.x,wyvern.z),13.5,'castle roof is a valid aerial altitude');
flyingRuntime.beginTick(.1,[owner,enemySoldier]);
assert.ok(wyvern.height>3,'flying creature starts rising toward a roof instead of remaining at ground height');
assert.ok(creatureFlightHeight(wyvern,1)>3,'the renderer sees authoritative flight altitude');
const otherWyvern={...wyvern,id:'another-aircraft',x:11,z:10};
flyingRuntime.objects.push(otherWyvern);
assert.equal(flyingRuntime.airspaceClear(wyvern,11,10),false,'same-level flying creatures block airspace');
otherWyvern.height+=4;
assert.equal(flyingRuntime.airspaceClear(wyvern,11,10),true,'separate flight levels can cross');
assert.equal(flyingRuntime.free(11,10,true),true,'ground building cannot block aerial route');

assert.equal(ridingStyleForCreature('horse'),'straddle');
assert.equal(ridingStyleForCreature('wolf'),'straddle');
assert.equal(ridingStyleForCreature('dragon'),'throne');
assert.equal(ridingStyleForCreature('wyvern'),'throne');
assert.ok(Math.abs(DRAGON_SEATED_JOINTS.thigh_l.splay)<Math.abs(RIDING_JOINTS.thigh_l.splay),
  'throne legs do not straddle a saddle');

const html=fs.readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
assert.match(html,/id="missionTargetAccept"/);
assert.match(html,/id="missionTargetBack"/);
assert.match(html,/showMissionPreview\(mission\)/);
assert.match(html,/clearMissionPreview\(\)/);
assert.match(html,/value="eliminate_commander"/);
console.log('軍師の後列配置・非攻撃・専用軍馬・討伐命令、竜の着座、建物対象確認、屋上空路 PASS');
