import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createReferenceFaceSkinMaterial} from '../src/face-reference-skin-pbr-v90.js';
import {updateRealFacePigment} from '../src/face-feature-meshes.js';
import {createFaceOralAnatomy} from '../src/face-oral-anatomy-v80.js';

test('v90 source-owned facial skin has no detached lipstick overlay and uses a physical material',()=>{
 const material=createReferenceFaceSkinMaterial();
 assert.ok(material.isMeshPhysicalMaterial);
 assert.equal(material.metalness,0);
 assert.ok(material.roughness>.70);
 assert.equal(material.userData.v90LipGlossFollowsHeadVertices,true);
 const shader={
  vertexShader:'#include <common>\n#include <begin_vertex>',
  fragmentShader:'#include <common>\n#include <roughnessmap_fragment>'
 };
 material.onBeforeCompile(shader);
 assert.match(shader.vertexShader,/attribute float v90LipWetness/);
 assert.match(shader.vertexShader,/vReferenceLipWetness = v90LipWetness/);
 assert.match(shader.fragmentShader,/roughnessFactor \*= mix/);
 assert.equal(material.customProgramCacheKey(),
  'reference-skin-pbr-v90-native-lip-roughness');
 material.dispose();
});

test('v90 valid native oral aperture receives lipstick and lip gloss on the actual head triangles',()=>{
 const face=new THREE.Mesh(
  new THREE.SphereGeometry(.3,80,64),
  createReferenceFaceSkinMaterial()
 );
 face.name='FEMALE_INDEPENDENT_CLAY_FACE';
 face.userData.actualMouthCreaseY=0;
 face.userData.v88NativeOralRig={ready:true};
 face.userData.v83SafeOriginalMouthTopology=false;
 const result=updateRealFacePigment(face,{mouthWidth:.65},'color','female',0);
 assert.ok(result.lip>0,'Real v88 native lip boundary must receive pigment');
 assert.equal(face.userData.v90NativeOralLipstickReady,true);
 const gloss=face.geometry.getAttribute('v90LipWetness');
 const pigment=face.geometry.getAttribute('color');
 assert.equal(gloss.count,face.geometry.getAttribute('position').count);
 assert.equal(pigment.count,gloss.count);
 assert.ok(Array.from(gloss.array).some(v=>v>.10),'Real lips need a glossier material');
 assert.ok(Array.from(gloss.array).some(v=>v===0),'Skin must not all get lip gloss');
 assert.ok(Array.from(pigment.array).every(Number.isFinite));
 updateRealFacePigment(face,{mouthWidth:.65},'clay','female',0);
 assert.ok(Array.from(face.geometry.getAttribute('v90LipWetness').array).every(v=>v===0),
  'Clay topology preview must not retain coloured lip specular regions');
 face.geometry.dispose();face.material.dispose();
});

test('v90 enamel incisors have their own rounded mesh and do not use primitive bead-only tooth rows',()=>{
 const face=new THREE.Group();
 const mouth=createFaceOralAnatomy(face,{width:.12,height:.3,depth:.2});
 const central=mouth.root.getObjectByName('V80_UPPER_TOOTH_06');
 const molar=mouth.root.getObjectByName('V80_UPPER_TOOTH_02');
 assert.ok(central?.geometry?.type==='BoxGeometry',
  'Visible incisors should be real bevelled crowns');
 assert.equal(central.userData.v90NaturalEnamelCrown,'rounded-box-incisor');
 assert.equal(molar.userData.v90NaturalEnamelCrown,'rounded-molar');
 assert.ok(molar.geometry.type==='SphereGeometry');
 assert.ok(central.material.isMeshPhysicalMaterial);
 assert.ok(central.material.ior>=1.45);
 mouth.dispose();
});
