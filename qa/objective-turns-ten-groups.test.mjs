import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SourceTextModule} from 'node:vm';
import {createNewGame} from '../src/game-core-flow.js';
import {ensureSortiePlan,sortieTeams,sortieTeamCount,SORTIE_TEAM_IDS,
 SORTIE_GRID_CELLS,SORTIE_FORMATION_CELLS,sortiePlanningLimit} from '../src/three-team-sortie.js';
import {makeCoreBattleRequest} from '../src/core-battle-bridge.js';
import {armyGroups} from '../src/army-groups.js';
import {threeGroupOverview} from '../src/battle-three-group-hierarchy.js';
import {OBJECTIVE_TURN_GOALS,TURN_MOVE_OPTIONS,TURN_ACTION_OPTIONS,createObjectiveTurnEngine} from '../src/battle-objective-turns.js';

assert.deepEqual(SORTIE_TEAM_IDS,Array.from({length:10},(_,i)=>i+1));
assert.equal(OBJECTIVE_TURN_GOALS.length,5);
assert.ok(TURN_MOVE_OPTIONS.some(x=>x.id==='building'));
assert.ok(TURN_MOVE_OPTIONS.some(x=>x.id==='bridge_front'));
assert.ok(TURN_MOVE_OPTIONS.some(x=>x.id==='rear'));
assert.ok(TURN_ACTION_OPTIONS.some(x=>x.id==='ranged'));
assert.equal(SORTIE_GRID_CELLS,16);
assert.equal(SORTIE_FORMATION_CELLS.balanced.length,16);
const game=createNewGame('十部隊・陣形継承');
ensureSortiePlan(game);
const existing=JSON.stringify(game.sortiePlan.teams[0]);
assert.equal(sortieTeams(game).length,10);
assert.equal(armyGroups(game.campaign).length,10);
ensureSortiePlan(game);
assert.equal(JSON.stringify(game.sortiePlan.teams[0]),existing,
 're-normalizing does not replace an existing 4x4 formation');
assert.equal(game.sortiePlan.teams.reduce((n,g)=>n+sortieTeamCount(g),0)<=sortiePlanningLimit(game),true);
game.location='map';
const request=makeCoreBattleRequest(game,'c01-s02','ten-group-turn-test');
assert.ok(request.units.length>0);
assert.ok(request.sortieTeamCount>=1&&request.sortieTeamCount<=10);
assert.ok(request.units.every(u=>Number(u.armyGroupId)>=1&&Number(u.armyGroupId)<=10));
const summary=threeGroupOverview(
 [{team:0,squadId:'2',armyGroupId:10,hp:80,maxHp:100,alive:true}],
 {'2':10},[]);
assert.equal(summary.length,10);
assert.equal(summary[9].alive,1);
const hpSummary=threeGroupOverview([
 {team:0,squadId:'2',armyGroupId:10,hp:40,maxHp:100,alive:true},
 {team:0,squadId:'2',armyGroupId:10,hp:0,maxHp:100,alive:false}
],{'2':10},[]);
assert.equal(hpSummary[9].hp,40);
assert.equal(hpSummary[9].initialMaxHp,200,'total HP denominator retains the fallen soldiers');
// The retired objective-turn model is kept as legacy data, not used by combat.
const battleHtml=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
assert.match(battleHtml,/createRealtimeBattleCommands/);
assert.match(battleHtml,/const objectiveTurnUI=null/);
assert.match(battleHtml,/realtimeCommandUI\?\.openDeployment\(\)/);
assert.doesNotMatch(battleHtml,/objectiveTurnUI\.begin\(\)/);
for(const path of ['src/battle-objective-turns.js','src/battle-objective-turn-panel.js',
 'src/army-groups.js','src/battle-three-group-hierarchy.js','src/battle-three-group-panel.js',
 'src/three-team-sortie.js','src/three-team-core-bridge.js']){
 new SourceTextModule(readFileSync(new URL('../'+path,import.meta.url),'utf8'),{identifier:path});
}
const html=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
assert.doesNotMatch(html,/installObjectiveTurnPanel/);
assert.match(html,/createRealtimeBattleCommands/);
assert.match(html,/const objectiveTurnUI=null/);
assert.match(html,/realtimeCommandUI\?\.openDeployment\(\)/);
assert.match(html,/onMove:\(id,point\)=>/);
assert.match(html,/getBattleRealtimeQA/);
console.log('PASS: ten inherited sortie formations preserved; the battle now opens one-time deployment and continuous orders');
