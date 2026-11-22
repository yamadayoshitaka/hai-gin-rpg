import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {classifyDonorOralInterior} from '../src/face-native-oral-rig-v88.js';

test('v94 open mouth hides pre-existing donor skin covering oral interior without touching source',()=>{
 const ring=[],vertices=[],triangles=[];
 for(let i=0;i<40;i++){
  const angle=i*Math.PI*2/40;
  ring.push(i);
  vertices.push(.16*Math.cos(angle),.51+.022*Math.sin(angle),.70);
 }
 // Mouth skin cross-fan triangle, in front of actual dental geometry.
 vertices.push(-.02,.509,.69, .02,.509,.69, 0,.516,.69);
 const cross=[40,41,42];
 vertices.push(-1,0,.1,1,0,.1,1,1,.1,-1,1,.1);
 for(let i=0;i<40;i++)triangles.push(i,(i+1)%40,43);
 triangles.push(...cross);
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
 geometry.setIndex(triangles);
 geometry.computeBoundingBox();
 const src=geometry.getAttribute('position').array.slice();
 const original=Array.from(geometry.index.array);
 const clipped=classifyDonorOralInterior(geometry,ring,original);
 assert.equal(clipped.removed,1,'Hide the offending original face triangle while open');
 assert.equal(clipped.opened.length,original.length-3);
 assert.ok(clipped.hidden.has('40/41/42'));
 assert.deepEqual(Array.from(geometry.index.array),original,'Neutral donor triangles must stay recoverable');
 assert.deepEqual(Array.from(geometry.getAttribute('position').array),Array.from(src));
 geometry.dispose();
});

test('v94 unverified rim cannot clip unrelated face polygons',()=>{
 const sphere=new THREE.SphereGeometry(1,24,16);sphere.computeBoundingBox();
 const tris=Array.from(sphere.index.array);
 const result=classifyDonorOralInterior(sphere,[0,1,2],tris);
 assert.equal(result.removed,0);
 assert.deepEqual(result.opened,tris);
 sphere.dispose();
});
