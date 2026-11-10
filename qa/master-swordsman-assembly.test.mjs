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
import {measureSwordsmanShoulders,createFittedSwordsmanArmor,createClosedSleeveBridge,bendSourceTunicSleeves,slimSourceTunicUpperSilhouette,trimDanglingTunicSleeveFins}
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
 assert.equal(mounted.diagnostics().rearSleeveGeometryClosed,true);
 assert.equal(mounted.diagnostics().rearSleeveAngularSegments,32);
 assert.equal(mounted.diagnostics().rearSleeveEndCaps,true);
 for(const sleeve of mounted.sleeves){
  const g=sleeve.geometry;
  assert.equal(g.userData.closedSleeve,true);
  const vertexCount=g.getAttribute('position').count;
  assert.equal(vertexCount,32*6+2,'Complete concentric sleeve rings and two caps');
  assert.equal(g.getIndex().count,5*32*6+32*6,'Front/back walls and two end caps');
  const box=new THREE.Box3().setFromBufferAttribute(g.getAttribute('position'));
  assert.ok(box.max.z-box.min.z>.05&&box.max.z-box.min.z<.10,
   'Sleeve must have a genuine rear face without bulky detached cones');
  assert.ok(g.userData.lengthMeters<.17,'Long floating sleeves must not return');
 }
 assert.equal(mounted.diagnostics().attachmentStraps,2);
 assert.equal(mounted.diagnostics().compactSleevesFitted,true);
 assert.ok(mounted.diagnostics().sleeveConnectorMaxRadius<=.04);
 assert.ok(mounted.diagnostics().sleeveConnectorLengthMeters<=.17);
 assert.equal(mounted.diagnostics().boneRigFitted,false);
 // Loose synthetic sleeve tubes must not hang alongside genuine boy/girl arms.
 mounted.changeAppearance(featuredSwordsmanProfile('hero-01'));
 assert.equal(mounted.diagnostics().visibleAuxiliarySleeves,0);
 mounted.changeAppearance(featuredSwordsmanProfile('hero-girl-01'));
 assert.equal(mounted.diagnostics().visibleAuxiliarySleeves,0);
 mounted.changeAppearance(createSwordsmanAppearance(8));
 assert.equal(mounted.diagnostics().visibleAuxiliarySleeves,2);
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
 assert.equal(rotated.distalSleeveRotatesTogether,true);
 assert.ok(rotated.angleRadians>=.8&&rotated.angleRadians<1.15,
  'Complete cuffs must rotate to the A-pose rather than leave horizontal fins');
 assert.equal(rotated.sourceTrianglesUnchanged,true);
 assert.notEqual(tunic.geometry,orig,'Preview should clone the real source');
 assert.equal(orig.getIndex()?.count,originalIndices);
 assert.deepEqual(orig.getAttribute('position').array,before,
  'Source geometry must remain byte-identical after fitting');
 assert.equal(tunic.geometry.getAttribute('uv').count,orig.getAttribute('uv').count);
 const clipped=trimDanglingTunicSleeveFins(tunic,body);
 assert.equal(clipped.originalUvPreserved,true);
 assert.equal(clipped.originalClothSourceUnmodified,true);
 assert.equal(clipped.torsoBackNotTrimmed,true);
 assert.ok(clipped.remainingTriangleCount<=clipped.originalTriangleCount);
 assert.equal(tunic.geometry.getAttribute('uv').count,orig.getAttribute('uv').count);
 tunic.geometry.dispose();orig.dispose();body.geometry.dispose();
});


import {FEATURED_SWORDSMEN,featuredSwordsmanProfile}
 from '../src/master-swordsman-featured-profiles.js';
