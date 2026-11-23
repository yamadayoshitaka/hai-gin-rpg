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
  {id:102,job:'魔法使い',rarity:'N',count:3,commanderId:'player'}
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

test('training preview matches assigned job slots rather than always showing three',()=>{
 const game=attackTrainingGame('陣形の人数整合');
 renderInnFormationWizard({game,view:'roster',teamId:1,rosterPreviewId:'attack'});
 const team=game.sortiePlan.teams[0];
 const assigned=team.slots.filter(id=>id!=null&&Number(team.counts[String(id)]||0)>0);
 assert.ok(assigned.length>=2,'fixture includes at least two assigned jobs');
 team.slots=[assigned[0],assigned[1],null];
 const render=view=>renderInnFormationWizard({game,view,teamId:1,
  rosterPreviewId:'attack'});
 for(const view of ['roster','rosterQuote','formation']){
  const html=render(view);
  assert.equal((html.match(/<animateTransform /g)||[]).length,2,view+' only animates two jobs');
  assert.match(html,/味方 2ジョブ/);
 }
 // The named preset automatically refills required roles when a team is
 // normalized. Use the editable free layout to test a genuinely vacant slot.
 // Rendering normalizes the sortie plan and replaces the team object.
 // Always mutate the latest team, rather than an outdated test reference.
 const single=game.sortiePlan.teams[0];
 single.formation='free';
 single.grid.fill(null);
 single.slots=[assigned[0],null,null];
 delete single.counts[String(assigned[1])];
 assert.equal((render('roster').match(/<animateTransform /g)||[]).length,0);
 assert.match(render('roster'),/自由陣形で配置します/,'one job cannot fulfill a two-job preset');
 const empty=game.sortiePlan.teams[0];
 empty.slots=[null,null,null];
 empty.grid.fill(null);
 delete empty.counts[String(assigned[0])];
 assert.equal((render('roster').match(/<animateTransform /g)||[]).length,0);
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
