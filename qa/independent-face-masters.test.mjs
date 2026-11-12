import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import * as THREE from 'three';
import {makeIndependentFaceMaster,FACE_MASTER_SPEC,femaleInnerFeatureDelta,femaleCheekJawDelta}
 from '../src/independent-face-masters.js';
import {updateFaceFeatureAngles,applyFaceColorMode,createFastFaceSurfaceSampler}
 from '../src/face-feature-meshes.js';
import {createScalpAnchoredWig,wigVolumeLiftAt} from '../src/face-scalp-wig.js';
import {attachIndependentHeadToBody,buildBodyDepthCollision,removeHeadBustBelowNeck,createSealedNeckBridge,createClosedShoulderCaps} from '../src/face-body-assembly.js';
import {CHAPTER_ONE_ART_BY_KEY,FEMALE_COMMANDER_ART_PALETTE} from '../src/chapter-one-character-art-references.js';
import {DEFAULT_WIG_STYLE_ID,getWigStyle,listWigStyles,WIG_BASE_VOLUME_PROFILES} from '../src/face-wig-styles.js';
import {normalizeFemaleFaceControls,normalizeMaleFaceControls,FEMALE_V7_DEFAULTS,FACE_V7_PALETTE,CONTACT_COLORS,safeContactColor,LIBRARY_FACE_PRESET,MALE_REFERENCE_DEFAULT,FACE_SLIDER_RANGES,FACE_EYE_SPACING_DEFAULT,FACE_EYE_SPACING_RANGE}
 from '../src/face-v7-controls.js';

import {PART_CATALOG,PART_GROUPS,HAIR_COLORS,resolvePartSelection,defaultPartSelection,normalizePartSelection}
 from '../src/face-part-catalog-v32.js';
import {HERO_JOBS,HERO_OUTFITS,HERO_ACTIONS,createHeroineStudioWardrobe}
 from '../src/heroine-studio-wardrobe.js';

function fixture(){
 const original=new THREE.SphereGeometry(.19,64,48);
 const source=new THREE.Group();
 const face=new THREE.Mesh(original,new THREE.MeshStandardMaterial({color:0xbbbbbb}));
 face.name='GEO-real-source-head';
 source.add(face);
 const eye=new THREE.Mesh(new THREE.SphereGeometry(.018,18,12));
 eye.name='GEO_sclera_l';source.add(eye);
 return {source,original,face};
}
test('two source-derived clay face meshes have owned independent vertices and preserved source GLB',()=>{
 const {source,original,face}=fixture();
 const before=original.getAttribute('position').array.slice();
 const female=makeIndependentFaceMaster(source,'female');
 const male=makeIndependentFaceMaster(source,'male');
 assert.equal(female.report.code,'female-saved-preset-contact-makeup-v8');
 assert.equal(male.report.code,'male-shared-head-natural-eyes-v8');
 assert.ok(female.report.sourceVertices>1100);
 assert.ok(male.report.sourceVertices>1100);
 assert.ok(female.report.triangles>2000&&male.report.triangles>2000);
 assert.ok(female.report.modifiedVertices>800);
 assert.ok(male.report.modifiedVertices>800);
 assert.equal(female.report.bodyUnchanged,true);
 assert.equal(male.report.bodyUnchanged,true);
 assert.equal(female.report.hairVisible,false);
 assert.equal(female.report.artCertified,false);
 assert.equal(female.report.sourceGeometryIndependent,true);
 assert.notEqual(female.face.geometry,original);
 assert.notEqual(male.face.geometry,original);
 assert.notEqual(female.face.geometry,male.face.geometry);
 assert.deepEqual(original.getAttribute('position').array,before);
 assert.equal(face.geometry,original);
 assert.equal(female.face.material.vertexColors,true);
 assert.equal(female.face.material.map,null);
 assert.equal(female.face.material.wireframe,false);
 assert.ok(female.face.material.color.getHexString().startsWith('bfc3'));
 assert.equal(female.root.getObjectByName('GEO_sclera_l').visible,false);
 assert.equal(female.report.facePartMeshCount,28);
 assert.equal(male.report.facePartMeshCount,19);
 assert.ok(female.report.facePartTriangles>1000);
 assert.equal(female.report.detailedParts.eyelidMeshCount,4);
 assert.equal(female.report.detailedParts.eyeMeshCount,2);
 assert.equal(female.report.detailedParts.lipMeshCount,2);
 assert.equal(female.report.detailedParts.eyebrowMeshCount,2);
 assert.equal(female.report.detailedParts.eyelashMeshCount,4);
 assert.equal(female.report.detailedParts.underEyeShadowMeshCount,0);
 assert.equal(female.report.detailedParts.lipstickMeshCount,0);
 assert.equal(male.report.detailedParts.lipstickMeshCount,0);
 assert.equal(male.report.detailedParts.eyelashMeshCount,0);
 assert.equal(male.report.detailedParts.eyebrowMeshCount,2);
 assert.equal(male.report.maleNoMakeup,true);
 assert.equal(male.report.sharedFemaleBase,true);
 assert.equal(female.report.detailedParts.irisDiameterRequestFactor,1);
 assert.equal(female.report.detailedParts.actualIrisDiameterFactor,1);
 assert.ok(female.report.detailedParts.pupilPolarAngleRadians>.22);
 assert.equal(female.report.femaleControls.jawSharpness,5);
 assert.equal(female.report.femaleControls.noseTipLift,0);
 assert.equal(female.report.detailedParts.noseSourceIntegrated,true);
 assert.equal(female.report.detailedParts.doubleLidCreaseMeshCount,2);
 assert.equal(female.report.detailedParts.lowerOrbitalVolumeMeshCount,0);
 assert.ok(female.report.detailedParts.irisPolarAngleRadians>.55);
 assert.ok(female.report.detailedParts.pupilPolarAngleRadians>.22);
 assert.equal(female.report.detailedParts.mouthHalfWidthFraction,.044,
  'Female upper and lower lips must use the selected half-width option');
 assert.equal(male.report.detailedParts.mouthHalfWidthFraction,.044,
  'Male inherits the same smaller structural mouth, without lipstick');
 assert.ok(female.root.getObjectByName('LEFT_DOUBLE_EYELID_FOLD')?.isMesh);
 assert.equal(female.root.getObjectByName('RIGHT_LOWER_LID_VOLUME'),undefined);
 assert.ok(female.report.detailedParts.realSurfaceProjectionCount>100,
  'Eyes and lips must project onto real 3D head, not a flat card');
 assert.ok(female.root.getObjectByName('UPPER_3D_VERMILION_LIP')?.isMesh);
 assert.ok(female.root.getObjectByName('LOWER_3D_VERMILION_LIP')?.isMesh);
 assert.ok(female.root.getObjectByName('LEFT_UPPER_ANATOMICAL_EYELID')?.isMesh);
 let changedBetweenSexes=0;
 const a=female.face.geometry.getAttribute('position');
 const b=male.face.geometry.getAttribute('position');
 for(let i=0;i<a.count;i++)if(Math.abs(a.getX(i)-b.getX(i))+
  Math.abs(a.getY(i)-b.getY(i))+Math.abs(a.getZ(i)-b.getZ(i))>.00001)
  changedBetweenSexes++;
 assert.equal(changedBetweenSexes,0,
  'Male must share saved female base head geometry; only makeup and face parts differ');
 assert.equal(female.report.cheekVolumeMetric,male.report.cheekVolumeMetric,
  'Both saved default heads must preserve identical cheeks');
 assert.equal(female.report.outerContourXError,0,
  'Mouth and nose adjustments must not pull the outer face silhouette');
 assert.ok(female.report.outerContourSamples>100);
 assert.ok(female.report.localizedNoseAndMouthSamples>20);
 assert.equal(female.report.innerFeatureHalfWidthLimit,.28);
 assert.equal(female.report.femaleJawStyle,'full-cheek-smooth-oval-point-v6');
 assert.equal(female.report.headTemplate,'realistic-head-animation.glb');
 assert.equal(female.report.cheekJawSculpt,'smooth-head-source-feminine-jaw-v6');
 for(const name of ['LEFT_SCULPTED_EYEBROW','RIGHT_SCULPTED_EYEBROW',
  'LEFT_UPPER_LASH_MESH','LEFT_LOWER_LASH_MESH',
  'RIGHT_UPPER_LASH_MESH','RIGHT_LOWER_LASH_MESH']){
  assert.ok(female.root.getObjectByName(name)?.isMesh,
   'Missing real eyebrow/eyelash mesh '+name);
 }
 assert.ok(female.report.cheekSculptSamples>0);
 assert.ok(female.report.jawSculptSamples>0);
 assert.ok(female.report.addedCheekDepth>0);
 assert.ok(female.report.narrowedJawDistance>0);
 assert.ok(female.report.apexLowering>0);
 assert.ok(female.report.maxCheekWidthChange<.005,
  'Nose/mouth edits may not pull the real upper/lower cheeks inward');
});
test('strictly exclude body, wig and makeup from face-only model assembly',()=>{
 const f=fixture();const built=makeIndependentFaceMaster(f.source,'female');
 const visible=[];
 built.root.traverse(o=>{if(o.isMesh&&o.visible)visible.push(o)});
 assert.equal(visible.length,29,'Face plus 28 fitted eye/brow/lash meshes without bags');
 assert.ok(visible.includes(built.face));
 assert.ok(visible.every(o=>o===built.face||built.parts.getObjectById(o.id)));
 assert.ok(visible.every(o=>!/hair|armour|body|garment/i.test(o.name)));
 assert.equal(built.report.headOnly,true);
 assert.throws(()=>makeIndependentFaceMaster(new THREE.Group(),'female'),/high-resolution/);
 assert.throws(()=>makeIndependentFaceMaster(f.source,'other'),/male\/female/);
});
test('face studio includes stable gender, view and export controls with no body dependency',()=>{
 const html=readFileSync('face-mesh-studio.html','utf8');
 for(const id of ['female','male','front','side','threeQuarter','back','wire',
  'faceCanvas','export','status','metrics','clay','color','irisDiameter',
  'noseTipLift','nostrilCover','noseBridgeSharpness','jawSharpness','eyeAngle',
  'eyeSpacing','lipstickX','lipstickY','lipstickWidth','lipstickHeight',
  'contactPreset','contactColor','resetPreset',
  'maleAdjustments','maleJawSharpness','maleEyeSpacing','maleIrisDiameter',
  'maleNoseTipLift','maleNostrilCover','maleNoseBridgeSharpness',
  'maleEyeAngle','maleBeardDensity','maleBeardLength','resetMalePreset'])
  assert.match(html,new RegExp('id="'+id+'"'));
 assert.doesNotMatch(html,/id="eyeSize"|id="maleEyeSize"/);
 assert.match(html,/makeIndependentFaceMaster/);
 assert.doesNotMatch(html,/loadAsync\(base\+'realistic-head-sculpt\.glb'\)/,'Old gaunt sculpt must not be loaded as the female face');
 assert.match(html,/realistic-head-animation.glb/);
 assert.doesNotMatch(html,/realistic-body-female.glb/);
 assert.doesNotMatch(html,/realistic-body-male.glb/);
 assert.match(html,/binary:true,onlyVisible:true/);
 assert.ok(existsSync('src/independent-face-masters.js'));
 assert.ok(existsSync('src/face-feature-meshes.js'));
 assert.match(html,/id="parts"/);
 assert.equal(Object.keys(FACE_MASTER_SPEC).length,2);
});

test('nose and mouth deformation has compact support and never changes cheek/jaw outline',()=>{
 const d=v=>femaleInnerFeatureDelta({xn:v,yn:.57,zn:.98,offsetX:.12,depth:.30});
 const nose=d(.19);
 assert.ok(nose.dx<-.001,'Nasal alar wings must move inwards');
 assert.ok(nose.dz>.001,'Nasal bridge and tip retain positive depth');
 const preservedCheek=femaleInnerFeatureDelta({
  xn:.38,yn:.575,zn:.93,offsetX:.05,depth:.3
 });
 assert.equal(preservedCheek.dx,0);
 assert.equal(preservedCheek.dz,0);
 const mouth=femaleInnerFeatureDelta({
  xn:.25,yn:.505,zn:.95,offsetX:.1,depth:.3
 });
 assert.ok(mouth.dx<-.001,'Localized narrowing of female mouth increased');
 // The new sculpt must roughly double the previous local inward shift,
 // while keeping the cheeks and perimeter strictly untouched.
 const earlierNoseDx=-.12*(.175*nose.noseSupport+.145*nose.mouthSupport);
 const earlierMouthDx=-.1*(.175*mouth.noseSupport+.145*mouth.mouthSupport);
 assert.ok(Math.abs(nose.dx/earlierNoseDx-2)<1e-9);
 assert.ok(Math.abs(mouth.dx/earlierMouthDx-2)<1e-9);
 for(const x of [-1,-.9,-.70,-.55,.55,.70,.9,1]){
  for(const y of [.35,.50,.57,.65]){
   const p=femaleInnerFeatureDelta({
    xn:x,yn:y,zn:.97,offsetX:x*.15,depth:.31
   });
   assert.equal(p.dx,0,'Outer contour unexpectedly narrowed at '+x);
   assert.equal(p.dz,0,'Outer contour unexpectedly protruded at '+x);
   assert.equal(p.noseSupport,0);
   assert.equal(p.mouthSupport,0);
  }
 }
});

test('independent cheek fill and chin contour actually alter different 3D regions',()=>{
 const sculpt=(x,y,z=.94)=>femaleCheekJawDelta({
  xn:x,yn:y,zn:z,offsetX:x*.16,depth:.32,height:.39
 });
 const hollow=sculpt(.36,.465);
 const cheekBone=sculpt(.36,.64);
 assert.ok(hollow.dz>.001&&hollow.dz<.009,'Smooth donor cheeks should receive only gentle support');
 assert.ok(hollow.dz>cheekBone.dz*15,
  'Do not exaggerate the cheekbone instead of filling the sunken cheek');
 const lowerCheek=sculpt(.42,.41);
 const middleCheek=sculpt(.42,.455);
 const upperCheek=sculpt(.42,.54);
 assert.ok(middleCheek.dz>.007&&lowerCheek.dz>.006&&upperCheek.dz>.004,
  'Gaunt middle/lower cheeks should have continuous visible volume beneath the cheekbone');
 assert.ok(Math.abs(sculpt(-.42,.455).dz-middleCheek.dz)<1e-12,
  'Cheek volume should be bilaterally symmetrical');
 assert.equal(sculpt(.42,.455,.12).dz,0,
  'Cheek fill must not alter the back of the head');
 assert.equal(hollow.dx,0,'Cheek zone must keep its width');
 const chin=sculpt(.37,.30);
 assert.ok(chin.dx<-.004,'Lower jaw edge should taper, not just the centreline');
 assert.ok(Math.abs(chin.dx)>Math.abs(sculpt(.37,.46).dx)*5,
  'Taper only the chin, not the jaw-to-cheek contour');
 const center=sculpt(0,.255);
 assert.ok(center.dy<0,'Central chin point should form a delicate apex');
 // Keep mouth and nose geometry independent of cheek/jaw shaping.
 const mouth=sculpt(.10,.505);
 assert.equal(mouth.dx,0,'Chin taper cannot change nose or mouth width');
 assert.ok(mouth.dz<.0003,'Midface filler cannot create a lip protrusion');
 for(const y of [.24,.32,.45,.59]){
  for(const x of [-1,-.9,.9,1]){
   const p=sculpt(x,y);
   assert.equal(p.dx,0,'No ear or skull silhouette narrowing');
   assert.ok(p.dz<.000001,'No ear or skull protrusion');
  }
 }
 // Check that the cheek surface is C0-smooth with small neighbouring steps.
 for(let y=.36;y<.55;y+=.02){
  const a=sculpt(.35,y),b=sculpt(.35,y+.002);
  assert.ok(Math.abs(a.dz-b.dz)<.002,
   'A discontinuous cheek ridge would create a hard shadow');
 }
});

