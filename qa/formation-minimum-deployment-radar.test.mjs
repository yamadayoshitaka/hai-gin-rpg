import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SourceTextModule} from 'node:vm';
import {createNewGame} from '../src/game-core-flow.js';
import {CAMPAIGN_STAGE_BY_ID} from '../src/campaign-stage-plan.js';
import {ensureSortiePlan,sortieFormationStatus,sortieFormationBuff,sortieTeams,
 setSortieCount,sortieAllowedCells,sortiePlanningLimit,SORTIE_FORMATIONS,
 SORTIE_FORMATION_CELLS} from '../src/three-team-sortie.js';
import {formationJobMinimums,formationMinimumForRole,FORMATION_MINIMUM_SOLDIERS,
 FORMATION_ROLES} from '../src/sortie-formation-logic.js';
import {makeCoreBattleRequest} from '../src/core-battle-bridge.js';
import {formationStillIntact} from '../src/battle-formation-integrity.js';
const game=createNewGame('陣形の最低ジョブ人数検証');
game.campaign.squads.push(
 {id:3,job:'魔法使い',rarity:'N',count:10,commanderId:'player'},
 {id:4,job:'忍者',rarity:'N',count:10,commanderId:'player'}
);
game.townStage='c01-s01';
ensureSortiePlan(game);
const team=sortieTeams(game)[0];
const minimums=formationJobMinimums(team,game.campaign.squads,
 SORTIE_FORMATION_CELLS,SORTIE_FORMATIONS[team.formation].slots);
assert.equal(minimums.length,4);
assert.ok(minimums.every(x=>x.min>=2&&x.options.length>0));
assert.equal(formationMinimumForRole('front'),3);
assert.equal(formationMinimumForRole('support'),2);
assert.equal(formationMinimumForRole('guard'),3);
assert.equal(formationMinimumForRole('ranged'),2);
assert.equal(formationMinimumForRole('scout'),2);
assert.equal(minimums.reduce((a,b)=>a+b.min,0),9);
assert.ok(minimums.every(x=>x.valid),'auto assignment reserves every mandatory job minimum');
assert.equal(sortieFormationStatus(game,1).valid,true);
assert.equal(sortieFormationBuff(game,1).attack,.04);
const first=minimums[0];
setSortieCount(game,1,Number(first.sourceId),first.min-1);
assert.equal(sortieFormationStatus(game,1).valid,false,'below minimum cancels formation bonuses');
assert.equal(sortieFormationBuff(game,1).attack,0);
assert.match(sortieFormationStatus(game,1).reason,/最低人数/);
setSortieCount(game,1,Number(first.sourceId),first.min);
assert.equal(sortieFormationStatus(game,1).valid,true);
const stage=CAMPAIGN_STAGE_BY_ID['c01-s02'];
assert.equal(sortiePlanningLimit(game),40);
game.location='map';
const request=makeCoreBattleRequest(game,stage.id,'formation-minimum-radar');
const integrity=request.formationIntegrity['1'];
assert.ok(integrity.active,'valid minimum allows battle starting bonus');
assert.equal(Object.keys(integrity.minBySource).length,4);
const units=request.units.filter(u=>u.armyGroupId===1).map(u=>({
 team:0,armyGroupId:u.armyGroupId,sourceSquadId:u.sourceSquadId,
 hp:100,alive:true
}));
assert.equal(formationStillIntact({...integrity,groupId:'1'},units),true);
const chosen=integrity.requiredSources[0],requirement=integrity.minBySource[chosen];
let dropped=0;
const casualties=units.map(u=>{
 if(String(u.sourceSquadId)===chosen&&dropped<1){dropped++;return {...u,hp:0,alive:false};}
 return u;
});
assert.equal(requirement,3);
assert.equal(formationStillIntact({...integrity,groupId:'1'},casualties),false,
 'when a job falls from minimum 3 to 2, buffs collapse in battle');
assert.ok(request.initialSquadOrders);
assert.ok(Object.values(request.initialSquadOrders).every(order=>order==='hold'),
 'initial order selection is retired: everyone starts with neutral hold');
const world=readFileSync(new URL('../world-map.html',import.meta.url),'utf8');
assert.doesNotMatch(world,/id="deploymentRadarBoard"/,'no second world map deployment UI');
assert.doesNotMatch(world,/id="deploymentPicker"/);
assert.match(world,/beginSortie\(stage\)/);
const radar=readFileSync(new URL('../src/battle-realtime-commands.js',import.meta.url),'utf8');
assert.match(radar,/id="realtimeRadarExpand"/);
assert.match(radar,/placedTeams\.add\(group\)/);
assert.match(radar,/requirePrebattleChoices/);
const battleHtml=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
assert.match(battleHtml,/Story mode has already locked its initial positions on the FULL radar/);
assert.match(battleHtml,/if\(storyRequest\?\.sortieTeamCount\|\|directBattlePreview\)\{\s*for\(const id of squadIds\)/,
 'both story sorties and the public 50v50 battle preview skip the old initial orders wizard');
assert.ok(battleHtml.indexOf('Start real-time autonomous combat immediately after loading')<
 battleHtml.indexOf("openingPlan.id='openingSquadStrategies'"),
 'story battle must bypass the old three-screen launch wizard before it exists');
const inn=readFileSync(new URL('../src/three-team-sortie-ui.js',import.meta.url),'utf8');
assert.match(inn,/各ジョブの最低配置人数/);
assert.match(inn,/最低人数/);
assert.match(inn,/formationJobMinimums/);
new SourceTextModule(readFileSync(new URL('../src/sortie-formation-logic.js',import.meta.url),'utf8'),
 {identifier:'sortie-formation-logic.js'});
new SourceTextModule(readFileSync(new URL('../src/three-team-core-bridge.js',import.meta.url),'utf8'),
 {identifier:'three-team-core-bridge.js'});
new SourceTextModule(readFileSync(new URL('../src/battle-formation-integrity.js',import.meta.url),'utf8'),
 {identifier:'battle-formation-integrity.js'});
console.log('PASS: minimum headcount/role, stage deployment, runtime collapse, radar selection and no opening orders');
