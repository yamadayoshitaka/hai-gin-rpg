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

// Battle footwork and motion integration contract.
import fs from 'node:fs';
const motionSource=fs.readFileSync('src/universal-animation-runtime.js','utf8');
const gameSource=fs.readFileSync('src/game-runtime.js','utf8');
assert.ok(motionSource.includes("backwalk:'Walk_Loop'"));
assert.ok(motionSource.includes("sidestep:'Walk_Loop'"));
assert.ok(motionSource.includes("JOB_STRIKE_CANDIDATES"));
assert.ok(motionSource.includes("'Kick_Low'"));
assert.ok(gameSource.includes("guardBackwalking=walking&&combat.guardHeld"));
assert.ok(gameSource.includes("battleDepthMove=battleActive&&walking"));

// Guard / crouch animation contract: visible rig pose changes without moving colliders.
const visualSrc=fs.readFileSync('src/universal-animation-runtime.js','utf8');
const runtimeSrc=fs.readFileSync('src/game-runtime.js','utf8');
assert.ok(visualSrc.includes("guard:'Sword_Idle'"));
assert.ok(visualSrc.includes("crouch:'Idle_Loop'"));
assert.ok(visualSrc.includes("if(action==='crouch')"));
assert.ok(visualSrc.includes("if(action==='backwalk')"));
assert.ok(runtimeSrc.includes("crouchButton.setPointerCapture"));
assert.ok(runtimeSrc.includes("host===player&&player.userData.crouchHeld?'crouch'"));

// A crouch must hinge at the knees without bowing the torso or squashing the character.
const squatSource=fs.readFileSync('src/universal-animation-runtime.js','utf8');
assert.ok(squatSource.includes('rotate(motion.legBones.leftShin,1.38*crouch)'));
assert.ok(!squatSource.includes('rotate(motion.chestBones,.075*crouch)'));
assert.ok(!squatSource.includes('*(1-.23*crouch)'));
