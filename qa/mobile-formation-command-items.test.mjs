import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createNewGame} from '../src/game-core-flow.js';
import {ensureSortiePlan,sortieTeams,SORTIE_FORMATIONS} from '../src/three-team-sortie.js';
import {INN_CONSUMABLES,teamItemStock,setInnTeamItem,innTeamItemsSummary} from '../src/inn-team-items.js';
import {formationAllowsTactic,formationUnlockLabels} from '../src/formation-strategy-unlocks.js';
import {renderInnFormationWizard} from '../src/inn-formation-wizard.js';

const game=createNewGame('UI行軍・陣形・持参品検証');
game.location='town';game.inventory.potion=3;game.inventory.ether=2;game.inventory.antidote=1;
assert.ok(INN_CONSUMABLES.some(x=>x.id==='potion'));
ensureSortiePlan(game);
assert.equal(setInnTeamItem(game,1,'potion',1),1);
assert.equal(setInnTeamItem(game,1,'potion',1),2);
assert.equal(setInnTeamItem(game,2,'potion',1),1);
assert.throws(()=>setInnTeamItem(game,3,'potion',1),/在庫/);
assert.equal(teamItemStock(game,1,'potion').owned,3);
assert.equal(teamItemStock(game,1,'potion').assigned,1);
assert.equal(teamItemStock(game,1,'potion').available,0);
assert.equal(setInnTeamItem(game,1,'potion',-1),1);
assert.equal(teamItemStock(game,3,'potion').available,1);
assert.equal(setInnTeamItem(game,3,'potion',1),1);
assert.equal(setInnTeamItem(game,2,'ether',1),1);
assert.equal(setInnTeamItem(game,3,'antidote',1),1);
ensureSortiePlan(game);
assert.equal(sortieTeams(game)[0].items.potion,1,'save normalization must retain items');
assert.equal(innTeamItemsSummary(game,2).some(x=>x.id==='ether'),true);
assert.match(renderInnFormationWizard({game,view:'items',teamId:1}),/持参アイテム/);
assert.match(renderInnFormationWizard({game,view:'review',teamId:1}),/持参アイテム/);
const formationHtml=renderInnFormationWizard({game,view:'formation',teamId:1,formationPage:0});
assert.equal((formationHtml.match(/data-inn-wizard-formation="attack"/g)||[]).length,1,
 'the inn must display one named formation per paged screen without scrolling');
assert.equal((formationHtml.match(/data-inn-wizard-formation="free"/g)||[]).length,1,
 'free formation is an always-available escape hatch, not a second named card');
assert.equal((formationHtml.match(/data-inn-wizard-formation-page=/g)||[]).length,2);
assert.match(formationHtml,/追加作戦/);
assert.ok(Object.keys(SORTIE_FORMATIONS).length>8);
assert.equal(formationAllowsTactic('balanced','melee_split'),false);
assert.equal(formationAllowsTactic('pincer','melee_split'),true);
assert.equal(formationAllowsTactic('pincer','ranged_split'),true);
assert.equal(formationAllowsTactic('wall','ranged_split'),false);
assert.equal(formationAllowsTactic('fortress','regroup'),true);
assert.equal(formationAllowsTactic('free','melee_focus'),true,
 'basic job actions stay available even in free formation');
assert.ok(formationUnlockLabels('constellation').length>=8);
const town=readFileSync(new URL('../town-hub.html',import.meta.url),'utf8');
const battle=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
const center=readFileSync(new URL('../src/targeted-strategy-runtime.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/three-team-sortie-ui.css',import.meta.url),'utf8');
const radar=readFileSync(new URL('../src/battle-realtime-commands.js',import.meta.url),'utf8');
for(const marker of ['data-inn-wizard-item','items:\'leader\'','setInnTeamItem'])
 assert.ok(town.includes(marker),'town item control '+marker);
for(const marker of ['focusCommandTeam(team,id)','onMoveExecute:','getFormationId:','townItemsSpent:spentInnItems'])
 assert.ok(battle.includes(marker),'real battle link '+marker);
for(const marker of ['moveTarget','moveConfirm','data-strategy-start','tacticUnlocked'])
 assert.ok(center.includes(marker),'separate command flow '+marker);
for(const marker of ['deployStep=\'placement\'','syncPrebattleScreen()','realtimeMapViewport','配置を確定して作戦選択','作戦を保存して次の隊へ']){
 assert.ok(radar.includes(marker),'two-step prebattle UI '+marker);
}
assert.match(css,/\.innWizardFormations/);
assert.match(css,/overflow:hidden!important/);

const strategy=readFileSync(new URL('../src/targeted-strategy-runtime.js',import.meta.url),'utf8');
const strategyCss=readFileSync(new URL('../src/central-battle-orders.css',import.meta.url),'utf8');
const radarCss=readFileSync(new URL('../src/battle-realtime-commands.css',import.meta.url),'utf8');
assert.match(strategy,/renderFormationSignaturePreview\(formation\)/,
 'battle command selection must reuse the actual inn animated formation');
assert.match(strategy,/data-strategy-quick="assault"/);
assert.match(strategy,/data-strategy-signature="1"/);
assert.match(strategy,/data-strategy-start="plan"/);
assert.match(strategy,/else if\(kind==='plan'\)step='family'/,
 'the advanced tactics button must open the real tactics picker');
assert.match(radar,/realtimeInitialFormationPreview/,
 'each prebattle team needs an animated preview next to allowed orders');
assert.match(radar,/PREBATTLE_TACTIC_NAMES/);
assert.match(strategyCss,/centerQuickBattleGrid/);
assert.match(radarCss,/#realtimeInitialFormationPreview/);

console.log('PASS: paged formations, animated battle tactics, team items, and formation unlocks');
