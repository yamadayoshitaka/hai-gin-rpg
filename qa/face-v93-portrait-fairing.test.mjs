import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {fairYoungPortraitSurface} from '../src/face-portrait-fairing-v93.js';

const makeFace=()=>{
 const geometry=new THREE.SphereGeometry(.14,36,28);
 const p=geometry.getAttribute('position');
 geometry.computeBoundingBox();
 const b=geometry.boundingBox,d=b.getSize(new THREE.Vector3()),cx=b.getCenter(new THREE.Vector3()).x;
 // Sculpt a deliberately sharp, unflattering lower-cheek depression into
 // an owned test geometry with the same normalized head coordinates.
 for(let i=0;i<p.count;i++){
  const ax=Math.abs((p.getX(i)-cx)/(d.x*.5)),ny=(p.getY(i)-b.min.y)/d.y;
  const f=Math.exp(-.5*((ax-.49)/.19)**2)*Math.exp(-.5*((ny-.47)/.085)**2);
  if(p.getZ(i)>0)p.setZ(i,p.getZ(i)-d.z*.060*f);
 }
 p.needsUpdate=true;
 return geometry;
};

test('v93 fairing softens cheek creases on editable geometry but preserves lips and source',()=>{
 const original=makeFace(),face=original.clone();
 const before=face.getAttribute('position').array.slice();
 const result=fairYoungPortraitSurface(face,{gender:'female',ageWrinkles:0,bodyType:'ultraThin'});
 assert.ok(result.applied&&result.vertices>20);
 assert.ok(result.maxMove<face.boundingBox.getSize(new THREE.Vector3()).z*.10);
 const p=face.getAttribute('position'),b=original.boundingBox||new THREE.Box3().setFromBufferAttribute(original.getAttribute('position'));
 const d=b.getSize(new THREE.Vector3()),cx=b.getCenter(new THREE.Vector3()).x;
 let boosted=0,lipUnchanged=0;
 for(let i=0;i<p.count;i++){
  assert.equal(original.getAttribute('position').getZ(i),before[i*3+2],'Original donor clone never mutates');
  assert.equal(p.getX(i),before[i*3]);
  assert.equal(p.getY(i),before[i*3+1]);
  const ax=Math.abs((before[i*3]-cx)/(d.x*.5));
  const ny=(before[i*3+1]-b.min.y)/d.y;
  if(ax>.36&&ax<.66&&ny>.40&&ny<.51&&before[i*3+2]>0&&p.getZ(i)>before[i*3+2])boosted++;
  if(ax<.09&&Math.abs(ny-.509)<.028&&Math.abs(p.getZ(i)-before[i*3+2])<1e-12)lipUnchanged++;
 }
 assert.ok(boosted>5,'Skeletal young mid-cheeks must regain depth');
 assert.ok(lipUnchanged>0,'Original donor lip seam remains untouched');
});

test('v93 mature and male models retain their established anatomy',()=>{
 for(const opts of [{gender:'male',ageWrinkles:0},{gender:'female',ageWrinkles:1}]){
  const face=makeFace(),before=face.getAttribute('position').array.slice();
  const report=fairYoungPortraitSurface(face,opts);
  assert.equal(report.applied,false);
  assert.deepEqual(Array.from(face.getAttribute('position').array),Array.from(before));
 }
});
