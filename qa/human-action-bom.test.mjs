import assert from 'node:assert/strict';
import {HUMAN_ACTIONS,resolveHumanAction,calculateHumanPose,validateHumanActions} from '../src/human-action-bom.js';
assert.equal(validateHumanActions(),true);
assert.equal(resolveHumanAction({}), 'idle');
assert.equal(resolveHumanAction({moving:true}), 'walk');
assert.equal(resolveHumanAction({moving:true,running:true}), 'run');
assert.equal(resolveHumanAction({attack:true,moving:true}), 'attack');
assert.equal(resolveHumanAction({dead:true,attack:true}), 'dead');
for(const action of Object.keys(HUMAN_ACTIONS)){
 for(const t of [0,.1,.35,1.3]){
  const p=calculateHumanPose(action,t);
  for(const key of ['hips','knees','ankles','shoulders','elbows','wrists']){
   assert.equal(p[key].length,2,action+':'+key);
   assert.ok(p[key].every(Number.isFinite),action+':'+key);
  }
 }
}
assert.ok(Math.abs(calculateHumanPose('walk',.1).hips[0]-calculateHumanPose('walk',.1).hips[1])>.1);
assert.ok(calculateHumanPose('idle',0).shoulders.every(a=>Math.abs(a)<.5),'idle arms relaxed');
console.log('Human action BOM: PASS');
