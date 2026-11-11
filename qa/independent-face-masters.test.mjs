import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import * as THREE from 'three';
import {makeIndependentFaceMaster,FACE_MASTER_SPEC,femaleInnerFeatureDelta,femaleCheekJawDelta}
 from '../src/independent-face-masters.js';
import {updateFaceFeatureAngles,applyFaceColorMode}
 from '../src/face-feature-meshes.js';
import {normalizeFemaleFaceControls,FEMALE_V7_DEFAULTS,FACE_V7_PALETTE,CONTACT_COLORS,safeContactColor}
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
 assert.equal(female.face.material.vertexColors,false);
 assert.equal(female.face.material.map,null);
 assert.equal(female.face.material.wireframe,false);
 assert.ok(female.face.material.color.getHexString().startsWith('bfc3'));
 assert.equal(female.root.getObjectByName('GEO_sclera_l').visible,false);
 assert.equal(female.report.facePartMeshCount,26);
 assert.equal(male.report.facePartMeshCount,14);
 assert.ok(female.report.facePartTriangles>1000);
 assert.equal(female.report.detailedParts.eyelidMeshCount,4);
 assert.equal(female.report.detailedParts.eyeMeshCount,2);
 assert.equal(female.report.detailedParts.lipMeshCount,2);
 assert.equal(female.report.detailedParts.eyebrowMeshCount,2);
 assert.equal(female.report.detailedParts.eyelashMeshCount,4);
 assert.equal(female.report.detailedParts.underEyeShadowMeshCount,2);
 assert.equal(female.report.detailedParts.lipstickMeshCount,2);
 assert.equal(male.report.detailedParts.lipstickMeshCount,0);
 assert.equal(male.report.detailedParts.eyelashMeshCount,0);
 assert.equal(male.report.detailedParts.eyebrowMeshCount,2);
 assert.equal(male.report.maleNoMakeup,true);
 assert.equal(male.report.sharedFemaleBase,true);
 assert.equal(female.report.detailedParts.irisDiameterRequestFactor,1);
 assert.equal(female.report.detailedParts.actualIrisDiameterFactor,1);
 assert.ok(female.report.detailedParts.pupilPolarAngleRadians>.22);
 assert.equal(female.report.femaleControls.jawSharpness,2.5);
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
 assert.ok(changedBetweenSexes>400,'Two genders must contain actually different geometry');
 assert.ok(female.report.cheekVolumeMetric>male.report.cheekVolumeMetric,
  'Female healthy cheek volume should exceed male face');
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
 assert.equal(visible.length,27,'Face plus 26 eye/lip/cosmetic meshes');
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
  'contactPreset','contactColor','resetPreset'])
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
 assert.equal(normalizeFemaleFaceControls({jawSharpness:999}).jawSharpness,2.5);
 assert.equal(FEMALE_V7_DEFAULTS.irisDiameter,1);
 assert.equal(FEMALE_V7_DEFAULTS.jawSharpness,2.5);
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
 assert.equal(parts.getObjectByName('UPPER_LIPSTICK_MAKEUP').visible,false);
 assert.equal(f.face.geometry,f.original);
});
test('v8 lipstick stays projected on the 3D lips and follows XY and size sliders',()=>{
 const source=fixture().source;
 const centered=makeIndependentFaceMaster(source,'female',{femaleControls:{
  lipstickX:0,lipstickY:0,lipstickWidth:1,lipstickHeight:1
 }});
 const moved=makeIndependentFaceMaster(source,'female',{femaleControls:{
  lipstickX:.05,lipstickY:-.025,lipstickWidth:1.25,lipstickHeight:.75
 }});
 const base=centered.parts.getObjectByName('UPPER_3D_VERMILION_LIP');
 const overlay=centered.parts.getObjectByName('UPPER_LIPSTICK_MAKEUP');
 assert.ok(base?.isMesh&&overlay?.isMesh);
 const b=base.geometry.getAttribute('position'),o=overlay.geometry.getAttribute('position');
 assert.equal(b.count,o.count);
 let xError=0,yError=0;
 for(let i=0;i<b.count;i++){
  xError=Math.max(xError,Math.abs(b.getX(i)-o.getX(i)));
  yError=Math.max(yError,Math.abs(b.getY(i)-o.getY(i)));
 }
 assert.ok(xError<1e-6&&yError<1e-6,'Standard lipstick must coincide with actual lip XY');
 const altered=moved.parts.getObjectByName('UPPER_LIPSTICK_MAKEUP').geometry.getAttribute('position');
 const center=(array,key)=>{let sum=0;for(let i=0;i<array.count;i++)
  sum+=key==='x'?array.getX(i):array.getY(i);return sum/array.count};
 assert.ok(center(altered,'x')>center(o,'x'));
 assert.ok(center(altered,'y')<center(o,'y'));
 assert.equal(moved.report.detailedParts.lipstickPlacement.anchoredToLipSurface,true);
 const male=makeIndependentFaceMaster(source,'male');
 assert.equal(male.root.getObjectByName('UPPER_LIPSTICK_MAKEUP'),undefined);
 assert.equal(male.root.getObjectByName('LEFT_UNDER_EYE_SHADOW'),undefined);
 assert.equal(male.root.getObjectByName('LEFT_UPPER_LASH_MESH'),undefined);
 assert.ok(male.root.getObjectByName('LEFT_NATURAL_MALE_BROW')?.isMesh);
});

test('v8 lipstick slider extremes stay on the real vermilion lip footprint',()=>{
 const {source}=fixture();
 const model=makeIndependentFaceMaster(source,'female',{
  femaleControls:{lipstickX:.12,lipstickY:-.12,lipstickWidth:1.8,lipstickHeight:1.8}
 });
 const face=model.face;
 face.geometry.computeBoundingBox();
 const box=face.geometry.boundingBox;
 const width=box.max.x-box.min.x,height=box.max.y-box.min.y;
 const cx=(box.max.x+box.min.x)/2;
 for(const name of ['UPPER_LIPSTICK_MAKEUP','LOWER_LIPSTICK_MAKEUP']){
  const mesh=model.parts.getObjectByName(name);
  assert.ok(mesh?.isMesh,name+' exists');
  const pos=mesh.geometry.getAttribute('position');
  const upper=name.startsWith('UPPER');
  const cy=box.min.y+height*.509+(upper?height*.009:-height*.009);
  for(let i=0;i<pos.count;i++){
   assert.ok(Math.abs(pos.getX(i)-cx)<=width*.044+1e-5,
    name+' stays within lip corners');
   assert.ok(Math.abs(pos.getY(i)-cy)<=height*.019+1e-5,
    name+' stays within the lip vertical envelope');
  }
 }
});
