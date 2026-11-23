import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {parseHTML} from 'linkedom';
import {createNewGame} from '../src/game-core-flow.js';
import {renderInnFormationWizard} from '../src/inn-formation-wizard.js';
import {createRealtimeBattleCommands} from '../src/battle-realtime-commands.js';

const file=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const attackTrainingGame=name=>{
 const game=createNewGame(name);
 game.campaign.squads=[
  {id:101,job:'騎士',rarity:'N',count:3,commanderId:'player'},
  {id:102,job:'魔法使い',rarity:'N',count:3,commanderId:'player'},
  {id:103,job:'忍者',rarity:'N',count:2,commanderId:'player'}
 ];
 game.sortiePlan=null;
 return game;
};


test('training formation animation follows template list and precedes quote, with unclipped purchase controls',()=>{
 const game=attackTrainingGame('訓練所UI確認');
 const markup=renderInnFormationWizard({
  game,view:'roster',teamId:1,rosterPreviewId:'attack',rosterFormationPage:0
 });
 const list=markup.indexOf('class="trainingFormationList"');
 const animation=markup.indexOf('class="trainingFormationAnimation"');
 const signature=markup.indexOf('class="signaturePreview"',animation);
 const quick=markup.indexOf('class="trainingFormationQuick"');
 assert.ok(list>=0&&animation>list&&signature>animation&&quick>signature,
  'the animation must follow the paged template list, before the hire quote action');
 assert.match(markup,/data-inn-wizard-quote=/);
 const quoteMarkup=renderInnFormationWizard({
  game,view:'rosterQuote',teamId:1,rosterPreviewId:'attack'
 });
 assert.ok(quoteMarkup.indexOf('class="trainingFormationAnimation"')>=0);
 assert.ok(quoteMarkup.indexOf('class="trainingFormationQuote"')>
  quoteMarkup.indexOf('class="trainingFormationAnimation"'),
  'the separate quote page must show the animation before the hire quote');
 assert.match(quoteMarkup,/data-training-auto-formation=/);
 const css=file('src/three-team-sortie-ui.css');
 assert.match(css,/\.innWizardRosterPreview\) \.innWizardBody\{[\s\S]*?overflow:hidden!important/);
 assert.match(css,/\.innWizardRosterPreview\) \.innWizardRosterPreview\{[\s\S]*?overflow:hidden!important/);
 assert.match(css,/\.trainingFormationAnimation \.signaturePreview svg\{/);
 assert.match(css,/\.trainingFormationQuote>small\{[\s\S]*?overflow:visible/);
});

test('named previews require three distinct jobs; free allows one to three',()=>{
 const game=attackTrainingGame('陣形の人数整合');
 renderInnFormationWizard({game,view:'roster',teamId:1,rosterPreviewId:'attack'});
 const team=game.sortiePlan.teams[0];
 const assigned=team.slots.filter(id=>id!=null&&Number(team.counts[String(id)]||0)>0);
 assert.equal(assigned.length,3,'fixture includes the required three distinct jobs');
 team.slots=[assigned[0],assigned[1],assigned[2]];
 const render=view=>renderInnFormationWizard({game,view,teamId:1,
  rosterPreviewId:'attack'});
 for(const view of ['roster','rosterQuote','formation']){
  const html=render(view);
  assert.equal((html.match(/<animateTransform /g)||[]).length,3,view+' animates all three eligible jobs');
  assert.match(html,/味方 3ジョブ/);
 }
 // Two real jobs remain deployed but cannot unlock a named formation.
 // Rendering normalizes the sortie plan and replaces the team object.
 // Always mutate the latest team, rather than an outdated test reference.
 const single=game.sortiePlan.teams[0];
 single.formation='free';
 single.grid.fill(null);
 single.slots=[assigned[0],assigned[1],null];
 delete single.counts[String(assigned[2])];
 assert.equal((render('roster').match(/<animateTransform /g)||[]).length,0);
 assert.match(render('roster'),/自由陣形で配置します/,'two jobs cannot fulfill a three-job preset');
 assert.equal(game.sortiePlan.teams[0].slots.filter(Boolean).length,2,'two assigned jobs remain in free layout');
 const empty=game.sortiePlan.teams[0];
 empty.slots=[assigned[0],null,null];
 empty.grid.fill(null);
 delete empty.counts[String(assigned[1])];
 assert.equal((render('roster').match(/<animateTransform /g)||[]).length,0);
 assert.equal(game.sortiePlan.teams[0].slots.filter(Boolean).length,1,'free layout supports one job');
});

test('training formation page separates all controls and returns to team selection at the end',()=>{
 const game=attackTrainingGame('訓練所全画面ページ');
 const first=renderInnFormationWizard({game,view:'formation',teamId:1,formationPage:0});
 const last=renderInnFormationWizard({game,view:'formation',teamId:1,formationPage:999});
// Check the actual last page even when new formations are registered.
 const parsed=parseHTML(first).document;
 const article=parsed.querySelector('.innWizardFormationCard');
 assert.ok(article,'one complete formation must live in a separate card');
 assert.equal(parsed.querySelectorAll('.innWizardFormationCard').length,1,
  'a smartphone page displays one formation, not an overlapping grid');
 assert.ok(article.querySelector('.innWizardFormationDiagram'),'formation diagram stays in its own region');
 assert.equal(article.querySelector('.innWizardFormationDiagram').closest('button'),null,
  'animation must never be nested inside an action button');
 assert.ok(article.querySelector('.innWizardFormationDetail'),'information stays below animation');
 assert.ok(parsed.querySelector('.innWizardFormationPager'),'pager is a sibling below the card');
 assert.ok(parsed.querySelector('.innWizardFreeFormation'),'free formation remains independently selectable');
 assert.match(first,/data-inn-wizard-formation-page="1"/);
 assert.match(last,/data-inn-wizard-return-teams="1"/);
 assert.doesNotMatch(last,/data-inn-wizard-formation-page="1"/,
  'the final page goes back to the team selector instead of wrapping to page one');
 const css=file('src/three-team-sortie-ui.css');
 assert.match(css,/\.innWizardFormationCard\{/);
 assert.match(css,/\.innWizardFormationDiagram\{/);
 assert.match(css,/\.innWizardFormationPager\{/);
 assert.match(css,/\.innWizardFormationCard\) \.innWizardBody\{/);
});

test('all paid town actions require explicit confirmation and success plays the coin chime',()=>{
 const town=file('town-hub.html'),audio=file('src/town-audio-director.js');
 for(const key of ['d.trainingHire','d.trainingAutoFormation','d.innWizardBuyEquip',
  'd.buy','d.forgeWeapon','d.tavernGacha','showTownTransactionConfirm(button,summary)',
  'event.stopImmediatePropagation()','data-confirm-purchase-yes',
  "townAudio.effect('coin')"]){
  assert.ok(town.includes(key),'missing purchase confirmation/audio contract: '+key);
 }
 assert.match(town,/root\.querySelector\('\[data-confirm-purchase-yes\]'\)\.onclick=/);
 assert.match(audio,/coin:\[\[1450/,'a distinct metallic coin sound is synthesized');
 assert.match(audio,/kind==='coin'\?'triangle'/,'coin sound is not a generic menu tap');
});

test('Android uses paged touch buttons rather than the system-wide dropdown',()=>{
 const js=file('src/battle-realtime-commands.js'),css=file('src/battle-realtime-commands.css');
 assert.match(js,/<select id="realtimeInitialStrategy" hidden tabindex="-1"/);
 assert.match(js,/id="realtimeInitialStrategyChoices"/);
 assert.match(js,/id="realtimeInitialStrategyPager"/);
 assert.match(js,/const options=\[\.\.\.basic,\.\.\.advanced\],perPage=6/);
 assert.match(js,/initialTeamPlans\.set\(String\(group\),strategy\)/);
 assert.match(css,/#realtimeBattleMapOverlay #realtimeInitialStrategyChoices\{/);
 assert.match(css,/\.realtimeMapCard:has\(#realtimeInitialTeamPlanning:not\(\[hidden\]\)\)\{[\s\S]*?overflow-y:auto!important/);
});

test('three-team prebattle strategy touch cards store selections and keep footer accessible',()=>{
 const {document}=parseHTML('<html><body></body></html>');
 const teams=[1,2,3].map(group=>({id:'team'+group,groupId:group,
  label:'第'+group+'隊',job:'剣士',alive:4,total:4,hp:200,maxHp:200,x:30+group,z:80}));
 const ui=createRealtimeBattleCommands({documentRef:document,worldSize:232,
  requirePrebattleChoices:true,getDeploymentTeams:()=>teams,getSquads:()=>teams,
  getInitialTeamPlan:()=>({formation:'標準陣形',formationActive:true,
   allowedStrategies:['assault','defense','balanced','explore']}),
  getLegalPoint:(x,z)=>({x,z}),canDeploy:()=>true,
  onDeploy:()=>true,onStart:()=>true
 });
 // linkedom exposes a read-only select.value descriptor; real browsers
 // allow the assignment. Override that single test double property.
 const chooser=document.querySelector('#realtimeInitialStrategy');
 Object.defineProperty(chooser,'value',{value:'',writable:true,configurable:true});
 ui.openDeployment();
 ui.selectSquad('team3');
 assert.equal(chooser.hidden,true);
 const choices=document.querySelector('#realtimeInitialStrategyChoices');
 assert.equal(choices.querySelectorAll('button').length,4);
 const defense=choices.querySelector('[data-prebattle-strategy="defense"]');
 assert.ok(defense,'defense is a real touch button');
 defense.click();
 assert.equal(chooser.value,'defense');
 assert.equal(defense.getAttribute('aria-pressed'),'true');
 assert.equal(document.querySelector('#realtimeStart').hidden,false);
});
