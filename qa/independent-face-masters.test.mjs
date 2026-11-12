import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import * as THREE from 'three';
import {makeIndependentFaceMaster,FACE_MASTER_SPEC,femaleInnerFeatureDelta,femaleCheekJawDelta}
 from '../src/independent-face-masters.js';
import {updateFaceFeatureAngles,applyFaceColorMode,createFastFaceSurfaceSampler}
 from '../src/face-feature-meshes.js';
import {createScalpAnchoredWig} from '../src/face-scalp-wig.js';
import {DEFAULT_WIG_STYLE_ID,getWigStyle,listWigStyles} from '../src/face-wig-styles.js';
import {normalizeFemaleFaceControls,FEMALE_V7_DEFAULTS,FACE_V7_PALETTE,CONTACT_COLORS,safeContactColor,LIBRARY_FACE_PRESET,MALE_REFERENCE_DEFAULT,FACE_SLIDER_RANGES}
 from '../src/face-v7-controls.js';

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
 assert.equal(female.report.facePartMeshCount,32);
 assert.equal(male.report.facePartMeshCount,19);
 assert.ok(female.report.facePartTriangles>1000);
 assert.equal(female.report.detailedParts.eyelidMeshCount,4);
 assert.equal(female.report.detailedParts.eyeMeshCount,2);
 assert.equal(female.report.detailedParts.lipMeshCount,2);
 assert.equal(female.report.detailedParts.eyebrowMeshCount,2);
 assert.equal(female.report.detailedParts.eyelashMeshCount,4);
 assert.equal(female.report.detailedParts.underEyeShadowMeshCount,2);
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
 assert.equal(female.report.detailedParts.lowerOrbitalVolumeMeshCount,2);
 assert.ok(female.report.detailedParts.irisPolarAngleRadians>.55);
 assert.ok(female.report.detailedParts.pupilPolarAngleRadians>.22);
 assert.equal(female.report.detailedParts.mouthHalfWidthFraction,.044,
  'Female upper and lower lips must use the selected half-width option');
 assert.equal(male.report.detailedParts.mouthHalfWidthFraction,.044,
  'Male inherits the same smaller structural mouth, without lipstick');
 assert.ok(female.root.getObjectByName('LEFT_DOUBLE_EYELID_FOLD')?.isMesh);
 assert.ok(female.root.getObjectByName('RIGHT_LOWER_LID_VOLUME')?.isMesh);
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
 assert.equal(visible.length,33,'Face plus 32 anatomical/eye/eyeshadow meshes');
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
  'eyeSize','lipstickX','lipstickY','lipstickWidth','lipstickHeight',
  'contactPreset','contactColor','resetPreset',
  'maleAdjustments','maleJawSharpness','maleEyeSize','maleIrisDiameter',
  'maleNoseTipLift','maleNostrilCover','maleNoseBridgeSharpness',
  'maleEyeAngle','maleBeardDensity','maleBeardLength','resetMalePreset'])
  assert.match(html,new RegExp('id="'+id+'"'));
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
  eyeSize:.8,eyeAngle:-12
 }}),large=makeIndependentFaceMaster(f.source,'female',{femaleControls:{
  eyeSize:1.25,eyeAngle:15
 }});
 const eyes=(model)=>model.parts.getObjectByName('LEFT_ORBITAL_EYEBALL');
 assert.ok(eyes(large).geometry.boundingSphere===null||
  eyes(large).geometry.getAttribute('position').count>500);
 assert.ok(small.report.detailedParts.eyeScale<large.report.detailedParts.eyeScale);
 assert.ok(Math.abs(large.parts.getObjectByName('LEFT_EYE_LINKED_PIVOT').rotation.z-
  -THREE.MathUtils.degToRad(15))<1e-9);
 const parts=large.parts;
 assert.equal(parts.getObjectByName('LEFT_UNDER_EYE_SHADOW').parent.name,'LEFT_EYE_LINKED_PIVOT');
 assert.equal(parts.getObjectByName('LEFT_SCULPTED_EYEBROW').parent.parent.name,'LEFT_EYE_LINKED_PIVOT');
 assert.equal(updateFaceFeatureAngles(parts,{eyeAngle:10}).eyeAngle,10);
 assert.ok(parts.getObjectByName('LEFT_EYE_LINKED_PIVOT').rotation.z<0);
 assert.equal(applyFaceColorMode(large.face,'color',{contactColor:CONTACT_COLORS.blue}),'color');
 assert.equal(parts.getObjectByName('LEFT_CURVED_IRIS').material.color.getHex(),0x467fa7);
 assert.equal(safeContactColor('invalid'),CONTACT_COLORS.brown);
 assert.equal(applyFaceColorMode(large.face,'clay'),'clay');
 assert.equal(parts.getObjectByName('LEFT_UNDER_EYE_SHADOW').visible,false);
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
 const model=makeIndependentFaceMaster(source,'female',{femaleControls:{eyeAngle:14,eyeSize:1.2}});
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
  jawSharpness:3.9,eyeSize:1.2,eyeAngle:15,beardDensity:.8,beardLength:2
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
 assert.deepEqual(f.report.femaleControls,saved);
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

