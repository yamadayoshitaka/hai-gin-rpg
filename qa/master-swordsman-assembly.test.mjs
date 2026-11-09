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
import {measureSwordsmanShoulders,createFittedSwordsmanArmor,bendSourceTunicSleeves}
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


test('real tunic sleeve vertices are rotated toward arms without touching source geometry or UVs',()=>{
 const body=new THREE.Mesh(new THREE.BoxGeometry(.88,1.69,.36));
 const tunic=new THREE.Mesh(new THREE.CylinderGeometry(.42,.42,.8,48,7));
 tunic.position.y=.17;
 const orig=tunic.geometry;
 const before=orig.getAttribute('position').array.slice(0);
 const originalIndices=orig.getIndex()?.count;
 const rotated=bendSourceTunicSleeves(tunic,body);
 assert.ok(rotated.movedSourceVertices>30,'No real sleeve vertices were bent');
 assert.equal(rotated.sourceTrianglesUnchanged,true);
 assert.notEqual(tunic.geometry,orig,'Preview should clone the real source');
 assert.equal(orig.getIndex()?.count,originalIndices);
 assert.deepEqual(orig.getAttribute('position').array,before,
  'Source geometry must remain byte-identical after fitting');
 assert.equal(tunic.geometry.getAttribute('uv').count,orig.getAttribute('uv').count);
 tunic.geometry.dispose();orig.dispose();body.geometry.dispose();
});


import {FEATURED_SWORDSMEN,featuredSwordsmanProfile}
 from '../src/master-swordsman-featured-profiles.js';
import {buildHeadConformingScalp,buildFittedShortHairStrands}
 from '../src/master-swordsman-scalp-shell.js';

test('five boys and a separately sourced girl plus five allies remain distinct from soldiers',()=>{
 assert.equal(FEATURED_SWORDSMEN.length,11);
 const heroes=FEATURED_SWORDSMEN.filter(p=>p.category==='hero');
 const allies=FEATURED_SWORDSMEN.filter(p=>p.category==='ally');
 assert.equal(heroes.length,6);
 assert.equal(allies.length,5);
 assert.equal(new Set(FEATURED_SWORDSMEN.map(p=>p.key)).size,11);
 assert.equal(new Set(FEATURED_SWORDSMEN.map(p=>p.hairStyle)).size,11);
 const appearances=new Set();
 for(const profile of FEATURED_SWORDSMEN){
  assert.deepEqual(featuredSwordsmanProfile(profile.key),profile);
  assert.equal(Object.keys(profile.face).length,7);
  assert.ok(profile.id>=1000,'Hero/ally identity must not collide with 1000 regular soldiers');
  assert.ok(profile.faceWidth>=.9&&profile.faceWidth<=1.04);
  assert.ok(profile.eyeSize>=1&&profile.eyeSize<=1.24);
  assert.ok(profile.artGradeCertified===false);
  assert.ok(profile.sourceAssetUnique===false);
  appearances.add(JSON.stringify([profile.face,profile.hairStyle,profile.skin,profile.iris]));
 }
 assert.equal(appearances.size,11);
 const girl=featuredSwordsmanProfile('hero-girl-01');
 assert.equal(girl.gender,'female');
 assert.equal(girl.headSource,'realistic-head-sculpt');
 assert.equal(girl.visualGenderIdentity,'girl');
 assert.notDeepEqual(girl.proportions,featuredSwordsmanProfile('hero-01').proportions);
 assert.throws(()=>featuredSwordsmanProfile('soldier-0000'),/Unknown/);
 assert.equal(createSwordsmanRoster(1000).length,1000);
});
test('actual head topology covers rear scalp and crown but leaves face transparent',()=>{
 const actor=new THREE.Group(),head=new THREE.Group();actor.add(head);
 const sourceGeometry=new THREE.SphereGeometry(.19,64,48);
 const mesh=new THREE.Mesh(sourceGeometry,new THREE.MeshStandardMaterial({color:'#ddbb99'}));
 mesh.name='GEO-head_animation_realistic';
 mesh.position.set(0,.66,0);head.add(mesh);
 actor.updateWorldMatrix(true,true);
 const before=sourceGeometry.getAttribute('position').array.slice();
 const {scalp,report}=buildHeadConformingScalp(head);
 assert.equal(report.originalHeadGeometryUntouched,true);
 assert.ok(report.highRearCoverageSamples>35);
 assert.ok(report.highTopCoverageSamples>40);
 assert.ok(report.faceUncoveredSamples>30);
 assert.equal(report.sourceFaceVertices,sourceGeometry.getAttribute('position').count);
 assert.equal(scalp.geometry.getAttribute('color').itemSize,4,'Vertex alpha fades facial hairline');
 assert.deepEqual(sourceGeometry.getAttribute('position').array,before,'Original CC0 head was altered');
 // Geometrical scalp must be tied to head mesh, rather than an unrelated dome.
 assert.equal(scalp.name,'HEAD_CONFORMING_SOURCE_TOPOLOGY_SCALP');
 const {hair:hairStrands,report:hairReport}=buildFittedShortHairStrands(scalp,{style:3});
 assert.ok(hairReport.ribbons>=90);
 assert.ok(hairReport.triangles>hairReport.ribbons*3);
 assert.equal(hairReport.sourceSurfaceAligned,true);
 assert.equal(hairStrands.geometry.getAttribute('position').count,hairReport.ribbons*8);
 hairStrands.geometry.dispose();hairStrands.material.dispose();
 scalp.geometry.dispose();scalp.material.dispose();sourceGeometry.dispose();mesh.material.dispose();
});


