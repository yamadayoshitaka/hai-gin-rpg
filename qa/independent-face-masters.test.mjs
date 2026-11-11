import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import * as THREE from 'three';
import {makeIndependentFaceMaster,FACE_MASTER_SPEC,femaleInnerFeatureDelta,femaleCheekJawDelta}
 from '../src/independent-face-masters.js';
import {updateFaceFeatureAngles,applyFaceColorMode}
 from '../src/face-feature-meshes.js';
import {createScalpAnchoredWig} from '../src/face-scalp-wig.js';
import {normalizeFemaleFaceControls,FEMALE_V7_DEFAULTS,FACE_V7_PALETTE,CONTACT_COLORS,safeContactColor,LIBRARY_FACE_PRESET,MALE_REFERENCE_DEFAULT}
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
 assert.equal(female.report.facePartMeshCount,30);
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
 assert.equal(visible.length,31,'Face plus 30 anatomical eye/lip meshes');
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
 assert.equal(normalizeFemaleFaceControls({jawSharpness:999}).jawSharpness,5);
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
test('v10 lipstick stays on the actual lip triangles and sliders affect pigment only',()=>{
 const source=fixture().source;
 const base=makeIndependentFaceMaster(source,'female');
 const moved=makeIndependentFaceMaster(source,'female',{femaleControls:{
  lipstickX:.05,lipstickY:-.025,lipstickWidth:1.25,lipstickHeight:.75
 }});
 for(const part of ['UPPER','LOWER']){
  const lip=base.parts.getObjectByName(part+'_3D_VERMILION_LIP');
  const altered=moved.parts.getObjectByName(part+'_3D_VERMILION_LIP');
  assert.ok(lip?.isMesh&&altered?.isMesh);
  assert.equal(base.parts.getObjectByName(part+'_LIPSTICK_MAKEUP'),undefined);
  const p=lip.geometry.getAttribute('position');
  const q=altered.geometry.getAttribute('position');
  const c=lip.geometry.getAttribute('color');
  const d=altered.geometry.getAttribute('color');
  assert.equal(c.itemSize,3);
  let changed=0;
  for(let i=0;i<p.count;i++){
   assert.equal(p.getX(i),q.getX(i));
   assert.equal(p.getY(i),q.getY(i));
   if(Math.abs(c.getX(i)-d.getX(i))>1e-5)changed++;
  }
  assert.ok(changed>0,'Lipstick sliders should change color without moving mesh');
  assert.equal(altered.userData.lipstickOnSameTriangles,true);
 }
 assert.equal(moved.report.detailedParts.lipstickPlacement.paintAsVertexColor,true);
 const male=makeIndependentFaceMaster(source,'male');
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
 assert.equal(m.report.detailedParts.blushOpacityFactor,.43);
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

test('male eye-angle updates preserve independent male controls and never add cosmetics',()=>{
 const m=makeIndependentFaceMaster(fixture().source,'male');
 const requested={...MALE_REFERENCE_DEFAULT,eyeAngle:-8,browAngle:12,lashAngle:3};
 const result=updateFaceFeatureAngles(m.parts,requested);
 assert.equal(result.eyeAngle,-8);
 assert.equal(result.browAngle,12);
 assert.equal(result.lashAngle,3);
 for(const side of ['LEFT','RIGHT']){
  const sign=side==='LEFT'?-1:1;
  for(const [name,angle] of [
   ['_EYE_LINKED_PIVOT',-8],['_BROW_ANGLE_CONTROL',12],
   ['_LASH_ANGLE_CONTROL',3]
  ]){
   const pivot=m.parts.getObjectByName(side+name);
   if(pivot)assert.ok(Math.abs(pivot.rotation.z-sign*THREE.MathUtils.degToRad(angle))<1e-9);
  }
 }
 assert.equal(m.parts.getObjectByName('LEFT_UPPER_EYELINER'),undefined);
 assert.equal(m.parts.getObjectByName('LOWER_LIPSTICK_MAKEUP'),undefined);
 assert.equal(m.face.material.vertexColors,false);
});
