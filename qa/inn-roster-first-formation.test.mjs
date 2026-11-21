import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createNewGame,equipSquadItem} from '../src/game-core-flow.js';
import {ensureSortiePlan,sortieTeams,sortieTeamCount,sortieFormationStatus,sortiePlanningLimit,SORTIE_FORMATIONS} from '../src/three-team-sortie.js';
import {selectInnRosterJob,setInnRosterCount,chooseInnFormation,inspectInnFormation} from '../src/inn-formation-rules.js';
import {renderInnFormationWizard} from '../src/inn-formation-wizard.js';

const game=createNewGame('陣形先行から隊員先行に変更');
game.sortieTestLevel=99;
game.campaign.squads=[
 {id:1,job:'騎士',rarity:'R',count:20,commanderId:'player'},
 {id:2,job:'魔法使い',rarity:'SR',count:18,commanderId:'player'},
 {id:3,job:'忍者',rarity:'SSR',count:8,commanderId:'player'},
 {id:4,job:'盾騎士',rarity:'N',count:12,commanderId:'player'},
 {id:5,job:'僧侶',rarity:'R',count:8,commanderId:'player'},
 {id:6,job:'格闘家',rarity:'N',count:8,commanderId:'player'}
];
for(const team of sortieTeams(game)){
 team.formation='free';team.slots=[null,null,null];team.grid=Array(16).fill(null);
 team.counts={};team.divisions={};team.captainId=null;
}
assert.match(renderInnFormationWizard({game}),/どの隊を編成する/);
const teamPage=renderInnFormationWizard({game});
assert.equal((teamPage.match(/data-inn-wizard-team=/g)||[]).length,3);
assert.ok(!teamPage.includes('どの作戦で戦う？'));
for(const view of ['roster','equipment','items','leader','formation','review']){
 assert.match(renderInnFormationWizard({game,view,teamId:1}),/第1隊/);
}
assert.match(renderInnFormationWizard({game,view:'roster'}),/隊員・人数/);
assert.match(renderInnFormationWizard({game,view:'equipment'}),/装備/);
assert.match(renderInnFormationWizard({game,view:'leader'}),/リーダー/);

selectInnRosterJob(game,1,0,1);
selectInnRosterJob(game,1,1,2);
selectInnRosterJob(game,1,2,3);
let team=sortieTeams(game)[0];
assert.deepEqual(team.slots,['1','2','3']);
assert.deepEqual(team.counts,{'1':5,'2':5,'3':5});
assert.equal(team.captainId,1);
assert.equal(inspectInnFormation(game,1,'dragon').eligible,false,
 'top-quality formation must reject weak headcounts and rarity requirements');
assert.match(inspectInnFormation(game,1,'dragon').reason,/合計28人以上/);

setInnRosterCount(game,1,1,7);
setInnRosterCount(game,1,2,5);
setInnRosterCount(game,1,3,1);
team=sortieTeams(game)[0];
assert.equal(sortieTeamCount(team),28);
const dragon=inspectInnFormation(game,1,'dragon');
assert.equal(dragon.eligible,true,'28 soldiers with R, SR, SSR and proper roles qualify');
assert.equal(dragon.assignment.length,3);
const canPick=renderInnFormationWizard({game,view:'formation',teamId:1,formationPage:Object.keys(SORTIE_FORMATIONS).indexOf('dragon')});
assert.match(canPick,/龍牙陣形/);
assert.match(canPick,/目的：/);
assert.match(canPick,/動き：/);
assert.match(canPick,/条件：/);
chooseInnFormation(game,1,'dragon');
team=sortieTeams(game)[0];
const before={slots:[...team.slots],counts:{...team.counts},captainId:team.captainId};
assert.equal(team.formation,'dragon');
assert.equal(sortieFormationStatus(game,1).valid,true);
ensureSortiePlan(game);
team=sortieTeams(game)[0];
assert.deepEqual(team.slots,before.slots,'normalization must preserve chosen jobs');
assert.deepEqual(team.counts,before.counts,'formation does not silently exchange members');
assert.equal(team.captainId,before.captainId,'formation does not replace captain');
assert.equal(sortieTeamCount(team),28);
assert.ok(sortiePlanningLimit(game)>=28);
equipSquadItem(game,1,'iron_sword','武器');
assert.match(renderInnFormationWizard({game,view:'equipment'}),/鉄の剣/);
assert.match(renderInnFormationWizard({game,view:'review'}),/第1隊の編成内訳/);
assert.match(renderInnFormationWizard({game,view:'review'}),/龍牙陣形/);
assert.match(renderInnFormationWizard({game,view:'review'}),/28人/);
assert.match(renderInnFormationWizard({game,view:'review'}),/鉄の剣/);
assert.match(renderInnFormationWizard({game,view:'review'}),/隊長：/);
assert.match(renderInnFormationWizard({game,view:'review'}),/攻撃\+/);

assert.throws(()=>chooseInnFormation(game,2,'constellation'),/条件未達/);

selectInnRosterJob(game,2,0,1);
setInnRosterCount(game,2,1,3);
assert.throws(()=>selectInnRosterJob(game,3,0,1),/空き兵員|他の隊/);
assert.equal(sortieTeams(game).reduce((n,t)=>n+sortieTeamCount(t),0),36);

const town=readFileSync(new URL('../town-hub.html',import.meta.url),'utf8');
assert.match(town,/innWizardStep='teamPick'/);
assert.match(town,/renderInnFormationWizard/);
for(const key of ['data-inn-wizard-team','data-inn-wizard-roster-job','data-inn-wizard-count',
 'data-inn-wizard-gear-source','data-inn-wizard-equip','data-inn-wizard-item','data-inn-wizard-leader',
 'data-inn-wizard-formation','data-inn-wizard-save'])
 assert.ok(town.includes(key),'town click handler for '+key);
const css=readFileSync(new URL('../src/three-team-sortie-ui.css',import.meta.url),'utf8');
assert.match(css,/\.innWizardBody/);
console.log('PASS: team-first seven-screen wizard, roster rarity gates, gear, captain, persistence and no troop cloning');