test('v7 nose tip and bridge adjustable within central nose; chin 2x, cheek untouched',()=>{
 const source=fixture().source;
 const before=makeIndependentFaceMaster(source,'female',{femaleControls:{
  noseTipLift:0,nostrilCover:0,noseBridgeSharpness:0,jawSharpness:1
 }});
 const after=makeIndependentFaceMaster(source,'female',{femaleControls:{
  noseTipLift:2,nostrilCover:2,noseBridgeSharpness:2.2,jawSharpness:2
 }});
 assert.notEqual(before.face.geometry,after.face.geometry);
 assert.equal(after.report.outerContourXError,0);
 assert.ok(after.report.maxCheekWidthChange<.005);
 const a=before.face.geometry.getAttribute('position');
 const z=after.face.geometry.getAttribute('position');
 let modified=0;
 for(let i=0;i<a.count;i++)if(Math.abs(a.getY(i)-z.getY(i))+
   Math.abs(a.getZ(i)-z.getZ(i))+Math.abs(a.getX(i)-z.getX(i))>1e-6)
   modified++;
 assert.ok(modified>10,'Nose and chin sliders must alter actual vertices');
 const at=(x,y)=>femaleInnerFeatureDelta({xn:x,yn:y,zn:.97,offsetX:x*.1,depth:.3,height:.4,
  controls:normalizeFemaleFaceControls({noseTipLift:2,nostrilCover:2,noseBridgeSharpness:2})});
 assert.ok(at(0,.566).dy>0,'Nasal tip rises');
 assert.ok(at(.18,.53).dy<0,'Lower nasal rim drops to conceal nostril opening');
 assert.ok(at(0,.65).dz>.001,'Nose bridge has enhanced central depth');
 assert.deepEqual(at(.36,.56),{dx:0,dy:0,dz:0,noseSupport:0,mouthSupport:0});
});
test('color-only mode and brow/lash tilt do not change vertices or source donor',()=>{
 const f=fixture(),built=makeIndependentFaceMaster(f.source,'female');
 const vertices=built.face.geometry.getAttribute('position').array.slice();
 const before=built.parts.getObjectByName('LEFT_BROW_ANGLE_CONTROL').rotation.z;
 const newAngles=updateFaceFeatureAngles(built.parts,{browAngle:-17,lashAngle:20});
 assert.equal(newAngles.browAngle,-17);
 assert.notEqual(before,built.parts.getObjectByName('LEFT_BROW_ANGLE_CONTROL').rotation.z);
 assert.notEqual(built.parts.getObjectByName('LEFT_LASH_ANGLE_CONTROL').rotation.z,0);
 assert.equal(applyFaceColorMode(built.face,'color'),'color');
 assert.equal(built.face.material.color.getHex(),FACE_V7_PALETTE.skin);
 assert.equal(built.parts.getObjectByName('LEFT_CURVED_IRIS').material.color.getHex(),FACE_V7_PALETTE.iris);
 assert.equal(applyFaceColorMode(built.face,'clay'),'clay');
 assert.deepEqual(built.face.geometry.getAttribute('position').array,vertices);
 assert.equal(f.face.geometry,f.original,'Original donor must be unchanged');
 assert.equal(normalizeFemaleFaceControls({jawSharpness:999}).jawSharpness,10);
 assert.equal(FEMALE_V7_DEFAULTS.irisDiameter,1);
 assert.equal(FEMALE_V7_DEFAULTS.jawSharpness,5);
 assert.equal(FEMALE_V7_DEFAULTS.noseTipLift,0);
 assert.equal(FEMALE_V7_DEFAULTS.noseBridgeSharpness,2.5);
});

test('v8 linked eye angle, real eye scaling and contact lens color preserve source',()=>{
 const f=fixture(),small=makeIndependentFaceMaster(f.source,'female',{femaleControls:{
  eyeWidth:.8,eyeHeight:.8,eyeAngle:-12
 }}),large=makeIndependentFaceMaster(f.source,'female',{femaleControls:{
  eyeWidth:1.25,eyeHeight:1.25,eyeAngle:15
 }});
 const eyes=(model)=>model.parts.getObjectByName('LEFT_ORBITAL_EYEBALL');
 assert.ok(eyes(large).geometry.boundingSphere===null||
  eyes(large).geometry.getAttribute('position').count>500);
 assert.ok(small.report.detailedParts.eyeScale<large.report.detailedParts.eyeScale);
 assert.ok(Math.abs(large.parts.getObjectByName('LEFT_EYE_LINKED_PIVOT').rotation.z-
  -THREE.MathUtils.degToRad(15))<1e-9);
 const parts=large.parts;
 assert.equal(parts.getObjectByName('LEFT_UNDER_EYE_SHADOW'),undefined);
 assert.equal(parts.getObjectByName('LEFT_SCULPTED_EYEBROW').parent.parent.name,'LEFT_EYE_LINKED_PIVOT');
 assert.equal(updateFaceFeatureAngles(parts,{eyeAngle:10}).eyeAngle,10);
 assert.ok(parts.getObjectByName('LEFT_EYE_LINKED_PIVOT').rotation.z<0);
 assert.equal(applyFaceColorMode(large.face,'color',{contactColor:CONTACT_COLORS.blue}),'color');
 assert.equal(parts.getObjectByName('LEFT_CURVED_IRIS').material.color.getHex(),0x467fa7);
 assert.equal(safeContactColor('invalid'),CONTACT_COLORS.brown);
 assert.equal(applyFaceColorMode(large.face,'clay'),'clay');
 assert.equal(parts.getObjectByName('LEFT_UNDER_EYE_SHADOW'),undefined);
 assert.equal(parts.getObjectByName('UPPER_LIPSTICK_MAKEUP'),undefined);
 assert.equal(f.face.geometry,f.original);
});
test('v15 lipstick is painted only on REAL source-head triangles, no sliding lip cards',()=>{
 const source=fixture().source;
 const base=makeIndependentFaceMaster(source,'female');
 const moved=makeIndependentFaceMaster(source,'female',{femaleControls:{
  lipstickX:.12,lipstickY:.12,lipstickWidth:.2,lipstickHeight:.2
 }});
 const p=base.face.geometry.getAttribute('position');
 const q=moved.face.geometry.getAttribute('position');
 const c=base.face.geometry.getAttribute('color');
 const d=moved.face.geometry.getAttribute('color');
 assert.equal(c.itemSize,3);
 let changed=0;
 for(let i=0;i<p.count;i++){
  assert.equal(p.getX(i),q.getX(i));
  assert.equal(p.getY(i),q.getY(i));
  assert.equal(p.getZ(i),q.getZ(i));
  if(Math.abs(c.getX(i)-d.getX(i))>1e-7||
     Math.abs(c.getY(i)-d.getY(i))>1e-7)changed++;
 }
 assert.ok(changed>0,'Lipstick parameters must recolor real face vertices');
 for(const part of ['UPPER','LOWER']){
  const lip=base.parts.getObjectByName(part+'_3D_VERMILION_LIP');
  const altered=moved.parts.getObjectByName(part+'_3D_VERMILION_LIP');
  assert.ok(lip.isMesh&&altered.isMesh);
  assert.equal(lip.geometry.getAttribute('color').itemSize,3,
   'Real vermilion mesh itself carries the lipstick tint');
  assert.equal(altered.userData.lipstickOnSameTriangles,true);
  assert.equal(altered.userData.lipstickOnSourceHead,true);
  assert.equal(base.parts.getObjectByName(part+'_LIPSTICK_MAKEUP'),undefined);
 }
 assert.equal(moved.report.detailedParts.lipstickPlacement.paintAsVertexColor,true);
 assert.equal(moved.report.detailedParts.lipstickPlacement.appliedToSourceHead,true);
 const male=makeIndependentFaceMaster(source,'male');
 assert.equal(male.face.material.vertexColors,false);
 assert.equal(male.root.getObjectByName('UPPER_LIPSTICK_MAKEUP'),undefined);
 assert.equal(male.root.getObjectByName('LEFT_UNDER_EYE_SHADOW'),undefined);
 assert.ok(male.root.getObjectByName('LEFT_NATURAL_MALE_BROW')?.isMesh);
});
test('v10 orbital eyeliner follows eyes and blush stays on head geometry',()=>{
 const source=fixture().source;
 const model=makeIndependentFaceMaster(source,'female',{femaleControls:{eyeAngle:14,eyeWidth:1.2,eyeHeight:1.2}});
 assert.equal(model.report.detailedParts.eyelinerMeshCount,4);
 assert.equal(model.report.detailedParts.eyeAccentMeshCount,2);
 assert.equal(model.report.detailedParts.blushMeshCount,0);
 assert.equal(model.report.detailedParts.blushVertexTint,true);
 assert.equal(model.face.geometry.getAttribute('color').itemSize,3);
 for(const side of ['LEFT','RIGHT']){
  const lid=model.parts.getObjectByName(side+'_UPPER_ANATOMICAL_EYELID');
  assert.equal(model.parts.getObjectByName(side+'_UPPER_EYELINER').parent,lid);
  assert.equal(model.parts.getObjectByName(side+'_EYE_ACCENT_LINE').parent.name,
   side+'_DOUBLE_EYELID_FOLD');
  assert.equal(lid.parent.name,side+'_EYE_LINKED_PIVOT');
  assert.equal(model.parts.getObjectByName(side+'_CHEEK_BLUSH'),undefined);
  assert.ok(model.parts.getObjectByName(side+'_SCULPTED_EYEBROW')?.isMesh);
 }
 const eye=model.parts.getObjectByName('LEFT_EYE_LINKED_PIVOT');
 const before=eye.rotation.z;
 updateFaceFeatureAngles(model.parts,{eyeAngle:-12});
 assert.notEqual(eye.rotation.z,before);
 assert.equal(model.report.sourceUntouched,true);
});
test('library-saved default jaw=5 with independent male face and beard controls',()=>{
 const source=fixture().source;
 const original=makeIndependentFaceMaster(source,'female');
 const strong=makeIndependentFaceMaster(source,'female',{femaleControls:{jawSharpness:4.8}});
 assert.equal(original.report.femaleControls.jawSharpness,5);
 assert.equal(strong.report.femaleControls.jawSharpness,4.8);
 const a=original.face.geometry.getAttribute('position');
 const b=strong.face.geometry.getAttribute('position');
 let moved=0;
 for(let i=0;i<a.count;i++)if(Math.abs(a.getX(i)-b.getX(i))>1e-6)moved++;
 assert.ok(moved>10,'Female high-range jaw slider must change real geometry');
 assert.equal(strong.report.outerContourXError,0);
 const male=makeIndependentFaceMaster(source,'male');
 const beardy=makeIndependentFaceMaster(source,'male',{maleControls:{
  jawSharpness:3.9,eyeWidth:1.2,eyeHeight:1.2,eyeAngle:15,beardDensity:.8,beardLength:2
 }});
 assert.equal(male.report.maleControls.jawSharpness,5);
 assert.equal(beardy.report.maleControls.jawSharpness,3.9);
 assert.equal(beardy.report.detailedParts.beardMeshCount,5);
 const hair=name=>name+'_3D_HAIR';
 assert.ok(beardy.parts.getObjectByName(hair('CHIN_BEARD')).isMesh);
 assert.ok(beardy.parts.getObjectByName(hair('CHIN_BEARD')).userData.filamentCount>
  male.parts.getObjectByName(hair('CHIN_BEARD')).userData.filamentCount);
 assert.ok(beardy.parts.getObjectByName(hair('CHIN_BEARD')).geometry.getAttribute('position').count>100);
 assert.equal(beardy.parts.getObjectByName('UPPER_LIPSTICK_MAKEUP'),undefined);
 assert.equal(beardy.parts.getObjectByName('LEFT_UPPER_EYELINER'),undefined);
 assert.equal(beardy.parts.getObjectByName('LEFT_CHEEK_BLUSH'),undefined);
 assert.equal(beardy.report.maleNoMakeup,true);
});

test('v10 high jaw settings alter chin point without contracting the neck or cheeks',()=>{
 const source=fixture().source;
 const normal=makeIndependentFaceMaster(source,'female',{femaleControls:{jawSharpness:2.5}});
 const sharp=makeIndependentFaceMaster(source,'female',{femaleControls:{jawSharpness:5}});
 const p=normal.face.geometry.getAttribute('position'),q=sharp.face.geometry.getAttribute('position');
 const b=normal.face.geometry.boundingBox;
 const bottom=b.min.y,height=b.max.y-b.min.y;
 let neckVertices=0,neckError=0,tipChanged=0,upperCheekError=0;
 for(let i=0;i<p.count;i++){
  const yn=(p.getY(i)-bottom)/height;
  const diff=Math.abs(p.getX(i)-q.getX(i))+
   Math.abs(p.getY(i)-q.getY(i))+Math.abs(p.getZ(i)-q.getZ(i));
  if(yn<.20){neckVertices++;neckError=Math.max(neckError,diff);}
  if(yn>.48&&yn<.63)upperCheekError=Math.max(upperCheekError,diff);
  if(yn>.27&&yn<.38&&diff>1e-6)tipChanged++;
 }
 assert.ok(neckVertices>100,'Need actual neck/back-of-head sampled vertices');
 assert.ok(neckError<1e-6,'High jaw cannot squeeze neck or throat');
 assert.ok(upperCheekError<1e-6,'High jaw cannot narrow cheeks');
 assert.ok(tipChanged>8,'Jaw slider must visibly sharpen the chin tip');
});
test('v10 child eyeliner and crease pigment share the exact eye-local coordinate frame',()=>{
 const f=fixture(),m=makeIndependentFaceMaster(f.source,'female');
 for(const side of ['LEFT','RIGHT']){
  const eyelid=m.parts.getObjectByName(side+'_UPPER_ANATOMICAL_EYELID');
  const liner=m.parts.getObjectByName(side+'_UPPER_EYELINER');
  const crease=m.parts.getObjectByName(side+'_DOUBLE_EYELID_FOLD');
  const accent=m.parts.getObjectByName(side+'_EYE_ACCENT_LINE');
  assert.equal(liner.parent,eyelid);
  assert.equal(accent.parent,crease);
  const lid=eyelid.geometry.getAttribute('position');
  const line=liner.geometry.getAttribute('position');
  // Both meshes must use the same shifted joint-local coordinates.
  assert.ok(Math.abs(lid.getX(0)-line.getX(0))<1e-4);
  assert.ok(Math.abs(lid.getY(0)-line.getY(0))<.003);
  const fold=crease.geometry.getAttribute('position');
  const mark=accent.geometry.getAttribute('position');
  assert.ok(Math.abs(fold.getX(0)-mark.getX(0))<1e-4);
  assert.ok(Math.abs(fold.getY(0)-mark.getY(0))<.003);
 }
 updateFaceFeatureAngles(m.parts,{eyeAngle:20});
 for(const side of ['LEFT','RIGHT']){
  const brow=m.parts.getObjectByName(side+'_SCULPTED_EYEBROW');
  const p=brow.geometry.getAttribute('position');
  for(let i=0;i<p.count;i++){
   assert.ok(Number.isFinite(p.getX(i)+p.getY(i)+p.getZ(i)));
  }
 }
 assert.equal(m.report.sourceUntouched,true);
});

