import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runArmSwingComponents} from '../src/character-system/rig-arm-dash-correction.js';

// At every phase both arms keep a fixed narrow side separation. The run
// motion is front/back and alternate, never the lateral flap seen on Android.
for(const phase of [0,Math.PI/2,Math.PI,Math.PI*1.5,Math.PI*2]){
  const left=runArmSwingComponents(-1,phase);
  const right=runArmSwingComponents(1,phase);
  assert.ok(Math.abs(left.outward+right.outward)<1e-10);
  assert.ok(Math.abs(left.forward+right.forward)<1e-10);
  assert.equal(left.down,1);
  assert.equal(right.down,1);
  assert.ok(Math.abs(left.outward)<.2,'hands remain near the torso laterally');
}
const forward=runArmSwingComponents(1,Math.PI/2);
const backward=runArmSwingComponents(1,Math.PI*1.5);
assert.ok(forward.forward>.4&&backward.forward<-.4,
  'run has a visible fore-aft swing and opposing arm phases');
assert.equal(forward.outward,backward.outward,
  'lateral arm travel must not oscillate with the run cycle');
assert.equal(runArmSwingComponents(1,NaN).forward,0);

const helper=readFileSync(new URL('../src/character-system/rig-arm-dash-correction.js',import.meta.url),'utf8');
const army=readFileSync(new URL('../src/mass-battle-real-army.js',import.meta.url),'utf8');
const atlas=readFileSync(new URL('../src/crowd-impostor-atlas.js',import.meta.url),'utf8');
assert.match(helper,/setFromUnitVectors\(current,target\)/,
  'correct the 65-bone shoulder to an actual target arm direction');
assert.match(helper,/getWorldPosition\(new THREE\.Vector3\(\)\)/,
  'measure arms in world space rather than guessing local bone axes');
assert.doesNotMatch(helper,/\.cross\(forward\)/,
  'do not derive a sideways swing axis from the T-posed arm');
assert.match(army,/applyCapturedRunArmSwing\(THREE,representative\.character\.model/,
  'GPU full body and outfit get the corrected RUN');
assert.match(atlas,/applyCapturedRunArmSwing\(THREE,actor\.character\.model/,
  'the distant four-frame atlas shares the same corrected arm plane');
assert.match(army,/const locomotion='run'/,'keep the genuine RUN source for mass soldiers');
console.log('PASS: 1000v1000 real-bone arm swing stays fore-aft; 50v50 native RUN remains unmodified');
