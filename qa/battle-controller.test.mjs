import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createBattleInputState,resolveBattleInput,consumeSpecialCommand,resolveStrike,battleMovementVector,battleFacingYaw,BATTLE_RULES} from '../src/battle-controller.js';

const hero={x:0,z:0},enemy={x:5,z:0},camera={x:0,z:-10};
// Screen-right is negative X when camera is on the -Z axis: enemy lies left.
const input=(state,x,z,time)=>resolveBattleInput(state,{x,z,time,battle:true,hasTarget:true,hero,target:enemy,camera});
const s=createBattleInputState();
assert.equal(input(s,0,-1,10).jump,true,'up starts jump');
assert.equal(input(s,0,-1,20).jump,false,'held up cannot auto-rejump');
assert.equal(input(s,0,0,40).crouch,false);
assert.equal(input(s,0,1,60).crouch,true,'down crouches');
assert.equal(input(s,0,0,90).crouch,false,'neutral stands');
assert.equal(input(s,1,0,120).guard,true,'away from opponent holds guard');
assert.equal(input(s,-1,0,140).guard,false,'towards opponent releases guard');
assert.equal(input(s,-1,0,150).parry,false,'forward never starts obsolete parry');
assert.equal(input(s,0,-1,160).step,null,'up never launches old dodge');
assert.equal(input(s,0,1,200).step,null,'down never launches old step');
const command=createBattleInputState();
input(command,0,1,100);
input(command,-.65,.65,190);
const ready=input(command,-1,0,270);
assert.equal(ready.specialReady,true,'down/down-forward/forward recognizes QCF command');
assert.equal(consumeSpecialCommand(command,280),true,'attack consumes command exactly once');
assert.equal(consumeSpecialCommand(command,285),false,'command cannot be reused');
const expire=createBattleInputState();
input(expire,0,1,100);input(expire,-.7,.7,200);input(expire,-1,0,300);
assert.equal(consumeSpecialCommand(expire,650),false,'special input expires');
const field=createBattleInputState();
const fieldMove=(x,z,time)=>resolveBattleInput(field,{x,z,time,battle:false,hasTarget:false});
assert.equal(fieldMove(1,0,100).dash,false);
fieldMove(0,0,170);
assert.equal(fieldMove(1,0,260).dash,true,'field double tap still dashes');
assert.ok(battleMovementVector({longitudinal:1,lateral:0},hero,enemy,camera).z>0);
assert.equal(battleFacingYaw({x:0,z:0},{x:0,z:5}),0);
assert.ok(resolveStrike(createBattleInputState(),'weak',0).damageMultiplier<resolveStrike(createBattleInputState(),'mid',0).damageMultiplier);
assert.ok(resolveStrike(createBattleInputState(),'strong',0).damageMultiplier>resolveStrike(createBattleInputState(),'mid',0).damageMultiplier);
assert.equal(resolveStrike(createBattleInputState(),'special',0).label,'必殺技');
const chain=createBattleInputState();
resolveStrike(chain,'weak',100);resolveStrike(chain,'mid',300);
assert.equal(resolveStrike(chain,'strong',500).finisher,'三連撃','weak-medium-strong combo must be reachable from arcade controls');
const game=fs.readFileSync('src/game-runtime.js','utf8');
const html=fs.readFileSync('index.html','utf8');
assert.ok(game.includes("const strikeButtons=['弱','中','強']"),'three arcade strengths are actual click handlers');
assert.ok(game.includes("consumeSpecialCommand(commandState,now)"),'controller command is wired to attack');
assert.ok(game.includes("combat.crouchHeld=!!(battleActive&&inputCommand.crouch"),'crouch is controlled by lever');
assert.ok(game.includes("combat.jumpRemaining=combat.jumpDuration"),'jump is controlled by lever');
assert.ok(game.includes("visualRoot.position.y=visualRoot.userData.arcadeBaseY"),'jump has visible vertical arc');
assert.ok(game.includes("player.userData.hitKnockback={vx:"),'hit knockback must move the actor backwards');
assert.ok(!game.includes("const crouchButton=document.createElement"),'old crouch button is deleted');
assert.equal((html.match(/combat-controls-authority-v1180/g)||[]).length,1);
for(const id of ['combat-overrides-v1074','combat-authority-v108','combat-large-buttons-v1141','combat-layout-v1168','data-driven-control-layout-v88']){
 assert.ok(!html.includes('<style id="'+id+'">'),'legacy competing CSS must be removed: '+id);
}
assert.ok(html.includes('grid-column:1/span 2!important'),'strong button gets full-width touch target');
console.log('PASS arcade v118: jump, crouch, back guard, three strengths, QCF special, knockback and controls');

assert.ok(game.includes('battleActive?Math.abs(inputX)>.12:strength>.09'),'vertical-only arcade input does not cause walking in place');
