import assert from 'node:assert/strict';
import {createBattleInputState,resolveBattleInput,resolveStrike,battleMovementVector,battleFacingYaw} from '../src/battle-controller.js';
const s=createBattleInputState();
const move=(x,z,time)=>resolveBattleInput(s,{x,z,time,battle:false,hasTarget:false});
assert.equal(move(1,0,100).dash,false,'first push never dashes');
assert.equal(move(1,0,200).dash,false,'holding never dashes');
move(0,0,260);
assert.equal(move(1,0,430).dash,true,'second direction push dashes in field');
move(0,0,470);
const q=createBattleInputState();
assert.equal(resolveBattleInput(q,{x:0,z:1,time:100,battle:false}).guard,false,'field no guard');
assert.equal(resolveBattleInput(createBattleInputState(),{x:0,z:-1,time:100,battle:true,hasTarget:true}).step,null,'single UP walks, never auto-steps');
assert.equal(resolveBattleInput(createBattleInputState(),{x:0,z:1,time:100,battle:true,hasTarget:true}).step,null,'single DOWN walks, never auto-steps');
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
assert.equal(resolveBattleInput(createBattleInputState(),{x:-1,z:0,time:100,battle:true,hasTarget:true,hero:sideHero,target:rightEnemy,camera:sideCamera}).parry,true,'forward towards opponent triggers parry');
assert.equal(resolveBattleInput(createBattleInputState(),{x:0,z:1,time:100,battle:true,hasTarget:true,hero:sideHero,target:leftEnemy,camera:sideCamera}).step,null,'single vertical DOWN remains walk input');

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
assert.ok(gameSource.includes("guardBackwalking=actuallyMoving&&combat.guardHeld&&inputCommand.guard"));
assert.ok(gameSource.includes("battleDepthMove=battleActive&&actuallyMoving"));

// Guard / crouch animation contract: visible rig pose changes without moving colliders.
const visualSrc=fs.readFileSync('src/universal-animation-runtime.js','utf8');
const runtimeSrc=fs.readFileSync('src/game-runtime.js','utf8');
assert.ok(visualSrc.includes("guard:'Sword_Idle'"));
assert.ok(visualSrc.includes("crouch:'Idle_Loop'"));
assert.ok(visualSrc.includes("const crouching=action==='crouch'"));
assert.ok(visualSrc.includes("if(action==='backwalk')"));
assert.ok(runtimeSrc.includes("crouchButton.addEventListener('pointerdown'"));
assert.ok(runtimeSrc.includes("host===player&&player.userData.crouchHeld?'crouch'"));

// A crouch must hinge at the knees without bowing the torso or squashing the character.
const squatSource=fs.readFileSync('src/universal-animation-runtime.js','utf8');
assert.ok(squatSource.includes('for(const chain of motion.crouchLegs)'));
assert.ok(!squatSource.includes('rotate(motion.chestBones,.075*crouch)'));
assert.ok(!squatSource.includes('*(1-.23*crouch)'));

// IK squat regression: no generic mesh squashing or torso folding; reset pelvis before mixer.
const ikSquatSource=fs.readFileSync('src/universal-animation-runtime.js','utf8');
assert.ok(ikSquatSource.includes('procedural crouch overlay'));
assert.ok(ikSquatSource.includes('rotate([chain.knee],-1.24*crouch)'));
assert.ok(ikSquatSource.includes('motion.pelvisBone.position.y=motion.pelvisBaseY;'));
assert.ok(!ikSquatSource.includes('rotate(motion.legBones.leftThigh,-.88*crouch)'));

