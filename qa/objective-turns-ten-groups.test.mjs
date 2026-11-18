import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SourceTextModule} from 'node:vm';
import {createNewGame} from '../src/game-core-flow.js';
import {ensureSortiePlan,sortieTeams,sortieTeamCount,SORTIE_TEAM_IDS,
 SORTIE_GRID_CELLS,SORTIE_FORMATION_CELLS,sortiePlanningLimit} from '../src/three-team-sortie.js';
import {makeCoreBattleRequest} from '../src/core-battle-bridge.js';
import {armyGroups} from '../src/army-groups.js';
import {threeGroupOverview} from '../src/battle-three-group-hierarchy.js';
import {OBJECTIVE_TURN_GOALS,createObjectiveTurnEngine} from '../src/battle-objective-turns.js';

assert.deepEqual(SORTIE_TEAM_IDS,Array.from({length:10},(_,i)=>i+1));
assert.equal(OBJECTIVE_TURN_GOALS.length,5);
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
const groups=Array.from({length:10},(_,i)=>({
 id:i+1,alive:i<3?10:0,hp:i<3?100:0,danger:false
}));
const calls=[],onPause=value=>calls.push(['pause',value]);
const engine=createObjectiveTurnEngine({
 getGroups:()=>groups,onPause,
 onMove:(id,g)=>calls.push(['move',id,g.id]),
 onAction:(id,g)=>calls.push(['act',id,g.after]),
 onReport:rows=>calls.push(['report',rows.length]),
 moveSeconds:2,actionSeconds:3
});
assert.equal(engine.snapshot().phase,'idle');
engine.begin();assert.equal(engine.snapshot().phase,'planning');
assert.equal(engine.setGoal(1,'support'),true);
assert.equal(engine.setGoal(3,'defend'),true);
assert.equal(engine.setGoal(4,'bad'),false);
assert.equal(engine.start(),true);
assert.deepEqual(calls.filter(x=>x[0]==='move'),[
 ['move',1,'support'],['move',2,'attack'],['move',3,'defend']
]);
assert.equal(engine.snapshot().phase,'moving');
engine.update(1);assert.equal(engine.snapshot().phase,'moving');
engine.update(1);assert.equal(engine.snapshot().phase,'acting');
assert.deepEqual(calls.filter(x=>x[0]==='act'),[
 ['act',1,'defend'],['act',2,'charge'],['act',3,'defend']
]);
groups[0].alive=8;groups[0].hp=65;
engine.update(3);
assert.equal(engine.snapshot().phase,'report');
assert.equal(engine.snapshot().report.find(x=>x.id===1).losses,2);
assert.equal(engine.snapshot().goalByGroup[1],'support');
assert.equal(engine.start(),true);
assert.equal(engine.snapshot().turn,2);
assert.deepEqual(calls.filter(x=>x[0]==='move').slice(-3).map(x=>x[2]),
 ['support','attack','defend'],'unchanged objectives persist without re-selecting');
assert.equal(engine.setGoal(2,'retreat'),false,'cannot edit objectives while units are moving');

for(const path of ['src/battle-objective-turns.js','src/battle-objective-turn-panel.js',
 'src/army-groups.js','src/battle-three-group-hierarchy.js','src/battle-three-group-panel.js',
 'src/three-team-sortie.js','src/three-team-core-bridge.js']){
 new SourceTextModule(readFileSync(new URL('../'+path,import.meta.url),'utf8'),{identifier:path});
}
const html=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
assert.match(html,/installObjectiveTurnPanel/);
assert.match(html,/objectiveTurnUI\.begin\(\)/);
assert.match(html,/objectiveTurnUI\.update\(/);
assert.match(html,/objectiveTurnUI\?\.finish\(\)/);
assert.match(html,/src\/battle-objective-turn-panel.css/);
console.log('PASS ten 4x4 formations, automatic two-phase objective turns, maintained goals, group casualties, real battle integration');
