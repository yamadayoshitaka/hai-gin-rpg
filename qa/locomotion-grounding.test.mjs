import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {clipTimeForStepPhase,groundedModelY,footfallAtPhase,footPlantWeight}
  from '../src/character-system/locomotion-sync.js';

const read=name=>readFileSync(new URL(name,import.meta.url),'utf8');
const runtime=read('../src/character-system/shared-character-runtime.js');
const game=read('../tactics-wireframe.html');
const gpu=read('../src/mass-battle-real-army.js');

for(const duration of [.55,1.2,2.5]){
  assert.equal(clipTimeForStepPhase(0,duration),0);
  assert.ok(Math.abs(clipTimeForStepPhase(Math.PI,duration)-duration/2)<1e-9);
  assert.ok(Math.abs(clipTimeForStepPhase(3*Math.PI/2,duration)-duration*.75)<1e-9);
  assert.equal(clipTimeForStepPhase(2*Math.PI,duration),0);
  assert.ok(Math.abs(clipTimeForStepPhase(-Math.PI/2,duration)-duration*.75)<1e-9);
}

// The old `baseline + (rest - lowest)` target settles at half the required
// boot correction. A terrain contact error must instead adjust current Y.
assert.equal(groundedModelY(.15,0,0,-.05,1.8),.20);
assert.equal(groundedModelY(.20,0,0,0,1.8),.20);
assert.equal(groundedModelY(0,0,0,-.8,1.8),1.8*.24);
assert.equal(groundedModelY(0,0,0,.8,1.8),-1.8*.18);
assert.equal(footfallAtPhase(2.5*Math.PI).step,2);
assert.ok(Math.abs(footfallAtPhase(2.5*Math.PI).progress-.5)<1e-9);
assert.equal(footPlantWeight(0),0);
assert.equal(footPlantWeight(.2),1);
assert.equal(footPlantWeight(.7),0);

assert.match(runtime,/current\.time=clipTimeForStepPhase\(locomotionPhase,current\.getClip\(\)\.duration\)/,
  'Every live rig samples its authored animation from actual travelled steps');
assert.match(runtime,/lockDelta\.copy\(plantAnchor\)\.sub\(plantedPosition\)/,
  'The planted boot is constrained to its world-space anchor');
assert.match(runtime,/groundedModelY\(model\.position\.y,baselineY,restFootY,lowestFoot\(\),height\)/,
  'Height correction uses the true local boot position');
assert.match(game,/syncLocomotionPhase\(massUnit\._visualMotion\?\.phase\?\?massSim\.getStepPhase\(massUnit,massAlpha\)\)/,
  'Detailed soldiers sample the same smoothed distance-driven foot phase as the GPU army');
assert.match(game,/Math\.PI\*\(a\.gaitSteps\|\|0\)/,
  '50v50 detailed soldiers also follow physical distance rather than wall time');
assert.match(game,/if\(u\.moveDuration>0&&u\.moveElapsed<u\.moveDuration\)/,
  'All soldiers interpolate terrain/bridge height, not only the ninja job');
assert.match(gpu,/attribute==='crowdWalkA'\?Math\.PI\*1\.5:Math\.PI\*\.5/,
  'The instanced army captures opposite footfalls at known cycle locations');
assert.doesNotMatch(gpu,/physicallyMoving\|\|u\.action==='walk'\?1/,
  'Stale walk flags cannot drag an idle soldier in-place');

console.log('Distance-matched gait, planted-foot locking, ground contact and 50/1000 soldier parity PASS');
