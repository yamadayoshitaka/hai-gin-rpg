import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {auditFacialTopology,fitTopologyNasalSideProfile,
 createThreeRingVestibuleIndices,createTopologyOralMuscleField}
 from '../src/face-muscle-topology-v95.js';

const makeProfile=()=>{
 const g=new THREE.SphereGeometry(1,48,36);
 g.computeBoundingBox();
 const box=g.boundingBox,d=box.getSize(new THREE.Vector3()),p=g.getAttribute('position');
 const cx=box.getCenter(new THREE.Vector3()).x;
 for(let i=0;i<p.count;i++){
  const ax=Math.abs((p.getX(i)-cx)/(d.x*.5));
  const ny=(p.getY(i)-box.min.y)/d.y;
  const field=Math.exp(-.5*(ax/.15)**2)
   *Math.exp(-.5*((ny-.58)/.068)**2);
  if(p.getZ(i)>.50)p.setZ(i,p.getZ(i)+.48*field);
 }
 p.needsUpdate=true;g.computeBoundingBox();g.computeVertexNormals();
 return g;
};

test('v95 topology audit reports actual indexed edges and keeps source triangles',()=>{
 const g=makeProfile(),before=Array.from(g.index.array);
 const a=auditFacialTopology(g);
 assert.equal(a.valid,true);
 assert.ok(a.edges>1000&&a.triangleCount>2000);
 assert.equal(a.invalidTriangles,0);
 assert.deepEqual(Array.from(g.index.array),before);
 g.dispose();
});

test('v95 profile changes nose DEPTH using connected edge flow, not a floating frontal nose',()=>{
 const donor=makeProfile(),g=donor.clone();
 const before=Array.from(g.getAttribute('position').array);
 const indexBefore=Array.from(g.index.array);
 const report=fitTopologyNasalSideProfile(g,{gender:'female',ageWrinkles:0});
 assert.equal(report.applied,true,JSON.stringify(report));
 assert.equal(report.topologyDriven,true);
 assert.ok(report.verticesAffected>5,JSON.stringify(report));
 assert.ok(report.connectedVisited>report.connectedNoseSeeds);
 assert.ok(report.maxReduction>0&&report.maxReduction<.4);
 assert.equal(report.normalInversionRejected,0,'Result cannot invert real nose triangles');
 const p=g.getAttribute('position');
 let reduced=0,unchanged=0;
 for(let i=0;i<p.count;i++){
  assert.equal(p.getX(i),before[i*3]);
  assert.equal(p.getY(i),before[i*3+1]);
  assert.ok(p.getZ(i)<=before[i*3+2]+1e-8);
  if(p.getZ(i)<before[i*3+2]-1e-5)reduced++;
  else unchanged++;
 }
 assert.ok(reduced>5&&unchanged>100,'Only local nasal profile changes');
 assert.deepEqual(Array.from(g.index.array),indexBefore);
 assert.deepEqual(Array.from(donor.getAttribute('position').array),before,
  'Original face donor is never mutated');
 g.dispose();donor.dispose();
});

test('v95 sex-separated facial profile does not shrink the male source head',()=>{
 const g=makeProfile(),before=Array.from(g.getAttribute('position').array);
 const r=fitTopologyNasalSideProfile(g,{gender:'male'});
 assert.equal(r.applied,false);
 assert.deepEqual(Array.from(g.getAttribute('position').array),before);
 g.dispose();
});

test('v95 actual oral topology generates two anatomical quad strips across three rings',()=>{
 const n=40,idx=createThreeRingVestibuleIndices(n);
 assert.equal(idx.length,n*2*6);
 for(let i=0;i<idx.length;i++)assert.ok(idx[i]>=0&&idx[i]<n*3);
 assert.throws(()=>createThreeRingVestibuleIndices(3),/mouth boundary/);
 const g=new THREE.SphereGeometry(1,24,16);
 const r=createTopologyOralMuscleField(g,[0,1,2]);
 assert.equal(r.valid,false,'Bad unrelated oral rings must fail closed');
 g.dispose();
});
