import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {buildHeadConformingScalp} from '../src/master-swordsman-scalp-shell.js';
import {buildHeroineWigRootCap,buildHeroineFantasyLongHair}
 from '../src/master-heroine-long-hair.js';
import {applyEyeFixtureBlink,applyHeroineMakeupToFace} from '../src/master-swordsman-assembly.js';
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
 assert.equal(report.coveredBySolidSourceTopology,true);
 assert.equal(report.foreheadBangsVisible,true);
 assert.equal(report.crownFlowLocks,8000);
 assert.equal(report.crownFlowTriangles,64000);
 assert.equal(report.crownHasActualTangentFibreGeometry,true);
 const fibers=cap.getObjectByName('HEROINE_CROWN_DENSE_SURFACE_FIBRE_FLOW');
 assert.ok(fibers?.isMesh&&fibers.geometry.index.count===64000*3,
  'The wig cap is still an opaque bald-looking dome without top hair');
 assert.ok(fibers.userData.sourceScalpRoots);
 assert.equal(report.fringeLockCount,520);
 assert.equal(report.fringeTriangleCount,520*6*2);
 assert.ok(report.fringeTipMinNormalized>=.69);
 assert.equal(report.fringeFaceClear,true);
 const fringe=cap.getObjectByName('HEROINE_FRONT_FRINGE_SOURCE_ROOTED_ROSE_PINK');
 assert.ok(fringe?.isMesh&&fringe.geometry.index.count>5000,
  'Missing actual 3D pink bangs above the face');
 assert.ok(fringe.userData.sourceCrownRoots&&fringe.userData.eyebrowClear);
 assert.deepEqual(geometry.getAttribute('position').array,source);
 cap.geometry.dispose();cap.material.dispose();scalp.geometry.dispose();
 scalp.material.dispose();geometry.dispose();skin.material.dispose();
});

test('100k strand wig has separate fringe, temple and layered back objects',()=>{
 const head=new THREE.Group();
 const skin=new THREE.Mesh(new THREE.SphereGeometry(.19,48,32),
  new THREE.MeshStandardMaterial());
 head.add(skin);
 const {scalp}=buildHeadConformingScalp(head);
 const {hair,report}=buildHeroineFantasyLongHair(scalp);
 assert.equal(hair.isGroup,true);
 assert.equal(report.individualFilamentCount,100000);
 assert.equal(report.strandSegmentCount,600000);
 assert.equal(report.separatedHairObjects,true);
 assert.equal(report.rearLayerCount,3);
 assert.equal(report.wigPartCount,6);
 assert.equal(hair.children.length,6);
 assert.ok(hair.children.every(p=>p.isLineSegments&&p.userData.bodyClipped));
 assert.ok(report.maxSideOutwardDriftMeters<.02);
 assert.equal(report.beardFreeFrontNeck,true);
 assert.equal(report.frontNeckIntrusionVertices,0);
 assert.ok(report.neckRearClearanceCorrections>0);
 assert.equal(report.rearFlow,'tapered-clumped-swaying-layers-no-flat-hem');
 assert.ok(report.rearEndSampleCount>1000,'Rear filament measurements missing');
 assert.ok(report.rearEndTaperRatio>.57,
  'Rear hair still widens into a solid triangular curtain: '+report.rearEndTaperRatio);
 const bb=scalp.geometry.boundingBox,d=bb.getSize(new THREE.Vector3());
 const cx=(bb.min.x+bb.max.x)*.5,cz=(bb.min.z+bb.max.z)*.5;
 let napeVertices=0,segments=0;
 for(const part of hair.children){
  const attr=part.geometry.getAttribute('position');
  assert.equal(attr.count%(6*2),0,'Each wig part must hold complete strands');
  segments+=attr.count/2;
  for(let i=0;i<attr.count;i+=37){
   const y=attr.getY(i),x=attr.getX(i),z=attr.getZ(i);
   if(y<=bb.min.y+d.y*.19&&y>=bb.min.y-d.y*.70){
    napeVertices++;
    assert.ok(Math.abs(x-cx)>=d.x*.40||z<=cz-d.z*.38+1e-5,
     'Long pink hair hangs in front of the chin');
   }
  }
  for(let strand=0;strand<attr.count/12;strand+=Math.max(1,Math.floor(attr.count/1200))){
   const start=strand*12;
   for(let section=0;section<5;section++){
    const a=start+section*2+1,b=start+(section+1)*2;
    for(const axis of ['X','Y','Z'])
     assert.equal(attr['get'+axis](a),attr['get'+axis](b),'Broken follicle strand');
   }
  }
 }
 assert.equal(segments,600000);
 assert.ok(napeVertices>200);
 for(const part of hair.children){part.geometry.dispose();part.material.dispose();}
 scalp.geometry.dispose();scalp.material.dispose();
 skin.geometry.dispose();skin.material.dispose();
});

