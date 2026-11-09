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

// One tap selects source, then action, then the in-world target.
assert.match(html,/squadQuickPage==='home'/);
assert.match(html,/\['📯 号令','orders'\],\['🎒 アイテム','items'\]/);
assert.match(html,/function beginCircleTargetSelection\(kind,itemId=null\)/);
assert.match(html,/function chooseCircleActionTarget\(id,team\)/);
assert.match(html,/if\(action\.kind==='item'\)ok=useSquadBattleItem\(action\.itemId,id\)/);
assert.match(html,/else if\(action\.kind==='support'\)\{/);
assert.match(html,/if\(ok\)markRibbonOrderIssued\(action\.source\)/,
 'Recovery order consumes the commanding squads own 120s interval');
assert.match(html,/targetSquadId:String\(id\),x:Math\.round\(center\.x\)/);
assert.match(html,/if\(ok\)\{closeSquadTactics\(\);return true;\}/);

// The established finite planning budget pauses the simulation while choosing.
assert.match(html,/if\(!paused&&tacticalBankRemaining>0\)\{tacticalPlanningActive=true;setBattlePaused\(true\);\}/);
assert.match(html,/tacticalBankRemaining=Math\.max\(0,tacticalBankRemaining-bankDelta\)/);
assert.match(html,/if\(tacticalBankRemaining<=0\)\{tacticalPlanningActive=false;setBattlePaused\(false\);\}/);
assert.equal(ORDER_COOLDOWN_SECONDS,120);
assert.equal(secondsUntilNextOrder(10,50),80);
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
assert.match(html,/battleCeremony\.update\(\);\s*updateBattleResultCutins\(\)/);

const match=html.match(/<script type="module">([\s\S]*?)<\/script>/);
assert.ok(match,'Battle module exists');
const syntax=spawnSync(process.execPath,['--check','--input-type=module'],{
 input:match[1],encoding:'utf8',timeout:15000
});
assert.equal(syntax.status,0,syntax.stderr||'Battle module syntax');
console.log('PASS circle-only squad command UX, target choice, timed pause, 120s lock and post-cutin reports');