import {prepareYouthfulFace} from '../src/master-swordsman-youthful-face.js';
test('real 3D head vertices change toward youthful face while original CC0 mesh remains identical',()=>{
 const head=new THREE.Group();
 const sourceGeometry=new THREE.SphereGeometry(.19,64,40);
 const originalData=sourceGeometry.getAttribute('position').array.slice();
 const face=new THREE.Mesh(sourceGeometry,new THREE.MeshStandardMaterial());
 face.name='GEO-head_animation_realistic';head.add(face);
 const young=prepareYouthfulFace(head);
 assert.notEqual(young.faceMesh.geometry,sourceGeometry);
 const result=young.apply(.9);
 assert.ok(result.modifiedVertices>40);
 assert.equal(result.sourceUnchanged,true);
 assert.deepEqual(sourceGeometry.getAttribute('position').array,originalData);
 const profileA=young.faceMesh.geometry.getAttribute('position').array.slice();
 young.apply(.15);
 const profileB=young.faceMesh.geometry.getAttribute('position').array;
 assert.ok(profileA.some((x,i)=>Math.abs(x-profileB[i])>1e-5));
 young.faceMesh.geometry.dispose();sourceGeometry.dispose();face.material.dispose();
});
test('featured profiles have actually different youthful sculpt and pupils',()=>{
 const hero=featuredSwordsmanProfile('hero-01');
 const ally=featuredSwordsmanProfile('ally-04');
 assert.ok(hero.youthfulness>.75&&hero.youthfulness<=1);
 assert.ok(ally.youthfulness<.7);
 assert.ok(hero.eyeSize>ally.eyeSize);
 const changed=validateAppearanceOverrides(hero,{youthfulness:.92,eyeSize:1.08,faceWidth:.96});
 assert.equal(changed.youthfulness,.92);
 assert.equal(changed.eyeSize,1.08);
 assert.equal(changed.faceWidth,.96);
 assert.throws(()=>validateAppearanceOverrides(hero,{eyeSize:2}),/range/);
});