test('natural makeup edits real face vertex colors, resets and preserves source vertices',()=>{
 const geometry=new THREE.SphereGeometry(.19,64,48);
 const p=geometry.getAttribute('position');
 const base=new Float32Array(p.count*3).fill(1);
 geometry.setAttribute('color',new THREE.BufferAttribute(base.slice(),3));
 const before=p.array.slice();
 const face=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({vertexColors:true}));
 const result=applyHeroineMakeupToFace(face,base,{
  strength:.93,blush:.91,lip:.95,eyeliner:.96,
  eyeAnchors:[new THREE.Vector3(-.075,.095,.1),new THREE.Vector3(.075,.095,.1)]
 });
 assert.equal(result.strength,.93);
 assert.ok(result.blushVertices>0,'Cheek color missing');
 assert.ok(result.lipVertices>0,'Rose-tinted lips missing');
 assert.ok(result.mouthMaskYNormalized[0]>.44,
  'Real sculpt lip pigment must sit above the chin (WebGL calibration)');
 assert.equal(result.chinLipVertices,0,'Lipstick has leaked below the lips onto the chin');
 assert.equal(result.chinLipMaskExcluded,true);
 assert.deepEqual(result.mouthMaskYNormalized,[.448,.532]);
 assert.ok(result.linerVertices>0,'Eye-following upper lash color missing');
 assert.ok(result.changedVertices>100,'Cosmetics are too faint to affect the face');
 assert.equal(result.skinShaderUsesVertexColors,true,
  'The actual head shader must render the cosmetic vertex colors');
 const colored=geometry.getAttribute('color');
 let rose=0,liner=0;
 for(let i=0;i<colored.count;i++){
  if(colored.getX(i)>colored.getY(i)+.04)rose++;
  if(colored.getY(i)<.75)liner++;
 }
 assert.ok(rose>10,'Makeup never produced visible rosy hues');
 assert.ok(liner>0,'Eyeliner never produced visible dark pixels');
 assert.notDeepEqual(colored.array,base);
 applyHeroineMakeupToFace(face,base,{strength:0});
 assert.deepEqual(geometry.getAttribute('color').array,base);
 assert.deepEqual(p.array,before);
 geometry.dispose();face.material.dispose();
});

test('upper eyelid drives lashes in blink, and returning to zero restores the pose',()=>{
 const parent=new THREE.Group(),upper=new THREE.Group(),lower=new THREE.Group(),
  lashes=new THREE.Group(),lid=new THREE.Group();
 parent.add(upper,lower,lid);upper.add(lashes);
 upper.position.y=.25;upper.scale.y=1.08;lower.position.y=.12;lashes.position.y=.02;
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
 assert.ok(girl.proportions.eyeHeight>.96&&girl.proportions.eyeHeight<1.03);
 assert.ok(girl.proportions.noseWidth>=.78&&girl.proportions.noseWidth<.88);
 assert.ok(girl.proportions.mouthWidth>=.90&&girl.proportions.mouthWidth<1);
 assert.ok(girl.proportions.chinLength>=.94&&girl.proportions.chinLength<.98);
 assert.ok(girl.proportions.cheekRoundness>=1&&girl.proportions.cheekRoundness<1.035);
 assert.ok(girl.proportions.preEarFullness<=.70&&girl.proportions.lowerCheekLateral<=.75);
 assert.ok(girl.makeup.strength>.9);
 assert.ok(girl.makeup.lip>.9&&girl.makeup.eyeliner>.9);
 assert.ok(girl.proportions.eyeTilt>.04);
 assert.ok(girl.proportions.noseBridge>=1&&girl.proportions.noseBridge<=1.08);
 assert.ok(girl.proportions.jawTaper<.94);
 assert.ok(girl.proportions.middleThird>=.93&&girl.proportions.middleThird<.96);
 assert.ok(girl.proportions.noseLength<.94);
 assert.ok(girl.proportions.mouthVertical>.008);
 assert.match(girl.visualDirection,/lightning-inspired/);
 assert.equal(girl.makeup.sourceFaceOnly,true);
 assert.equal(girl.facialArtistApproval,false);
});