import {buildHeadConformingScalp,buildFittedShortHairStrands,buildFantasyRearHairLayers}
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
import {buildHeroineFantasyLongHair} from '../src/master-heroine-long-hair.js';
test('heroine golden hair has dense independently shaped real polygon locks and retains its scalp master',()=>{
 const head=new THREE.Group();
 const source=new THREE.SphereGeometry(.19,48,32);
 const base=source.getAttribute('position').array.slice();
 const face=new THREE.Mesh(source,new THREE.MeshStandardMaterial());
 face.name='SOURCE_CC0_FEMALE_HEAD_TEST';head.add(face);
 head.updateWorldMatrix(true,true);
 const {scalp}=buildHeadConformingScalp(head);
 const {hair,report}=buildHeroineFantasyLongHair(scalp);
 assert.equal(report.authoredStyle,'fantasy-long-blonde');
 assert.equal(report.scalpAnchored,true);
 assert.equal(report.originalSourceGeometryIntact,true);
 assert.equal(report.roundedCrossSection,false);
 assert.equal(hair.isLineSegments,true,'All filaments must be real GPU line primitives');
 assert.equal(report.denseFringe,true);
 assert.equal(report.softTaperedTips,true);
 assert.equal(report.eyebrowSafeFringe,true);
 assert.ok(report.fringeTipMinYNormalized>.73,
  'Full fringe should end above the actual eyebrow ridge');
 assert.ok(report.rearLocks>=320,'Five staggered back-hair layers required');
 assert.ok(report.faceFramingLocks>=216,'Both temples require dense layers');
 assert.ok(report.bangLocks>=96,'Dense upper-forehead fringe required');
 assert.equal(report.lockCount,report.rearLocks+report.faceFramingLocks+report.bangLocks);
 assert.equal(report.triangleCount,0);
 assert.equal(report.strandSegmentCount,hair.geometry.getAttribute('position').count/2);
 assert.equal(report.individualFilamentCount,100000);
 assert.equal(report.strandSegmentCount,300000,
  'One hundred thousand curved filaments with three 3D line sections must be present');
 assert.equal(report.noWidePolygonCards,true);
 assert.equal(Object.values(report.scalpRegions).reduce((a,b)=>a+b,0),100000);
 assert.ok(report.lengthInHeads>=3);
 assert.deepEqual(source.getAttribute('position').array,base,
  'Actual source head geometry must not change when adding hair');
 hair.geometry.dispose();hair.material.dispose();scalp.geometry.dispose();scalp.material.dispose();
 source.dispose();face.material.dispose();
});

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

test('heroine 01 has real long blonde 3D hair past shoulders, without a floating bun',()=>{
 const profile=featuredSwordsmanProfile('hero-girl-01');
 assert.equal(profile.hairColor,'#e6bc71');
 assert.equal(profile.coiffureStyle,'fantasy-long-blonde');
 const head=new THREE.Group();
 const original=new THREE.SphereGeometry(.19,64,48);
 const snapshot=original.getAttribute('position').array.slice();
 const mesh=new THREE.Mesh(original,new THREE.MeshStandardMaterial());
 head.add(mesh);
 const {scalp}=buildHeadConformingScalp(head);
 const {hair,report}=buildHeroineFantasyLongHair(scalp);
 assert.equal(report.authoredStyle,'fantasy-long-blonde');
 assert.equal(report.individualFilamentCount,100000);
 assert.ok(report.rearLocks>=70000);
 assert.ok(report.faceFramingLocks>=24000);
 assert.ok(report.lengthInHeads>=2.5);
 assert.ok(report.lowestRelativeToScalpBottom<-.8);
 assert.ok(report.triangleCount>1000);
 assert.equal(report.noFloatingBun,true);
 assert.equal(report.sourceHeadUnchanged,true);
 assert.equal(report.staticUnrigged,true);
 assert.equal(report.roundedCrossSection,true,
  'Golden hair must use volumetric 3D strands rather than flat cards');
 assert.equal(report.layeredVolume,true,'Missing layered long-hair mass');
 assert.equal(report.strandSegmentCount,300000,'Individual 3D filaments are missing');
 assert.equal(hair.material.isLineBasicMaterial,true,'Coarse card mesh shader must be retired');
 const positions=hair.geometry.getAttribute('position');
 for(let i=0;i<positions.count;i+=71)
  assert.ok(Number.isFinite(positions.getX(i))&&
    Number.isFinite(positions.getY(i))&&Number.isFinite(positions.getZ(i)));
 assert.deepEqual(original.getAttribute('position').array,snapshot);
 hair.geometry.dispose();hair.material.dispose();scalp.geometry.dispose();
 scalp.material.dispose();mesh.material.dispose();original.dispose();
});