test('v12 closed liner corners and dark softly feathered lower-eye makeup stay attached',()=>{
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
  const shadow=m.parts.getObjectByName(side+'_UNDER_EYE_SHADOW');
  assert.equal(shadow.userData.feathered,true);
  assert.equal(shadow.geometry.getAttribute('color').itemSize,4);
  assert.ok(shadow.material.opacity>.5);
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
 assert.equal(r.meshCount,2);
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
  assert.equal(eye.eyeballProjection,'orbital-four-landmark-fitted-ellipsoid');
  assert.equal(eye.eyeProfileLateralMargins.length,2);
  for(const margin of eye.eyeProfileLateralMargins)
   assert.ok(Number.isFinite(margin)&&margin>.002,
    'Profile eye still buried under facial skin: '+gender+' '+margin);
  for(const side of ['LEFT','RIGHT']){
   const globe=model.parts.getObjectByName(side+'_ORBITAL_EYEBALL');
   assert.ok(globe.isMesh&&globe.userData.profileExposed);
   assert.ok(globe.scale.z>.95);
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
  eyeSize:[.5,1.5,1],
  irisDiameter:[0,2,1],
  lipstickWidth:[.2,1.8,1],
  lipstickHeight:[.2,1.8,1]
 };
 for(const [key,[min,max,original]] of Object.entries(expected)){
  assert.deepEqual(FACE_SLIDER_RANGES[key],[min,max],key+' range');
  assert.equal(FEMALE_V7_DEFAULTS[key],original,key+' original saved value');
 }
 for(const [key,[low,high]] of Object.entries(FACE_SLIDER_RANGES)){
  const midpoint=(low+high)/2;
  assert.ok(Math.abs(midpoint-FEMALE_V7_DEFAULTS[key])<1e-9,
   'Saved GLB not centered: '+key);
  assert.equal(MALE_REFERENCE_DEFAULT[key],FEMALE_V7_DEFAULTS[key],
   'Male must share saved female face baseline: '+key);
  assert.equal(normalizeFemaleFaceControls({[key]:low})[key],low);
  assert.equal(normalizeFemaleFaceControls({[key]:high})[key],high);
 }
 assert.deepEqual(normalizeFemaleFaceControls({}),FEMALE_V7_DEFAULTS);
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
 assert.ok(wig.getReport().normalUpdateDivisor===3);
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
 assert.ok(r.rootDistribution.backLeft>=90&&r.rootDistribution.backRight>=90);
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
 assert.equal(report.crownRootRatio,.20);
 assert.equal(report.posteriorRootRatio,.51);
 assert.equal(report.undercoatLockCount,88);
 assert.equal(report.groomingSmoothingPasses,3);
 assert.equal(report.strandRibbonOrientation,'guide-tangent-on-scalp',
  'Hair ribbon must follow real scalp, not fixed horizontal spike axes');
 assert.ok(report.frizzAmplitudeFactor<=.1);
 assert.equal(report.scalpCrownCoverage,'extended-to-rear-top');
 assert.equal(report.rearScalpCoverage,'nape-and-occipital-head-triangles');
 assert.ok(report.rootDistribution.crown>=90,'Crown does not have enough roots');
 for(const key of ['backLeft','backRight'])
  assert.ok(report.rootDistribution[key]>=90,'Back scalp roots missing '+key);
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