test('user Library GLB face preset is canonical and male derives cosmetic-free',()=>{
 const saved={
  irisDiameter:1,jawSharpness:5,noseTipLift:0,nostrilCover:2,
  noseBridgeSharpness:2.5,browAngle:6,lashAngle:7,eyeAngle:0,
  eyeSize:1,lipstickX:0,lipstickY:0,lipstickWidth:1,lipstickHeight:1
 };
 assert.equal(LIBRARY_FACE_PRESET.sourceFile,'female-saved-preset-contact-makeup-v8.glb');
 assert.equal(LIBRARY_FACE_PRESET.sha256,
  'aecac5a923a1f56a6c53eeaebbe5c987cb5685144058054391a92d479dc21060');
 assert.equal(LIBRARY_FACE_PRESET.contactColor,CONTACT_COLORS.brown);
 assert.deepEqual(FEMALE_V7_DEFAULTS,saved);
 for(const [key,value] of Object.entries(saved))
  assert.equal(MALE_REFERENCE_DEFAULT[key],value,'male saved geometry '+key);
 assert.equal(MALE_REFERENCE_DEFAULT.cosmetics,false);
 const source=fixture().source;
 const f=makeIndependentFaceMaster(source,'female');
 const m=makeIndependentFaceMaster(source,'male');
 assert.deepEqual(Object.fromEntries(Object.keys(saved).map(
  key=>[key,f.report.femaleControls[key]])),saved);
 assert.equal(f.report.femaleControls.eyeSpacing,FACE_EYE_SPACING_DEFAULT,
  'Eye separation is an additive v21 control, not an altered Library GLB value');
 for(const [key,value] of Object.entries(saved))
  assert.equal(m.report.maleControls[key],value,'male GLB-derived value '+key);
 const pf=f.face.geometry.getAttribute('position');
 const pm=m.face.geometry.getAttribute('position');
 assert.equal(pf.count,pm.count);
 for(let i=0;i<pf.count;i++){
  assert.equal(pf.getX(i),pm.getX(i));
  assert.equal(pf.getY(i),pm.getY(i));
  assert.equal(pf.getZ(i),pm.getZ(i));
 }
 assert.notEqual(f.face.geometry,m.face.geometry);
 assert.equal(m.face.material.vertexColors,false,'male face has no blush');
 assert.equal(m.parts.getObjectByName('LEFT_UPPER_EYELINER'),undefined);
 assert.equal(m.parts.getObjectByName('LOWER_LIPSTICK_MAKEUP'),undefined);
 assert.equal(m.parts.getObjectByName('LEFT_UNDER_EYE_SHADOW'),undefined);
 assert.ok(m.parts.getObjectByName('LEFT_NATURAL_MALE_BROW')?.isMesh);
});

test('v26 closed eyeliner corners remain linked without under-eye bags',()=>{
 const m=makeIndependentFaceMaster(fixture().source,'female');
 assert.equal(m.report.detailedParts.eyelinerCornersClosed,true);
 assert.ok(m.report.detailedParts.lipCenterNormalized>=.498);
 assert.ok(m.report.detailedParts.lipCenterNormalized<=.520);
 assert.equal(m.report.detailedParts.blushOpacityFactor,.78);
 for(const side of ['LEFT','RIGHT']){
  const upper=m.parts.getObjectByName(side+'_UPPER_EYELINER');
  const lower=m.parts.getObjectByName(side+'_LOWER_EYELINER');
  assert.equal(upper.userData.eyelinerCornersClosed,true);
  assert.equal(upper.parent.name,side+'_UPPER_ANATOMICAL_EYELID');
  assert.equal(lower.parent.name,side+'_LOWER_ANATOMICAL_EYELID');
  assert.ok(upper.geometry.getAttribute('position').count>116);
  assert.ok(lower.material.opacity>.4);
  assert.equal(m.parts.getObjectByName(side+'_UNDER_EYE_SHADOW'),undefined);
  assert.equal(m.parts.getObjectByName(side+'_LOWER_LID_VOLUME'),undefined);
 }
});
test('v12 eye tilt cannot merge eyebrow meshes across the nose at both extremes',()=>{
 const m=makeIndependentFaceMaster(fixture().source,'female');
 const box=m.face.geometry.boundingBox;
 const width=box.max.x-box.min.x,cx=(box.max.x+box.min.x)/2;
 for(const angle of [-20,0,20]){
  updateFaceFeatureAngles(m.parts,{...FEMALE_V7_DEFAULTS,eyeAngle:angle});
  m.parts.updateMatrixWorld(true);
  for(const side of ['LEFT','RIGHT']){
   const eyebrow=m.parts.getObjectByName(side+'_SCULPTED_EYEBROW');
   const attr=eyebrow.geometry.getAttribute('position');
   for(let i=0;i<attr.count;i++){
    const pos=new THREE.Vector3(attr.getX(i),attr.getY(i),attr.getZ(i));
    eyebrow.localToWorld(pos);m.parts.worldToLocal(pos);
    assert.ok(side==='LEFT'?pos.x<=cx-width*.0229:
     pos.x>=cx+width*.0229,'Brow crossed nasal midline on angle '+angle);
   }
  }
 }
 assert.equal(m.report.femaleControls.jawSharpness,5);
 assert.equal(m.report.femaleControls.nostrilCover,2);
});
test('v12 rooted 3D wig uses real scalp vertices and projects facial/torso contacts',()=>{
 const m=makeIndependentFaceMaster(fixture().source,'female');
 const w=createScalpAnchoredWig(m.face,{count:96,lengthScale:1.2});
 m.face.add(w.root);
 assert.equal(w.root.name,'FEMALE_SCALP_ANCHORED_LONG_WIG');
 const r=w.getReport();
 assert.equal(r.rootCount,96);
 assert.ok(r.realScalpCandidateCount>=12);
 assert.equal(r.meshCount,3);
 assert.ok(r.collisionTypes.includes('face'));
 assert.ok(r.collisionTypes.includes('left-shoulder')===false);
 const hair=w.root.getObjectByName('REAL_ROOTED_SWEPT_HAIR_LOCKS');
 const scalp=w.root.getObjectByName('REAL_SCALP_TRIANGLE_HAIR_CAP');
 assert.ok(hair.isMesh);
 assert.ok(scalp.isMesh);
 assert.ok(hair.geometry.getAttribute('position').count>=96*12*4);
 const head=m.face.geometry.getAttribute('position');
 for(const sample of w.getRootSamples()){
  const original=new THREE.Vector3().fromBufferAttribute(head,sample.vertexIndex);
  const delta=original.distanceTo(new THREE.Vector3(...sample.point));
  assert.ok(delta<.01,'Hair roots must remain attached to real scalp vertices');
 }
 const bb=m.face.geometry.boundingBox,center=bb.getCenter(new THREE.Vector3());
 const before=center.clone();const after=w.resolvePoint(before);
 assert.ok(after.distanceTo(before)>.001,'Head collision should push hair outward');
 for(let i=0;i<5;i++)w.update(.034);
 assert.ok(w.getReport().collisionEvents>0);
 const vertices=hair.geometry.getAttribute('position');
 for(let i=0;i<vertices.count;i+=23){
  assert.ok(Number.isFinite(vertices.getX(i)+vertices.getY(i)+vertices.getZ(i)));
 }
 w.dispose();
});

test('v13 saved nose and chin defaults affect both real head meshes and survive reset',()=>{
 const original=makeIndependentFaceMaster(fixture().source,'female');
 const altered=makeIndependentFaceMaster(fixture().source,'female',{femaleControls:{
  jawSharpness:2.5,nostrilCover:0,noseBridgeSharpness:0
 }});
 assert.equal(original.report.femaleControls.jawSharpness,5);
 assert.equal(original.report.femaleControls.nostrilCover,2);
 assert.equal(original.report.femaleControls.noseBridgeSharpness,2.5);
 const a=original.face.geometry.getAttribute('position');
 const b=altered.face.geometry.getAttribute('position');
 let changed=0;
 for(let i=0;i<a.count;i++)
  if(Math.abs(a.getX(i)-b.getX(i))+
   Math.abs(a.getY(i)-b.getY(i))+
   Math.abs(a.getZ(i)-b.getZ(i))>1e-7)changed++;
 assert.ok(changed>40,'Saved chin and nasal values must sculpt real vertices');
 const male=makeIndependentFaceMaster(fixture().source,'male');
 assert.equal(male.report.maleControls.jawSharpness,5);
 assert.equal(male.report.maleControls.nostrilCover,2);
 assert.equal(male.report.maleControls.noseBridgeSharpness,2.5);
});
test('v13 eyes expose actual 3D sclera and cornea beyond the lateral head surface',()=>{
 for(const gender of ['female','male']){
  const model=makeIndependentFaceMaster(fixture().source,gender);
  const eye=model.report.detailedParts;
  assert.equal(eye.eyeballProjection,'sculpted-face-conforming-almond-no-sphere');
  assert.equal(eye.eyeProfileLateralMargins.length,2);
  for(const margin of eye.eyeProfileLateralMargins)
   assert.ok(Number.isFinite(margin)&&margin<.005,
    'Profile eye must stay in its sculpted socket, not protrude: '+gender+' '+margin);
  for(const side of ['LEFT','RIGHT']){
   const globe=model.parts.getObjectByName(side+'_ORBITAL_EYEBALL');
   assert.ok(globe.isMesh&&globe.userData.profileExposed);
   assert.equal(globe.userData.noDetachedEyeball,true);
   assert.equal(globe.userData.geometryType,'face-conforming-almond-eye');
   assert.ok(model.parts.getObjectByName(side+'_CURVED_IRIS')?.isMesh);
  }
 }
});
test('v13 full scalp coverage allocates real roots to back, nape and both temples',()=>{
 const model=makeIndependentFaceMaster(fixture().source,'female');
 const w=createScalpAnchoredWig(model.face,{count:480,color:0x705443});
 const report=w.getReport(),zones=report.rootDistribution;
 assert.equal(report.rootCount,480);
 assert.equal(Object.values(zones).reduce((n,k)=>n+k,0),480);
 for(const zone of ['crown','fringeLeft','fringeRight','templeLeft',
   'templeRight','backLeft','backRight','napeLeft','napeRight']){
  assert.ok(zones[zone]>=17,'Missing hair follicles in '+zone);
  assert.ok(report.zoneCandidateCounts[zone]>=4,'No true scalp '+zone);
 }
 const rootSamples=w.getRootSamples();
 assert.equal(rootSamples.length,9);
 for(const zone of ['backLeft','backRight','templeLeft','templeRight','napeLeft','napeRight'])
  assert.ok(rootSamples.some(root=>root.zone===zone),'No sampled root for '+zone);
 assert.equal(report.hairColor,'#705443');
 assert.notEqual(report.tipColor,'#e0bc83','Brown hair must not be golden at ends');
 const g=w.root.getObjectByName('REAL_ROOTED_SWEPT_HAIR_LOCKS').geometry;
 const color=g.getAttribute('color');
 for(let i=0;i<color.count;i+=31){
  assert.ok(color.getX(i)>color.getY(i)&&color.getY(i)>color.getZ(i),
   'Hair gradient must stay in brown chroma');
 }
 w.dispose();
});

test('v14 saved Library GLB equals exact midpoint of every female/male face slider',()=>{
 const expected={
  jawSharpness:[0,10,5],
  nostrilCover:[0,4,2],
  noseBridgeSharpness:[0,5,2.5],
  noseTipLift:[-2,2,0],
  irisDiameter:[0,2,1],
  lipstickWidth:[.2,2.8,1],
  lipstickHeight:[.2,1.8,1]
 };
 for(const [key,[min,max,original]] of Object.entries(expected)){
  assert.deepEqual(FACE_SLIDER_RANGES[key],[min,max],key+' range');
  assert.equal(FEMALE_V7_DEFAULTS[key],original,key+' original saved value');
 }
 for(const [key,[low,high]] of Object.entries(FACE_SLIDER_RANGES)){
  // Eye depth is a NEW v25 control; it never existed in the Library v8
  // preset, so it cannot be asserted equal to an invented saved value.
  if(FEMALE_V7_DEFAULTS[key]===undefined){
   // Added eye-region sliders are additive and never rewrite the original
   // Library GLB preset's frozen 13 saved parameters.
   assert.equal(normalizeFemaleFaceControls({[key]:low})[key],low);
   assert.equal(normalizeFemaleFaceControls({[key]:high})[key],high);
   assert.equal(normalizeMaleFaceControls({[key]:high})[key],high);
   if(key==='eyeDepth')assert.equal(normalizeFemaleFaceControls({}).eyeDepth,0);
   continue;
  }
  const midpoint=(low+high)/2;
  assert.ok(key==='lipstickWidth'||Math.abs(midpoint-FEMALE_V7_DEFAULTS[key])<1e-9,
   'Saved GLB not centered: '+key);
  assert.equal(MALE_REFERENCE_DEFAULT[key],FEMALE_V7_DEFAULTS[key],
   'Male must share saved female face baseline: '+key);
  assert.equal(normalizeFemaleFaceControls({[key]:low})[key],low);
  assert.equal(normalizeFemaleFaceControls({[key]:high})[key],high);
 }
 const empty=normalizeFemaleFaceControls({});
 assert.equal(empty.eyeSpacing,FACE_EYE_SPACING_DEFAULT);
 assert.deepEqual(Object.fromEntries(Object.keys(FEMALE_V7_DEFAULTS)
  .map(key=>[key,empty[key]])),FEMALE_V7_DEFAULTS);
 assert.deepEqual(FACE_EYE_SPACING_RANGE,[.65,1.35]);
});
test('v14 sculpt stronger than saved standard remains functional on real face vertices',()=>{
 const src=fixture().source;
 const base=makeIndependentFaceMaster(src,'female');
 const stronger=makeIndependentFaceMaster(src,'female',{femaleControls:{
  jawSharpness:9,nostrilCover:3.6,noseBridgeSharpness:4.5
 }});
 assert.equal(stronger.report.femaleControls.jawSharpness,9);
 assert.equal(stronger.report.femaleControls.nostrilCover,3.6);
 assert.equal(stronger.report.femaleControls.noseBridgeSharpness,4.5);
 const p=base.face.geometry.getAttribute('position');
 const q=stronger.face.geometry.getAttribute('position');
 let moved=0;let maxDelta=0;
 const bounds=base.face.geometry.boundingBox;
 const dy=bounds.max.y-bounds.min.y;
 for(let i=0;i<p.count;i++){
  const delta=Math.abs(p.getX(i)-q.getX(i))+
   Math.abs(p.getY(i)-q.getY(i))+
   Math.abs(p.getZ(i)-q.getZ(i));
  if(delta>1e-7)moved++;
  if(delta>maxDelta)maxDelta=delta;
  const yn=(p.getY(i)-bounds.min.y)/dy;
  if(yn<.19)assert.ok(delta<1e-7,'Neck must not deform above saved chin value');
 }
 assert.ok(moved>40,'Upper half of slider must sculpt real geometry');
 assert.ok(maxDelta>.00001);
 const male=makeIndependentFaceMaster(src,'male',{maleControls:{
  jawSharpness:8,nostrilCover:3,noseBridgeSharpness:4
 }});
 assert.equal(male.report.maleControls.jawSharpness,8);
 assert.equal(male.report.maleControls.nostrilCover,3);
 assert.equal(male.report.maleControls.noseBridgeSharpness,4);
});

