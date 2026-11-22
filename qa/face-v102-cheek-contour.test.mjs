import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {v102CheekContourField,fairV102CheekContour}
 from '../src/face-v102-cheek-contour.js';

const field=(xn,yn,zn=.96,ageWrinkles=0)=>
 v102CheekContourField({xn,yn,zn,ageWrinkles});

test('v102 removes upper cheek shelves while keeping the lower cheek full and nasal region isolated',()=>{
 const crest=field(.45,.56),lower=field(.47,.455);
 assert.ok(crest.dz<-.012,'Remove the raised cheek ridge');
 assert.ok(lower.dz>0,'Support the lower cheek rather than hollowing it');
 assert.equal(field(.20,.56).dz,0,'Keep native nose completely fixed');
 assert.equal(field(.9,.56).dz,0,'Keep ear and silhouette fixed');
 assert.equal(field(.45,.85).dz,0,'Keep eyes and forehead fixed');
 assert.equal(field(.45,.56,.1).dz,0,'Keep rear skull fixed');
 assert.equal(field(.45,.56,.96,.9).dz,0,'Preserve mature age features');
 assert.ok(Math.abs(field(-.45,.56).dz-crest.dz)<1e-12,'Both cheeks match');
});

test('v102 original indexed donor caps artificially raised cheek without moving the nose',()=>{
 const donor=new THREE.SphereGeometry(.14,72,56);
 donor.computeBoundingBox();
 const original=donor.getAttribute('position').array.slice();
 const originalIndices=Array.from(donor.getIndex().array);
 const head=donor.clone();
 const attr=head.getAttribute('position');
 const depth=donor.boundingBox.max.z-donor.boundingBox.min.z;
 for(let i=0;i<attr.count;i++){
  const x=Math.abs(original[i*3]/.14);
  const y=(original[i*3+1]+.14)/.28;
  const z=original[i*3+2];
  if(z<=0)continue;
  const peak=Math.exp(-.5*((x-.45)/.14)**2)*
   Math.exp(-.5*((y-.56)/.06)**2);
  const hollow=Math.exp(-.5*((x-.47)/.20)**2)*
   Math.exp(-.5*((y-.455)/.06)**2);
  attr.setZ(i,z+depth*(.085*peak-.018*hollow));
 }
 const before=attr.array.slice();
 const result=fairV102CheekContour(head,{
  gender:'female',ageWrinkles:0,donorPositions:original,
  donorCenterX:0,donorHalfWidth:.14
 });
 assert.equal(result.applied,true,JSON.stringify(result));
 assert.equal(result.version,102);
 assert.equal(result.donorAnchored,true);
 assert.equal(result.maxNoseChange,0);
 assert.ok(result.crestBack>4,'Raised cheek crest recedes');
 assert.ok(result.lowerFill>2,'Lower cheek is not flattened');
 assert.ok(result.donorCapVertices>0,'Donor envelope engages on an artificial ridge');
 assert.ok(result.changedVertices>20);
 assert.deepEqual(Array.from(head.getIndex().array),originalIndices);
 assert.deepEqual(Array.from(donor.getAttribute('position').array),Array.from(original));
 let reduced=0,nasal=0,untouchedBack=0;
 for(let i=0;i<attr.count;i++){
  const ax=Math.abs(original[i*3]/.14);
  const y=(original[i*3+1]+.14)/.28;
  const z=before[i*3+2],next=attr.getZ(i);
  assert.ok(Number.isFinite(next));
  if(ax>.35&&ax<.60&&y>.52&&y<.61&&next<z)reduced++;
  if(ax<=.285){
   assert.equal(next,z,'Nose/philtrum vertex is immutable');
   nasal++;
  }
  if(original[i*3+2]<-.1&&next===z)untouchedBack++;
 }
 assert.ok(reduced>4);
 assert.ok(nasal>10);
 assert.ok(untouchedBack>10);
 const male=donor.clone(),old=donor.clone();
 assert.equal(fairV102CheekContour(male,{gender:'male',donorPositions:original}).applied,false);
 assert.equal(fairV102CheekContour(old,{gender:'female',ageWrinkles:1,donorPositions:original}).applied,false);
 assert.deepEqual(Array.from(male.getAttribute('position').array),Array.from(original));
 assert.deepEqual(Array.from(old.getAttribute('position').array),Array.from(original));
 donor.dispose();head.dispose();male.dispose();old.dispose();
});
