import assert from 'node:assert/strict';
import {helmetFitForHead} from '../src/character-system/helmet-fit-policy.js';

const head={x:.23,y:.255,z:.21};
const small={x:.125,y:.16,z:.113};
const fitting=helmetFitForHead(head,small);
assert.ok(fitting[0]>2.2,'An undersized helmet must grow beyond the old 1.55x maximum');
assert.ok(fitting[2]>2.2,'An undersized helmet must also cover the back of the head');
assert.ok(fitting[1]>1.65,'The metal crown must cover the scalp and hairline');
assert.ok(small.x*fitting[0]>=head.x*1.3,'The fitted helmet must provide hair clearance at the temples');
assert.ok(small.z*fitting[2]>=head.z*1.3,'The fitted helmet must provide hair clearance at the nape');
const large=helmetFitForHead(head,{x:.42,y:.45,z:.44});
assert.ok(large.every(n=>n<1.4),'An oversized source helmet must not expand absurdly');
assert.deepEqual(helmetFitForHead(head,small),fitting,'Fit is deterministic per measured head');
console.log('PASS anatomically measured world-space helmet fit');
