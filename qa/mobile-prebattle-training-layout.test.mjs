import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {parseHTML} from 'linkedom';
import {createNewGame} from '../src/game-core-flow.js';
import {renderInnFormationWizard} from '../src/inn-formation-wizard.js';
import {createRealtimeBattleCommands} from '../src/battle-realtime-commands.js';

const file=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('training formation animation follows template list and precedes quote, with unclipped purchase controls',()=>{
 const game=createNewGame('訓練所UI確認');
 const markup=renderInnFormationWizard({
  game,view:'roster',teamId:1,rosterPreviewId:'attack',rosterFormationPage:0
 });
 const list=markup.indexOf('class="trainingFormationList"');
 const animation=markup.indexOf('class="trainingFormationAnimation"');
 const signature=markup.indexOf('class="signaturePreview"',animation);
 const quote=markup.indexOf('class="trainingFormationQuote"');
 assert.ok(list>=0&&animation>list&&signature>animation&&quote>signature,
  'the animation must be immediately below the paged template list, above the hire quote');
 assert.match(markup,/data-training-auto-formation=/);
 const css=file('src/three-team-sortie-ui.css');
 assert.match(css,/\.innWizardRosterPreview\) \.innWizardBody\{[\s\S]*?overflow-y:auto!important/);
 assert.match(css,/\.innWizardRosterPreview\) \.innWizardRosterPreview\{[\s\S]*?overflow:visible!important/);
 assert.match(css,/\.trainingFormationAnimation \.signaturePreview svg\{/);
 assert.match(css,/\.trainingFormationQuote>small\{[\s\S]*?overflow:visible/);
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
 ui.openDeployment();
 ui.selectSquad('team3');
 const chooser=document.querySelector('#realtimeInitialStrategy');
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