// Front parry and up/down steps are edge-triggered. Holding cannot spam them.
const parryState=createBattleInputState();
const parryArgs={x:-1,z:0,battle:true,hasTarget:true,hero:sideHero,target:rightEnemy,camera:sideCamera};
assert.equal(resolveBattleInput(parryState,{...parryArgs,time:400}).parry,true);
assert.equal(resolveBattleInput(parryState,{...parryArgs,time:500}).parry,false);
resolveBattleInput(parryState,{...parryArgs,x:0,time:580});
assert.equal(resolveBattleInput(parryState,{...parryArgs,time:650}).parry,true);
const stepState=createBattleInputState();
assert.equal(resolveBattleInput(stepState,{x:0,z:-1,time:100,battle:true,hasTarget:true}).step,null);
assert.equal(resolveBattleInput(stepState,{x:0,z:-1,time:200,battle:true,hasTarget:true}).step,null);
resolveBattleInput(stepState,{x:0,z:0,time:250,battle:true,hasTarget:true});
assert.equal(resolveBattleInput(stepState,{x:0,z:1,time:350,battle:true,hasTarget:true}).step,null);
assert.ok(gameSource.includes("strikePad.appendChild(crouchButton)"),'crouch button must not live in hidden strike pad');
assert.ok(gameSource.includes("player.userData.crouchHeld=combat.crouchHeld&&!combat.dead"),'crouch works outside the battle state');
assert.ok(!gameSource.includes("if(combat.playerStamina<job.cost)"),'SP never gates techniques');
assert.ok(!gameSource.includes('id="hero-sp"'),'SP meter is removed');


// v116.9: only one battle control layout owns dimensions (not layered obsolete CSS).
const releaseHtml=fs.readFileSync('index.html','utf8');
for(const removed of ['combat-overrides-v1074','combat-authority-v108','combat-large-buttons-v1141','combat-layout-v1168','data-driven-control-layout-v88']){
 assert.ok(!releaseHtml.includes('<style id="'+removed+'">'),'old combat CSS must be removed: '+removed);
}
assert.equal((releaseHtml.match(/<style id="combat-controls-authority-v1170">/g)||[]).length,1);
assert.ok(releaseHtml.includes('grid-template-rows:repeat(2,92px)!important'),'combat buttons remain large');
assert.ok(releaseHtml.includes('grid-template-columns:repeat(2,minmax(0,1fr))!important'),'crouch remains a large independent touch control');
assert.ok(gameSource.includes("combat.dodgeKind=lateral?'sidestep':'backstep'"),'no active cartwheel');
const parryApproach=createBattleInputState();
const headOnParry=resolveBattleInput(parryApproach,{x:0,z:-1,time:123,battle:true,hasTarget:true,hero:{x:0,z:0},target:{x:0,z:5},camera:{x:0,z:-10}});
assert.equal(headOnParry.parry,true,'forward toward opponent activates parry first');
assert.equal(headOnParry.step,null,'forward parry does not launch a step');
const crouchMotionSource=fs.readFileSync('src/universal-animation-runtime.js','utf8');
assert.ok(crouchMotionSource.includes("crouch:'Idle_Loop'"),'library crouch uses an idle clip with procedural overlay');
assert.ok(crouchMotionSource.includes('filter(chain=>chain.hip&&chain.knee)'),'squat does not require optional foot bones');

// Second vertical press within the window triggers ONE evasive step; the first press walks.
const tapUp=createBattleInputState();
assert.equal(resolveBattleInput(tapUp,{x:0,z:-1,time:100,battle:true,hasTarget:true}).step,null);
resolveBattleInput(tapUp,{x:0,z:0,time:170,battle:true,hasTarget:true});
assert.equal(resolveBattleInput(tapUp,{x:0,z:-1,time:270,battle:true,hasTarget:true}).step,'backstep');
assert.equal(resolveBattleInput(tapUp,{x:0,z:-1,time:300,battle:true,hasTarget:true}).step,null);
assert.ok(gameSource.includes('combat.crouchHeld=!combat.crouchHeld'),'crouch touch toggles rather than instant release');
assert.ok(gameSource.includes("strikePad.style.display=battleActive?'grid':'none'"),'grid owner is not replaced by flex');
assert.ok(releaseHtml.includes('combat-controls-authority-v1170'),'current CSS authority is retained');
assert.ok(releaseHtml.includes('body .hud.brand b{font-size:clamp(23px'),'title must remain readable');

assert.ok(gameSource.includes('if(inputCommand.guard&&combat.guardHeld&&targetPosition)'),'forward parry cannot hijack camera-depth movement');
