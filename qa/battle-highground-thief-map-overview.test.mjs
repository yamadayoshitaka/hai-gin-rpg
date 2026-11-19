import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {battleJobSpecialActions} from '../src/battle-job-special-actions.js';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const controls=read('src/battle-realtime-commands.js');
const tactics=read('tactics-wireframe.html');
const highground=read('src/mass-battle-highground.js');
const simulation=read('src/mass-battle-grid-sim.js');
const css=read('src/battle-realtime-commands.css');

test('thief exposes dedicated unlock and steal actions before target selection',()=>{
 assert.deepEqual(battleJobSpecialActions('シーフ').map(a=>a.id),['unlock_door','steal_item']);
 assert.match(controls,/id="realtimeThiefUnlock"/);
 assert.match(controls,/id="realtimeThiefSteal"/);
 assert.match(controls,/showSpecialTargets\('dock',action\)/);
 assert.match(tactics,/const maxLock=members\.filter\(u=>u\.jobId==='thief'\)/);
 assert.match(tactics,/kind!=='door'\|\|o\.team===1/);
 assert.match(tactics,/開錠済み/);
});

test('selected rooftops and second-floor windows are visible with physical availability',()=>{
 assert.equal(battleJobSpecialActions('忍者').find(a=>a.id==='high_ground')?.target,'height');
 assert.match(tactics,/\/\/ Include enemy-side structures/);
 assert.match(tactics,/available,reason/);
 assert.match(tactics,/route\.points\.at\(-1\)/);
 assert.match(controls,/target\.available===false/);
 assert.match(controls,/t\.available!==false/);
 assert.doesNotMatch(highground,/if\(!windows\.length\)continue/);
 assert.match(highground,/if\(windows\.length\)\{/);
 const order=simulation.split('orderSquadHighGround(')[1].split('_assignHighGroundUnits(')[0];
 assert.doesNotMatch(order,/route\.team!==team/);
 assert.match(order,/_highGroundClaims\.has\(key\)/);
});

test('central radar tap switches the actual three-dimensional camera into overhead mode',()=>{
 assert.match(controls,/onMapOverview\(\{x:/);
 assert.match(controls,/strategy:event\.detail>=2/);
 assert.match(tactics,/onMapOverview:point=>\{/);
 assert.match(tactics,/battleViewMode='overview';commandOverviewLocked=false;controls\.enabled=true;/);
 assert.match(tactics,/setBattleCamera\(new THREE\.Vector3\(x,terrainY\(x,z\),z\),cameraOverviewOffset\);/);
 assert.match(css,/#realtimeBattleDock #realtimeThiefUnlock/);
});


test('high-ground target picker paints immediately, disables unavailable locations and focuses the actual 3D camera',()=>{
 const start=controls.indexOf('function showSpecialTargets(');
 const end=controls.indexOf('function showSpecialChoices(',start);
 assert.ok(start>=0&&end>start);
 const picker=controls.slice(start,end);
 assert.match(picker,/const focusHighGround=target=>/);
 assert.match(picker,/onMapOverview\(\{x:Math\.round\(target\.x\),z:Math\.round\(target\.z\)\}\)/);
 assert.match(picker,/focusHighGround\(shown\.find\(/);
 assert.match(picker,/focusHighGround\(target\)/);
 assert.match(picker,/button\.disabled=target\.available===false/);
 const mapEnd=picker.indexOf('  }else{',picker.indexOf('const isStructure='));
 const initialPaint=picker.indexOf('   paint();',picker.indexOf('const isStructure='));
 assert.ok(initialPaint>0&&initialPaint<mapEnd,'first render must paint the canvas before a click');
});


test('shield knight and thief engine aliases expose real special abilities in the live squad HUD',()=>{
 assert.deepEqual(battleJobSpecialActions('盗賊').map(action=>action.id),
  ['unlock_door','steal_item']);
 assert.deepEqual(battleJobSpecialActions('盾戦士').map(action=>action.id),
  ['frontline_guard']);
 assert.ok(battleJobSpecialActions('召喚士').some(action=>action.id==='summon_and_attack'));
 assert.ok(battleJobSpecialActions('弓使い').some(action=>action.id==='high_ground'));
 assert.match(tactics,/const job=squadPrimaryJob\(id\);/);
 assert.match(controls,/const isThief=specialJob\.includes\('シーフ'\)/);
 assert.match(controls,/\$\('realtimeThiefUnlock'\)\.hidden=dockTab!=='strategy'\|\|!isThief/);
});

test('every special target picker provides a dedicated enabled-after-selection confirmation',()=>{
 const begin=controls.indexOf('function showSpecialTargets(');
 const end=controls.indexOf('function showSpecialChoices(',begin);
 const picker=controls.slice(begin,end);
 assert.ok(begin>0&&end>begin);
 assert.match(picker,/この高所・対象で固有技を確定/);
 assert.match(picker,/この対象で固有技を確定/);
 assert.match(picker,/if\(origin==='dock'\)confirmDockStrategy\(\)/);
 assert.match(picker,/confirmButton\.disabled=true/);
 assert.match(picker,/confirmButton\.disabled=false/);
 assert.match(picker,/button\.disabled=target\.available===false/);
 const css=read('src/battle-realtime-commands.css');
 assert.match(css,/\.realtimeContextChoices \.realtimeMainConfirm\{\s*position:sticky;bottom:0/);
});

test('retired battle circle icons remain hidden behind the new two-sided squad HUD',()=>{
 assert.match(tactics,/body\.battle-realtime-clean #squadScreenLabels \.squadScreenLabel:not\(\[hidden\]\)/);
 assert.match(tactics,/display:none!important;visibility:hidden!important;pointer-events:none!important/);
 assert.match(tactics,/const job=squadPrimaryJob\(id\);/);
});
