const assert=require('node:assert/strict');
const {decide,visualDelta,failureKind}=require('./wardrobe-quality-feedback.cjs');
const make=(value,failed=false)=>({mode:'fast',tested:failed?5:6,expected:6,
 records:Array.from({length:6},(_,i)=>({job:'job0'+(i+1),sex:'male',visualSample:Array(18).fill(value)})),
 failures:failed?[{error:'Helmet obscured all hair'}]:[]});
const before=make(9),after=make(9),changed=make(20);
assert.equal(visualDelta(after,before).averageFraction,0);
assert.ok(visualDelta(changed,before).averageFraction>.004);
assert.equal(decide(after,before,null).action,'review_visual_result');
const once=decide(after,before,null),twice=decide(after,before,once);
assert.equal(twice.action,'change_direction');
assert.equal(twice.focus,'unchanged');
assert.equal(decide(changed,before,twice).stalledIterations,0);
assert.equal(failureKind('Hair GLB missing'),'hair_headwear');
const failed=decide(make(9,true),before,null);
assert.equal(failed.action,'fix_regression');
assert.equal(decide(make(9,true),before,failed).action,'change_direction');
console.log('PASS wardrobe quality feedback and bounded pivot detection');
