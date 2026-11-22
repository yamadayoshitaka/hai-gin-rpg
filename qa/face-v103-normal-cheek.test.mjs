import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {v103NormalCheekField,repairV103NormalCheek}
 from '../src/face-v103-normal-cheek.js';

const field=(xn,yn,bodyType='normal',ageWrinkles=0)=>
 v103NormalCheekField({xn,yn,zn:.97,bodyType,ageWrinkles});

test('v103 reference-style young normal face has smooth mid-cheek without adding a high ridge',()=>{
 const lower=field(.48,.47),mid=field(.49,.50),crest=field(.49,.60);
 assert.ok(lower.dz>0,'Gently support the cheek hollow below the bone');
 assert.ok(mid.dz>0,'Midface has a continuous shallow rounded surface');
 assert.ok(crest.dz<mid.dz,'Upper cheek cannot become a new pointed hill');
 assert.ok(mid.dz<.035,'Do not overinflate a normal young cheek');
 for(const x of [.0,.18,.285,.30,.9])
  assert.equal(field(x,.50).dz,0,'Native nostril/ear zone protected');
 assert.equal(field(.50,.48,'thin').dz,0);
 assert.equal(field(.50,.48,'ultraThin').dz,0);
 assert.equal(field(.50,.48,'normal',.9).dz,0);
 assert.equal(field(.50,.30).dz,0,'Jaw and mouth are excluded');
});

test('v103 edits real indexed cheek topology without changing nose, mouth, male or source',()=>{
 const donor=new THREE.SphereGeometry(.14,72,56);
 donor.computeBoundingBox();
 const original=donor.getAttribute('position').array.slice();
 const idx=Array.from(donor.getIndex().array);
 const surface=donor.clone();
 const attr=surface.getAttribute('position'),depth=.28;
 for(let i=0;i<attr.count;i++){
  const x=Math.abs(original[i*3]/.14),y=(original[i*3+1]+.14)/.28;
  const z=original[i*3+2];if(z<0)continue;
  const crest=Math.exp(-.5*((x-.49)/.16)**2)*
   Math.exp(-.5*((y-.59)/.055)**2);
  const hollow=Math.exp(-.5*((x-.49)/.22)**2)*
   Math.exp(-.5*((y-.49)/.055)**2);
  attr.setZ(i,z+depth*(.05*crest-.045*hollow));
 }
 const before=attr.array.slice();
 const report=repairV103NormalCheek(surface,{
  gender:'female',ageWrinkles:0,bodyType:'normal',
  donorPositions:original,donorCenterX:0,donorHalfWidth:.14
 });
 assert.equal(report.applied,true,JSON.stringify(report));
 assert.equal(report.version,103);
 assert.equal(report.nasalMax,0);
 assert.ok(report.changedVertices>12&&report.filledVertices>5);
 assert.deepEqual(Array.from(surface.index.array),idx);
 assert.deepEqual(Array.from(donor.getAttribute('position').array),Array.from(original));
 let lowerFilled=0,unchangedNose=0,unchangedRear=0;
 for(let i=0;i<attr.count;i++){
  const ax=Math.abs(original[i*3]/.14),y=(original[i*3+1]+.14)/.28;
  const z=before[i*3+2],next=attr.getZ(i);
  assert.equal(attr.getX(i),before[i*3],'X silhouette unchanged');
  assert.equal(attr.getY(i),before[i*3+1],'Y contour unchanged');
  if(ax>.40&&ax<.61&&y>.46&&y<.53&&next>z)lowerFilled++;
  if(ax<=.305){
   assert.equal(next,z,'Original nose, tip and philtrum must be EXACT');
   unchangedNose++;
  }
  if(original[i*3+2]<-.10&&next===z)unchangedRear++;
 }
 assert.ok(lowerFilled>3,'Real lower-midcheek vertices regain volume');
 assert.ok(unchangedNose>10&&unchangedRear>10);
 for(const [g,b,age] of [['male','normal',0],['female','thin',0],['female','normal',.8]]){
  const clone=donor.clone(),saved=clone.getAttribute('position').array.slice();
  assert.equal(repairV103NormalCheek(clone,{
   gender:g,bodyType:b,ageWrinkles:age
  }).applied,false);
  assert.deepEqual(Array.from(clone.getAttribute('position').array),Array.from(saved));
  clone.dispose();
 }
 surface.dispose();donor.dispose();
});