test('hero-01 uses a distinctive youthful face sculpt and understated shoulder armor',()=>{
 const lead=featuredSwordsmanProfile('hero-01');
 assert.equal(lead.label,'美少年化改修中・外観未承認');
 assert.equal(lead.category,'hero');
 assert.ok(lead.youthfulness>=.95);
 assert.ok(lead.faceWidth>=.90&&lead.faceWidth<=.92);
 assert.ok(lead.eyeSize>=1.03&&lead.eyeSize<=1.09,'Hero should not use exaggerated cartoon eye scale');
 assert.ok(lead.face.JawWidth<.10);
 assert.ok(lead.face.NoseWidth<.12);
 assert.ok(lead.face.ChinLength<.18);
 assert.ok(lead.shoulderSize>=.7&&lead.shoulderSize<=.85);
 assert.equal(lead.armorStyle,1);
 assert.ok(/^#[a-fA-F0-9]{6}$/.test(lead.skin));
 assert.ok(/^#[a-fA-F0-9]{6}$/.test(lead.iris));
 assert.ok(FEATURED_SWORDSMEN.filter(p=>p.category==='hero'&&p.key!=='hero-01').length===5);
 assert.ok(FEATURED_SWORDSMEN.filter(p=>p.category==='ally').length===5);
 assert.equal(lead.artGradeCertified,false,'Only a fitted preview, never falsely approved for battle');
});


import {buildReferenceHeroineHair} from '../src/master-heroine-coiffure.js';
test('adopted knight heroine gets a low swept 3D bun without moving original female head vertices',()=>{
 const head=new THREE.Group();
 const geometry=new THREE.SphereGeometry(.19,64,48);
 const masterBytes=geometry.getAttribute('position').array.slice();
 const face=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial());
 face.name='GEO-head_animation_realistic';
 head.add(face);head.updateWorldMatrix(true,true);
 const {scalp}=buildHeadConformingScalp(head);
 const {hair,report}=buildReferenceHeroineHair(scalp);
 assert.equal(report.authoredStyle,'swept-low-bun');
 assert.equal(report.sourceAligned,true);
 assert.equal(report.originalCC0HeadUntouched,true);
 assert.equal(report.noFaceSpanningCards,true);
 assert.ok(report.sweptStrands>80);
 assert.ok(report.flowStreaks>=7);
 assert.equal(report.bunMeshes,22);
 assert.equal(report.templeWisps,4);
 assert.ok(report.maxStrandSegmentMeters<=.014,'Detached hair spikes must fail source geometry QA');
 assert.ok(report.bunNormalizedHeight>=.48&&report.bunNormalizedHeight<=.60,
  'Bun must stay on lower rear skull, not down at shoulder');
 assert.ok(Math.abs(report.bunCenterOffsetRatio)<.2,'Bun shifted too far away from the skull');
 assert.ok(report.frontEyeZoneVertices<10,'Hair ribbons drape across eye area');
 assert.deepEqual(geometry.getAttribute('position').array,masterBytes,
  'Do not deform licensed or CC0 source head geometry when fitting hair');
 const bun=hair.getObjectByName('REFERENCE_LOW_GATHERED_BUN_CORE');
 const bands=hair.getObjectByName('FEMALE_REAL_HEAD_SWEPT_STRAND_GEOMETRY');
 assert.ok(bun?.isMesh&&bands?.isMesh);
 assert.ok(bun.position.z-bun.scale.z<scalp.geometry.boundingBox.min.z-.02*report.scalpBoundsMeters[2],
  'Bun must protrude at the back of the scalp while its center is embedded, never float');
 assert.ok(bands.geometry.getAttribute('position').count>500);
 assert.equal(new Set(hair.children.map(c=>c.name)).size,hair.children.length);
 hair.traverse(o=>{
  if(!o.isMesh)return;
  const pos=o.geometry.getAttribute('position');
  for(let i=0;i<pos.count;i+=37)
   assert.ok(Number.isFinite(pos.getX(i))&&Number.isFinite(pos.getY(i))&&Number.isFinite(pos.getZ(i)));
  o.geometry.dispose();
  if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());
  else o.material.dispose();
 });
 scalp.geometry.dispose();scalp.material.dispose();
 face.material.dispose();geometry.dispose();
});
