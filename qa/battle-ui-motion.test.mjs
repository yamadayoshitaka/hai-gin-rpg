import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {selectMassBattleMotion} from '../src/character-system/battle-motion-policy.js';

const html=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
const gpu=readFileSync(new URL('../src/mass-battle-real-army.js',import.meta.url),'utf8');

for(const id of ['topBgm','topSurrender','showTopBgm','showTopSurrender','allyCasualties','enemyCasualties'])
  assert.match(html,new RegExp(`id="${id}"`),`${id} must exist`);
assert.match(html,/\$\('topBgm'\)\.onclick=\(\)=>\$\('soundToggle'\)\.click\(\)/,
  'Top BGM shortcut must operate the existing sound system');
assert.match(html,/closest\?\.\('#soundToggle,#topBgm'\)/,
  'First tap on either sound button must unlock audio instead of toggling it off');
assert.match(html,/\$\('topSurrender'\)\.onclick=\(\)=>\$\('surrender'\)\.click\(\)/,
  'Top surrender must keep the existing confirmation');
assert.match(html,/localStorage\.setItem\(key,String\(setting\.checked\)\)/,
  'Display preferences must persist');
assert.match(html,/initialCounts\[0\]-aliveCounts\[0\]\)\+'\/'\+initialCounts\[0\]/,
  'Friendly casualties have the initial strength as denominator');
assert.match(html,/initialCounts\[1\]-aliveCounts\[1\]\)\+'\/'\+initialCounts\[1\]/,
  'Enemy casualties have the initial strength as denominator');
assert.doesNotMatch(html,/requestMotion\(a,unit\.action==='skill'\?'skill'/,
  'AI snapshots must not overwrite render-frame walking animation');
assert.match(html,/selectMassBattleMotion\(massUnit,a\.speed,elapsed,a\.massAnimation\)/,
  'Detailed soldiers use a single motion policy');
assert.match(gpu,/walking \+= idle \* 0\.065/,
  'Instanced soldiers receive a subtle animated idle pose');
assert.match(gpu,/visualTime\*\(u\.action==='blocked'\?1\.4:\.8\)/,
  'Stationary instanced soldiers advance their gesture phase');

const unit=(action,props={})=>({alive:true,action,moveDuration:0,moveElapsed:0,hitFlash:0,...props});
let motion=selectMassBattleMotion(unit('idle'),3.2,0);
assert.equal(motion.state,'idle');
motion=selectMassBattleMotion(unit('walk',{moveDuration:.5,moveElapsed:.1}),3.2,.1,motion);
assert.equal(motion.state,'walk');
motion=selectMassBattleMotion(unit('walk',{moveDuration:.5,moveElapsed:.1}),5.1,.2,motion);
assert.equal(motion.state,'run','Speed selects the running action on a moving soldier');
motion=selectMassBattleMotion(unit('attack'),3.2,.25,motion);
assert.equal(motion.state,'attack');
motion=selectMassBattleMotion(unit('idle'),3.2,.42,motion);
assert.equal(motion.state,'attack','An AI tick cannot erase an attack before it finishes');
motion=selectMassBattleMotion(unit('idle'),3.2,.95,motion);
assert.equal(motion.state,'idle','The pose returns to idle when its hold expires');
motion=selectMassBattleMotion(unit('attack',{attackElapsed:.9}),3.2,1,motion);
assert.equal(motion.state,'idle','A soldier waiting through an attack cooldown must not freeze on an attack frame');
motion=selectMassBattleMotion(unit('attack',{attackElapsed:0}),3.2,1.1,motion);
assert.equal(motion.state,'attack','The next actual attack must restart its motion');
motion=selectMassBattleMotion(unit('idle'),3.2,1.8,motion);
assert.equal(motion.state,'idle');
motion=selectMassBattleMotion(unit('blocked'),3.2,1.9,motion);
assert.equal(motion.state,'idle','Blocked soldiers do not skate in place while their root is stationary');
motion=selectMassBattleMotion(unit('hit',{hitFlash:1}),3.2,2.0,motion);
assert.equal(motion.state,'hit');
motion=selectMassBattleMotion(unit('idle'),3.2,2.15,motion);
assert.equal(motion.state,'hit','Hit reactions stay visible for a minimum duration');
motion=selectMassBattleMotion(unit('walk',{moveDuration:.8,moveElapsed:.2}),3.2,2.2,motion);
assert.equal(motion.state,'walk','Actual locomotion overrides a held stationary gesture');
assert.equal(selectMassBattleMotion({alive:false},3.2,2,motion).state,'dead');

console.log('Top BGM/surrender visibility, casualty fractions, per-soldier animation continuity PASS');