test('v15 eyeshadow is a real eyelid child, lipstick fast updates without shape motion',async()=>{
 const m=makeIndependentFaceMaster(fixture().source,'female');
 assert.equal(m.report.detailedParts.upperEyeshadowMeshCount,2);
 assert.equal(m.report.detailedParts.shadowOnRealEyelids,true);
 for(const side of ['LEFT','RIGHT']){
  const shadow=m.parts.getObjectByName(side+'_UPPER_EYESHADOW');
  assert.ok(shadow?.isMesh);
  assert.equal(shadow.parent.name,side+'_UPPER_ANATOMICAL_EYELID');
  assert.equal(shadow.geometry.getAttribute('color').itemSize,4);
  assert.ok(shadow.material.opacity>.75);
 }
 const before=m.face.geometry.getAttribute('position').array.slice();
 const prev=m.face.geometry.getAttribute('color').array.slice();
 const {updateRealFacePigment}=await import('../src/face-feature-meshes.js');
 const result=updateRealFacePigment(m.face,{...FEMALE_V7_DEFAULTS,
  lipstickX:.09,lipstickWidth:.6},'color');
 assert.equal(m.face.userData.mouthPigmentSource,'sculpted-head-vertices');
 assert.ok(result.lip>=0&&result.cheek>=0);
 assert.deepEqual(m.face.geometry.getAttribute('position').array,before);
 const now=m.face.geometry.getAttribute('color').array;
 assert.ok(now.some((value,i)=>Math.abs(value-prev[i])>1e-6));
 assert.equal(m.parts.getObjectByName('UPPER_3D_VERMILION_LIP').userData.lipstickOnSameTriangles,true);
 const male=makeIndependentFaceMaster(fixture().source,'male');
 assert.equal(male.parts.getObjectByName('LEFT_UPPER_EYESHADOW'),undefined);
});
test('v15 real scalp growth follows shell and respects final haircut',()=>{
 const model=makeIndependentFaceMaster(fixture().source,'female');
 const wig=createScalpAnchoredWig(model.face,{count:144,lengthScale:1});
 assert.deepEqual(wig.getReport().growthStages,['grow','relax','collide','trim']);
 assert.equal(wig.getReport().smoothScalpNormals,true);
 assert.equal(wig.getReport().verticalForeheadDrape,true);
 const scalp=wig.root.getObjectByName('REAL_SCALP_TRIANGLE_HAIR_CAP');
 assert.equal(scalp.userData.rearUndercoatAnchoredToRealScalp,true);
 assert.ok(scalp.userData.rearUndercoatTriangleCount>=400);
 assert.equal(scalp.userData.rearUndercoatStripCount,88,
  'Rear hair should be individual overlapping narrow strands, not one slab');
 assert.equal(scalp.userData.rearUndercoatStyle,
  'overlapping-real-scalp-rooted-tapered-ribbons');
 assert.ok(scalp.userData.rearUndercoatMaxStripWidth<
  (model.face.geometry.boundingBox.max.x-model.face.geometry.boundingBox.min.x)*.035,
  'The back hair contains a single broad rectangular sheet');
 assert.ok(scalp.userData.rearUndercoatTipHeightRange>
  (model.face.geometry.boundingBox.max.y-model.face.geometry.boundingBox.min.y)*.02,
  'Hairtips must be layered, not a straight blunt line');
 assert.equal(wig.getReport().realScalpPosteriorUndercoat,true);
 assert.equal(scalp.geometry.getAttribute('normal').count,
  scalp.geometry.getAttribute('position').count);
 assert.equal(wig.getReport().scalpCoverage,
  'continuous-colored-triangle-cap-plus-locks');
 for(const s of wig.getCutSamples()){
  assert.ok(s.minY>=s.trimY-1e-5,'Hair passed cut plane '+s.zone);
 }
 wig.update(.04);
 assert.equal(wig.getReport().normalUpdateDivisor,0);
 assert.equal(wig.getReport().physicsHz,0);
 assert.equal(wig.getReport().simulationEnabled,false);
 wig.dispose();
});

test('v15 indexed surface sampler matches exact raycast on real triangle geometry',()=>{
 const geom=new THREE.SphereGeometry(.19,64,48);
 const accel=createFastFaceSurfaceSampler(geom);
 assert.equal(accel.cellCount,1280);
 assert.ok(accel.triangleCount>5000);
 const mesh=new THREE.Mesh(geom,new THREE.MeshBasicMaterial({
  side:THREE.DoubleSide}));
 const ray=new THREE.Raycaster();
 for(const [x,y] of [[0,0],[.02,.02],[-.06,.03],[.08,-.07],[-.11,.09]]){
  ray.set(new THREE.Vector3(x,y,.5),new THREE.Vector3(0,0,-1));
  const hit=ray.intersectObject(mesh,false)[0];
  assert.ok(hit);
  const sample=accel.query(x,y);
  assert.ok(sample!==null,'Indexed sampler did not find front triangle');
  assert.ok(Math.abs(sample-hit.point.z)<1e-5,
   'Indexed surface diverges from real raycast '+x+','+y);
 }
});

test('v16 rear hair roots are posterior and salon cut has actual staggered lengths',()=>{
 const model=makeIndependentFaceMaster(fixture().source,'female');
 const w=createScalpAnchoredWig(model.face,{count:480,lengthScale:1.1});
 const r=w.getReport(),box=model.face.geometry.boundingBox;
 const d=box.getSize(new THREE.Vector3()),cz=(box.min.z+box.max.z)*.5;
 assert.equal(r.rootCount,480);
 assert.equal(r.hairShape,'head-hugging-salon-layered-pointcut');
 assert.equal(r.rearRootPolicy,'actual-posterior-scalp-only');
 assert.equal(r.pointCutEnds,true);
 assert.equal(r.centerBackCoverage,true);
 assert.equal(r.uShapedRearCut,true);
 assert.equal(r.longSalonLayers,true);
 assert.equal(r.centralRearNeckOcclusionAvoided,true);
 assert.equal(r.diagonalFeatheredFringe,true);
 assert.ok(r.rootDistribution.backLeft>=80&&r.rootDistribution.backRight>=80);
 const samples=w.getStyleSamples();
 const rear=samples.filter(s=>s.zone.startsWith('back')||s.zone.startsWith('nape'));
 assert.ok(rear.length>=40);
 // At least one real back scalp root near the head midline must appear
 // in the representative guide locks, not only at the outer temples.
 const nearMidline=rear.filter(s=>Math.abs(s.root[0]-
   (box.min.x+box.max.x)*.5)<d.x*.16);
 assert.ok(nearMidline.length>=4,'Center-back remained bald');
 for(const sample of rear){
  assert.ok(sample.root[2]<cz-d.z*.04,
   'A rear/nape hair lock was actually grown from the face');
  assert.ok(sample.tip[2]<cz,
   'Rear lock must continue behind the skull, not point toward face');
  assert.ok(Number.isFinite(sample.firstStep[0]+sample.firstStep[1]+sample.firstStep[2]));
 }
 const backTips=samples.filter(s=>s.zone.startsWith('back')).map(s=>s.tip[1]);
 assert.ok(Math.max(...backTips)-Math.min(...backTips)>d.y*.012,
  'Back haircut still has an unnatural ruler-straight cut line');
 for(const s of w.getCutSamples())
  assert.ok(s.minY>=s.trimY-1e-5);
 w.dispose();
});
test('v16 eyeliner reprojects onto same eyelid at -20, 0, +20 degrees',()=>{
 const m=makeIndependentFaceMaster(fixture().source,'female');
 let previous=m.parts.userData.eyelinerSurfaceSyncCount;
 for(const angle of [-20,0,20]){
  const sync=updateFaceFeatureAngles(m.parts,{...FEMALE_V7_DEFAULTS,
   eyeAngle:angle});
  assert.equal(sync.eyelinerMeshesRefitted,4);
  assert.ok(m.parts.userData.eyelinerSurfaceSyncCount>previous);
  previous=m.parts.userData.eyelinerSurfaceSyncCount;
  m.parts.updateMatrixWorld(true);
  for(const side of ['LEFT','RIGHT']){
   for(const height of ['UPPER','LOWER']){
    const liner=m.parts.getObjectByName(side+'_'+height+'_EYELINER');
    const lid=m.parts.getObjectByName(side+'_'+height+'_ANATOMICAL_EYELID');
    assert.equal(liner.parent,lid);
    assert.equal(liner.userData.conformsTo,'real-eyelid-mesh');
    assert.equal(liner.material.polygonOffset,true);
    const lp=liner.geometry.getAttribute('position');
    const ep=lid.geometry.getAttribute('position');
    // Line start is at 0.018*4 = 0.072 of the first eyelid band.
    for(const i of [0,7,14,21,28]){
     const world=new THREE.Vector3(lp.getX(i),lp.getY(i),lp.getZ(i));
     liner.localToWorld(world);
     const target=new THREE.Vector3(
      THREE.MathUtils.lerp(ep.getX(i),ep.getX(29+i),.072),
      THREE.MathUtils.lerp(ep.getY(i),ep.getY(29+i),.072),
      THREE.MathUtils.lerp(ep.getZ(i),ep.getZ(29+i),.072));
     lid.localToWorld(target);
     assert.ok(world.distanceTo(target)<.005,
      'Eye-liner detached from lid at angle '+angle+' ('+side+' '+height+')');
    }
   }
  }
 }
});

test('v17 wigs are independently registered assets with crown center part and physical gravity',()=>{
 const styles=listWigStyles();
 assert.equal(DEFAULT_WIG_STYLE_ID,'center-part-gravity-long');
 assert.ok(styles.some(x=>x.id==='center-part-gravity-long'));
 assert.ok(styles.some(x=>x.id==='salon-layered-long'));
 assert.ok(Object.isFrozen(getWigStyle(DEFAULT_WIG_STYLE_ID)));
 assert.equal(getWigStyle(DEFAULT_WIG_STYLE_ID).gravityMps2,9.81);
 assert.throws(()=>getWigStyle('missing-wig'),/Unknown registered/);
 const face=makeIndependentFaceMaster(fixture().source,'female');
 const wig=createScalpAnchoredWig(face.face,{count:240});
 const report=wig.getReport();
 assert.equal(report.hairstyleId,DEFAULT_WIG_STYLE_ID);
 assert.equal(report.wigAssetType,'independent-wig');
 assert.equal(report.centerPart,true);
 assert.equal(report.gravityRestShape,true);
 assert.equal(report.gravityMps2,9.81);
 assert.equal(report.exactFaceSurfaceCollision,true);
 assert.ok(report.crownWhorl.length===3&&report.crownWhorl.every(Number.isFinite));
 assert.equal(wig.root.userData.assetType,'independent-wig');
 assert.equal(wig.root.userData.hairStyleId,DEFAULT_WIG_STYLE_ID);
 const part=wig.getPartSamples();
 assert.ok(part.length>=20,'Whorl center split should include crown roots');
 assert.ok(part.some(p=>p.side===-1)&&part.some(p=>p.side===1),
  'The center part must send crown locks to BOTH sides of the head');
 assert.ok(part.every(p=>p.gravityRestShape));
 const bb=face.face.geometry.boundingBox,d=bb.getSize(new THREE.Vector3());
 const cx=(bb.min.x+bb.max.x)/2,cz=(bb.min.z+bb.max.z)/2;
 const original=new THREE.Vector3(cx,bb.min.y+d.y*.62,cz+d.z*.10);
 const before=wig.getReport().faceContactEvents;
 const corrected=wig.resolvePoint(original);
 assert.ok(wig.getReport().faceContactEvents>before,'Hair must contact actual face');
 assert.ok(corrected.distanceTo(original)>1e-6,'Collision must displace a strand');
 wig.update(.05);
 assert.ok(wig.getReport().collisionEvents>=0);
 const other=createScalpAnchoredWig(face.face,{count:96,styleId:'salon-layered-long'});
 assert.equal(other.root.userData.hairStyleId,'salon-layered-long');
 assert.equal(other.getReport().centerPart,false);
 assert.notEqual(wig.root,other.root,'Each wig must be a separate 3D instance');
 wig.dispose();other.dispose();
});

test('v18 full crown/rear rooted hair and straight gravity-groomed long locks',()=>{
 const m=makeIndependentFaceMaster(fixture().source,'female');
 const wig=createScalpAnchoredWig(m.face,{count:480,lengthScale:1.25});
 const report=wig.getReport();
 assert.equal(report.rootCount,480);
 assert.equal(report.crownRootRatio,.23);
 assert.equal(report.posteriorRootRatio,.46);
 assert.equal(report.undercoatLockCount,88);
 assert.equal(report.groomingSmoothingPasses,3);
 assert.equal(report.strandRibbonOrientation,'guide-tangent-on-scalp',
  'Hair ribbon must follow real scalp, not fixed horizontal spike axes');
 assert.ok(report.frizzAmplitudeFactor<=.1);
 assert.equal(report.scalpCrownCoverage,'extended-to-rear-top');
 assert.equal(report.rearScalpCoverage,'nape-and-occipital-head-triangles');
 assert.ok(report.rootDistribution.crown>=90,'Crown does not have enough roots');
 for(const key of ['backLeft','backRight'])
  assert.ok(report.rootDistribution[key]>=80,'Back scalp roots missing '+key);
 const g=m.face.geometry;
 const box=g.boundingBox,d=box.getSize(new THREE.Vector3());
 const midZ=(box.min.z+box.max.z)*.5;
 const samples=wig.getCoverageSamples();
 const crowns=samples.filter(x=>x.zone==='crown');
 const rear=samples.filter(x=>x.zone.startsWith('back')||x.zone.startsWith('nape'));
 assert.ok(crowns.length>=24&&rear.length>=70);
 assert.ok(crowns.some(x=>x.root[2]<midZ),
  'New crown hair does not extend to back half of head');
 assert.ok(rear.every(x=>x.root[2]<midZ-d.z*.035),
  'Back hair is still being generated on the face');
 assert.ok(samples.every(x=>Number.isFinite(x.guideDeviation)));
 const cap=wig.root.getObjectByName('REAL_SCALP_TRIANGLE_HAIR_CAP');
 assert.equal(cap.userData.rearUndercoatStripCount,88);
 assert.ok(cap.userData.rearUndercoatMaxStripWidth<d.x*.025);
 for(const cut of wig.getCutSamples())
  assert.ok(cut.minY>=cut.trimY-1e-5);
 wig.update(.05);
 wig.dispose();
});

