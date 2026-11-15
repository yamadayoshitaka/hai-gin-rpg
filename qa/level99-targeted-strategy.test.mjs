import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SourceTextModule} from 'node:vm';
import {createNewGame} from '../src/game-core-flow.js';
import {CAMPAIGN_STAGE_BY_ID} from '../src/campaign-stage-plan.js';
import {makeCoreBattleRequest} from '../src/core-battle-bridge.js';
import {MassBattleGridSimulation} from '../src/mass-battle-grid-sim.js';
import {ensureSortiePlan,sortieSquadCap,unlockedSortieFormations,setSortieFormation,
 sortieFormationBuff,setSortieDivisions,sortieTeams,sortieTeamSquads,
 SORTIE_FORMATIONS,sortieLevel} from '../src/three-team-sortie.js';
const stage=CAMPAIGN_STAGE_BY_ID['c01-s02'],game=createNewGame('99級作戦');
ensureSortiePlan(game);
assert.equal(sortieLevel(game),99,'battle preview uses temporary level 99');
assert.equal(sortieSquadCap(game),16);
assert.equal(unlockedSortieFormations(game).length,14);
setSortieFormation(game,1,'constellation');
assert.equal(sortieFormationBuff(game,1).attack,.25);
assert.equal(sortieFormationBuff(game,1).defense,.22);
setSortieDivisions(game,1,1,3);
game.location='map';
const req=makeCoreBattleRequest(game,stage.id,'preview-99');
assert.equal(req.sortieLevel,99);
assert.equal(req.commanders[0].level,99);
assert.equal(req.units.length,40,'dividing does not duplicate soldiers');
const divided=req.units.filter(u=>u.sourceSquadId===1);
assert.equal(new Set(divided.map(u=>u.squadId)).size,3);
assert.equal(divided.length,30);
assert.ok(divided.every(u=>u.formationBuff.attack===.25));
assert.ok(divided.every(u=>u.armyGroupId===1));
assert.equal(divided.filter(u=>u.isStrategist).length,1,'only the main retains the protagonist');
assert.equal(new Set(req.units.filter(u=>u.teamMainLeader).map(u=>u.squadId)).size,1,
 'a group has precisely one main squad even across several jobs');
assert.ok(req.units.find(u=>u.isStrategist).teamMainLeader,'the protagonist stays with the main');
assert.equal(Object.values(req.subdivisionMap).filter(row=>row.leaderHeldInMain).length,1);
assert.equal(Object.keys(req.subdivisionMap).length,4,'3 knight platoons and 1 priest platoon');
const strong=req.units.find(u=>u.sourceSquadId===1);
assert.ok(strong.equipmentBuff.attack>=.25,'formation bonus is applied in the authoritative battle request');

const low=createNewGame('初級');
low.sortieTestLevel=1;
for(let i=3;i<=19;i++)low.campaign.squads.push({id:i,job:'忍者',rarity:'N',count:2,commanderId:'player'});
ensureSortiePlan(low);
assert.equal(sortieSquadCap(low),4);
assert.equal(unlockedSortieFormations(low).length,3);
assert.throws(()=>setSortieFormation(low,1,'constellation'),/レベル/);
assert.equal(sortieTeams(low)[0].slots.filter(Boolean).length,4);
assert.equal(sortieTeams(low)[1].slots.filter(Boolean).length,4);
low.sortieTestLevel=99;
ensureSortiePlan(low);
assert.equal(sortieSquadCap(low),16);
// Existing assigned squads persist when the test level is changed; no troop cloning.
assert.ok(sortieTeams(low).reduce((n,t)=>n+Object.values(t.counts).reduce((a,b)=>a+b,0),0)<=
 low.campaign.squads.reduce((n,s)=>n+s.count,0));

const sim=Object.create(MassBattleGridSimulation.prototype);
sim.time=10;
sim.units=[{team:0,squadId:1,alive:true},{team:1,squadId:2,alive:true}];
sim.squadDebuffs=new Map();
assert.equal(sim.applySquadDebuff(2,'attack',.2,15,1),true);
assert.equal(sim.applySquadDebuff(2,'defense',.15,15,1),true);
assert.equal(sim.applySquadDebuff(2,'speed',.18,15,1),true);
assert.equal(sim._squadDebuff(sim.units[1],'attack'),.2);
assert.equal(sim._squadDebuff(sim.units[1],'speed'),.18);
assert.equal(sim._debuffDamage(sim.units[1],sim.units[0],100),80,'enemy attack drops by 20%');
assert.equal(sim._debuffDamage(sim.units[0],sim.units[1],100),115,'enemy defense drops by 15%');
sim.time=26;
assert.equal(sim._squadDebuff(sim.units[1],'attack'),0,'debuff expires');
assert.equal(sim.applySquadDebuff(2,'unknown',.3,10,1),false);

for(const path of ['src/targeted-strategy-runtime.js','src/three-team-sortie.js',
 'src/three-team-sortie-ui.js','src/three-team-core-bridge.js','src/mass-battle-grid-sim.js',
 'src/mass-battle-worker-client.js','src/mass-battle-worker-runtime.js']){
 new SourceTextModule(readFileSync(new URL('../'+path,import.meta.url),'utf8'),{identifier:path});
}
const battle=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
assert.match(battle,/createTargetedStrategyUi/);
assert.match(battle,/issueTargetedPlan/);
assert.match(battle,/issueTargetedMapCommand/);
assert.match(battle,/massWorker\?\.applySquadDebuff/);
assert.match(battle,/targetedEnemyQueues/);
const worker=readFileSync(new URL('../src/mass-battle-worker-runtime.js',import.meta.url),'utf8');
assert.match(worker,/case 'squadDebuff'/);
const ui=readFileSync(new URL('../src/targeted-strategy-runtime.js',import.meta.url),'utf8');
assert.ok(!ui.includes('<select'),'targeting remains tap-based');
console.log('PASS Lv99: unlocked formations, 16-squad cap, platoon splits, main leader, all-group buffs, debuffs, real strategy planner');