test('both male and female fantasy hair have nonfloating rear scalp layers',()=>{
 const head=new THREE.Group();
 const original=new THREE.SphereGeometry(.19,64,48);
 const face=new THREE.Mesh(original,new THREE.MeshStandardMaterial());
 head.add(face);
 const before=original.getAttribute('position').array.slice();
 const {scalp}=buildHeadConformingScalp(head);
 for(const female of [false,true]){
  const {hair,report}=buildFantasyRearHairLayers(scalp,{style:female?2:3,female});
  assert.equal(report.sourceHeadUnchanged,true);
  assert.equal(report.bodyRearOnly,true);
  assert.equal(report.noFrontEyeCoverage,true);
  assert.ok(report.anchors>=6);
  assert.ok(report.layerLengthMeters>.025);
  const pos=hair.geometry.getAttribute('position');
  const bb=scalp.geometry.boundingBox;
  const midZ=(bb.min.z+bb.max.z)*.5;
  for(let j=0;j<pos.count;j++){
   assert.ok(pos.getZ(j)<midZ,'Fantasy layers must stay behind eye plane');
   assert.ok(Number.isFinite(pos.getX(j))&&Number.isFinite(pos.getY(j))&&Number.isFinite(pos.getZ(j)));
  }
  hair.geometry.dispose();hair.material.dispose();
 }
 assert.deepEqual(original.getAttribute('position').array,before,
  'Never modify source head while improving fantasy hair');
 scalp.geometry.dispose();scalp.material.dispose();
 face.material.dispose();original.dispose();
});
test('all boy and girl heroes have age-softened proportions and allies retain their profiles',()=>{
 const heroes=FEATURED_SWORDSMEN.filter(p=>p.category==='hero');
 assert.equal(heroes.length,6);
 for(const hero of heroes){
  const girl=hero.key==='hero-girl-01';
  if(girl){
   // The reference-fit warp visibly stretched the jaw. Guard against
   // re-enabling extreme 'youth' morphs in the production preview.
   assert.ok(hero.youthfulness>=.4&&hero.youthfulness<=.7);
   assert.ok(hero.proportions.cheekRoundness<=1.25);
   assert.ok(hero.proportions.middleThird>=.93&&hero.proportions.middleThird<=1.04);
   assert.ok(hero.proportions.jawTaper>=.88&&hero.proportions.jawTaper<=1.05);
   assert.ok(hero.proportions.chinLength>=.93);
  }else{
   assert.ok(hero.youthfulness>=.95);
   assert.ok(hero.proportions.middleThird<=.92);
   assert.ok(hero.proportions.noseWidth<=.87);
   assert.ok(hero.proportions.chinLength<=.94);
  }
  assert.ok(hero.proportions.browThickness<=.9);
  assert.equal(hero.artGradeCertified,false);
 }
 assert.ok(featuredSwordsmanProfile('ally-02').youthfulness<.8,
  'Do not silently rejuvenate the veteran ally');
});

