import assert from 'node:assert/strict';
import {CLOTH_FIT_POLICY,resolveClothRadius} from '../src/character-system/outfit-clearance-policy.js';

assert.ok(CLOTH_FIT_POLICY.maximumFactor<=1.07,'cloth relief must be a small margin, not a padded suit');
const nominal=[.073,.061,.058,.045,.108,.082,.085,.055];
let tested=0;
for(const radius of nominal){
 for(const ratio of [.5,.85,1,1.15,1.45,1.75]){
  const samples=Array.from({length:80},(_,i)=>radius*ratio*(.91+.18*i/79));
  const actual=resolveClothRadius(radius,samples);
  assert.ok(actual>=radius*1.012-1e-8,`too tight: ${radius}/${ratio}`);
  assert.ok(actual<=radius*1.065+1e-8,`baggy: ${radius}/${ratio} -> ${actual}`);
  tested++;
 }
 const noSamples=resolveClothRadius(radius);
 assert.ok(noSamples<=radius*1.065,`fallback oversized: ${radius}`);
 tested++;
}
assert.throws(()=>resolveClothRadius(0),/positive/);
console.log(`PASS ${tested} anatomical cloth radius cases: sleeve/trouser relief capped at 6.5%`);
