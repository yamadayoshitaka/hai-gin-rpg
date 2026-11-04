// Body-under-outfit regression: preserve the real face while removing naked
// torso/leg triangles rendered through armor. Uses the shipped character data.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import {maskBodyBelowNeck} from '../src/character-system/rigged-outfit-runtime.js';

function loadAccessor(json,buffer,id){
  const a=json.accessors[id],v=json.bufferViews[a.bufferView];
  const offset=(v.byteOffset||0)+(a.byteOffset||0),count=a.count*({SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type]);
  const length={5121:1,5123:2,5125:4,5126:4}[a.componentType];
  const array=a.componentType===5121?new Uint8Array(count):a.componentType===5123?new Uint16Array(count):a.componentType===5125?new Uint32Array(count):new Float32Array(count);
  for(let i=0;i<count;i++){
    const p=offset+i*length;
    array[i]=a.componentType===5121?buffer[p]:a.componentType===5123?buffer.readUInt16LE(p):
      a.componentType===5125?buffer.readUInt32LE(p):buffer.readFloatLE(p);
  }
  return array;
}
for(const sex of ['Male','Female']){
  const base=`assets/characters/quaternius-base/Superhero_${sex}_FullBody`;
  const json=JSON.parse(fs.readFileSync(base+'.gltf'));
  const bin=fs.readFileSync(base+'.bin');
  const primitive=json.meshes.at(-1).primitives[0];
  const indices=loadAccessor(json,bin,primitive.indices);
  const joints=loadAccessor(json,bin,primitive.attributes.JOINTS_0);
  const weights=loadAccessor(json,bin,primitive.attributes.WEIGHTS_0);
  const vertices=json.accessors[primitive.attributes.POSITION].count;
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(vertices*3),3));
  geometry.setAttribute('skinIndex',new THREE.Uint8BufferAttribute(joints,4));
  geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));
  geometry.setIndex(new THREE.BufferAttribute(indices,1));
  const mesh=new THREE.SkinnedMesh(geometry,new THREE.MeshStandardMaterial());
  mesh.name=`SuperHero_${sex}`;
  mesh.skeleton=new THREE.Skeleton(json.skins[0].joints.map(i=>{
    const bone=new THREE.Bone();bone.name=json.nodes[i].name;return bone;
  }));
  const model=new THREE.Group();model.add(mesh);
  const restore=maskBodyBelowNeck(model);
  const faceTriangles=mesh.geometry.index.count/3;
  assert.ok(faceTriangles>1400&&faceTriangles<3500,`${sex} face mask removed a head or kept whole body: ${faceTriangles}`);
  restore();assert.equal(mesh.geometry,geometry,'original body not restored');
  console.log(`${sex}: head/neck preserved ${faceTriangles} triangles, naked body suppressed`);
}
