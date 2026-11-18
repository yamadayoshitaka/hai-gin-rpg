import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {
 createObjectiveTurnEngine,TURN_MOVE_OPTIONS,TURN_ACTION_OPTIONS
} from '../src/battle-objective-turns.js';

test('turn sequence accepts map destination then inventory action and persists choices',()=>{
 const moves=[],actions=[];
 const groups=[{id:1,initial:8,alive:8,hp:80},{id:2,initial:5,alive:5,hp:50}];
 const engine=createObjectiveTurnEngine({
  groupIds:[1,2],getGroups:()=>groups,moveSeconds:1,actionSeconds:1,
  hasArrived:()=>true,onMove:(id,order)=>moves.push([id,order]),
  onAction:(id,order)=>actions.push([id,order])
 });
 assert.equal(engine.begin().phase,'planning');
 assert.equal(engine.setMove(2,'bridge_front','bridge-1'),true);
 assert.equal(engine.setAction(2,'item'),true);
 assert.equal(engine.start(),false,'missing selected item blocks turn start');
 assert.equal(engine.setItem(2,'healing_potion'),true);
 assert.equal(engine.start(),true);
 engine.update(.1);
 assert.equal(actions.find(([id])=>id===2)[1].itemId,'healing_potion');
 assert.equal(moves.find(([id])=>id===2)[1].targetId,'bridge-1');
 engine.update(1.1);
 assert.equal(engine.status().phase,'report');
 engine.update(2.1,{wallDt:2.1});
 assert.equal(engine.status().phase,'moving');
 assert.deepEqual(engine.snapshot().ordersByGroup[2],
  {move:'bridge_front',action:'item',targetId:'bridge-1',itemId:'healing_potion'});
});
test('free map cell selection, faster turn tempo, and job-based groups stay wired',()=>{
 const engine=createObjectiveTurnEngine({groupIds:[1],getGroups:()=>[{id:1,alive:5,initial:5,hp:100}]});
 assert.equal(engine.begin().phase,'planning');
 assert.equal(engine.setMove(1,'point','105,118'),true);
 assert.equal(engine.snapshot().ordersByGroup[1].targetId,'105,118');
 assert.equal(engine.start(),true);
 assert.equal(engine.status().remaining,20);
 engine.update(20);
 assert.equal(engine.status().phase,'acting');
 assert.equal(engine.status().remaining,4);
 const panel=readFileSync(new URL('../src/battle-objective-turn-panel.js',import.meta.url),'utf8');
 const battle=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
 assert.match(panel,/getLegalMapPoint/);
 assert.match(panel,/engine.setMove\(g.id,'point'/);
 assert.match(battle,/order.move==='point'/);
 assert.match(battle,/getGroupLabel:groupId=>turnGroupLabels/);
 assert.match(battle,/battleAudio.setPhase\('battle'\)/);
 assert.match(battle,/announceBattleLoot/);
});
test('all movement and strategy choices are button and map based, without select dropdowns',()=>{
 const panel=readFileSync(new URL('../src/battle-objective-turn-panel.js',import.meta.url),'utf8');
 assert.ok(TURN_MOVE_OPTIONS.some(option=>option.id==='building'));
 assert.ok(TURN_MOVE_OPTIONS.some(option=>option.id==='bridge_front'));
 assert.ok(TURN_ACTION_OPTIONS.some(option=>option.id==='item'));
 assert.match(panel,/objectiveTurnMap/);
 assert.match(panel,/data-pager/);
 assert.match(panel,/data-action-id/);
 assert.match(panel,/data-item-id/);
 assert.match(panel,/objectiveTurnIntelRows/);
 assert.doesNotMatch(panel,/<select(?:\s|>)/i);
});
test('battle starts directly without opening wizard and shows live ally job power',()=>{
 const battle=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
 const panel=readFileSync(new URL('../src/battle-objective-turn-panel.js',import.meta.url),'utf8');
 const styles=readFileSync(new URL('../src/battle-objective-turn-panel.css',import.meta.url),'utf8');
 assert.doesNotMatch(battle,/setOpeningWizardPage\('formation'\)/);
 assert.doesNotMatch(battle,/const openingPlan=document\.createElement/);
 assert.match(battle,/setBattlePaused\(true\)/);
 assert.match(battle,/loading\.hidden=true/);
 assert.match(battle,/updateUI\(\);animate\(\)/);
 assert.match(battle,/getGroupJobs:groupId=>jobPowerBreakdown/);
 assert.match(battle,/jobs:jobPowerBreakdown\(alive\)/);
 assert.match(panel,/getGroupJobs=()=>\[\]/);
 assert.match(panel,/objectiveTurnJobs/);
 assert.match(panel,/objectiveIntelJobs/);
 assert.match(styles,/objectiveTurnJobs/);
 assert.match(styles,/body\.objective-turn-enabled #battleTeamCameraSwitches/);
 assert.match(styles,/body\.objective-turn-running #battleTopDock/);
});
test('the tactical map supports enlarge, zoom, pinch and pan without losing target selection',()=>{
 const panel=readFileSync(new URL('../src/battle-objective-turn-panel.js',import.meta.url),'utf8');
 const styles=readFileSync(new URL('../src/battle-objective-turn-panel.css',import.meta.url),'utf8');
 assert.match(panel,/data-map-zoom="in"/);
 assert.match(panel,/data-map-zoom="out"/);
 assert.match(panel,/data-map-zoom="reset"/);
 assert.match(panel,/data-map-expand/);
 assert.match(panel,/setPointerCapture/);
 assert.match(panel,/pointermove/);
 assert.match(panel,/pointerDist/);
 assert.match(panel,/pointerup/);
 assert.match(panel,/wheel/);
 assert.match(panel,/zoomMap/);
 assert.match(panel,/chooseChoice\(index\)/);
 assert.match(styles,/#objectiveTurnMapStep\.expanded/);
});
