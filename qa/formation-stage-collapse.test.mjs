import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SourceTextModule} from 'node:vm';
import {createNewGame} from '../src/game-core-flow.js';
import {CAMPAIGN_STAGE_BY_ID,stageDeploymentLimit} from '../src/campaign-stage-plan.js';
import {makeCoreBattleRequest} from '../src/core-battle-bridge.js';
import {formationStillIntact,brokenFormationGroups} from '../src/battle-formation-integrity.js';
import {
 ensureSortiePlan,sortieSquadCap,sortieAllowedCells,sortieTeams,sortieFormationBuff,
 sortieFormationStatus,setSortieFormation,setSortieGridCell,allocateThreeTeamSortie
} from '../src/three-team-sortie.js';
import {renderThreeTeamPlanner} from '../src/three-team-sortie-ui.js';

const stage2=CAMPAIGN_STAGE_BY_ID['c01-s02'],stage3=CAMPAIGN_STAGE_BY_ID['c01-s03'];
assert.equal(stageDeploymentLimit(CAMPAIGN_STAGE_BY_ID['c01-s01']),0);
assert.equal(stageDeploymentLimit(stage2),40);
assert.equal(stageDeploymentLimit(stage3),41);
assert.equal(stage2.deploymentLimit,40);
const game=createNewGame('レベルと職業付き陣形枠');
ensureSortiePlan(game);
game.sortieTestLevel=1;
assert.equal(sortieSquadCap(game),4);
assert.equal(sortieAllowedCells(game,1).length,4);
assert.equal((renderThreeTeamPlanner({game,teamId:1}).match(/data-sortie-state="locked"/g)||[]).length,12,
 'preset formation at level 1 must lock twelve cells');
assert.throws(()=>setSortieGridCell(game,1,15,1),/固定配置/,
 'manual job placement outside a preset formation is prohibited');
assert.throws(()=>setSortieGridCell(game,1,6,1),/固定配置/,
 'a knight cannot be assigned to a support role');
game.sortieTestLevel=7;
assert.equal(sortieSquadCap(game),5,'seventh level unlocks fifth contingent');
assert.equal(sortieAllowedCells(game,1).length,4,'four primary cells are selectable until the fifth contingent is needed');
game.sortieTestLevel=99;
assert.equal(sortieSquadCap(game),16);
const extended=createNewGame('五隊陣形');
extended.campaign.squads.push(
 {id:3,job:'魔法使い',rarity:'N',count:8,commanderId:'player'},
 {id:4,job:'忍者',rarity:'N',count:8,commanderId:'player'},
 {id:5,job:'シーフ',rarity:'N',count:8,commanderId:'player'},
 {id:6,job:'盾騎士',rarity:'N',count:8,commanderId:'player'},
 {id:7,job:'格闘家',rarity:'N',count:8,commanderId:'player'});
extended.sortieTestLevel=7;
ensureSortiePlan(extended);
assert.equal(sortieSquadCap(extended),5);
assert.equal(sortieTeams(extended)[0].slots.filter(Boolean).length,4,
 'the default four-slot preset never auto-expands at higher levels');
setSortieFormation(extended,1,'spear');
assert.equal(sortieTeams(extended)[0].slots.filter(Boolean).length,5,
 'the fixed Lv7 spear preset has exactly five job-role cells');
assert.equal(sortieAllowedCells(extended,1).length,5,
 'at level 7 a filled four-role preset opens its fifth deployment cell');
assert.equal(sortieFormationStatus(extended,1).valid,true,
 'the fifth contingent may use an unlocked reinforcement cell while retaining the four role anchors');

