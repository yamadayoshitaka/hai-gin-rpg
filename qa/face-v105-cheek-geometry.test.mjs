import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {v102CheekContourField,fairV102CheekContour}
 from '../src/face-v102-cheek-contour.js';

test('v105 removes the old deep cheek cut in thin and normal body types',()=>{
 for(const bodyType of ['thin','normal']){
  const old=v102CheekContourField({xn:.45,yn:.56,zn:.96,
   mode:'v102',bodyType});
  const next=v102CheekContourField({xn:.45,yn:.56,zn:.96,
   mode:'v105',bodyType});
  assert.ok(old.dz<-.012,'The v102 carved relief is reproducible');
  assert.ok(next.dz>old.dz*.25,
   'v105 cannot excavate a deep cheekbone trench');
  assert.ok(Math.abs(next.dz)<.010,
   'The corrective field is shallow and cannot make a new mound');
  assert.equal(v102CheekContourField({xn:.20,yn:.56,mode:'v105',
   bodyType}).dz,0);
 }
});
test('v105 actual indexed face clips any cut while conserving donor nasal topology',()=>{
 const donor=new THREE.SphereGeometry(.14,72,56);
 donor.computeBoundingBox();
 const original=donor.getAttribute('position').array.slice();
 const prior=donor.clone(),legacy=donor.clone();
 const bodyType='thin',depth=.28;
 const before=prior.getAttribute('position').array.slice();
 const report=fairV102CheekContour(prior,{gender:'female',
  mode:'v105',bodyType,ageWrinkles:0,
  donorPositions:original,donorCenterX:0,donorHalfWidth:.14});
 assert.equal(report.applied,true,JSON.stringify(report));
 assert.equal(report.version,105);
 assert.equal(report.donorCapVertices,0);
 assert.equal(report.maxNoseChange,0);
 assert.ok(report.changedVertices>8);
 assert.deepEqual(Array.from(prior.index.array),Array.from(donor.index.array));
 let nose=0,moved=0,maxRecess=0,maxFill=0;
 const p=prior.getAttribute('position');
 for(let i=0;i<p.count;i++){
  const relative=p.getZ(i)-before[i*3+2];
  if(Math.abs(original[i*3]/.14)<=.345){
   nose++;assert.equal(relative,0,'Original nose and mouth lock');
  }
  maxRecess=Math.min(maxRecess,relative);
  maxFill=Math.max(maxFill,relative);
  if(relative)moved++;
 }
 assert.ok(nose>50&&moved>8);
 assert.ok(maxRecess>=-depth*.0053);
 assert.ok(maxFill<=depth*.0105);
 const old=fairV102CheekContour(legacy,{gender:'female',
  mode:'v102',bodyType,
  donorPositions:original,donorCenterX:0,donorHalfWidth:.14});
 assert.equal(old.applied,true);
 donor.dispose();prior.dispose();legacy.dispose();
});
