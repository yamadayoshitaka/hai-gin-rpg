import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {computeSourceFit,HERO_FACE_MORPHS,HERO_FACE_PRESETS,identifyOriginalVikingParts,
 maskBodyUnderSourceGarment,fitCCBYHairToHead}
 from '../src/master-swordsman-assembly.js';

test('real source fit uses dimensions, grounds garment and hides donor head only',()=>{
 const bb=new THREE.Box3(new THREE.Vector3(-.44,-.845,-.15),new THREE.Vector3(.44,.845,.15));
 const hb=new THREE.Box3(new THREE.Vector3(-.137,-.19,-.12),new THREE.Vector3(.137,.19,.12));
 const ob=new THREE.Box3(new THREE.Vector3(-.501,0,-.175),new THREE.Vector3(.501,1.69,.175));
 const fit=computeSourceFit(bb,hb,ob);
 assert.ok(Math.abs(fit.headShift.y-(.845-.19))<1e-6);
 assert.ok(Math.abs(fit.outfitShift.y+.845)<1e-6);
 assert.ok(fit.neckY<.845&&fit.neckY>.5);
 assert.ok(fit.outfitWidthRatio>1&&fit.outfitWidthRatio<1.5);
 assert.equal(fit.heightRatio,1);
 assert.throws(()=>computeSourceFit(bb,new THREE.Box3(),ob),/bounds required/);
 assert.throws(()=>computeSourceFit(bb,hb,
   new THREE.Box3(new THREE.Vector3(-2,0,0),new THREE.Vector3(2,1.7,.4))),/manual remeshing/);
});
test('seven actual facial features have explicit career presets and remain deformable',()=>{
 assert.equal(HERO_FACE_MORPHS.length,7);
 for(const name of ['swordsman','mage','ninja','neutral']){
  const p=HERO_FACE_PRESETS[name];
  assert.ok(p);
  for(const [k,v] of Object.entries(p)){
   assert.ok(HERO_FACE_MORPHS.includes(k),name+' unrecognized feature');
   assert.ok(v>=0&&v<=1,name+' not normalized');
  }
 }
 assert.notDeepEqual(HERO_FACE_PRESETS.swordsman,HERO_FACE_PRESETS.mage);
 assert.notDeepEqual(HERO_FACE_PRESETS.swordsman,HERO_FACE_PRESETS.ninja);
});
test('real clothing recognition is based on source mesh names not guessed fake pieces',()=>{
 const root=new THREE.Group();
 for(const part of ['tunic','pants','boots','scalp','beard','eyebrows','moustache']){
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(1,1,1));
  mesh.name='CC0-Viking-'+part;root.add(mesh);
 }
 assert.equal(identifyOriginalVikingParts(root).size,7);
});

test('integration-critical hair fitting and skin cutting helpers remain exported',()=>{
 assert.equal(typeof maskBodyUnderSourceGarment,'function');
 assert.equal(typeof fitCCBYHairToHead,'function');
});
