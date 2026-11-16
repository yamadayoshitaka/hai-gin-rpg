import assert from 'node:assert/strict';
import * as THREE from 'three';
import {readFileSync} from 'node:fs';
import {fitBattleArtistFaceToHead,BATTLE_FACE_PROPORTION_VERSION}
 from '../src/character-system/battle-head-proportion-fit.js';

// Use the actual CC0 head's 3490 position vertices, including its wider
// cervical/shoulder skirt; a rectangular test mesh would conceal the bug.
const glb=readFileSync(new URL('../assets/master-sources/blender/realistic-head-animation.glb',import.meta.url));
assert.equal(glb.toString('ascii',0,4),'glTF');
const jsonSize=glb.readUInt32LE(12);
const gltf=JSON.parse(glb.toString('utf8',20,20+jsonSize));
const mesh=gltf.meshes.find(m=>m.name==='GEO-head_animation_realistic.001');
const accessor=gltf.accessors[mesh.primitives[0].attributes.POSITION];
const view=gltf.bufferViews[accessor.bufferView];
const start=20+jsonSize+8+view.byteOffset+(accessor.byteOffset||0);
const stride=view.byteStride||12;
const vertices=new Float32Array(accessor.count*3);
for(let i=0;i<accessor.count;i++)for(let k=0;k<3;k++)
 vertices[i*3+k]=glb.readFloatLE(start+i*stride+k*4);
const node=gltf.nodes.find(n=>n.name==='CC0_SOURCE_GEO-head_animation_realistic');
assert.ok(node?.scale&&node.translation);

for(const sex of ['male','female']){
 const bone=new THREE.Bone();bone.name='Head';
 const root=new THREE.Group();bone.add(root);
 root.scale.setScalar(.64);root.position.set(0,-.145,0);
 const geo=new THREE.BufferGeometry();
 geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
 const face=new THREE.Mesh(geo,new THREE.MeshPhysicalMaterial({color:0xa88b79}));
 face.position.fromArray(node.translation);face.scale.fromArray(node.scale);root.add(face);
 const eye=new THREE.Mesh(new THREE.SphereGeometry(.014),new THREE.MeshStandardMaterial());
 face.add(eye);
 bone.updateMatrixWorld(true);
 const material=face.material;
 // Measured from the actual male 65-bone combat head by Chromium GLTFLoader.
 const center=[0,.09493554346,.01919321718],size=[.1812702966,.2313497336,.2233311523];
 const target={min:center.map((v,i)=>v-size[i]/2),max:center.map((v,i)=>v+size[i]/2)};
 const fitted=fitBattleArtistFaceToHead({faceRoot:root,faceMesh:face,headBounds:target});
 assert.equal(fitted.version,BATTLE_FACE_PROPORTION_VERSION);
 assert.ok(fitted.sourceMeshTransformApplied);
 assert.ok(fitted.shoulderWidthExcludedFromFit);
 assert.ok(fitted.cervicalSkirtExcludedFromHeightFit);
 assert.ok(fitted.cranialSamples>3000,'Real human skull vertex sample missing');
 assert.ok(fitted.sourceShoulderToSkullWidthRatio>1.45,
  'Need to exclude genuinely broad neck/bust from face width: '+JSON.stringify(fitted));
 assert.ok(fitted.widthRatio>=.99&&fitted.widthRatio<=1.15,
  'True cranial width must match the head bone, not be a tiny mask');
 assert.ok(fitted.cranialHeightRatio>=1&&fitted.cranialHeightRatio<=1.15);
 assert.ok(fitted.scale>.95,'Small-face bug still present');
 assert.equal(face.material,material,'Skin finish must not be altered by fit');
 assert.equal(eye.parent,face,'Eyes/eyelashes remain skull-anchored');
 assert.equal(root.parent,bone,'Facial morphs must follow Head bone');
 assert.ok(Math.abs(root.scale.x-root.scale.y)<1e-8,'Do not stretch facial features');
 const old=root.position.clone(),scale=root.scale.x;
 const twice=fitBattleArtistFaceToHead({faceRoot:root,faceMesh:face,headBounds:target});
 assert.ok(root.position.distanceTo(old)<1e-6,'No accumulating vertical head offset');
 assert.ok(Math.abs(root.scale.x-scale)<1e-6,'No cumulative face growth');
 assert.equal(twice.widthRatio,fitted.widthRatio);
}
console.log('PASS: actual 3490-vertex CC0 face resized to human skull, neck/shoulder-width excluded, eyes preserved');
