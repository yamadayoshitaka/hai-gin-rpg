import assert from 'node:assert/strict';
import {createBattleInputState,resolveBattleInput,resolveStrike,battleMovementVector,battleFacingYaw} from '../src/battle-controller.js';
const s=createBattleInputState();
const move=(x,z,time)=>resolveBattleInput(s,{x,z,time,battle:true,hasTarget:true});
assert.equal(move(0,-1,100).dash,false,'first push never dashes');
assert.equal(move(0,-1,200).dash,false,'holding never dashes');
move(0,0,260);
assert.equal(move(0,-1,430).dash,true,'second forward push dashes');
move(0,0,470);
assert.equal(move(0,1,500).guard,true,'back lever guards');
assert.equal(move(0,1,500).dash,false,'guard cannot trigger dash');
const q=createBattleInputState();
assert.equal(resolveBattleInput(q,{x:0,z:1,time:100,battle:false}).guard,false,'outside battle no guard');
const hero={x:0,z:0},enemy={x:0,z:5},camera={x:0,z:-10};
let v=battleMovementVector({longitudinal:1,lateral:0},hero,enemy,camera);
assert.ok(v.z>0,'forward approaches target');
v=battleMovementVector({longitudinal:-1,lateral:0},hero,enemy,camera);
assert.ok(v.z<0,'back retreats from target');
v=battleMovementVector({longitudinal:0,lateral:1},hero,enemy,camera);
assert.ok(v.x<0,'right lever follows the camera screen-right axis');
v=battleMovementVector({longitudinal:0,lateral:1},hero,enemy,{x:10,z:0});
assert.ok(v.z<0,'right lever stays screen-right after battle camera swings to the side');
assert.equal(battleFacingYaw(hero,enemy),0);
const c=createBattleInputState();
resolveStrike(c,'mid',0);resolveStrike(c,'low',300);
assert.equal(resolveStrike(c,'mid',600).finisher,'三連撃');
assert.equal(resolveStrike(c,'mid',3200).finisher,null,'timed out combo');
const c2=createBattleInputState();
resolveStrike(c2,'low',3300);resolveStrike(c2,'mid',3500);
assert.equal(resolveStrike(c2,'special',3700).finisher,'崩し奥義');
console.log('PASS battle v115: double tap, guard, front/back, strafing and combos');

// Screen-right faces world -X when the camera looks from -Z to +Z.
const sideHero={x:0,z:0},sideCamera={x:0,z:-10};
const leftEnemy={x:-5,z:0},rightEnemy={x:5,z:0};
assert.equal(resolveBattleInput(createBattleInputState(),{x:-1,z:0,time:100,battle:true,hasTarget:true,hero:sideHero,target:leftEnemy,camera:sideCamera}).guard,true,'screen-left retreats from enemy at world -X');
assert.equal(resolveBattleInput(createBattleInputState(),{x:1,z:0,time:100,battle:true,hasTarget:true,hero:sideHero,target:rightEnemy,camera:sideCamera}).guard,true,'screen-right retreats from enemy at world +X');
assert.equal(resolveBattleInput(createBattleInputState(),{x:-1,z:0,time:100,battle:true,hasTarget:true,hero:sideHero,target:rightEnemy,camera:sideCamera}).guard,false,'approaching enemy never guards');
assert.equal(resolveBattleInput(createBattleInputState(),{x:0,z:1,time:100,battle:true,hasTarget:true,hero:sideHero,target:leftEnemy,camera:sideCamera}).guard,false,'orthogonal sidestep does not guard');

// Defensive contract: retreat is deliberately slower than battle walking and perfect guard is time-limited.
import {BATTLE_RULES} from '../src/battle-controller.js';
assert.ok(BATTLE_RULES.guard.retreatSpeed<BATTLE_RULES.movement.battleSpeed);
assert.ok(BATTLE_RULES.guard.perfectWindowSeconds>0&&BATTLE_RULES.guard.perfectWindowSeconds<.3);
