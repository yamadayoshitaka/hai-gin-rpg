import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SourceTextModule} from 'node:vm';
import {createNewGame} from '../src/game-core-flow.js';
import {ensureSortiePlan,sortieTeams,sortieTeamCount,sortieFormationStatus} from '../src/three-team-sortie.js';
import {renderThreeTeamPlanner} from '../src/three-team-sortie-ui.js';
import {
 THREE_TEAM_STRATEGY_TYPES,suggestedThreeTeamFormations,
 selectThreeTeamStrategy,chooseThreeTeamFormation,saveThreeTeamStrategy,savedThreeTeamStrategy
} from '../src/three-team-strategy-presets.js';

const game=createNewGame('宿屋の作戦別3隊ウィザード');
game.townStage='c01-s01';
game.sortieTestLevel=99;
game.campaign.squads=[
 {id:1,job:'騎士',rarity:'N',count:20,commanderId:'player'},
 {id:2,job:'僧侶',rarity:'N',count:20,commanderId:'player'},
 {id:3,job:'魔法使い',rarity:'N',count:20,commanderId:'player'},
 {id:4,job:'忍者',rarity:'N',count:10,commanderId:'player'},
 {id:5,job:'シーフ',rarity:'N',count:10,commanderId:'player'},
 {id:6,job:'盾騎士',rarity:'N',count:10,commanderId:'player'},
 {id:7,job:'召喚士',rarity:'N',count:10,commanderId:'player'},
 {id:8,job:'弓使い',rarity:'N',count:10,commanderId:'player'},
 {id:9,job:'格闘家',rarity:'N',count:10,commanderId:'player'}
];
ensureSortiePlan(game);
const countSquads=()=>sortieTeams(game).reduce((n,t)=>n+sortieTeamCount(t),0);
const people=game.campaign.squads.reduce((n,s)=>n+s.count,0);
assert.equal(Object.keys(THREE_TEAM_STRATEGY_TYPES).length,4);
assert.equal(suggestedThreeTeamFormations(game,'attack').length,3);

const start=renderThreeTeamPlanner({game,view:'strategy'});
assert.match(start,/どの作戦で戦う/);
assert.equal((start.match(/data-sortie-plan-strategy=/g)||[]).length,4);
assert.ok(!start.includes('sortieAutoOptions'),'no automatic-composition bar on the main screen');
assert.ok(!start.includes('sortieModeTabs'),'no 6-tab board on the main screen');

selectThreeTeamStrategy(game,'attack');
assert.equal(game.sortieStrategyFamily,'attack');
const pick=renderThreeTeamPlanner({game,teamId:1,view:'formationPick'});
assert.match(pick,/第1隊の陣形は/);
assert.equal((pick.match(/data-sortie-plan-formation=/g)||[]).length,4);
assert.ok(!pick.includes('data-sortie-plan-strategy'),'one decision topic per screen');
assert.ok(!pick.includes('sortieModeTabs'));

chooseThreeTeamFormation(game,'attack',1,'attack');
chooseThreeTeamFormation(game,'attack',2,'balanced');
chooseThreeTeamFormation(game,'attack',3,'support');
const before=sortieTeams(game).map(t=>t.formation);
assert.deepEqual(before,['attack','balanced','support']);
assert.ok(countSquads()<=people,'formation never creates nonexistent soldiers');
const saved=saveThreeTeamStrategy(game,'attack');
assert.equal(saved.teams.length,3);
assert.deepEqual(saved.teams.map(t=>t.formation),before);
assert.deepEqual(savedThreeTeamStrategy(game,'attack').teams.map(t=>t.formation),before);

const review=renderThreeTeamPlanner({game,view:'review',teamId:3});
assert.match(review,/3隊の編成を確認/);
assert.equal((review.match(/data-sortie-plan-edit=/g)||[]).length,3);
assert.match(review,/data-sortie-plan-save/);
assert.ok(!review.includes('sortieAutoOptions'));

selectThreeTeamStrategy(game,'defense');
assert.equal(game.sortieStrategyFamily,'defense');
saveThreeTeamStrategy(game,'defense');
selectThreeTeamStrategy(game,'attack');
assert.deepEqual(sortieTeams(game).map(t=>t.formation),before,
 'switching to a saved strategy restores each of its three formations');
assert.equal(Object.keys(game.sortieFormationPresets).length,2);
assert.ok(countSquads()<=people,'restoring templates never clones soldiers');
assert.ok(!sortieFormationStatus(game,1).reason.includes('テンプレートの4隊'),
 'three-job combat no longer asks for obsolete four-job formation capacity');
assert.throws(()=>chooseThreeTeamFormation(game,'attack',4,'balanced'),/第1〜3隊/);

const town=readFileSync(new URL('../town-hub.html',import.meta.url),'utf8');
for(const attr of ['data-sortie-plan-strategy','data-sortie-plan-formation','data-sortie-plan-save']){
 assert.ok(town.includes(attr),'inn click handler: '+attr);
}
assert.ok(town.includes("sortieView='strategy'"),'inn opens the wizard first');
for(const f of ['src/three-team-strategy-presets.js','src/three-team-sortie-ui.js','src/three-team-sortie.js']){
 new SourceTextModule(readFileSync(new URL('../'+f,import.meta.url),'utf8'),{identifier:f});
}
console.log('PASS: one-choice screens, strategy-specific 3-team templates, saved restoration, no troop cloning');
