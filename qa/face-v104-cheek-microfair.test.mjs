import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {v104CheekWeight,smoothV104Cheek}
 from '../src/face-v104-cheek-microfair.js';

test('v104 microfair never uses the broad v103 cheek filler field',()=>{
 assert.equal(v104CheekWeight({xn:.49,yn:.50,zn:.95,bodyType:'thin'}),0);
 assert.equal(v104CheekWeight({xn:.21,yn:.52,zn:.95}),0);
 assert.equal(v104CheekWeight({xn:.87,yn:.52,zn:.95}),0);
 assert.equal(v104CheekWeight({xn:.50,yn:.75,zn:.95}),0);
 assert.ok(v104CheekWeight({xn:.49,yn:.52,zn:.96})>0);
});

test('v104 limits displacement, preserves nose source, topology and other builds',()=>{
 const base=new THREE.SphereGeometry(.14,80,64);
 const source=base.getAttribute('position').array.slice();
 const originalIndex=Array.from(base.index.array);
 const female=base.clone();
 const p=female.getAttribute('position');
 // Deliberately uneven input mimics the ridged v102 surface at neutral.
 for(let i=0;i<p.count;i++){
  const x=Math.abs(source[3*i]/.14),y=(source[3*i+1]+.14)/.28;
  if(source[3*i+2]<0||x<.36)continue;
  const bump=.003*Math.exp(-.5*((x-.51)/.16)**2)*
   Math.exp(-.5*((y-.54)/.09)**2);
  p.setZ(i,p.getZ(i)+bump);
 }
 const before=p.array.slice();
 const r=smoothV104Cheek(female,{gender:'female',bodyType:'normal',
  ageWrinkles:0,donorPositions:source,donorCenterX:0,donorHalfWidth:.14});
 assert.equal(r.applied,true,JSON.stringify(r));
 assert.equal(r.base,'v102');assert.equal(r.noseVertexDelta,0);
 assert.ok(r.changedVertices>5);
 assert.ok(r.maxVertexDisplacement<=.28*.0024+1e-6);
 assert.deepEqual(Array.from(female.index.array),originalIndex);
 assert.deepEqual(Array.from(base.getAttribute('position').array),Array.from(source));
 let changed=0;
 for(let i=0;i<p.count;i++){
  assert.equal(p.getX(i),before[3*i]);
  assert.equal(p.getY(i),before[3*i+1]);
  const diff=p.getZ(i)-before[3*i+2];
  if(Math.abs(source[3*i]/.14)<=.345)assert.equal(diff,0);
  assert.ok(Math.abs(diff)<=r.maxAllowed*1.01);
  if(diff)changed++;
 }
 assert.ok(changed>5);
 for(const [gender,bodyType,ageWrinkles] of [
  ['male','normal',0],['female','thin',0],['female','normal',.8]
 ]){
  const copy=base.clone(),snapshot=copy.getAttribute('position').array.slice();
  const report=smoothV104Cheek(copy,{gender,bodyType,ageWrinkles});
  assert.equal(report.applied,false);
  assert.deepEqual(Array.from(copy.getAttribute('position').array),Array.from(snapshot));
  copy.dispose();
 }
 base.dispose();female.dispose();
});