test('v19 pupils and irises are ROUND in frontal projection on curved 3D globes',()=>{
 for(const gender of ['female','male']){
  const m=makeIndependentFaceMaster(fixture().source,gender);
  for(const side of ['LEFT','RIGHT']){
   for(const name of ['CURVED_IRIS','CURVED_PUPIL']){
    const mesh=m.parts.getObjectByName(side+'_'+name);
    assert.ok(mesh?.isMesh);
    mesh.geometry.computeBoundingBox();
    const bb=mesh.geometry.boundingBox;
    const spanX=bb.max.x-bb.min.x,spanY=bb.max.y-bb.min.y;
    assert.ok(spanX>0&&spanY>0&&spanX/spanY<1.9,
     'Eye color disc must stay compact inside an almond lid '+gender+' '+side+' '+name+' '+spanX/spanY);
    assert.equal(mesh.userData.circularProjected,true);
    assert.equal(mesh.userData.followsFaceSurface,true);
   }
   const iris=m.parts.getObjectByName(side+'_CURVED_IRIS');
   assert.equal(iris.geometry.getAttribute('color').itemSize,3);
   assert.equal(iris.userData.radialFibers,true);
  }
  assert.equal(m.report.detailedParts.irisPupilProjection,'circular-face-conformal-inset');
 }
});
test('v19 independent heroine face is attached to REAL female body without duplicate donor head',()=>{
 const head=makeIndependentFaceMaster(fixture().source,'female');
 const source=new THREE.Group();
 const bodyGeometry=new THREE.CylinderGeometry(.19,.20,1.7,20,24);
 const body=new THREE.Mesh(bodyGeometry,new THREE.MeshStandardMaterial({color:0xc6a9a2}));
 body.name='real CC0 body test fixture';
 source.add(body);
 const oldPositions=bodyGeometry.getAttribute('position').array.slice();
 const art=CHAPTER_ONE_ART_BY_KEY['commander-female'];
 assert.equal(art.characterId,'hero-girl-01');
 assert.ok(FEMALE_COMMANDER_ART_PALETTE.iris.startsWith('#'));
 const attached=attachIndependentHeadToBody(head,source,{characterId:art.characterId});
 assert.equal(attached.report.connectedCharacterId,'hero-girl-01');
 assert.equal(attached.report.hasRealBody,true);
 assert.equal(attached.report.noDuplicateOutfitLimbs,true);
 assert.equal(attached.root.getObjectByName('REFERENCE_PALETTE_OUTFIT'),undefined);
 assert.equal(typeof attached.setOutfitVisible,'function');
 assert.ok(attached.report.donorHeadTrianglesRemoved>0);
 assert.ok(attached.report.donorBodyTrianglesRetained>0);
 const scalpCopy=new THREE.Mesh(head.face.geometry.clone(),head.face.material);
 const cropped=removeHeadBustBelowNeck(head.face,
  attached.report.neckSeamY-(head.face.geometry.boundingBox.max.y-
   head.face.geometry.boundingBox.min.y)*.03);
 assert.ok(cropped.removedTriangles>0);
 assert.equal(head.face.userData.bustRemovedAtNeck,true);
 assert.ok(scalpCopy.geometry.getIndex().count>
  head.face.geometry.getIndex().count,
  'The independent full scalp must remain available after bust crop');
 assert.equal(attached.body.name,'CC0_CLIPPED_FEMALE_BODY');
 assert.deepEqual(bodyGeometry.getAttribute('position').array,oldPositions,
  'Original body GLB must never be modified');
 const clipped=attached.body.getObjectByName('real CC0 body test fixture');
 assert.notEqual(clipped.geometry,body.geometry);
 assert.ok(clipped.geometry.getAttribute('color')?.count>0);
 const dressed=clipped.material;
 attached.setOutfitVisible(false);
 assert.notEqual(clipped.material,dressed,'Clothing should be reversible');
 attached.setOutfitVisible(true);
 assert.equal(clipped.material,dressed,'Clothing should fit original body triangles');
 assert.ok(clipped.geometry.getIndex().count<body.geometry.getIndex().count);
 const hair=createScalpAnchoredWig(scalpCopy,{count:96,
  bodyCollisionResolver:attached.bodyCollider});
 assert.equal(hair.getReport().usesRealBodyTriangleContacts,true);
 assert.equal(hair.root.userData.assetType,'independent-wig');
 assert.ok(attached.bodyCollider.getReport().collisionTriangleCount>0);
 const faceBox=head.face.geometry.boundingBox;
 const guessY=faceBox.min.y-.04;
 const guessX=(faceBox.min.x+faceBox.max.x)*.5;
 const limits=attached.bodyCollider.query(guessX,guessY);
 assert.ok(limits,'Imported torso surface must support actual triangle contacts');
 const point=new THREE.Vector3(guessX,guessY,(limits.front+limits.rear)*.5);
 assert.equal(attached.bodyCollider.resolve(point),true);
 assert.ok(point.z>limits.front||point.z<limits.rear);
 assert.ok(attached.bodyCollider.getReport().contactCorrections>0);
 hair.dispose();attached.dispose();
});

test('v20 body collision protects visible hair-ribbon edges and clumped sway avoids frizz',()=>{
 const face=makeIndependentFaceMaster(fixture().source,'female');
 const box=face.face.geometry.boundingBox;
 const threshold=box.min.y+(box.max.y-box.min.y)*.72;
 const surfaceZ=.9;
 let contacts=0;
 // Simulated imported-body front surface. The solver pushes only points
 // penetrating the torso, just like the real GLB triangle-depth collider.
 const bodySolver={resolve(point){
  if(point.y>=threshold||point.z>=surfaceZ)return false;
  point.z=surfaceZ;contacts++;return true;
 }};
 const wig=createScalpAnchoredWig(face.face,{
  count:96,lengthScale:1.1,bodyCollisionResolver:bodySolver
 });
 const hair=wig.root.getObjectByName('REAL_ROOTED_SWEPT_HAIR_LOCKS');
 const report=wig.getReport();
 assert.equal(report.renderedRibbonBodyCollision,true);
 assert.equal(report.hairClumpSwayGroupSize,12);
 assert.equal(report.frizzAmplitudeFactor,.025);
 const pointsPerLock=report.pointCount/report.rootCount;
 const verify=()=>{
  const positions=hair.geometry.getAttribute('position');
  let checked=0;
  for(let i=0;i<positions.count;i++){
   const section=Math.floor(i/report.ribbonVerticesPerStation)%pointsPerLock;
   if(section===0||positions.getY(i)>=threshold-1e-5)continue;
   checked++;
   assert.ok(positions.getZ(i)>=surfaceZ-1e-5,
    'Actual rendered ribbon edge must remain outside torso collision surface');
  }
  assert.ok(checked>12,'Need a meaningful number of low-hair contact samples');
 };
 verify();
 wig.update(.05);
 verify();
 assert.ok(contacts>0,'Actual render endpoints must use the body resolver');
 assert.ok(wig.getReport().ribbonBodyContactEvents>0,
  'Record visible-ribbon corrections separately from guide contacts');
 wig.dispose();
});

test('v21 real eye gap, fine lash triangles and expanded lip geometry',()=>{
 const source=fixture().source;
 const narrow=makeIndependentFaceMaster(source,'female',{femaleControls:{
  eyeSpacing:.85,lipstickWidth:1
 }});
 const wide=makeIndependentFaceMaster(source,'female',{femaleControls:{
  eyeSpacing:1.35,lipstickWidth:2.8
 }});
 const gap=model=>{
  const l=model.parts.getObjectByName('LEFT_EYE_LINKED_PIVOT');
  const r=model.parts.getObjectByName('RIGHT_EYE_LINKED_PIVOT');
  return r.position.x-l.position.x;
 };
 assert.ok(gap(wide)>gap(narrow)*1.5,'Eyes must separate without changing eye size');
 assert.equal(wide.report.detailedParts.eyeSpacingFactor,1.35);
 assert.equal(wide.report.detailedParts.eyelashFilamentCount,252);
 for(const eye of ['LEFT','RIGHT'])for(const upper of [true,false]){
  const lashes=wide.parts.getObjectByName(
   eye+(upper?'_UPPER':'_LOWER')+'_LASH_MESH');
  assert.equal(lashes.userData.rootedOnEyeliner,true);
  assert.equal(lashes.userData.filamentCount,upper?84:42);
  assert.equal(lashes.geometry.getAttribute('position').count,
   (upper?84:42)*10);
  assert.equal(lashes.userData.curvedRibbonStations,5);
  assert.equal(lashes.userData.tipCurlsUpFromEyeliner,true);
  assert.equal(lashes.geometry.getIndex().count,(upper?84:42)*24);
  assert.equal(lashes.parent.name,eye+'_LASH_ANGLE_CONTROL');
 }
 const lipWidth=model=>{
  const mesh=model.parts.getObjectByName('UPPER_3D_VERMILION_LIP');
  mesh.geometry.computeBoundingBox();
  return mesh.geometry.boundingBox.max.x-mesh.geometry.boundingBox.min.x;
 };
 assert.ok(lipWidth(wide)>lipWidth(narrow)*1.5,
  '2.8x lipstick width must actually widen real vermilion polygons');
 assert.equal(wide.report.detailedParts.lipstickPlacement.width,2.8);
 assert.equal(normalizeFemaleFaceControls({lipstickWidth:9}).lipstickWidth,2.8);
 assert.equal(normalizeFemaleFaceControls({eyeSpacing:9}).eyeSpacing,1.35);
 assert.equal(normalizeMaleFaceControls({eyeSpacing:9}).eyeSpacing,1.35);
});
test('v21 fine fringe adds detail only to the front and preserves rear roots',()=>{
 const face=makeIndependentFaceMaster(fixture().source,'female');
 const normal=createScalpAnchoredWig(face.face,{count:96});
 const fine=createScalpAnchoredWig(face.face,{count:96,fineFringeMultiplier:3});
 const a=normal.getReport(),b=fine.getReport();
 assert.equal(a.rootCount,96);
 assert.ok(b.rootCount>a.rootCount);
 assert.equal(b.fineFringeMultiplier,3);
 for(const zone of ['fringeLeft','fringeRight'])
  assert.ok(b.rootDistribution[zone]>=a.rootDistribution[zone]*2.5);
 for(const zone of ['backLeft','backRight','napeLeft','napeRight'])
  assert.ok(b.rootDistribution[zone]>=a.rootDistribution[zone]-1,
   'Existing rear/neck strands must not be sacrificed for bangs');
 normal.dispose();fine.dispose();
});

test('v22 complete eye assembly moves together: brows, eyelids, eye bags, liner and lashes',()=>{
 const source=fixture().source;
 const a=makeIndependentFaceMaster(source,'female',{femaleControls:{eyeSpacing:.85}});
 const b=makeIndependentFaceMaster(source,'female',{femaleControls:{eyeSpacing:1.35}});
 const labels=[
  'ORBITAL_EYEBALL','UPPER_ANATOMICAL_EYELID','LOWER_ANATOMICAL_EYELID',
  'CURVED_IRIS','UPPER_EYELINER','SCULPTED_EYEBROW','UPPER_LASH_MESH'
 ];
 for(const side of ['LEFT','RIGHT']){
  const pivotA=a.parts.getObjectByName(side+'_EYE_LINKED_PIVOT');
  const pivotB=b.parts.getObjectByName(side+'_EYE_LINKED_PIVOT');
  assert.equal(pivotB.userData.linkedEyeGroups,true);
  const expected= pivotB.position.x-pivotA.position.x;
  assert.ok(Math.abs(expected)>.005,'Entire orbital assembly must change x');
  for(const key of labels){
   const name=side+'_'+key;
   const x=model=>{
    model.parts.updateMatrixWorld(true);
    const component=model.parts.getObjectByName(name);
    assert.ok(component,'Missing linked eye component '+name);
    return new THREE.Box3().setFromObject(component)
     .getCenter(new THREE.Vector3()).x;
   };
   const actual=x(b)-x(a);
   assert.ok(Math.abs(actual-expected)<.008,
    'Eye spacing must carry '+name+' without leaving it behind: '+actual+' versus '+expected);
  }
 }
});
test('v22 salon body locks gain real width without making the fringe thick',()=>{
 const source=fixture().source;
 const face=makeIndependentFaceMaster(source,'female');
 const hair=createScalpAnchoredWig(face.face,{count:96,fineFringeMultiplier:3});
 const report=hair.getReport();
 assert.ok(report.hairStrandWidthFraction>=.012);
 assert.equal(report.fullerCrownBackVolume,true);
 assert.equal(report.glabellaPartClearance,true);
 assert.equal(report.fullBodyTriangleContactBeforeProxy,true);
 assert.equal(report.fullBodyShoulderExtension,false);
 const geo=hair.root.getObjectByName('REAL_ROOTED_SWEPT_HAIR_LOCKS').geometry;
 const attr=geo.getAttribute('position');
 assert.equal(attr.count,report.rootCount*12*8);
 assert.ok([...attr.array].every(Number.isFinite),'Thickened ribbons must stay finite');
 const box=face.face.geometry.boundingBox;
 const body={query(){return {front:box.max.z+.03,rear:box.min.z-.03}},
  resolve(){return false}};
 const torsoHair=createScalpAnchoredWig(face.face,{count:96,
  bodyCollisionResolver:body,fineFringeMultiplier:3});
 assert.equal(torsoHair.getReport().fullBodyShoulderExtension,true);
 const nape=wig=>wig.getCutSamples().find(x=>x.zone==='napeLeft');
 assert.ok(nape(torsoHair).trimY<nape(hair).trimY,
  'Full-body hair must drape below the head cut line toward shoulder');
 torsoHair.update(.05);
 hair.dispose();torsoHair.dispose();
});

test('v23 front roots originate above forehead and real full body has a single rear layer',()=>{
 const face=makeIndependentFaceMaster(fixture().source,'female');
 const box=face.face.geometry.boundingBox,d=box.getSize(new THREE.Vector3());
 const collider={query:()=>null,resolve:()=>false};
 const full=createScalpAnchoredWig(face.face,{count:480,
  bodyCollisionResolver:collider,fineFringeMultiplier:3});
 const cap=full.root.getObjectByName('REAL_SCALP_TRIANGLE_HAIR_CAP');
 const wig=full.getReport();
 assert.equal(cap.userData.rearUndercoatStripCount,0,
  'Full body must never render short extra rear ribbons over the long drape');
 assert.equal(wig.singleRearLayer,true);
 assert.ok(wig.rearBodyVolumeExtra>0,'Additional volume must use the one real rear-hair layer');
 assert.equal(wig.fullLengthEyebrowFringe,true);
 assert.equal(wig.fringeRootAboveHairline,true);
 assert.ok(wig.rootDistribution.fringeLeft>0&&wig.rootDistribution.fringeRight>0);
 for(const sample of full.getCoverageSamples().filter(
  x=>x.zone.startsWith('fringe'))){
  const yn=(sample.root[1]-box.min.y)/d.y;
  assert.ok(yn>.825,
   'Fringe follicle must not originate from eyebrow/forehead: '+yn);
 }
 const head=createScalpAnchoredWig(face.face,{count:96});
 assert.ok(head.getReport().undercoatLockCount>0,
  'Head-only sculptor may keep undercoat when no long body drape exists');
 head.dispose();full.dispose();
});
test('v23 real orbital skin shifts with iris and eyelids instead of leaving eye holes behind',()=>{
 const source=fixture().source;
 const a=makeIndependentFaceMaster(source,'female',{femaleControls:{eyeSpacing:.85}});
 const b=makeIndependentFaceMaster(source,'female',{femaleControls:{eyeSpacing:1.35}});
 assert.equal(b.report.orbitalSocketShiftEnabled,true);
 assert.equal(b.report.orbitalSocketSpacing,1.35);
 const pa=a.face.geometry.getAttribute('position'),
  pb=b.face.geometry.getAttribute('position');
 const box=a.face.geometry.boundingBox,d=box.getSize(new THREE.Vector3()),
  cx=box.getCenter(new THREE.Vector3()).x;
 let moved=0,outerStill=0;
 for(let i=0;i<pa.count;i++){
  const x=pa.getX(i),y=pa.getY(i),z=pa.getZ(i);
  const xn=(x-cx)/d.x,yn=(y-box.min.y)/d.y,
   zn=(z-box.min.z)/d.z;
  if(xn>.095&&xn<.155&&yn>.65&&yn<.74&&zn>.55){
   if(pb.getX(i)-x>d.x*.006)moved++;
  }
  if(Math.abs(xn)>.46&&Math.abs(pb.getX(i)-x)<d.x*.000001)
   outerStill++;
 }
 assert.ok(moved>0,'Underlying socket surface must accompany whole eye assembly');
 assert.ok(outerStill>30,'Remote outer face contour must stay fixed');
});
test('v23 cropped head attaches a filled, GLB-exportable physical neck seam',()=>{
 const head=makeIndependentFaceMaster(fixture().source,'female');
 const box=head.face.geometry.boundingBox,h=box.max.y-box.min.y;
 const bottom=box.min.y+h*.29,top=bottom+h*.065;
 const cut=removeHeadBustBelowNeck(head.face,top);
 assert.ok(cut.removedTriangles>0);
 const attachment={root:new THREE.Group(),report:{}};
 const neck=createSealedNeckBridge(head.face,attachment,{
  headCutY:top,bodyCutY:bottom});
 assert.equal(neck.name,'REAL_HEAD_BODY_CLOSED_NECK_SEAL');
 assert.equal(attachment.report.neckSealed,true);
 assert.ok(attachment.report.neckBridgeTriangles>200);
 assert.ok(neck.geometry.index.count>=600);
 assert.ok([...neck.geometry.getAttribute('position').array].every(Number.isFinite));
 assert.equal(neck.userData.capEnds,true);
 assert.equal(head.face.getObjectByName(neck.name),neck);
});

