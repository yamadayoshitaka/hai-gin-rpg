import test from 'node:test';
import assert from 'node:assert/strict';
import {blinkAmountAt,nextBlinkGap,attachRealisticFace} from '../src/character-system/facial-blink-runtime.js';
import * as THREE from 'three';

test('blink closes quickly, briefly fully shuts and smoothly reopens',()=>{
 assert.equal(blinkAmountAt(0),0);
 assert.ok(blinkAmountAt(.05)>0&&blinkAmountAt(.05)<1);
 assert.equal(blinkAmountAt(.10),1);
 assert.equal(blinkAmountAt(.14),1);
 assert.ok(blinkAmountAt(.23)>0&&blinkAmountAt(.23)<1);
 assert.equal(blinkAmountAt(.31),0);
 assert.equal(blinkAmountAt(NaN),0);
});
test('automatic intervals are bounded and staggered across soldiers',()=>{
 const gaps=[];
 for(let id=1;id<51;id++)for(let n=0;n<4;n++){
  const gap=nextBlinkGap(id,n);
  assert.ok(gap>=2.4&&gap<=6);
  gaps.push(gap);
 }
 assert.ok(new Set(gaps.map(x=>x.toFixed(3))).size>185);
});
test('head/eye mismatch is treated as unsupported rather than faking blinking',()=>{
 const root=new THREE.Group();
 const face=attachRealisticFace(root);
 assert.equal(face.supported,false);
 assert.equal(face.forceBlink(),false);
 assert.equal(face.diagnostics().supported,false);
});