test('donor upper tunic can be narrowed without changing original back surface or UV texture',()=>{
 const body=new THREE.Mesh(new THREE.BoxGeometry(.88,1.69,.36));
 const shirt=new THREE.Mesh(new THREE.CylinderGeometry(.41,.41,.8,48,8));
 shirt.position.y=.17;
 const original=shirt.geometry;
 const snapshot=original.getAttribute('position').array.slice();
 const result=slimSourceTunicUpperSilhouette(shirt,body);
 assert.ok(result.modifiedUpperGarmentVertices>0);
 assert.ok(result.maxShiftMeters>0&&result.maxShiftMeters<.10);
 assert.equal(result.sourceOutfitUntouched,true);
 assert.equal(result.backPanelsPreserved,true);
 assert.equal(result.originalTrianglesIntact,true);
 assert.equal(result.originalUVCountIntact,true);
 assert.deepEqual(original.getAttribute('position').array,snapshot);
 shirt.geometry.dispose();original.dispose();body.geometry.dispose();
});
test('young male and female heroes have visibly larger heads and soft facial thirds',()=>{
 for(const key of ['hero-01','hero-02','hero-03','hero-04','hero-05','hero-girl-01']){
  const p=featuredSwordsmanProfile(key);
  const isGirl=key==='hero-girl-01';
  assert.ok(p.headScale>=(isGirl?1.05:1.07)&&p.headScale<=1.11);
  if(isGirl){
   assert.ok(p.proportions.middleThird>=.93);
   assert.ok(p.proportions.chinLength>=.93);
   assert.ok(p.proportions.noseLength>=.90);
   assert.ok(p.proportions.cheekRoundness<=1.25,
    'Female jaw distortion protection must remain active');
  }else{
   assert.ok(p.proportions.middleThird<.89);
   assert.ok(p.proportions.chinLength<.89);
   assert.ok(p.proportions.noseLength<.87);
  }
 }
 assert.equal(featuredSwordsmanProfile('ally-02').headScale,1);
});

test('clothing mask preserves every source triangle on exposed hands and forearms',()=>{
 const body=new THREE.Group();
 const skin=new THREE.MeshStandardMaterial({color:0xbca391});
 const torso=new THREE.Mesh(new THREE.CylinderGeometry(.235,.218,.91,32,16),skin);
 torso.position.y=.22;body.add(torso);
 for(const side of [-1,1]){
  const arm=new THREE.Mesh(new THREE.CylinderGeometry(.049,.042,.83,20,12),skin);
  arm.name=side<0?'left-forearm':'right-forearm';
  arm.position.set(side*.28,.045,0);body.add(arm);
  const hand=new THREE.Mesh(new THREE.SphereGeometry(.051,16,12),skin);
  hand.position.set(side*.28,-.425,0);body.add(hand);
  const leg=new THREE.Mesh(new THREE.CylinderGeometry(.108,.086,.78,20,12),skin);
  leg.position.set(side*.125,-.57,0);body.add(leg);
 }
 const originalArms=body.children.filter(m=>/forearm/.test(m.name))
  .map(m=>({mesh:m,vertices:m.geometry.getAttribute('position').array.slice(),
    triangles:m.geometry.getIndex().count/3}));
 const dress=new Map();
 for(const [name,width,height,y] of [
   ['tunic',.57,.93,.22],['pants',.55,.51,-.44],['boots',.48,.26,-.86]]){
  const garment=new THREE.Mesh(new THREE.BoxGeometry(width,height,.43));
  garment.position.y=y;dress.set(name,garment);
 }
 const report=maskBodyUnderSourceGarment(body,dress);
 assert.ok(report.removed>200,'Torso must still be obscured beneath cloth');
 assert.equal(report.armsAndHandsPreserved,true);
 assert.deepEqual(report.armRetentionRatio,[1,1]);
 assert.ok(report.armTrianglesAfter.every(n=>n>50));
 for(const {mesh,vertices,triangles} of originalArms){
  assert.deepEqual(mesh.geometry.getAttribute('position').array,vertices,
   'Exposed source arm vertices must not be cut');
  assert.equal(mesh.geometry.getIndex().count/3,triangles,
   'Source forearm triangles must remain connected from shoulder to hand');
 }
 for(const mesh of body.children)mesh.geometry.dispose();
 for(const mesh of dress.values())mesh.geometry.dispose();
 skin.dispose();
});

