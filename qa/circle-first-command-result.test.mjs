import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {ORDER_COOLDOWN_SECONDS,secondsUntilNextOrder} from '../src/battle-command-roster.js';

const html=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
const ceremony=readFileSync(new URL('../src/battle-ceremony.js',import.meta.url),'utf8');

// The screen-space circular markers REPLACE both mirrored squad sidebars.
assert.match(html,/#allySquadRibbon,#enemySquadRibbon,#squadCircleInfo\{display:none!important\}/);
assert.match(html,/title\.textContent=\(team===0\?'🔵 ':'🔴 '\)\+\(Number\(id\)\+1\)\+'隊'/);
assert.match(html,/label\.userDataStrength\.textContent=sum\.n\+'\/'\+sum\.total/);
assert.match(html,/if\(pendingCircleTarget\)\{chooseCircleActionTarget\(id,team\);return;\}/);
assert.match(html,/if\(team===0\)\{[\s\S]*?openSquadTactics\(id\)/);
assert.match(html,/if\(unavailable\)\{[\s\S]*?号令と道具は使用できません/);

// Three fixed rows fit the circle, without exposing the long objective line.
assert.match(html,/width:var\(--squadCircleSize,64px\)!important/);
assert.match(html,/id="squadCalloutLines"/);
assert.match(html,/#squadScreenLabels \.squadScreenLabel\[hidden\]\{display:none!important\}/);
assert.match(html,/\.squadScreenLabel>span\[hidden\]\{display:none!important\}/);
assert.match(html,/label\.userDataCurrentOrder\.hidden=false/);
assert.match(html,/label\.userDataObjective\.hidden=true/);
assert.match(html,/marker\.userData\.visualTarget\.set\(x,terrainY\(x,z\)\+0\.35,z\)/);
assert.match(html,/bottom:Math\.min\(rect\.bottom-4,reportTop-6\)/);
assert.match(html,/const points=\[\];/);
assert.match(html,/layoutSquadCallouts\(points,bounds,prior\)/);
assert.doesNotMatch(html,/if\(occupied\.some\(/,'Every squad must remain visible');
assert.doesNotMatch(html,/Math\.ceil\(attempt\/2\)\*68/,
 'Projected squad location must never drift for overlap avoidance');
assert.match(html,/squadMarkerClock>=\.25/,
 'Moving squad anchors must refresh frequently enough to stay with runners');
assert.match(html,/marker\.position\.copy\(marker\.userData\.visualTarget\)/,
 'Marker must sit on its actual centroid without an extra motion lag');
assert.doesNotMatch(html,/marker\.position\.lerp\(marker\.userData\.visualTarget/,
 'Never make screen markers trail behind their squads');

// One tap selects source, then action, then the in-world target.
assert.match(html,/squadQuickPage==='home'/);
assert.match(html,/\['📯 号令','orders'\],\['🎒 アイテム','items'\]/);
assert.match(html,/function beginCircleTargetSelection\(kind,itemId=null\)/);
assert.match(html,/function chooseCircleActionTarget\(id,team\)/);
assert.match(html,/if\(action\.kind==='item'\)ok=useSquadBattleItem\(action\.itemId,id,action\.source\)/,
 'Targeted item use must charge the issuing squad rather than the target');
assert.match(html,/else if\(action\.kind==='support'\)\{/);
assert.match(html,/if\(ok\)markRibbonOrderIssued\(action\.source\)/,
 'Recovery order consumes the commanding squads own 60s interval');
assert.match(html,/targetSquadId:String\(id\),x:Math\.round\(center\.x\)/);
assert.match(html,/if\(ok\)\{[\s\S]*?closeSquadTactics\(true\);\s*return true;\s*\}/,
 'Successful circle target selection must close the picker and restore overview');

// Player command selection ALWAYS pauses the battle in a locked far overview.
// The existing 5-minute tactical bank still counts down but cannot resume combat mid-selection.
assert.match(html,/if\(!paused\)setBattlePaused\(true\)/,
 'Opening the command selector pauses even after the tactical bank expires');
assert.match(html,/function enterCommandOverview\(\)\{[\s\S]*?commandOverviewLocked=true;[\s\S]*?controls\.enabled=false;[\s\S]*?setBattleCamera\(new THREE\.Vector3\(center,terrainY\(center,center\),center\),cameraOverviewOffset\);[\s\S]*?setCameraActive\('camOverview'\)/,
 'Opening a squad order must lock camera controls and switch to full-map overview');
assert.match(html,/function beginCircleTargetSelection\(kind,itemId=null\)[\s\S]*?enterCommandOverview\(\)/,
 'Circle target selection must invoke the locked full-map camera');
assert.match(html,/commandOverviewLocked=true/);
assert.match(html,/controls\.enabled=false/);
assert.match(html,/tacticalBankRemaining=Math\.max\(0,tacticalBankRemaining-bankDelta\)/);
assert.match(html,/if\(tacticalBankRemaining<=0\)\{tacticalPlanningActive=false;if\(!commandOverviewLocked\)setBattlePaused\(false\);\}/,
 'Reaching zero time must not resume combat while choosing targets');
assert.match(html,/if\(previous&&!finished&&paused!==previous\.wasPaused\)setBattlePaused\(previous\.wasPaused\)/,
 'Command completion restores the pause state from before selection');
assert.equal(ORDER_COOLDOWN_SECONDS,60);
assert.equal(secondsUntilNextOrder(10,50),20);
assert.equal(secondsUntilNextOrder(10,130),0);

// Reports carry REAL post-action state, and appear only after result cut-ins.
assert.match(ceremony,/showResult:detail=>\{if\(!locked\)begin\('result',detail\);\}/);
assert.match(html,/function updateBattleResultCutins\(\)/);
assert.match(html,/if\(battleCeremony\.state!=='idle'\)return/);
assert.match(html,/battleCeremony\.showResult\(next\.title\)/);
assert.match(html,/reportAfterBattleCutin\(next\.text,next\)/);
assert.match(html,/queueBattleResultCutin\('🎁 アイテム入手'/);
assert.match(html,/queueBattleResultCutin\('✚ 回復報告'/);
assert.match(html,/queueBattleResultCutin\(defeatedEnemy\?'⚔ 敵部隊撃破':'☠ 味方部隊壊滅'/);
assert.match(html,/function animate\(\)\{[\s\S]*?battleCeremony\.update\(\);[\s\S]*?updateBattleResultCutins\(\)/,
 'The frame must update the ceremony before presenting queued result cut-ins');

const match=html.match(/<script type="module">([\s\S]*?)<\/script>/);
assert.ok(match,'Battle module exists');
const syntax=spawnSync(process.execPath,['--check','--input-type=module'],{
 input:match[1],encoding:'utf8',timeout:15000
});
assert.equal(syntax.status,0,syntax.stderr||'Battle module syntax');
console.log('PASS circle-only squad command UX, target choice, always-frozen overview, 60s lock and post-cutin reports');