test('v25 tenfold detachable wig adds real fine fibre triangles without tenfold simulation cost',()=>{
 const face=makeIndependentFaceMaster(fixture().source,'female');
 const wig=createScalpAnchoredWig(face.face,{
  count:96,visualFiberMultiplier:10
 });
 const report=wig.getReport();
 const fine=wig.root.getObjectByName('DETACHABLE_WIG_FINE_FIBRES');
 assert.ok(fine?.isMesh,'Tenfold hair must exist as real GLB-exportable triangles');
 assert.equal(report.wigAssetType,'independent-wig');
 assert.equal(report.visualFiberMultiplier,10);
 assert.equal(report.visualFiberCount,report.rootCount*10);
 assert.equal(report.staticMicroFibreCount,report.rootCount*9);
 assert.ok(report.microFibreTriangles>report.rootCount*9*10);
 assert.ok(report.physicsGuideCount<=320,'Keep the physical guides mobile-safe');
 assert.equal(report.microFibresAnimated,false);
 const arr=fine.geometry.getAttribute('position').array;
 assert.ok([...arr].every(Number.isFinite),'No NaN micro-fibre vertices');
 assert.equal(wig.root.getObjectByName('DETACHABLE_WIG_FINE_FIBRES'),fine);
 wig.dispose();
});
test('v25 actual contact lens pigment and liner remain visible on linked eyelids',()=>{
 const face=makeIndependentFaceMaster(fixture().source,'female',{
  femaleControls:{eyeSpacing:.65,eyeDepth:-.1}
 });
 const iris=face.parts.getObjectByName('LEFT_CURVED_IRIS');
 const upper=face.parts.getObjectByName('LEFT_UPPER_EYELINER');
 const lower=face.parts.getObjectByName('LEFT_LOWER_EYELINER');
 assert.ok(iris?.isMesh&&upper?.isMesh&&lower?.isMesh);
 applyFaceColorMode(face.face,'color',{contactColor:'#2b8ac8'});
 assert.equal(iris.material.color.getHexString(),'2b8ac8');
 assert.ok(upper.visible&&lower.visible);
 assert.equal(upper.renderOrder,9);
 assert.equal(upper.material.depthTest,true);
 assert.ok(upper.material.opacity>=.99);
 assert.ok(face.report.detailedParts.eyeDepthFactor<=-.1);
 assert.equal(face.report.detailedParts.eyeSpacingFactor,.65);
 assert.ok(normalizeFemaleFaceControls({eyeDepth:-9}).eyeDepth>=-.3);
});

test('v26 wig foundation is a transparent unchanged copy of the actual head and exported with the wig',()=>{
 const face=makeIndependentFaceMaster(fixture().source,'female');
 const original=face.face.geometry.getAttribute('position').array.slice();
 const wig=createScalpAnchoredWig(face.face,{
  count:96,visualFiberMultiplier:3
 });
 const foundation=wig.root.getObjectByName('DETACHABLE_WIG_TRANSPARENT_HEAD_BASE');
 assert.ok(foundation?.isMesh);
 assert.notEqual(foundation.geometry,face.face.geometry,
  'Wig foundation must never mutate or share the character head geometry');
 assert.equal(foundation.geometry.getAttribute('position').count,
  face.face.geometry.getAttribute('position').count);
 const cloned=foundation.geometry.getAttribute('position').array;
 assert.deepEqual(Array.from(cloned.slice(0,45)),Array.from(original.slice(0,45)));
 assert.deepEqual(Array.from(face.face.geometry.getAttribute('position').array),Array.from(original));
 assert.equal(foundation.visible,true);
 assert.equal(foundation.material.transparent,true);
 assert.equal(foundation.material.opacity,0);
 assert.equal(foundation.material.depthWrite,false);
 assert.equal(foundation.material.colorWrite,false);
 assert.equal(foundation.userData.exactCopyOfSculptedHead,true);
 assert.equal(wig.getReport().transparentExactHeadWigBase,true);
 assert.equal(wig.getReport().rootScalpLiftFraction,.0125);
 assert.equal(wig.getReport().trueScalpRibbonVertexCollision,true);
 assert.equal(wig.getReport().hairStrandWidthFraction,.0135);
 // All original zone roots are now displaced slightly OUTWARD from the
 // copied head, rather than being planted inside its surface.
 const pos=face.face.geometry.getAttribute('position');
 const box=face.face.geometry.boundingBox;
 const center=box.getCenter(new THREE.Vector3());
 const d=box.getSize(new THREE.Vector3());
 for(const entry of wig.getRootSamples()){
  const source=new THREE.Vector3().fromBufferAttribute(pos,entry.vertexIndex);
  const lifted=new THREE.Vector3(...entry.point).sub(source);
  const outside=source.clone().sub(center).normalize();
  assert.ok(lifted.dot(outside)>=0,'Root cannot be buried beneath head');
  assert.ok(lifted.length()>d.x*.010,'Outward lift must exceed original buried margin');
 }
 const report=wig.getReport();
 assert.ok(report.scalpVertexCorrections>=0);
 wig.dispose();
});

test('v26 complete eye-region sliders change real facial meshes and preserve linked liner/brows',()=>{
 const source=fixture().source;
 const compact=makeIndependentFaceMaster(source,'female',{femaleControls:{
  eyeWidth:.70,eyeHeight:.65,eyeSpacing:.65,
  browWidth:.7,browThickness:.45,lashDensity:.5,lashLength:.5,
  lashThickness:.4,lashCurl:-.5
 }});
 const full=makeIndependentFaceMaster(source,'female',{femaleControls:{
  eyeWidth:1.45,eyeHeight:1.45,eyeSpacing:1.35,
  browWidth:1.5,browThickness:1.85,lashDensity:2.2,lashLength:2.1,
  lashThickness:1.9,lashCurl:1.5
 }});
 const dims=(m,name)=>{
  const o=m.parts.getObjectByName('LEFT_'+name);
  assert.ok(o?.isMesh,name+' must be an actual mesh');
  o.geometry.computeBoundingBox();
  const d=o.geometry.boundingBox.getSize(new THREE.Vector3());
  return {x:d.x,y:d.y,z:d.z};
 };
 for(const [mesh,axis,ratio] of [
  ['ORBITAL_EYEBALL','x',1.8],['ORBITAL_EYEBALL','y',1.8],
  ['SCULPTED_EYEBROW','x',1.8],['SCULPTED_EYEBROW','y',1.7]
 ]){
  const short=dims(compact,mesh)[axis],long=dims(full,mesh)[axis];
  assert.ok(long>short*ratio,
   'Eye-region slider must reshape '+mesh+' '+axis+' '+short+' vs '+long);
 }
 const a=compact.parts.getObjectByName('LEFT_EYE_LINKED_PIVOT');
 const b=full.parts.getObjectByName('LEFT_EYE_LINKED_PIVOT');
 assert.notEqual(a.position.x,b.position.x);
 for(const id of ['LEFT_UPPER_EYELINER','LEFT_LOWER_EYELINER',
  'LEFT_SCULPTED_EYEBROW','LEFT_UPPER_LASH_MESH']){
  const part=full.parts.getObjectByName(id);
  assert.ok(part,'Missing linked mesh '+id);
  let p=part;while(p.parent&&p!==b)p=p.parent;
  assert.equal(p,b,id+' must follow the entire eye-region pivot');
 }
 for(const side of ['LEFT','RIGHT']){
  const thin=compact.parts.getObjectByName(side+'_UPPER_LASH_MESH');
  const thick=full.parts.getObjectByName(side+'_UPPER_LASH_MESH');
  assert.ok(thick.userData.filamentCount>thin.userData.filamentCount*3,
   'Real individual lash counts must respond to density slider');
  assert.equal(thick.userData.lashLength,2.1);
  assert.equal(thick.userData.lashThickness,1.9);
  assert.equal(thick.userData.lashCurl,1.5);
  assert.equal(full.parts.getObjectByName(side+'_UNDER_EYE_SHADOW'),undefined);
  assert.equal(full.parts.getObjectByName(side+'_LOWER_LID_VOLUME'),undefined);
  assert.equal(full.parts.getObjectByName(side+'_ORBITAL_EYEBALL')
   .userData.noDetachedEyeball,true);
 }
 assert.equal(full.report.detailedParts.noStandaloneEyeSphere,true);
 assert.equal(full.report.detailedParts.noUnderEyeBags,true);
 assert.equal(full.report.detailedParts.lashDensityFactor,2.2);
 assert.equal(full.report.detailedParts.eyeWidthFactor,1.45);
 assert.equal(full.report.detailedParts.eyeHeightFactor,1.45);
});

test('v27 face-conforming eye bulges smoothly from eyeliner and default lashes curl',()=>{
 const source=fixture().source;
 const m=makeIndependentFaceMaster(source,'female');
 for(const side of ['LEFT','RIGHT']){
  const eye=m.parts.getObjectByName(side+'_ORBITAL_EYEBALL');
  const liner=m.parts.getObjectByName(side+'_UPPER_EYELINER');
  const lash=m.parts.getObjectByName(side+'_UPPER_LASH_MESH');
  assert.ok(eye?.isMesh&&liner?.isMesh&&lash?.isMesh);
  assert.equal(eye.userData.noDetachedEyeball,true);
  assert.equal(eye.userData.eyelinerToCenterBulge,true);
  assert.equal(eye.userData.eyelinerToCenterBulgeFraction,.080);
  assert.equal(lash.userData.curvedRibbonStations,5);
  assert.equal(lash.userData.tipCurlsUpFromEyeliner,true);
  assert.equal(lash.userData.lashLength,1.4);
  assert.equal(lash.userData.lashCurl,.85);
  const pos=lash.geometry.getAttribute('position');
  const firstZ=pos.getZ(0),secondZ=pos.getZ(2),lastZ=pos.getZ(8);
  assert.ok(lastZ>secondZ&&secondZ>firstZ,
   'Lashes must bend forward in 3D at the curled tip');
  assert.equal(m.report.detailedParts.eyeBulgeStartsAtEyeliner,true);
  assert.equal(m.report.detailedParts.eyeBulgeFraction,.080);
 }
 assert.equal(m.report.detailedParts.eyeWidthFactor,1);
 assert.equal(m.report.detailedParts.eyeHeightFactor,1);
});
test('v27 filled neck seam loft overlaps both clipped rings and closes collar',()=>{
 const head=makeIndependentFaceMaster(fixture().source,'female');
 const box=head.face.geometry.boundingBox,h=box.max.y-box.min.y;
 const bottom=box.min.y+h*.29,top=bottom+h*.065;
 removeHeadBustBelowNeck(head.face,top);
 const attachment={root:new THREE.Group(),report:{}};
 const neck=createSealedNeckBridge(head.face,attachment,{
  headCutY:top,bodyCutY:bottom});
 const p=neck.geometry.getAttribute('position');
 assert.ok(p.count>=6*49);
 assert.equal(attachment.report.neckBridgeUsesExactHeadCut,true);
 assert.ok(attachment.report.neckBridgeHeadCutSamples>=12);
 assert.equal(attachment.report.neckBridgeRingOverlap,1.075);
 assert.equal(attachment.report.neckBridgeUpperInsideActualHead,true);
 assert.equal(attachment.report.neckBridgeLowerInsideActualBody,true);
 assert.ok([...p.array].every(Number.isFinite));
});

test('v28 static detachable hair cards never change vertices with elapsed time',()=>{
 const head=makeIndependentFaceMaster(fixture().source,'female');
 const wig=createScalpAnchoredWig(head.face,{
  count:96,visualFiberMultiplier:3,staticGroom:true
 });
 const report=wig.getReport();
 const geometry=wig.root.getObjectByName('REAL_ROOTED_SWEPT_HAIR_LOCKS').geometry;
 const before=geometry.getAttribute('position').array.slice();
 wig.update(20);wig.update(.05);wig.update(10000);
 assert.deepEqual([...geometry.getAttribute('position').array],[...before],
  'Static hair shape must never drift after the first groom');
 assert.equal(report.physicsHz,0);
 assert.equal(report.physicsGuideCount,0);
 assert.equal(report.staticGroom,true);
 assert.equal(report.constructionCollisionOnly,true);
 assert.equal(report.simulationEnabled,false);
 assert.equal(report.runtimePhysicsCallsPerFrame,0);
 assert.match(report.hairCardStyle,/four-stacked-thick-ribbon/);
 assert.ok(wig.root.getObjectByName('DETACHABLE_WIG_TRANSPARENT_HEAD_BASE'));
 assert.ok(wig.root.getObjectByName('DETACHABLE_WIG_FINE_FIBRES'));
 wig.dispose();
});
test('v28 iris retains a true round 3D mesh disk inside each almond eye opening',()=>{
 const face=makeIndependentFaceMaster(fixture().source,'female',{
  femaleControls:{eyeWidth:1.2,eyeHeight:.65,irisDiameter:2}
 });
 for(const side of ['LEFT','RIGHT']){
  const iris=face.parts.getObjectByName(side+'_CURVED_IRIS');
  const pupil=face.parts.getObjectByName(side+'_CURVED_PUPIL');
  for(const part of [iris,pupil]){
   assert.ok(part?.userData?.unclippedTrueCircle);
   assert.equal(part.userData.apertureFitted,true);
   assert.equal(part.userData.roundVertexCount,65*21);
   part.geometry.computeBoundingBox();
   const size=part.geometry.boundingBox.getSize(new THREE.Vector3());
   assert.ok(Math.abs(size.x/size.y-1)<.01,
    'Projected color lens must be round, not flattened into stripes');
  }
 }
 assert.equal(face.report.detailedParts.irisNotSquashedAtLids,true);
});
test('v28 real shoulder rim caps fill both separately detected cut-plane holes',()=>{
 const head=makeIndependentFaceMaster(fixture().source,'female');
 const bounds=head.face.geometry.boundingBox;
 const width=bounds.max.x-bounds.min.x,cx=(bounds.min.x+bounds.max.x)*.5;
 const torso=new THREE.Group();
 head.face.add(torso);
 for(const side of [-1,1]){
  const mesh=new THREE.Mesh(new THREE.CylinderGeometry(width*.23,width*.23,
   width*.20,24,2),new THREE.MeshStandardMaterial());
  mesh.position.x=cx+side*width*.93;
  torso.add(mesh);
 }
 head.face.updateWorldMatrix(true,true);
 const cutY=head.face.localToWorld(new THREE.Vector3(0,0,0)).y;
 const attachment={root:torso,report:{}};
 const result=createClosedShoulderCaps(head.face,attachment,{cutY});
 assert.equal(result.count,2);
 assert.ok(result.triangles>=12);
 assert.equal(attachment.report.shoulderTopHolesClosed,true);
 for(const side of ['LEFT','RIGHT']){
  const patch=head.face.getObjectByName(side+'_SHOULDER_CUT_SURFACE_CAP');
  assert.ok(patch?.isMesh);
  assert.ok(patch.geometry.getAttribute('position').count>=4);
 }
});

