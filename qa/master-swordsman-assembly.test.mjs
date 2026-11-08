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


import {createSwordsmanAppearance,createSwordsmanRoster,validateAppearanceOverrides}
 from '../src/master-swordsman-1000-appearance.js';
import {measureSwordsmanShoulders,createFittedSwordsmanArmor}
 from '../src/master-swordsman-fitted-shoulders.js';

test('one thousand persistent unique multi-part identities are generated without allocating GLBs',()=>{
 const roster=createSwordsmanRoster(1000);
 assert.equal(roster.length,1000);
 assert.equal(new Set(roster.map(x=>x.displayCode)).size,1000);
 // Appearance fingerprints deliberately omit the ID string, proving the
 // uniqueness is actual shape/skin/eye/hair/cloth identity, not label only.
 const fingerprints=roster.map(x=>JSON.stringify([x.face,x.skin,x.iris,x.hairStyle,
   x.hairColor,x.clothColor,x.armorColor,x.armorStyle,x.shoulderSize,x.build,x.weaponStyle]));
 assert.equal(new Set(fingerprints).size,1000);
 for(let i=0;i<1000;i++){
  const x=roster[i];
  assert.deepEqual(x,createSwordsmanAppearance(i),'ID changes across separate runs');
  assert.ok(x.hairStyle>=1&&x.hairStyle<=14);
  assert.ok(/^#[a-fA-F0-9]{6}$/.test(x.skin));
  assert.ok(/^#[a-fA-F0-9]{6}$/.test(x.iris));
  assert.equal(Object.keys(x.face).length,7);
  assert.equal(x.sourceAssetUnique,false);
  assert.equal(x.artGradeCertified,false);
 }
 assert.throws(()=>createSwordsmanAppearance(1000),RangeError);
 assert.throws(()=>createSwordsmanAppearance(-1),RangeError);
 assert.throws(()=>createSwordsmanAppearance(1.5),RangeError);
});
test('skin eye colors morph sizes and hair styles are user-adjustable and range-checked',()=>{
 const src=createSwordsmanAppearance(0);
 const p=validateAppearanceOverrides(src,{
  skin:'#c39775',iris:'#4477aa',hairColor:'#442211',
  shoulderSize:.76,hairStyle:14,face:{NoseWidth:.9}
 });
 assert.equal(p.skin,'#c39775');
 assert.equal(p.iris,'#4477aa');
 assert.equal(p.shoulderSize,.76);
 assert.equal(p.hairStyle,14);
 assert.equal(p.face.NoseWidth,.9);
 assert.equal(src.face.NoseWidth,createSwordsmanAppearance(0).face.NoseWidth);
 assert.throws(()=>validateAppearanceOverrides(src,{iris:'white'}),/HEX/);
 assert.throws(()=>validateAppearanceOverrides(src,{face:{JawWidth:2}}),/range/);
});
test('shoulder anchors follow actual measured body+shirt and keep both sides symmetric',()=>{
 const realBody=new THREE.Mesh(new THREE.BoxGeometry(.88,1.69,.36));
 const realTunic=new THREE.Mesh(new THREE.BoxGeometry(.83,.8,.35));
 realTunic.position.y=.17;
 const root=new THREE.Group();root.add(realBody,realTunic);
 const fit=measureSwordsmanShoulders(realBody,realTunic);
 assert.ok(fit.left.x<0&&fit.right.x>0);
 assert.ok(Math.abs(fit.left.y-fit.right.y)<1e-10);
 assert.ok(fit.left.y<.845&&fit.left.y>0);
 const mounted=createFittedSwordsmanArmor({body:realBody,tunic:realTunic,
  appearance:createSwordsmanAppearance(7)});
 assert.equal(mounted.diagnostics().plateGroups,2);
 assert.equal(mounted.diagnostics().connectedSleeves,2);
 assert.equal(mounted.diagnostics().attachmentStraps,2);
 assert.equal(mounted.diagnostics().boneRigFitted,false);
 mounted.changeAppearance(createSwordsmanAppearance(8));
 mounted.dispose();
 realBody.geometry.dispose();realTunic.geometry.dispose();
});
