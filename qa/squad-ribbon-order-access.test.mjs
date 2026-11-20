import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {shouldHideSquadLabelsAtDistance} from '../src/battle-squad-circle-tap.js';
import {squadRibbonStatus,secondsUntilNextOrder} from '../src/battle-command-roster.js';

const html=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
function segment(begin,end){
 const start=html.indexOf(begin),stop=html.indexOf(end,start);
 assert.ok(start>=0&&stop>start,'missing live handler: '+begin);
 return html.slice(start,stop);
}
// The active battle controls use camera choice and group recommendations,
// not the retired one-tap individual command popup.
const circle=segment('function activateSquadLabel(id,team,','function makeSquadLabel(');
assert.match(circle,/if\(pendingCircleTarget\)\{chooseCircleActionTarget\(id,team\);return;\}/);
assert.match(circle,/if\(tap\.doubleTap\)\{\s*zoomToSquadMember\(id,team\);\s*return;/);
assert.match(circle,/selectOverviewSquad\(team,id\);/);
assert.match(circle,/pendingSquadCircleInfoTimer=setTimeout\(/);
assert.match(circle,/applyOverviewCamera\('squad'\)/);
assert.doesNotMatch(circle,/else openSquadTactics\(id\)/);
const open=segment('function openSquadTactics(id){','function beginStrategistWarp(){');
assert.match(open,/if\(!TOWN_MODE\)\{/);
assert.match(open,/return realtimeCommandUI\?\.selectSquad\(id\)\?\?false/);
assert.match(open,/if\(!paused\)setBattlePaused\(true\)/);
assert.match(open,/\$\('squadTactics'\)\.hidden=false;showSquadTacticsPanel\('main'\)/);
const overview=segment("$('overviewRecommendPlan').onclick=()=>{",'function updateOverviewSquadPins(');
assert.match(overview,/targetedStrategyUi\.open\(group,\{\s*startAtRecommendations:true,groupOnly:true\s*\}\)/);
assert.match(html,/divisionsSelectionOnly:true/);
const target=segment('function chooseCircleActionTarget(id,team){','function confirmCircleActionTarget(){');
assert.match(target,/action\.selectedTargetId=String\(id\)/);
assert.match(target,/\$\('battleTargetConfirm'\)\.hidden=false/);
assert.doesNotMatch(target,/issueSquadOrder\(/);
const confirm=segment('function confirmCircleActionTarget(){','function requestSquadRecovery(');
assert.match(confirm,/if\(!hasSquadCommander\(action\.source\)\)/);
assert.equal(secondsUntilNextOrder(15,20),115);
assert.equal(secondsUntilNextOrder(15,135),0);
assert.equal(squadRibbonStatus({team:0,alive:12,total:15,commanderAlive:true}).enabled,true);
assert.equal(squadRibbonStatus({team:0,alive:12,total:15,commanderAlive:false}).enabled,false);
assert.equal(shouldHideSquadLabelsAtDistance(62,true),false);
assert.equal(shouldHideSquadLabelsAtDistance(17,true),false);
assert.equal(shouldHideSquadLabelsAtDistance(8,false),true);
console.log('PASS: active squad camera chooser, group recommendations, target confirmation and strategist lock');