import {createFittedFantasyHeroGarment} from '../src/master-hero-fitted-garment.js';
test('real body-surface tunic follows both shoulders, arms and torso without artificial cylinders',()=>{
 const body=new THREE.Group();
 const torso=new THREE.Mesh(new THREE.CylinderGeometry(.22,.165,1.69,48,40));
 body.add(torso);
 for(const side of [-1,1]){
  const upperArm=new THREE.Mesh(new THREE.CylinderGeometry(.061,.047,.53,32,16));
  upperArm.position.set(side*.29,.16,0);
  body.add(upperArm);
 }
 const stored=body.children.map(m=>m.geometry.getAttribute('position').array.slice());
 for(const female of [false,true]){
  const fitted=createFittedFantasyHeroGarment(body,{female});
  const d=fitted.report;
  assert.equal(d.bodyFitted,true);
  assert.equal(d.anatomicalSourceSurface,true);
  assert.equal(d.sourceTrianglesOnly,true);
  assert.equal(d.noProceduralCylinderSleeves,true);
  assert.equal(d.noVikingTposeSleeves,true);
  assert.equal(d.anatomicallyConnectedUpperSleeves,true);
  assert.equal(d.originalCC0ClothUntouched,true);
  assert.ok(d.torsoTriangles>180);
  assert.ok(d.breastplateTriangles>25);
  assert.ok(d.upperArmTriangles.left>35&&d.upperArmTriangles.right>35);
  assert.equal(d.hipTassetPanels,0);
  assert.equal(d.shortTabardPanels,0);
  assert.equal(d.sleeveCuffCount,2);
  assert.equal(d.fittedNecklineTrim,true);
  assert.equal(d.fittedHighCollar,true);
  assert.equal(d.centerCrestFitted,true);
  assert.equal(d.slimLeatherBelt,false);
  assert.ok(fitted.object.getObjectByName('KNIGHT_SMALL_BREASTPLATE_CREST')?.isMesh);
  assert.ok(!fitted.object.getObjectByName('KNIGHT_SLIM_LEATHER_WAIST_BAND'));
  assert.equal(d.anatomyFittedLowerClothes.realLegSurface,true);
  assert.equal(d.anatomyFittedLowerClothes.overlappingFadedLegSeams,true);
  assert.ok(d.hemHeight>-.30,
   'Source shirt must end above thigh; disconnected bodysuit crotch is not acceptable');
  assert.ok(fitted.object.getObjectByName('KNIGHT_ANATOMICAL_FITTED_TROUSERS')?.isMesh);
  assert.ok(fitted.object.getObjectByName('KNIGHT_ANATOMICAL_FITTED_BOOTS')?.isMesh);
  assert.ok(fitted.object.getObjectByName('KNIGHT_FORM_FITTED_HIGH_COLLAR')?.isMesh);
  assert.ok(fitted.object.getObjectByName('KNIGHT_NECKLINE_FITTED_TRIM')?.isMesh);
  assert.equal(d.artGradeCertified,false,'Technical geometry is not an art approval');
  const tunic=fitted.object.getObjectByName('KNIGHT_SOURCE_SURFACE_SHIRT_AND_JOINED_SLEEVES');
  const breastplate=fitted.object.getObjectByName('KNIGHT_ANATOMICAL_BREASTPLATE');
  for(const mesh of [tunic,breastplate]){
   assert.ok(mesh?.isMesh,'Actual source-surface geometry is missing');
   assert.ok(mesh.geometry.getAttribute('normal').count>90);
   assert.ok(mesh.geometry.getIndex().count>120);
   assert.equal(mesh.geometry.getAttribute('uv').count,
    mesh.geometry.getAttribute('position').count);
  }
  const box=new THREE.Box3().setFromObject(tunic);
  assert.ok(box.max.x>.28&&box.min.x<-.28,'Both sleeves must reach the actual source arms');
  for(let i=0;i<body.children.length;i++)
   assert.deepEqual(body.children[i].geometry.getAttribute('position').array,stored[i],
    'Do not deform the original CC0 source body to fake attached clothing');
  fitted.dispose();
 }
 for(const mesh of body.children)mesh.geometry.dispose();
});


import {createReferenceHeroineFaceFitter,REFERENCE_HEROINE_FACE}
 from '../src/master-heroine-reference-fit.js';