test('v29 female eyes project forward of skin with convex globe, connected lids and round iris',()=>{
 const model=makeIndependentFaceMaster(fixture().source,'female');
 const report=model.report.detailedParts;
 assert.equal(report.anteriorEyeGlobeReconstructed,true);
 assert.equal(report.eyeApertureHeightFraction,.50);
 assert.equal(report.eyeAnteriorClearanceRatios.length,2);
 for(const clearance of report.eyeAnteriorClearanceRatios)
  assert.ok(clearance>-.2&&clearance<.12,
   'Cornea must sit slightly inside the eyelid instead of projecting forward: '+clearance);
 for(const side of ['LEFT','RIGHT']){
  const eye=model.parts.getObjectByName(side+'_ORBITAL_EYEBALL');
  const iris=model.parts.getObjectByName(side+'_CURVED_IRIS');
  const upper=model.parts.getObjectByName(side+'_UPPER_ANATOMICAL_EYELID');
  const lower=model.parts.getObjectByName(side+'_LOWER_ANATOMICAL_EYELID');
  assert.ok(eye?.userData.anteriorGlobeReconstruction);
  assert.ok(iris?.userData.unclippedTrueCircle&&upper?.isMesh&&lower?.isMesh);
  assert.equal(eye.userData.eyelinerToCenterBulgeFraction,.080);
  const p=eye.geometry.getAttribute('position');
  const eyeCenter=p.getZ(9*(48+1)+24);
  const upperRim=p.getZ(18*(48+1)+24);
  assert.ok(eyeCenter>upperRim-model.face.geometry.boundingBox.getSize(new THREE.Vector3()).x*.052*.16,
   'Corneal centre should remain near the eyeliner, not buried');
  assert.ok(eye.userData.anteriorClearanceRatio>-.2&&
   eye.userData.anteriorClearanceRatio<.12);
 }
 const shallow=makeIndependentFaceMaster(fixture().source,'female',{
  femaleControls:{eyeDepth:-.3}
 });
 const forward=makeIndependentFaceMaster(fixture().source,'female',{
  femaleControls:{eyeDepth:.85}
 });
 assert.ok(forward.report.detailedParts.eyeAnteriorClearanceRatios[0]>
  shallow.report.detailedParts.eyeAnteriorClearanceRatios[0]+.035,
  'Eye depth slider must move the anterior cornea, not cosmetic paint');
 assert.equal(FACE_SLIDER_RANGES.eyeDepth[1],.85);
});

test('v30 corneal centre stays smooth and symmetrical instead of following source-skin triangulation',()=>{
 const face=makeIndependentFaceMaster(fixture().source,'female');
 assert.equal(face.report.detailedParts.smoothCornealCore,true);
 assert.equal(face.report.detailedParts.eyeCoreSkinBlendPower,4);
 for(const side of ['LEFT','RIGHT']){
  const eye=face.parts.getObjectByName(side+'_ORBITAL_EYEBALL');
  const iris=face.parts.getObjectByName(side+'_CURVED_IRIS');
  assert.equal(eye.userData.smoothCornealCore,true);
  assert.equal(eye.userData.skinBlendRestrictedToEyelidRim,true);
  assert.equal(iris.userData.sharedSmoothCornealSurface,true);
  const a=eye.geometry.getAttribute('position');
  const z=i=>a.getZ(9*49+i);
  const left=z(16),mid=z(24),right=z(32);
  const span=face.face.geometry.boundingBox.getSize(new THREE.Vector3()).x;
  const radius=span*.052;
  assert.ok(mid>left+radius*.012&&mid>right+radius*.012,
   'Eye front must have smooth visible corneal prominence');
  assert.ok(Math.abs(left-right)<radius*.04,
   'Eye must be symmetric at its core even when the source skin is uneven');
  // Avoid alternating peaks across the iris/white of the actual 3D model.
  const line=Array.from({length:17},(_,i)=>z(i+16));
  const peaks=line.slice(1,-1).filter((v,i)=>
   (v-line[i])*(v-line[i+2])>0).length;
  assert.ok(peaks<=1,'The cornea should have one convex peak, not jagged bands');
 }
});

test('v31 width and height alone determine effective eye size; size never moves cornea into socket',()=>{
 const source=fixture().source;
 const normal=makeIndependentFaceMaster(source,'female');
 const wide=makeIndependentFaceMaster(source,'female',{
  femaleControls:{eyeSize:.5,eyeWidth:1.45,eyeHeight:.65}
 });
 const tall=makeIndependentFaceMaster(source,'female',{
  femaleControls:{eyeSize:1.5,eyeWidth:.70,eyeHeight:1.45}
 });
 const same=makeIndependentFaceMaster(source,'female',{
  femaleControls:{eyeSize:999,eyeWidth:1.45,eyeHeight:.65}
 });
 assert.equal(wide.report.detailedParts.eyeScale,Math.sqrt(1.45*.65));
 assert.equal(tall.report.detailedParts.eyeScale,Math.sqrt(.70*1.45));
 assert.equal(wide.report.detailedParts.eyeSizeDerivedFromWidthHeight,true);
 assert.equal(wide.report.detailedParts.anteriorDepthIndependentOfSize,true);
 assert.equal(wide.report.detailedParts.eyeDepthFactor,0);
 for(const side of ['LEFT','RIGHT']){
  const cornea=face=>face.parts.getObjectByName(side+'_ORBITAL_EYEBALL');
  const centerZ=face=>cornea(face).geometry.getAttribute('position').getZ(9*49+24);
  // Width/height also reshape the SOURCE eye socket skin. Absolute Z
  // may legitimately shift with that skin; measure cornea-vs-skin
  // clearance instead of incorrectly demanding fixed world-space Z.
  for(const m of [normal,wide,tall,same]){
   assert.ok(cornea(m).userData.anteriorClearanceRatio>-.2&&
    cornea(m).userData.anteriorClearanceRatio<.12,
    'The cornea must stay recessed relative to the actual eyelid');
  }
  assert.ok(Math.abs(centerZ(same)-centerZ(wide))<1e-6,
   'Legacy eyeSize input must be ignored');
 }
 assert.equal(normalizeFemaleFaceControls({eyeSize:.5,eyeWidth:1.4,eyeHeight:.9})
  .eyeSize,Math.sqrt(1.4*.9));
 assert.equal(normalizeMaleFaceControls({eyeSize:1.5,eyeWidth:.7,eyeHeight:1.4})
  .eyeSize,Math.sqrt(.7*1.4));
 assert.equal(FACE_SLIDER_RANGES.eyeSize,undefined);
});
test('v31 contact lenses provide warm natural brown choices plus fantasy and custom tones',()=>{
 for(const key of ['brown','darkBrown','chocolate','honeyBrown','hazel',
  'amber','green','olive','emerald','blue','lightBlue','iceBlue','gray',
  'silver','violet','pink','red'])assert.match(CONTACT_COLORS[key],/^#[0-9a-f]{6}$/);
 assert.equal(Object.keys(CONTACT_COLORS).length,17);
 const face=makeIndependentFaceMaster(fixture().source,'female');
 for(const key of ['darkBrown','amber','olive','lightBlue','pink','red']){
  applyFaceColorMode(face.face,'color',{contactColor:CONTACT_COLORS[key]});
  assert.equal(face.parts.getObjectByName('LEFT_CURVED_IRIS').material.color.getHex(),
   Number('0x'+CONTACT_COLORS[key].slice(1)));
 }
 assert.equal(safeContactColor('#ae684c'),'#ae684c');
});
test('v31 static salon wig has staggered curtain fringe, long temples, feathered tips',()=>{
 const face=makeIndependentFaceMaster(fixture().source,'female');
 const wig=createScalpAnchoredWig(face.face,{
  count:480,visualFiberMultiplier:3,fineFringeMultiplier:3,staticGroom:true
 });
 const r=wig.getReport();
 assert.equal(r.runtimePhysicsCallsPerFrame,0);
 assert.equal(r.salonStaticLongLayers,true);
 assert.match(r.helmetSilhouetteFix,/curtain-fringe-long-temples/);
 assert.ok(r.templeLongLayerCount>20);
 const samples=wig.getStyleSamples();
 const fringe=samples.filter(x=>x.zone.startsWith('fringe'));
 const temples=samples.filter(x=>x.zone.startsWith('temple'));
 assert.ok(fringe.length>3&&temples.length>3);
 const minFringe=Math.min(...fringe.map(x=>x.tip[1]));
 const maxFringe=Math.max(...fringe.map(x=>x.tip[1]));
 assert.ok(maxFringe-minFringe>0.003,'Bangs must not end in a straight cut');
 const lowTemple=Math.min(...temples.map(x=>x.tip[1]));
 assert.ok(lowTemple<minFringe*.95,'Temple layer must extend below short bangs');
 wig.dispose();
});

test('v32 catalogs contain 10 independently selectable 3D profiles per gender and group',()=>{
 assert.equal(PART_GROUPS.length,6);
 for(const sex of ['female','male']){
  for(const group of PART_GROUPS){
   const candidates=PART_CATALOG[sex][group];
   assert.equal(candidates.length,group==='hair'?16:10,sex+' '+group);
   assert.equal(new Set(candidates.map(x=>x.id)).size,group==='hair'?16:10);
   assert.equal(new Set(candidates.map(x=>JSON.stringify(x.values))).size,group==='hair'?16:10,
    sex+' '+group+' requires ten distinct geometry or material specifications');
  }
 }
 assert.equal(normalizePartSelection({eye:99,nose:-4}).eye,9);
 assert.equal(normalizePartSelection({eye:99,nose:-4}).nose,0);
});
test('v32 selected nose, eyes and lips actually change original coherent mesh and parts',()=>{
 for(const sex of ['female','male']){
  const f=fixture(),before=f.original.getAttribute('position').array.slice();
  const basic=resolvePartSelection(sex,defaultPartSelection());
  const changed=resolvePartSelection(sex,{
   face:7,eye:6,nose:4,mouth:8,makeup:4,
   eyeX:2,eyeY:2,eyeZ:1,eyeAngle:6,
   noseX:1,noseY:-1,noseZ:2,noseAngle:6,
   mouthX:1,mouthY:2,mouthZ:1,mouthAngle:-6
  });
  const a=makeIndependentFaceMaster(f.source,sex,{
   [sex==='female'?'femaleControls':'maleControls']:basic.controls});
  const b=makeIndependentFaceMaster(f.source,sex,{
   [sex==='female'?'femaleControls':'maleControls']:changed.controls});
  const at=a.face.geometry.getAttribute('position');
  const bt=b.face.geometry.getAttribute('position');
  let moved=0;
  for(let i=0;i<at.count;i++)
   if(Math.abs(at.getX(i)-bt.getX(i))+
     Math.abs(at.getY(i)-bt.getY(i))+
     Math.abs(at.getZ(i)-bt.getZ(i))>1e-6)moved++;
  assert.ok(moved>45,'Preset must sculpt the actual connected head, '+sex);
  assert.ok(b.parts.getObjectByName('LEFT_ORBITAL_EYEBALL').isMesh);
  assert.ok(b.parts.getObjectByName('UPPER_3D_VERMILION_LIP').isMesh);
  assert.ok(b.report.detailedParts.eyeAnteriorClearanceRatios.every(x=>x>-.2&&x<.12));
  assert.deepEqual(f.original.getAttribute('position').array,before);
  if(sex==='female'){
   applyFaceColorMode(b.face,'color',{contactColor:'#514139',makeupType:4});
   assert.equal(b.parts.getObjectByName('UPPER_3D_VERMILION_LIP').material.color.getHex(),0xd09ca8);
  }
 }
});
test('v32 volumetric hair uses 4 offset stacked ribbon layers and 10 registered geometries',()=>{
 assert.equal(listWigStyles().length,16);
 const face=makeIndependentFaceMaster(fixture().source,'female');
 const one=createScalpAnchoredWig(face.face,{count:96,staticGroom:true,
  styleId:'center-part-gravity-long'});
 const short=createScalpAnchoredWig(face.face,{count:96,staticGroom:true,
  styleId:'rounded-bob'});
 assert.equal(one.getReport().layeredRibbonCount,4);
 assert.equal(one.getReport().ribbonVerticesPerStation,8);
 assert.equal(one.getReport().physicsHz,0);
 const locks=one.root.getObjectByName('REAL_ROOTED_SWEPT_HAIR_LOCKS');
 assert.equal(locks.geometry.getAttribute('position').count,
  one.getReport().rootCount*12*8);
 assert.ok(locks.geometry.getIndex().count>one.getReport().rootCount*11*4*6-1);
 const a=one.getStyleSamples(),b=short.getStyleSamples();
 assert.notDeepEqual(a.map(x=>x.tip),b.map(x=>x.tip));
 one.dispose();short.dispose();
});
test('v32 public studios visibly remove sliders and use ten-choice menus',()=>{
 for(const file of ['face-mesh-studio.html','face-body-studio.html']){
  const html=readFileSync(file,'utf8');
  assert.match(html,/v32PartMode/);
  assert.match(html,/createPartSelectorUI/);
  assert.match(html,/v32-legacy/);
  assert.match(html,/v32.*Choices/);
 }
});

test('v33 iris occupies more of true eye aperture while preserving a round pupil and raised convex cornea',()=>{
 const baseline=makeIndependentFaceMaster(fixture().source,'female',{
  femaleControls:{eyeWidth:1.12,eyeHeight:1.28,irisDiameter:1.12}
 });
 const report=baseline.report.detailedParts;
 for(const side of ['LEFT','RIGHT']){
  const iris=baseline.parts.getObjectByName(side+'_CURVED_IRIS');
  const eye=baseline.parts.getObjectByName(side+'_ORBITAL_EYEBALL');
  const pupil=baseline.parts.getObjectByName(side+'_CURVED_PUPIL');
  assert.equal(eye.userData.v33OrbitSampleCount,9);
  assert.equal(eye.userData.smoothCornealCore,true);
  assert.equal(iris.userData.v33IrisScale,.88);
  assert.ok(iris.userData.v33IrisOpeningFraction>=.9);
  assert.equal(iris.userData.gazeInwardOffsetRatio,.055);
  assert.equal(pupil.userData.gazeInwardOffsetRatio,.055);
  eye.geometry.computeBoundingBox();iris.geometry.computeBoundingBox();pupil.geometry.computeBoundingBox();
  const eyeCenterX=eye.geometry.boundingBox.getCenter(new THREE.Vector3()).x;
  const irisCenterX=iris.geometry.boundingBox.getCenter(new THREE.Vector3()).x;
  const pupilCenterX=pupil.geometry.boundingBox.getCenter(new THREE.Vector3()).x;
  assert.ok((irisCenterX-eyeCenterX)*(side==='LEFT'?-1:1)<0,
   'Iris should move toward the nose, not the temple');
  assert.ok(Math.abs(pupilCenterX-irisCenterX)<1e-5,
   'Black pupil must align with the iris to avoid strabismus');
  assert.ok(iris.userData.v33IrisOpeningFraction<=.94);
  assert.ok(iris.userData.unclippedTrueCircle);
  assert.ok(pupil.userData.unclippedTrueCircle);
  assert.ok(eye.userData.anteriorClearanceRatio>-.2&&
   eye.userData.anteriorClearanceRatio<.12);
 }
 assert.equal(report.irisMeshCount,2);
});
test('v33 shoulder seals match real donor vertex colors, have 3D dome shape and cover both holes',()=>{
 const head=makeIndependentFaceMaster(fixture().source,'female');
 const w=head.face.geometry.boundingBox.getSize(new THREE.Vector3()).x;
 const cx=head.face.geometry.boundingBox.getCenter(new THREE.Vector3()).x;
 const torso=new THREE.Group();head.face.add(torso);
 for(const side of [-1,1]){
  const mesh=new THREE.Mesh(new THREE.CylinderGeometry(w*.23,w*.23,
   w*.20,24,2),new THREE.MeshStandardMaterial());
  mesh.position.x=cx+side*w*.93;
  const col=new THREE.Color(side<0?'#cf8d79':'#617b9c');
  const colors=[];
  for(let i=0;i<mesh.geometry.getAttribute('position').count;i++)
   colors.push(col.r,col.g,col.b);
  mesh.geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  torso.add(mesh);
 }
 head.face.updateWorldMatrix(true,true);
 const cutY=head.face.localToWorld(new THREE.Vector3(0,0,0)).y;
 const attachment={root:torso,report:{}};
 const cap=createClosedShoulderCaps(head.face,attachment,{cutY});
 assert.equal(cap.count,2);
 assert.equal(attachment.report.shoulderCapsColorMatchedToBody,true);
 for(const side of ['LEFT','RIGHT']){
  const mesh=head.face.getObjectByName(side+'_SHOULDER_CUT_SURFACE_CAP');
  assert.equal(mesh.userData.v33SkinContinuity,true);
  assert.equal(mesh.userData.v33DomeNotFlat,true);
  assert.equal(mesh.material.vertexColors,true);
  const p=mesh.geometry.getAttribute('position');
  const c=mesh.geometry.getAttribute('color');
  assert.ok(p.getY(0)>p.getY(1));
  assert.ok(c.count===p.count);
  assert.ok([...c.array].every(Number.isFinite));
 }
});
test('v33 hairstyle selections include short, very short and scalp-hugging buzz for both genders',()=>{
 assert.equal(listWigStyles().length,16);
 for(const gender of ['female','male']){
  const chosen=PART_CATALOG[gender].hair;
  for(const [idx,kind] of [[10,'short'],[11,'very-short'],[12,'buzz']])
   assert.equal(getWigStyle(chosen[idx].values.styleId).shortCutKind,kind);
 }
 for(const style of ['natural-short','very-short','buzz-cut']){
  const face=makeIndependentFaceMaster(fixture().source,'female');
  const wig=createScalpAnchoredWig(face.face,{count:120,styleId:style,staticGroom:true});
  const report=wig.getReport();
  assert.equal(report.v33ShortCutKind,getWigStyle(style).shortCutKind);
  assert.equal(report.physicsHz,0);
  assert.equal(report.undercoatLockCount,0);
  assert.equal(report.layeredRibbonCount,4);
  const styleSamples=wig.getStyleSamples(),box=face.face.geometry.boundingBox;
  const dy=box.getSize(new THREE.Vector3()).y;
  const maxStrand=Math.max(...styleSamples.map(sample=>
   Math.abs(sample.root[1]-sample.tip[1])));
  assert.ok(maxStrand<dy*(style==='buzz-cut'?.04:style==='very-short'?.11:.24),
   'Short hairstyle must be a short scalp-bound real mesh');
  wig.dispose();
 }
 assert.equal(Object.keys(HAIR_COLORS).length,16);
 assert.equal(normalizePartSelection({hair:12,hairColor:'blue'}).hairColor,'blue');
 assert.equal(resolvePartSelection('female',{hair:12,hairColor:'blue'}).hairHex,'#415c99');
 assert.equal(resolvePartSelection('male',{hair:11,hairColor:'red'}).hairStyleId,'very-short');
});

test('v33 raised wig base uses three selectable real scalp geometries with matching lifted roots',()=>{
 assert.deepEqual(Object.keys(WIG_BASE_VOLUME_PROFILES),['natural','soft','airy','lifted','full']);
 const face=makeIndependentFaceMaster(fixture().source,'female');
 const original=face.face.geometry.getAttribute('position').array.slice();
 const box=face.face.geometry.boundingBox;
 const d=box.getSize(new THREE.Vector3()),c=box.getCenter(new THREE.Vector3());
 const at=new THREE.Vector3(c.x,box.min.y+d.y*.935,c.z);
 const lift=['natural','soft','airy','lifted','full'].map(profile=>wigVolumeLiftAt(at,box,profile));
 assert.equal(lift[0],0);
 assert.ok(lift[4]>lift[3]&&lift[3]>lift[2]&&lift[2]>lift[1]&&lift[1]>0,'physical volume rises above scalp');
 const results=[];
 for(const mode of ['natural','soft','airy','lifted','full']){
  const wig=createScalpAnchoredWig(face.face,{count:96,staticGroom:true,volumeProfile:mode});
  const cap=wig.root.getObjectByName('REAL_SCALP_TRIANGLE_HAIR_CAP');
  assert.ok(cap?.isMesh);
  assert.equal(cap.userData.v33WigVolumeProfile,mode);
  assert.equal(wig.getReport().v33WigVolumeProfile,mode);
  assert.equal(wig.getReport().runtimePhysicsCallsPerFrame,0);
  assert.equal(wig.getReport().layeredRibbonCount,4);
  results.push({cap:[...cap.geometry.getAttribute('position').array],
   roots:wig.getStyleSamples().map(x=>x.root)});
  wig.dispose();
 }
 assert.deepEqual(results[0].cap.length,results[3].cap.length);
 const changed=results[0].cap.filter((v,i)=>Math.abs(v-results[3].cap[i])>d.x*.002).length;
 assert.ok(changed>30,'selected lifted profile changes many actual scalp cap vertices');
 assert.notDeepEqual(results[0].roots,results[3].roots);
 assert.deepEqual(face.face.geometry.getAttribute('position').array,original,
  'raising removable wig base must never deform the original skin');
 for(const sex of ['female','male']){
  const resolved=resolvePartSelection(sex,{hairVolume:'lifted',hairColor:'brown'});
  assert.equal(resolved.hairVolume,'lifted');
  assert.equal(resolved.selection.hairVolume,'lifted');
  assert.equal(normalizePartSelection({hairVolume:'bogus'}).hairVolume,'natural');
 }
});

test('v35: heroine job and clothing selectors recolor real body and animate preview equipment',()=>{
 const actor=new THREE.Group();
 const attachment=new THREE.Group();actor.add(attachment);
 const body=new THREE.Group();attachment.add(body);
 const geometry=new THREE.BoxGeometry(.45,1.65,.25,8,24,4);
 const c=new Float32Array(geometry.getAttribute('position').count*3).fill(.75);
 geometry.setAttribute('color',new THREE.Float32BufferAttribute(c,3));
 const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({
  vertexColors:true,side:THREE.DoubleSide
 }));
 body.add(mesh);actor.updateWorldMatrix(true,true);
 const wardrobe=createHeroineStudioWardrobe({root:attachment,body},actor);
 assert.equal(HERO_JOBS.length,10);
 assert.ok(HERO_OUTFITS.length>=5&&HERO_ACTIONS.length>=6);
 assert.equal(wardrobe.getState().jobId,'knight');
 assert.ok(wardrobe.getState().bodyMeshCount>0);
 const base=geometry.getAttribute('color').array.slice();
 wardrobe.setSelection({jobId:'mage',outfitId:'robe'});
 assert.equal(wardrobe.getState().jobId,'mage');
 assert.ok(wardrobe.getState().equipmentCount>0);
 assert.notDeepEqual(geometry.getAttribute('color').array,base,
  'Outfit selection must change actual mesh vertex colors');
 wardrobe.setAction('run');wardrobe.update(.04);
 assert.equal(wardrobe.getState().actionId,'run');
 assert.ok(Math.abs(actor.position.y)>0||Math.abs(actor.rotation.z)>0,
  'Selected action must visibly update an actor transform');
 wardrobe.setVisible(false);wardrobe.dispose();
});
test('v35: mobile body studio exposes all selectors linked to live 3D model',()=>{
 const html=readFileSync('face-body-studio.html','utf8');
 for(const id of ['heroJob','heroOutfit','heroAction','heroHairStyle',
  'heroHairVolume','heroHairDensity']){
  assert.match(html,new RegExp('id="'+id+'"'));
 }
 assert.match(html,/createHeroineStudioWardrobe/);
 assert.match(html,/wardrobe\?\.update\(dt\)/);
 assert.match(html,/wardrobe\?\.attachActor\(next\.root\)/);
 assert.match(html,/wardrobe\.setSelection\(selectedStudio\)/);
});

