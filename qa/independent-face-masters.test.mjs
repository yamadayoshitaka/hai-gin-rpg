import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import * as THREE from 'three';
import {makeIndependentFaceMaster,FACE_MASTER_SPEC,femaleInnerFeatureDelta,femaleCheekJawDelta}
 from '../src/independent-face-masters.js';

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
 assert.equal(female.report.code,'female-face-full-cheeks-tapered-chin-v6');
 assert.equal(male.report.code,'male-face-base-v1');
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
 assert.equal(female.report.facePartMeshCount,16);
 assert.equal(male.report.facePartMeshCount,12);
 assert.ok(female.report.facePartTriangles>1000);
 assert.equal(female.report.detailedParts.eyelidMeshCount,4);
 assert.equal(female.report.detailedParts.eyeMeshCount,2);
 assert.equal(female.report.detailedParts.lipMeshCount,2);
 assert.equal(female.report.detailedParts.noseSourceIntegrated,true);
 assert.equal(female.report.detailedParts.doubleLidCreaseMeshCount,2);
 assert.equal(female.report.detailedParts.lowerOrbitalVolumeMeshCount,2);
 assert.ok(female.report.detailedParts.irisPolarAngleRadians>.55);
 assert.ok(female.report.detailedParts.pupilPolarAngleRadians>.22);
 assert.equal(female.report.detailedParts.mouthHalfWidthFraction,.044,
  'Female upper and lower lips must use the selected half-width option');
 assert.equal(male.report.detailedParts.mouthHalfWidthFraction,.119,
  'Male mouth must remain unchanged');
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
 assert.equal(female.report.innerFeatureHalfWidthLimit,.55);
 assert.equal(female.report.femaleJawStyle,'full-cheek-smooth-oval-point-v6');
 assert.equal(female.report.cheekJawSculpt,'midface-fullness-and-lower-jaw-taper-v6');
 assert.ok(female.report.cheekSculptSamples>0);
 assert.ok(female.report.jawSculptSamples>0);
 assert.ok(female.report.addedCheekDepth>0);
 assert.ok(female.report.narrowedJawDistance>0);
 assert.ok(female.report.apexLowering>0);
});
test('strictly exclude body, wig and makeup from face-only model assembly',()=>{
 const f=fixture();const built=makeIndependentFaceMaster(f.source,'female');
 const visible=[];
 built.root.traverse(o=>{if(o.isMesh&&o.visible)visible.push(o)});
 assert.equal(visible.length,17,'Face plus sixteen real 3D feature meshes');
 assert.ok(visible.includes(built.face));
 assert.ok(visible.every(o=>o===built.face||o.parent===built.parts));
 assert.ok(visible.every(o=>!/hair|armour|body|garment/i.test(o.name)));
 assert.equal(built.report.headOnly,true);
 assert.throws(()=>makeIndependentFaceMaster(new THREE.Group(),'female'),/high-resolution/);
 assert.throws(()=>makeIndependentFaceMaster(f.source,'other'),/male\/female/);
});
test('face studio includes stable gender, view and export controls with no body dependency',()=>{
 const html=readFileSync('face-mesh-studio.html','utf8');
 for(const id of ['female','male','front','side','threeQuarter','back','wire',
  'faceCanvas','export','status','metrics'])
  assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(html,/makeIndependentFaceMaster/);
 assert.match(html,/realistic-head-sculpt.glb/);
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
 assert.ok(hollow.dz>.02,'Previously hollow mid-cheek receives meaningful 3D volume');
 assert.ok(hollow.dz>cheekBone.dz*15,
  'Do not exaggerate the cheekbone instead of filling the sunken cheek');
 assert.equal(hollow.dx,0,'Cheek zone must keep its width');
 const chin=sculpt(.37,.30);
 assert.ok(chin.dx<-.009,'Actual lower jaw edge must be narrowed, not just centreline');
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
