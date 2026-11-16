import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {battleTeamParameters,recommendBattlePlans,registerBattlePlan,selectBattlePlan,
 allBattlePlans,BATTLE_PLAN_PRESETS} from '../src/battle-plan-recommendations.js';
const game={
 campaign:{squads:[{id:'shield',job:'盾騎士',count:12},{id:'healer',job:'僧侶',count:8},
  {id:'archer',job:'弓使い',count:10},{id:'ninja',job:'忍者',count:4}]},
 sortiePlan:{teams:[{id:1,formation:'balanced',counts:{shield:12,healer:8,archer:10}},
  {id:2,formation:'free',counts:{ninja:4}}]}
};
const stage={id:'c01-s05',name:'橋頭堡の防衛',kind:'defend',biome:'urban',winCondition:'拠点を守る'};
const team=battleTeamParameters(game,1);
assert.equal(team.people,30);
assert.ok(team.parameters.defense>team.parameters.mobility);
assert.equal(battleTeamParameters(game,2).parameters.recon>80,true);
const scores=recommendBattlePlans(game,stage,1);
assert.ok(scores.length>0);
assert.ok(scores[0].eligible);
assert.equal(scores[0].kind,'defend');
assert.ok(scores[0].score<=100);
assert.ok(scores.some(s=>s.id==='defense'));
const saved=registerBattlePlan(game,{name:'門前の盾',methodId:'block_passage',kind:'defend',terrain:'urban'});
assert.ok(allBattlePlans(game).some(s=>s.id===saved.id));
selectBattlePlan(game,1,saved.id);
assert.equal(game.activeBattlePlanByTeam['1'],saved.id);
assert.equal(recommendBattlePlans(game,stage,1,{limit:30}).find(s=>s.id===saved.id).eligible,true);
assert.throws(()=>registerBattlePlan(game,{name:'無効',methodId:'no-method'}));
const town=readFileSync(new URL('../town-hub.html',import.meta.url),'utf8');
const battle=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
const inn=readFileSync(new URL('../src/three-team-sortie-ui.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/three-team-sortie-ui.css',import.meta.url),'utf8');
const score=readFileSync(new URL('../src/fantasy-scene-score.js',import.meta.url),'utf8');
assert.match(town,/data-sortie-battle-save/);
assert.match(town,/data-sortie-battle-plan/);
assert.match(town,/townAudio\.setScene\(which==='formation'\?'inn'/);
assert.match(inn,/sortieModeTabs/);
assert.match(inn,/battleTeamParameters/);
assert.match(inn,/recommendBattlePlans/);
assert.match(css,/overflow-y:auto!important/);
assert.match(css,/#panel\.formation-command-ui\[hidden\]\{display:none!important;pointer-events:none!important\}/,
 'a closed inn panel must never block other town facility touches');
assert.match(css,/\.sortieModeTabs/);
assert.match(score,/town:'heartfelt',inn:'whispers'/);
assert.match(battle,/numberedPin\(center,group\+'-'\+/);
assert.match(battle,/getTemplates:groupId/);
assert.match(battle,/objectiveCheckpoints\.update\(\)/);
assert.match(battle,/createBattleObjectiveCheckpoints/);
console.log('PASS: saved strategies, tactical fitness, compact inn, BGM and matching numbered radar');