test('v35 cornea and iris are never hidden behind the original skin at any eye vertex',()=>{
 const model=makeIndependentFaceMaster(fixture().source,'female',{femaleControls:{
  eyeWidth:1.17,eyeHeight:1.12,irisDiameter:1.15,eyeDepth:-.12
 }});
 const sampler=createFastFaceSurfaceSampler(model.face.geometry);
 const radius=model.face.geometry.boundingBox.getSize(new THREE.Vector3()).x*.052;
 for(const side of ['LEFT','RIGHT']){
  const eye=model.parts.getObjectByName(side+'_ORBITAL_EYEBALL');
  const iris=model.parts.getObjectByName(side+'_CURVED_IRIS');
  const pupil=model.parts.getObjectByName(side+'_CURVED_PUPIL');
  model.root.updateMatrixWorld(true);
  for(const part of [eye,iris,pupil]){
   const positions=part.geometry.getAttribute('position');
   const vertex=new THREE.Vector3();
   for(let i=0;i<positions.count;i+=13){
    vertex.fromBufferAttribute(positions,i);
    part.localToWorld(vertex);model.face.worldToLocal(vertex);
    const skin=sampler.query(vertex.x,vertex.y);
    if(skin===null)continue;
    assert.ok(vertex.z>skin+radius*.017,
     part.name+' must sit in front of closed donor socket skin');
   }
  }
  assert.ok(pupil.userData.circularProjectedRadius>radius*.18,
   'Black pupil must be noticeably larger without clipping');
 }
 assert.equal(model.face.userData.softNaturalLipTint,true);
});

test('v36 reuse registered skinned battle outfits instead of synthesizing a second costume',()=>{
 const studio=readFileSync('face-body-studio.html','utf8');
 const bridge=readFileSync('src/heroine-battle-costume-bridge.js','utf8');
 const outfit=readFileSync('src/character-system/rigged-outfit-runtime.js','utf8');
 const registry=readFileSync('src/character-model-registry.js','utf8');
 assert.match(studio,/createRealBattleOutfitStudio/);
 assert.match(studio,/getFaceModel:\(\)=>model/);
 assert.match(studio,/v36RealBattleCostume/);
 assert.match(studio,/battleCostume\?\.attachFace\(next\)/);
 assert.match(bridge,/buildRiggedJobOutfit/);
 assert.match(bridge,/createCharacter/);
 assert.match(bridge,/loadJobMotionMap/);
 assert.match(bridge,/hideBattleDonorFace\(fresh\.model\)/);
 assert.match(bridge,/bone\.add\(faceRoot\)/);
 assert.match(bridge,/setHairVisible\(false\)/);
 assert.match(registry,/Superhero_Female_FullBody\.gltf/);
 assert.match(outfit,/quaternius-outfits/);
 assert.doesNotMatch(studio,/fillSelect\('heroOutfit',HERO_OUTFITS\)/);
 for(const id of ['job01','job02','job03','job04','job05','job06','job07','job08','job09','job10'])
  assert.match(bridge,new RegExp("id:'"+id+"'"),'Every real combat job outfit must be selectable');
});

test('v37 eye socket is sculpted into the contiguous original face mesh and iris sits inside eyeliner',()=>{
 const source=fixture().source;
 const donor=source.getObjectByName('GEO-real-source-head');
 const original=donor.geometry.getAttribute('position').array.slice();
 const model=makeIndependentFaceMaster(source,'female');
 const pos=model.face.geometry.getAttribute('position');
 assert.equal(pos.count,original.length/3,'No replacement face card or point loss');
 assert.equal(model.report.detailedParts.eyeSocketGeometry,
  'continuous-original-head-mesh-recessed-under-lid');
 assert.equal(model.report.detailedParts.eyeSkinDepthClampRemoved,true);
 assert.ok(model.report.detailedParts.eyeSocketSculptedVertices>0,
  'The donor face triangles must be physically indented below eyelids');
 assert.ok(model.report.detailedParts.eyeSocketMaxInset>0);
 assert.equal(model.face.geometry.userData.anatomicalEyeSocketSculpt,true);
 assert.deepEqual(donor.geometry.getAttribute('position').array,original,
  'Original imported head remains immutable');
 let receded=0;
 for(let i=0;i<pos.count;i++){
  if(pos.getZ(i)<original[i*3+2]-.000005)receded++;
 }
 assert.ok(receded>=model.report.detailedParts.eyeSocketSculptedVertices*.75,
  'Eye-region head vertices must move inward as a smooth contiguous surface');
 model.root.updateMatrixWorld(true);
 for(const side of ['LEFT','RIGHT']){
  const iris=model.parts.getObjectByName(side+'_CURVED_IRIS');
  const pupil=model.parts.getObjectByName(side+'_CURVED_PUPIL');
  const eyeliner=model.parts.getObjectByName(side+'_UPPER_EYELINER');
  const eye=model.parts.getObjectByName(side+'_ORBITAL_EYEBALL');
  const vertex=(mesh,index)=>model.face.worldToLocal(
   mesh.localToWorld(new THREE.Vector3().fromBufferAttribute(
    mesh.geometry.getAttribute('position'),index)));
  const irisMiddle=vertex(iris,0);
  const eyelinerMiddle=vertex(eyeliner,14);
  assert.ok(irisMiddle.z<eyelinerMiddle.z,
   'Iris centre belongs slightly BEHIND the upper eyeliner, not on top of the skin');
  assert.ok(vertex(pupil,0).z>irisMiddle.z,
   'Black pupil must be a thin layer on the same recessed corneal surface');
  assert.equal(eye.userData.socketDepressionInOriginalMesh,true);
  assert.equal(eye.userData.recessedBehindLid,true);
 }
});
