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
// Only full command-team defeat/collapse and confirmed item acquisition can
// automatically reframe the camera; ordinary orders, UR skills and reports cannot.
assert.match(html,/function queueBattleFocusCinematic\(x,z/);
assert.match(html,/if\(kind!=='annihilation'&&kind!=='loot'\)return false/);
assert.match(html,/stamp-lastAutomaticFocusAt<1400/);
assert.match(html,/priority>commanderCinematic.priority/);
assert.match(html,/cinematicFocusQueue\.push\(entry\)/);
assert.match(html,/const autoShotKind=next\.kind==='loot'\?'loot'/);
assert.match(html,/beginSquadFocusCinematic\(next\.squadId,next\.cameraTeam\?\?next\.team\?\?0,autoShotKind\)/);
assert.match(html,/const nextTarget=activeBuildingExplorations\.get\(key\)/);
assert.match(html,/queueBattleFocusCinematic\(\(task\.x-6\)\*CELL,\(task\.z-6\)\*CELL/);
assert.doesNotMatch(html,/kind:'ultimate'/,
 'UR attack effects must not autonomously alter the battlefield camera');
assert.match(html,/if\(manualCameraSquad\)applyOverviewCamera\(manualCameraSquad\.mode\)/,
 'An automatic milestone must restore the last explicitly selected team camera');
const script=html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
assert.ok(script);
const syntax=spawnSync(process.execPath,['--check','--input-type=module'],{
 input:script,encoding:'utf8',timeout:15000
});
assert.equal(syntax.status,0,syntax.stderr||'inline module parses');
console.log('PASS: one heal report, charge-annihilation milestones, camera-mode preserving cinematics, UR cast-only zoom');
