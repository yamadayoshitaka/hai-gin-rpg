import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {chooseBlockedMovementDetour} from '../src/battle-movement-recovery.js';

// A detour is only chosen from caller-supplied *legal and unoccupied* tiles.
// This guards crowded hut/bridge exits without allowing teleportation.
assert.deepEqual(chooseBlockedMovementDetour({
 x:10,z:10,goalX:14,goalZ:10,
 previousX:9,previousZ:10,
 neighbors:[{x:9,z:10},{x:10,z:9},{x:10,z:11}]
}),{x:10,z:9});
assert.equal(chooseBlockedMovementDetour({
 x:10,z:10,goalX:14,goalZ:10,neighbors:[]
}),null,'No legal step means wait without clipping through terrain');
assert.equal(chooseBlockedMovementDetour({
 x:10,z:10,goalX:Infinity,goalZ:10,neighbors:[{x:11,z:10}]
}),null,'Invalid goal cannot move a soldier');

const html=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
const grid=readFileSync(new URL('../src/mass-battle-grid-sim.js',import.meta.url),'utf8');
assert.match(html,/id="showAllySquadRibbon" type="checkbox" checked/);
assert.match(html,/id="showEnemySquadRibbon" type="checkbox" checked/);
assert.match(html,/ribbon\.hidden=!control\.checked/);
assert.match(html,/#allySquadRibbon\[hidden\],#enemySquadRibbon\[hidden\]\{display:none!important\}/);
assert.match(html,/id="lockedSquadStrategies"/);
assert.match(html,/refreshLockedSquadStrategyList\(\)/);
assert.match(html,/開戦後は変更不可/);
assert.match(html,/\$\('strategy'\)\.disabled=true/);
const strategyListener=html.match(/\$\('strategy'\)\.onchange=e=>\{([^}]+)\}/);
assert.ok(strategyListener);
assert.doesNotMatch(strategyListener[1],/setStrategy|lastGlobalOrderAt/);
const radarStart=html.indexOf("miniCanvas.addEventListener('pointerup',event=>{");
const radarEnd=html.indexOf('drawSquadMiniMap();\n});',radarStart);
assert.ok(radarStart>0&&radarEnd>radarStart);
const radarHandler=html.slice(radarStart,radarEnd);
assert.doesNotMatch(radarHandler,/openSquadTactics\(/,'Radar may move the camera, but must never open orders');
assert.match(radarHandler,/setBattleCamera\(/);
assert.match(html,/function recoverBlockedActor\(/);
assert.match(html,/recoverBlockedActor\(a,goal\)/);
assert.match(html,/if\(!enemy&&squadDirective\?\.mode!=='move'\)/);
assert.match(grid,/chooseBlockedMovementDetour\(/);
assert.match(grid,/u\.blockedTicks>=6/);
assert.match(grid,/occupied\[index\]!==-1/);
console.log('PASS: radar is navigation only, side labels toggle independently, strategy read-only, movement detour is collision-safe');