for(const teamId of [2,3]){
 setSortieFormation(game,teamId,'free');
 setSortieGridCell(game,teamId,teamId===2?15:12,1);
 assert.equal(sortieTeams(game)[teamId-1].formation,'free');
 assert.equal(sortieAllowedCells(game,teamId).length,16);
 assert.deepEqual(sortieFormationBuff(game,teamId),{attack:0,defense:0,mobility:0,healing:0});
 assert.equal(sortieFormationStatus(game,teamId).valid,false);
}
assert.equal(game.sortiePlan.teams.reduce((n,t)=>n+(t.counts['1']||0),0),30,
 'free placement in squads 2 and 3 moves, never clones, troops');
const page=renderThreeTeamPlanner({game,teamId:3,view:'templates',templatePage:2});
assert.match(page,/data-sortie-formation="free"/);
assert.match(renderThreeTeamPlanner({game,teamId:2}),/自由陣形/);
const mainUnits=game.sortiePlan.teams.reduce((n,t)=>n+Object.values(t.counts).reduce((a,b)=>a+b,0),0);
assert.equal(mainUnits,40);
game.location='map';
const deployment=makeCoreBattleRequest(game,stage2.id,'stage-cap-2');
assert.equal(deployment.units.length,40);
assert.equal(deployment.deploymentLimit,40);
assert.equal(deployment.formationIntegrity['2'].active,false);
assert.equal(deployment.formationIntegrity['3'].active,false);

const large=createNewGame('ステージ別出撃数');
large.campaign.squads[0].count=100;
large.campaign.squads.push(
 {id:3,job:'魔法使い',rarity:'N',count:10,commanderId:'player'},
 {id:4,job:'忍者',rarity:'N',count:10,commanderId:'player'});
ensureSortiePlan(large);
assert.equal(allocateThreeTeamSortie(large,stage2).reduce((n,x)=>n+x.count,0),40);
assert.equal(allocateThreeTeamSortie(large,stage3).reduce((n,x)=>n+x.count,0),40,
 'stage 3 allows 41 but must not fabricate one soldier absent from the existing 40-person deployment plan');
large.location='map';
const req=makeCoreBattleRequest(large,stage2.id,'stage-limit');
assert.equal(req.units.length,40,'stage cap must be applied before battle request generation');
assert.equal(req.formationIntegrity['1'].active,true);
const fragile=makeCoreBattleRequest(large,stage2.id,'understaffed');
assert.equal(fragile.formationIntegrity['1'].requiredSources.length,4);
const spec=fragile.formationIntegrity['1'];
const live=fragile.units.map(u=>({...u,team:0,alive:true,defeated:false,hp:1}));
assert.equal(formationStillIntact({...spec,groupId:'1'},live),true);
const lost=live.filter(u=>String(u.sourceSquadId)!==String(spec.requiredSources[1]));
assert.equal(formationStillIntact({...spec,groupId:'1'},lost),false,
 'losing a required job contingent breaks formation regardless of remaining numbers');
assert.deepEqual(brokenFormationGroups({'1':spec},lost),['1']);
assert.deepEqual(brokenFormationGroups({'1':spec},lost,new Set(['1'])),[],
 'one already-broken formation must not trigger again');
assert.equal(formationStillIntact({...spec,groupId:'1'},live.slice(0,1)),false,
 'fewer than half the deployed troops means formation collapse');

const battle=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
assert.match(battle,/updateBattleFormationIntegrity/);
assert.match(battle,/brokenFormationGroups\(storyRequest\.formationIntegrity,actors,brokenFormations\)/);
assert.match(battle,/a\.job=\{\.\.\.a\.job,damage:base\.damage,hp:base\.hp,speed:base\.speed\}/);
assert.match(battle,/storyRequest\.formationBonuses\[groupId\]=\{attack:0,defense:0,mobility:0,healing:0\}/);
for(const file of ['src/battle-formation-integrity.js','src/three-team-sortie.js','src/three-team-core-bridge.js']){
 new SourceTextModule(readFileSync(new URL('../'+file,import.meta.url),'utf8'),{identifier:file});
}
console.log('PASS: 4->5->16 preset slots by level; free formation in groups 2/3; staged 40/41 unit limits; broken formation revokes buffs');
