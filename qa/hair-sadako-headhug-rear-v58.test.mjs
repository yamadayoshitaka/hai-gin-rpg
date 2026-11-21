import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createScalpFirstLongGuide,createScalpAnchoredWig} from '../src/face-scalp-wig.js';

test('Sadako top-grown canopy hugs the head instead of fanning sideways',()=>{
 const box=new THREE.Box3(new THREE.Vector3(-1,-1,-1),new THREE.Vector3(1,1,1));
 for(const side of [-1,1]){
  const root=new THREE.Vector3(side*.12,.95,.01);
  const guide=createScalpFirstLongGuide({
   root,normal:new THREE.Vector3(side*.18,.97,.02).normalize(),
   box,zone:'crown',length:3.4,trimY:-5,segments:18,
   whorl:new THREE.Vector3(0,.95,-.12),
   targetX:side*.68,targetZ:root.z,crownOverSide:true,volumeSpread:0
  });
  assert.deepEqual(guide[0].toArray(),root.toArray(),
   'actual scalp follicle must not move');
  const onHead=guide.filter(p=>p.y>.20);
  assert.ok(onHead.length>3,'must produce a curved scalp section');
  assert.ok(onHead.every(p=>side*p.x<.68),
   'crown hair must not make a horizontal wing beyond the side of the head');
  assert.ok(guide[6].y<guide[1].y-.20,
   'canopy should turn downward before extending far past the temples');
 }
});

test('rear-rooted locks clear actual torso rather than switching to front side',()=>{
 const geometry=new THREE.SphereGeometry(.5,32,24);
 geometry.computeVertexNormals();
 const head=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial());
 let rearContacts=0;
 const bodyCollisionResolver={
  query:(_x,y)=>y<.06?{front:.11,rear:-.11}:null,
  resolve:(point,{side='nearest'}={})=>{
   if(point.y>=.06)return false;
   if(side==='rear'&&point.z>-.14){
    point.z=-.14;rearContacts++;return true;
   }
   if(side==='front'&&point.z<.14){point.z=.14;return true;}
   return false;
  }
 };
 const wig=createScalpAnchoredWig(head,{
  styleId:'sadako-straight-long',color:0x76513a,count:160,
  bodyCollisionResolver,visualFiberMultiplier:3,staticGroom:true,
  normalLayeredSingleMesh:false
 });
 const rear=wig.getStyleSamples().filter(s=>
  s.zone.startsWith('back')||s.zone.startsWith('nape'));
 assert.ok(rear.length>0,'actual posterior scalp locks must be present');
 assert.ok(rear.every(s=>s.tip[1]>=.06||s.tip[2]<=-.14+1e-6),
  'every posterior tip inside the torso height must remain behind the back');
 assert.ok(rearContacts>0,'the actual body resolver must be exercised');
 assert.equal(wig.getReport().sadakoRearOriginBasedClearance,true);
 wig.dispose();geometry.dispose();head.material.dispose();
});
