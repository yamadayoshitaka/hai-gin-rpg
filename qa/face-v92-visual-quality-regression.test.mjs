import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {shapeRebuiltEyeBand} from '../src/face-scalp-wig.js';
import {createFaceOralAnatomy} from '../src/face-oral-anatomy-v80.js';

const box=new THREE.Box3(new THREE.Vector3(-.5,0,-.5),new THREE.Vector3(.5,1,.5));

test('v92 long face-framing 3D hair is clear of BOTH pupils across the whole eye band',()=>{
 for(const side of [-1,1]){
  const root=new THREE.Vector3(side*.22,.94,.37);
  const eye=new THREE.Vector3(side*.105,.73,.38);
  const cheek=new THREE.Vector3(side*.12,.62,.35);
  const hair=[root.clone(),eye.clone(),cheek.clone()];
  shapeRebuiltEyeBand(hair,{box,side});
  assert.deepEqual(hair[0].toArray(),root.toArray(),'Do not move the scalp follicle');
  assert.ok(side*hair[1].x>=.325-1e-6,
   'A hair ribbon must have full-width clearance beyond the eye and lashes');
  assert.ok(side*hair[2].x>=.325-1e-6,
   'Long front locks must continue down the temple rather than snapping back across the cheek');
 }
});

test('v92 rear and side-back guides keep their original path',()=>{
 const hair=[
  new THREE.Vector3(-.2,.95,-.30),
  new THREE.Vector3(-.1,.77,-.32),
  new THREE.Vector3(-.12,.58,.39)
 ];
 const original=hair.map(v=>v.clone());
 shapeRebuiltEyeBand(hair,{box,side:-1});
 for(let i=0;i<hair.length;i++)assert.deepEqual(hair[i].toArray(),original[i].toArray());
});

test('v92 teeth do not overlap into double-wide white central fangs in the real 3D dental arcade',()=>{
 const head=new THREE.Group();
 const oral=createFaceOralAnatomy(head,{width:.12,height:.3,depth:.2});
 const left=oral.root.getObjectByName('V80_UPPER_TOOTH_06');
 const right=oral.root.getObjectByName('V80_UPPER_TOOTH_07');
 assert.ok(left&&right);
 const centerGap=right.position.x-left.position.x;
 assert.ok(centerGap>=left.scale.x+right.scale.x,
  'Central incisor crowns must not overlap after real 3D scaling');
 oral.update({openness:.70,jawDrop:.70,smile:.80});
 assert.equal(oral.upper.visible,true,'Natural large laugh should expose the upper teeth');
 assert.equal(oral.lower.visible,false,'Large laugh must not show a second dangling lower fang row');
 assert.equal(oral.tongue.visible,true);
 oral.update({openness:0,jawDrop:0,smile:0});
 assert.equal(oral.root.visible,false,'Neutral mouth must conceal all oral interiors');
 oral.dispose();
});
