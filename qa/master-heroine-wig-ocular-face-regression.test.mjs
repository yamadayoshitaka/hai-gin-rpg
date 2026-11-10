import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {buildHeadConformingScalp} from '../src/master-swordsman-scalp-shell.js';
import {buildHeroineWigRootCap,buildHeroineFantasyLongHair}
 from '../src/master-heroine-long-hair.js';
import {applyEyeFixtureBlink} from '../src/master-swordsman-assembly.js';
import {featuredSwordsmanProfile} from '../src/master-swordsman-featured-profiles.js';

test('heroine wig paints every upper-crown vertex and keeps face skin uncovered',()=>{
 const head=new THREE.Group();
 const geometry=new THREE.SphereGeometry(.19,48,32);
 const skin=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial());head.add(skin);
 const source=geometry.getAttribute('position').array.slice();
 const {scalp}=buildHeadConformingScalp(head);
 const {cap,report}=buildHeroineWigRootCap(scalp);
 const p=cap.geometry.getAttribute('position'),rgba=cap.geometry.getAttribute('color');
 const box=cap.geometry.boundingBox||new THREE.Box3().setFromBufferAttribute(p);
 const size=box.getSize(new THREE.Vector3());
 let crown=0,frontalFace=0;
 for(let i=0;i<p.count;i++){
  const y=(p.getY(i)-box.min.y)/size.y;
  const z=(p.getZ(i)-box.min.z)/size.z;
  if(y>.83){crown++;assert.ok(rgba.getW(i)>.99,'Visible crown gap');}
  if(z>.92&&y<.55){frontalFace++;assert.ok(rgba.getW(i)<.08,'Hair cap covers eye/face');}
 }
 assert.ok(crown>40&&frontalFace>20);
 assert.ok(report.coverageRatio>.95);
 assert.deepEqual(geometry.getAttribute('position').array,source);
 cap.geometry.dispose();cap.material.dispose();scalp.geometry.dispose();
 scalp.material.dispose();geometry.dispose();skin.material.dispose();
});

test('100k long-hair lines remain continuous with no spiky sideward flight',()=>{
 const head=new THREE.Group();
 const skin=new THREE.Mesh(new THREE.SphereGeometry(.19,48,32),new THREE.MeshStandardMaterial());
 head.add(skin);
 const {scalp}=buildHeadConformingScalp(head);
 const {hair,report}=buildHeroineFantasyLongHair(scalp);
 assert.equal(report.individualFilamentCount,100000);
 assert.equal(report.strandSegmentCount,600000);
 assert.equal(report.coherentScalpFlow,true);
 assert.equal(report.templeTipsTurnBehindShoulders,true);
 assert.ok(report.maxSideOutwardDriftMeters<.02);
 const p=hair.geometry.getAttribute('position');
 // The 70k rear strands are followed by 12k left and 12k right temple locks.
 const sections=report.strandSegmentCount/report.individualFilamentCount;
 for(const strand of [70000,70111,75999,81999,82000,88111,93999]){
  const start=strand*sections*2;
  for(let j=0;j<sections-1;j++){
   const a=start+j*2+1,b=start+(j+1)*2;
   for(const axis of ['X','Y','Z'])
    assert.equal(p['get'+axis](a),p['get'+axis](b),'Disconnected hair filament');
  }
 }
 hair.geometry.dispose();hair.material.dispose();scalp.geometry.dispose();
 scalp.material.dispose();skin.geometry.dispose();skin.material.dispose();
});

test('upper eyelid drives lashes in blink, and returning to zero restores the pose',()=>{
 const parent=new THREE.Group(),upper=new THREE.Group(),lower=new THREE.Group(),
  lashes=new THREE.Group(),lid=new THREE.Group();
 parent.add(upper,lower,lid);upper.add(lashes);
 upper.position.y=.25;lower.position.y=.12;lashes.position.y=.02;
 upper.userData.openLocalY=.25;upper.userData.openScaleY=1.08;
 upper.userData.blinkTravelLocal=.06;
 lower.userData.openLocalY=.12;lower.userData.blinkTravelLocal=.06;
 const fixture={upper,lower,lashes,lid};
 const open=lashes.getWorldPosition(new THREE.Vector3()).y;
 assert.equal(applyEyeFixtureBlink(fixture,1),1);
 const closed=lashes.getWorldPosition(new THREE.Vector3()).y;
 assert.ok(closed<open-.05,'Lashes must move WITH the closing upper eyelid');
 assert.equal(upper.position.y,.19);
 assert.equal(lid.visible,true);
 assert.equal(applyEyeFixtureBlink(fixture,0),0);
 assert.equal(lashes.getWorldPosition(new THREE.Vector3()).y,open);
 assert.equal(upper.scale.y,1.08);
 assert.equal(lid.visible,false);
 assert.equal(lashes.parent,upper);
});

test('heroine face has balanced original eye nose mouth and chin ratios',()=>{
 const girl=featuredSwordsmanProfile('hero-girl-01');
 assert.match(girl.referenceDesign,/^original-/);
 assert.ok(girl.proportions.eyeWidth>1.04&&girl.proportions.eyeWidth<1.12);
 assert.ok(girl.proportions.eyeHeight>1&&girl.proportions.eyeHeight<1.08);
 assert.ok(girl.proportions.noseWidth>=.88&&girl.proportions.noseWidth<1);
 assert.ok(girl.proportions.mouthWidth>=.90&&girl.proportions.mouthWidth<1);
 assert.ok(girl.proportions.chinLength>=.95&&girl.proportions.chinLength<1.02);
 assert.ok(girl.proportions.cheekRoundness>=1&&girl.proportions.cheekRoundness<1.12);
 assert.equal(girl.facialArtistApproval,false);
});
