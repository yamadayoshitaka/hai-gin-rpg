import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {damageNumberStyle} from '../src/damage-number-style.js';
import {massGaitActive,sampleMassVisualMotion} from '../src/mass-visual-motion.js';

assert.deepEqual(damageNumberStyle(12),{tier:'light',color:'#f5f8ff',size:16});
assert.deepEqual(damageNumberStyle(25),{tier:'medium',color:'#ffe16d',size:17});
assert.deepEqual(damageNumberStyle(60),{tier:'heavy',color:'#ff9346',size:18});
assert.deepEqual(damageNumberStyle(100),{tier:'devastating',color:'#ff5268',size:19});
assert.deepEqual(damageNumberStyle(4,0),{tier:'fatal',color:'#fa83f5',size:19});
assert.equal(damageNumberStyle(99,20).tier,'heavy',
 'damage colour may not depend on ally/enemy team or remaining HP except fatal');

const overlay=readFileSync(new URL('../src/confirmed-hit-overlay.js',import.meta.url),'utf8');
assert.doesNotMatch(overlay,/ctx\.arc\(/,'red/blue impact circles completely removed');
assert.doesNotMatch(overlay,/ctx\.strokeStyle=hit\.team/,
 'damage is coloured by amount rather than by faction');
assert.match(overlay,/const style=damageNumberStyle\(hit\.damage,hit\.remainingHp\)/);
assert.match(overlay,/ctx\.fillStyle=style\.color;ctx\.fillText/,
 'severity colour applied to the visible floating damage number');
assert.match(overlay,/const hp='HP '\+hit\.remainingHp/,
 'remaining hit points are still visible without target rings');

const unit=(id,direction)=>({
 id,alive:true,fromX:6,fromZ:6,x:6+direction[0],z:6+direction[1],
 facingX:direction[0],facingZ:direction[1],completedSteps:0,
 moveDuration:.5,moveElapsed:0,action:'walk',highGroundPhase:0
});
function renderPath(actor,dx,dz){
 let first=sampleMassVisualMotion(actor,{x:0,y:0,z:0},1,1/60,1),last=first;
 for(let i=1;i<=90;i++){
  const t=i/90;actor.moveElapsed=t*.5;
  const next=sampleMassVisualMotion(actor,{x:dx*t,y:0,z:dz*t},i+1,1/60,1);
  assert.ok(next.phase>=last.phase,'distance-driven phase never runs backwards');
  last=next;
 }
 return last;
}
const cardinal=unit(1,[1,0]),diagonal=unit(2,[1,1]);
const card=renderPath(cardinal,1,0);
const diag=renderPath(diagonal,1,1);
assert.ok(card.phase>5.8&&card.phase<6.3,'one cardinal game tile is one full real dash run cycle');
assert.ok(diag.phase>8.2&&diag.phase<9.0,
 'a diagonal grid step travels sqrt(2) farther and animates sqrt(2) more footfalls');
assert.ok(Math.abs(diag.phase/card.phase-Math.SQRT2)<.035,
 'distance cadence is proportional to actual interpolated root travel');
assert.ok(massGaitActive(diagonal),'last visible Worker easing remains running');
diagonal.action='attack';diagonal.moveElapsed=diagonal.moveDuration;
const before=diag.phase;
sampleMassVisualMotion(diagonal,{x:1.005,y:0,z:1.005},92,1/60,1);
assert.ok(diagonal._visualMotion.phase>=before,'post-tick visual easing continues gait');
assert.ok(massGaitActive(diagonal),'a strike does not freeze feet during residual root easing');
diagonal.action='blocked';
assert.equal(massGaitActive(diagonal),false,'a genuinely blocked actor is not running on the spot');
const prev=diagonal._visualMotion.phase;
sampleMassVisualMotion(diagonal,{x:30,y:0,z:30},93,1/60,1);
assert.equal(diagonal._visualMotion.phase,prev,'teleports never create fake foot strides');

const gpu=readFileSync(new URL('../src/mass-battle-real-army.js',import.meta.url),'utf8');
assert.match(gpu,/float stance=smoothstep\(0\.035,0\.16,contactProgress\)/);
assert.match(gpu,/runPose\.z\+=\(0\.46-contactProgress\*0\.92\)\*shoeMask\*activeFoot\*stance/,
 'GPU planted boot must counter forward movement with full-contact displacement');
assert.match(gpu,/real-rig-crowd-packed-v10-distance-planted-dash/,
 'WebGL shader programs are invalidated');
const page=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
assert.match(page,/confirmed-hit-overlay\.js\?v=4\.6\.35/,
 'mobile browser must load the version with no hit circles');
assert.match(page,/mass-visual-motion\.js\?v=4\.6\.35/,
 'mobile browser must load the distance-derived gait');
console.log('PASS: damage numbers replace impact rings, 5 severity colours, HP preserved, diagonal+worker footfalls match actual distance');