test('portrait-derived 3D jaw fit rounds cheek to chin without flattening nose depth',()=>{
 const geometry=new THREE.SphereGeometry(.19,64,48);
 geometry.computeBoundingBox();
 const base=geometry.getAttribute('position').array.slice();
 const box=geometry.boundingBox.clone();
 const fit=createReferenceHeroineFaceFitter(base,box);
 assert.equal(fit.report.sourceIsUserPortrait,true);
 assert.equal(fit.report.referenceView,'front only');
 assert.equal(fit.report.landmarkCount,9);
 assert.equal(fit.report.contourKnots,11);
 const half=.19;
 const jaw=fit.deform(.16,box.min.y+box.getSize(new THREE.Vector3()).y*.28,.13,1);
 assert.ok(jaw.x<.16,'The lateral jaw contour should narrow instead of bulging into square ears');
 const nose=fit.deform(0,box.min.y+box.getSize(new THREE.Vector3()).y*.57,.19,1);
 assert.equal(nose.x,0,'The photo outline must not warp centre of the nose');
 assert.equal(nose.z,.19,'The existing 3D nose depth remains real source data');
 assert.deepEqual(geometry.getAttribute('position').array,base,
  'Tracing a photo must not modify original CC0 source geometry');
 const head=new THREE.Group();
 const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial());
 head.add(mesh);
 const shape=prepareYouthfulFace(head,{referenceFit:true});
 const report=shape.apply(.97,{});
 assert.equal(report.referenceSilhouette?.source,REFERENCE_HEROINE_FACE.id);
 assert.equal(report.referenceSilhouetteApplied,false,
  'Photo trace must not automatically stretch the live head after user visual rejection');
 assert.ok(report.modifiedVertices>250);
 assert.ok(Number.isFinite(report.geometryDigest));
 assert.deepEqual(geometry.getAttribute('position').array,base);
 mesh.geometry.dispose();mesh.material.dispose();geometry.dispose();
});

test('heroine ear-front morph controls narrow the lateral wall without shrinking central cheek or chin',async()=>{
 const {deformFacePoint,FACE_PROPORTION_DEFAULTS,validateFaceProportions}=
  await import('../src/master-swordsman-face-proportions.js');
 const girl=featuredSwordsmanProfile('hero-girl-01');
 assert.ok(girl.proportions.preEarFullness<.8);
 assert.ok(girl.proportions.parotidWidth<.8);
 assert.ok(girl.proportions.lowerCheekLateral<1);
 assert.ok(girl.proportions.cheekRoundness>1,'Rounded cheeks retained');
 const box={min:{x:-.16,y:-.18,z:-.12},max:{x:.16,y:.20,z:.13}};
 const source={x:.134,y:.034,z:.025};
 const neutral=deformFacePoint(source.x,source.y,source.z,box,FACE_PROPORTION_DEFAULTS);
 const slim=deformFacePoint(source.x,source.y,source.z,box,
  validateFaceProportions({preEarFullness:.72,lowerCheekLateral:.85,parotidWidth:.74}));
 assert.ok(slim.x<neutral.x-.001,'Ear-front side must move inward');
 const center={x:.034,y:.018,z:.11};
 const before=deformFacePoint(center.x,center.y,center.z,box,FACE_PROPORTION_DEFAULTS);
 const after=deformFacePoint(center.x,center.y,center.z,box,
  validateFaceProportions({preEarFullness:.72,lowerCheekLateral:.85,parotidWidth:.74}));
 assert.ok(Math.abs(before.x-after.x)<.00015,'The central round cheek must remain intact');
 const chin={x:0,y:-.125,z:.11};
 assert.equal(deformFacePoint(chin.x,chin.y,chin.z,box,FACE_PROPORTION_DEFAULTS).x,
  deformFacePoint(chin.x,chin.y,chin.z,box,girl.proportions).x);
 const reversed=deformFacePoint(-source.x,source.y,source.z,box,
  validateFaceProportions({preEarFullness:.72,lowerCheekLateral:.85,parotidWidth:.74}));
 assert.ok(Math.abs(reversed.x+slim.x)<1e-10,'Left and right ears must be symmetric');
});
