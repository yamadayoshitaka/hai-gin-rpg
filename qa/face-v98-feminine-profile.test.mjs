import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {feminineMidfaceNoseDelta,refineFeminineMidfaceNose}
 from '../src/face-v98-feminine-profile.js';

const at=(xn,yn,zn=.95,ageWrinkles=0)=>
 feminineMidfaceNoseDelta({xn,yn,zn,ageWrinkles});

test('v98 real neutral cheeks become fuller without hollowing the mouth or ears',()=>{
 const upper=at(.48,.563);
 const lower=at(.49,.484);
 assert.ok(upper.dz>.04,'Actual upper malar area gains volume');
 assert.ok(lower.dz>0,'Lower cheek remains softly supported');
 assert.ok(upper.dx>0,'Malar width is supported, never pinched');
 assert.deepEqual(at(.9,.563),{dx:0,dy:0,dz:0,cheek:0,alar:0});
 assert.deepEqual(at(.48,.9),{dx:0,dy:0,dz:0,cheek:0,alar:0});
 assert.deepEqual(at(.48,.563,.10),{dx:0,dy:0,dz:0,cheek:0,alar:0});
});
test('v98 narrow nostrils are part of the native nose; tip drops with no pig-nose bulge',()=>{
 const alar=at(.18,.555);
 const other=at(-.18,.555);
 const tip=at(.035,.571);
 assert.ok(alar.dx<0&&other.dx>0,'Both alar wings narrow symmetrically');
 assert.ok(tip.dy<0,'Upturned nasal tip points down');
 assert.ok(tip.dz<0,'Rounded nose tip projects less');
 assert.ok(Math.abs(alar.dx+other.dx)<1e-12);
 const lip=at(.06,.505),nostril=at(.10,.55);
 assert.ok(Math.abs(lip.dy)<Math.abs(nostril.dy),
  'Native lip boundary has soft nasal isolation');
});
test('v98 mature faces are not silently replaced with youthful cheeks',()=>{
 assert.deepEqual(at(.48,.563,.95,.8),{dx:0,dy:0,dz:0,cheek:0,alar:0});
});
test('v98 sculpt preserves indexed donor geometry and male model',()=>{
 const original=new THREE.SphereGeometry(.14,72,56);
 const source=original.getAttribute('position').array.slice();
 const indices=Array.from(original.index.array);
 const female=original.clone();
 const report=refineFeminineMidfaceNose(female,{gender:'female',ageWrinkles:0});
 assert.equal(report.applied,true,JSON.stringify(report));
 assert.ok(report.verticesAffected>12);
 assert.ok(report.cheekVertices>0&&report.alarVertices>0);
 assert.ok(report.blend>0);
 assert.deepEqual(Array.from(original.getAttribute('position').array),Array.from(source));
 assert.deepEqual(Array.from(female.index.array),indices);
 let refilled=0,narrowed=0,unmodifiedBack=0;
 const p=female.getAttribute('position'),b=original.boundingBox||
  new THREE.Box3().setFromBufferAttribute(original.getAttribute('position'));
 const d=b.getSize(new THREE.Vector3());
 for(let i=0;i<p.count;i++){
  const x=source[i*3],y=source[i*3+1],z=source[i*3+2];
  const ax=Math.abs(x)/(d.x*.5),ny=(y-b.min.y)/d.y;
  if(z>0&&ax>.38&&ax<.60&&ny>.49&&ny<.62&&p.getZ(i)>z)
   refilled++;
  if(z>0&&ax>.13&&ax<.24&&ny>.53&&ny<.59&&
    Math.abs(p.getX(i))<Math.abs(x))narrowed++;
  if(z<-.10&&p.getX(i)===x&&p.getY(i)===y&&p.getZ(i)===z)
   unmodifiedBack++;
 }
 assert.ok(refilled>5,'Young cheek topology receives actual Z volume');
 assert.ok(narrowed>2,'Original nasal vertices become narrower');
 assert.ok(unmodifiedBack>20,'Rear skull remains immutable');
 assert.ok(female.userData.v98FeminineMidfaceNose);
 const male=original.clone();
 assert.equal(refineFeminineMidfaceNose(male,{gender:'male'}).applied,false);
 assert.deepEqual(Array.from(male.getAttribute('position').array),Array.from(source));
 original.dispose();female.dispose();male.dispose();
});
