import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import * as THREE from 'three';
import {makeIndependentFaceMaster,FACE_MASTER_SPEC}
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
 assert.equal(female.report.code,'female-face-anatomical-v2');
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
 assert.equal(female.report.facePartMeshCount,12);
 assert.equal(male.report.facePartMeshCount,12);
 assert.ok(female.report.facePartTriangles>1000);
 assert.equal(female.report.detailedParts.eyelidMeshCount,4);
 assert.equal(female.report.detailedParts.eyeMeshCount,2);
 assert.equal(female.report.detailedParts.lipMeshCount,2);
 assert.equal(female.report.detailedParts.noseSourceIntegrated,true);
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
});
test('strictly exclude body, wig and makeup from face-only model assembly',()=>{
 const f=fixture();const built=makeIndependentFaceMaster(f.source,'female');
 const visible=[];
 built.root.traverse(o=>{if(o.isMesh&&o.visible)visible.push(o)});
 assert.equal(visible.length,13,'Face plus twelve genuine 3D eye/eyelid/lip meshes');
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
