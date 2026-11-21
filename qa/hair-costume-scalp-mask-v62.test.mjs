import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {setCostumeHairScalpMask,releaseCostumeHairScalpMask}
 from '../src/face-costume-scalp-mask.js';
import {FACE_HAIR_RUNTIME_BUILD,createScalpAnchoredWig}
 from '../src/face-scalp-wig.js';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
function source(){
 const geometry=new THREE.SphereGeometry(.5,28,20);
 geometry.computeVertexNormals();
 const head=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial());
 return {head,geometry};
}

test('costume clipping hides native scalp beneath wig but keeps donor and ear/face skin',()=>{
 const {head,geometry}=source();
 const before=geometry.getAttribute('position').count;
 const oldMaterial=head.material,oldMatrix=head.matrix.clone();
 const r=setCostumeHairScalpMask(head,'buzz-cut');
 assert.ok(r.active&&r.removed>0,'native crown must be clipped');
 assert.notEqual(head.geometry,geometry);
 assert.ok(head.geometry.getAttribute('position').count>0);
 assert.equal(head.userData.originalCostumeScalpGeometry,geometry);
 assert.equal(head.material,oldMaterial);
 assert.ok(head.matrix.equals(oldMatrix),'head bone pose must be unchanged');
 assert.equal(head.userData.costumeScalpMaskMode,'donor-reference-neck-safe-v63');
 const second=setCostumeHairScalpMask(head,'sadako-straight-long');
 assert.equal(second.active,true);
 assert.equal(head.userData.originalCostumeScalpGeometry,geometry);
 const restored=setCostumeHairScalpMask(head,'buzz-cut',{wigVisible:false});
 assert.equal(restored.restored,true);
 assert.equal(head.geometry,geometry);
 releaseCostumeHairScalpMask(head);
 assert.equal(head.geometry,geometry);
 geometry.dispose();head.material.dispose();
});

test('costume scalp clipping preserves morph target data rather than losing facial expressions',()=>{
 const {head,geometry}=source();
 const src=geometry.getAttribute('position');
 const morph=new Float32Array(src.count*3);
 for(let i=0;i<src.count;i++){
  morph[i*3]=src.getX(i)+.03;
  morph[i*3+1]=src.getY(i);
  morph[i*3+2]=src.getZ(i);
 }
 geometry.morphAttributes.position=[new THREE.Float32BufferAttribute(morph,3)];
 head.updateMorphTargets();
 const result=setCostumeHairScalpMask(head,'buzz-cut');
 assert.equal(result.active,true);
 const p=head.geometry.getAttribute('position');
 const m=head.geometry.morphAttributes.position?.[0];
 assert.ok(m&&m.count===p.count);
 for(let i=0;i<Math.min(100,p.count);i++)
  assert.ok(Math.abs(m.getX(i)-p.getX(i)-.03)<1e-5);
 releaseCostumeHairScalpMask(head);
 geometry.dispose();head.material.dispose();
});

test('sparse pre-v61 buzz material and donor hairline are restored',()=>{
 const {head,geometry}=source();
 const wig=createScalpAnchoredWig(head,{styleId:'buzz-cut',
  color:0x77513e,count:80,staticGroom:true,
  normalLayeredSingleMesh:false});
 const cap=wig.root.getObjectByName('REAL_SCALP_TRIANGLE_HAIR_CAP');
 assert.ok(cap);
 assert.equal(cap.material.type,'MeshPhysicalMaterial');
 assert.equal(cap.userData.v66RealCrownUnderlayTriangles,0);
 assert.equal(cap.renderOrder,2);
 assert.equal(wig.getReport().buzzSparseApprovedLookRestored,true);
 assert.equal(wig.getReport().buzzScalpPigmentBelowFibres,false);
 const stubble=wig.root.getObjectByName('CLOSE_CUT_SCALP_FIBRES_V18');
 assert.equal(stubble?.userData.fibreCount,30000);
 wig.dispose();geometry.dispose();head.material.dispose();
});

test('Sadako retains side-crown coverage and movement while costume native scalp is clipped',()=>{
 const {head,geometry}=source();
 const wig=createScalpAnchoredWig(head,{styleId:'sadako-straight-long',
  count:100,color:0x77513e,staticGroom:false,
  normalLayeredSingleMesh:false});
 const report=wig.getReport();
 assert.ok(report.v66RealCrownUnderlayTriangles>0);
 assert.equal(report.bilateralTempleScalpCoverage,true);
 assert.equal(report.dynamicHairFollowsHead,true);
 const r=setCostumeHairScalpMask(head,'sadako-straight-long');
 assert.ok(r.active);
 assert.equal(report.buzzSparseApprovedLookRestored,false);
 wig.dispose();
 releaseCostumeHairScalpMask(head);
 geometry.dispose();head.material.dispose();
});

test('full-body studio applies the same donor mask ONLY after real costume fitting',()=>{
 const body=read('face-body-studio.html');
 const salon=read('face-mesh-studio.html');
 assert.match(FACE_HAIR_RUNTIME_BUILD,/costume-neck-buzz-crown-v63$/);
 for(const html of [body,salon])
  assert.match(html,/20261121-costume-neck-buzz-crown-v63/);
 assert.match(body,/import \{setCostumeHairScalpMask,releaseCostumeHairScalpMask\}/);
 assert.match(body,/if\(v32PartMode&&!battleCostume\)return/);
 assert.match(body,/battleCostume=bridge;[\s\S]*?syncCostumeScalpMask\(\)/);
 assert.match(body,/wigVisible=!wigVisible;[\s\S]*?syncCostumeScalpMask\(\)/);
 assert.match(body,/releaseCostumeHairScalpMask\(previous.face\)/);
 assert.match(body,/garmentCollisionResolver:mantleCollision/);
 assert.match(salon,/buzzHairlineFractionAtPoint/);
 assert.match(read('.github/workflows/hair-reselect-regression.yml'),
  /hair-costume-scalp-mask-v62\.test\.mjs/);
});
