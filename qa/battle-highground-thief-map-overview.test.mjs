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
