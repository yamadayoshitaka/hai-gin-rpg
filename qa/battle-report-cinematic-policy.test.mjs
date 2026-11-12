import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const html=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
// Recover normally, but only one healing cut-in across the whole battle.
assert.match(html,/let firstHealingReportShown=false/);
assert.match(html,/previousHp>15\+previousHp|sum\.hp>previousHp\+15/);
assert.match(html,/!firstHealingReportShown/);
assert.match(html,/firstHealingReportShown=true/);
assert.match(html,/queueBattleResultCutin\('✚ 回復報告'/);
assert.doesNotMatch(html,/elapsed-\(marker\.userData\.lastHealReportAt\?\?-Infinity\)>12/,
 'No recurring healing cut-ins every twelve seconds');
// Charging is an order, NOT an achievement; only the defeated-squad event
// earns a victory/status report.
assert.match(html,/if\(mode!=='charge'\)battleDialogue\.push/);
assert.match(html,/if\(mode!=='charge'\)battleCeremony\.showOrder/);
assert.match(html,/queueBattleResultCutin\(defeatedEnemy\?'⚔ 敵部隊撃破':'☠ 味方部隊壊滅'/);
// Every strategic event has a brief camera highlight, followed by complete
// overhead view. 1000-person raids must throttle automatic UR highlights.
assert.match(html,/function queueBattleFocusCinematic\(x,z/);
assert.match(html,/kind==='ultimate'\|\|kind==='result'/);
assert.match(html,/stamp-lastAutomaticFocusAt<6500/);
assert.match(html,/cinematicFocusQueue\.push\(entry\)/);
assert.match(html,/overPosition:overTarget\.clone\(\)\.add\(cameraOverviewOffset\)/);
assert.match(html,/commanderCinematic=null;\s*setBattleCamera\(shot\.overTarget,cameraOverviewOffset\);\s*setCameraActive\('camOverview'\)/,
 'Cinematic completion must restore the full overview camera position and mode');
assert.match(html,/if\(next\.squadId!=null&&/);
assert.match(html,/beginSquadFocusCinematic\(next\.squadId,next\.cameraTeam\?\?0,'result'\)/);
assert.match(html,/queueBattleFocusCinematic\(\(target\.x-6\)\*CELL,\(target\.z-6\)\*CELL/);
assert.match(html,/const nextTarget=activeBuildingExplorations\.get\(key\)/);
assert.match(html,/queueBattleFocusCinematic\(\(task\.x-6\)\*CELL,\(task\.z-6\)\*CELL/);
assert.match(html,/availableCombatSkills\(e\.jobId,'UR'\)\.some\(skill=>skill\.rank==='UR'/);
assert.match(html,/!String\(e\.skillId\)\.startsWith\('chant:'\)/);
assert.match(html,/queueBattleFocusCinematic\(\(e\.x-6\)\*CELL,\(e\.z-6\)\*CELL/);
const script=html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
assert.ok(script);
const syntax=spawnSync(process.execPath,['--check','--input-type=module'],{
 input:script,encoding:'utf8',timeout:15000
});
assert.equal(syntax.status,0,syntax.stderr||'inline module parses');
console.log('PASS: one heal report, charge-annihilation milestones, full-map cinematics, UR cast-only zoom');
