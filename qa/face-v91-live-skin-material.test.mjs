import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createReferenceFaceSkinMaterial} from '../src/face-reference-skin-pbr-v90.js';
import {applyHeroineSkinMaterial} from '../src/heroine-skin-material.js';

test('v91 face editor preserves real moving lip PBR shader when fitting studio skin',()=>{
 const material=createReferenceFaceSkinMaterial();
 const face=new THREE.Mesh(new THREE.SphereGeometry(.35,20,16),material);
 const wetLipShader=material.onBeforeCompile;
 const originalProgramKey=material.customProgramCacheKey();
 assert.equal(face.userData.studioHeroineFaceSurface,undefined);
 const report=applyHeroineSkinMaterial(face);
 assert.equal(report.applied,true);
 assert.equal(report.nativeLipShaderPreserved,true);
 assert.equal(face.material,material,'Do not replace the real skin/lip PBR shader');
 assert.equal(face.material.onBeforeCompile,wetLipShader);
 assert.equal(face.material.customProgramCacheKey(),originalProgramKey);
 assert.ok(face.material.bumpMap,'Still show subtle pore roughness on the real skin');
 assert.equal(face.userData.v91NativeLipShaderPreserved,true);
 assert.equal(face.userData.studioHeroineFaceSurface,true);
 assert.equal(applyHeroineSkinMaterial(face).reused,true);
 face.geometry.dispose();material.dispose();
});

test('v91 neutral fallback still applies a physical skin material',()=>{
 const mat=new THREE.MeshStandardMaterial({color:0xf0d9cb});
 const face=new THREE.Mesh(new THREE.SphereGeometry(.2,12,8),mat);
 const result=applyHeroineSkinMaterial(face);
 assert.equal(result.applied,true);
 assert.ok(face.material.isMeshPhysicalMaterial);
 assert.equal(face.material.userData.v90LipGlossFollowsHeadVertices,undefined);
 face.geometry.dispose();face.material.dispose();mat.dispose();
});
