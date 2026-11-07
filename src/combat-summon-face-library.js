/**
 * Reuse the in-repository CC0 Quaternius full-body facial mesh for humanoid
 * summons.  The donor is skinned at rest once, then baked into small static
 * meshes so the battlefield can keep its GPU-instanced summon renderer.
 *
 * The procedural face is retained as a low-LOD/offline fallback. No external
 * CDN asset or network dependency is introduced.
 */
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {retainSkinnedHead} from './quaternius-head-bom.js';

const DONOR_URL = new URL(
  '../assets/characters/quaternius-base/Superhero_Female_FullBody.gltf', import.meta.url
).href;

/** @returns {Promise<Array<{geometry:THREE.BufferGeometry,material:THREE.Material}>>} */
export async function loadQuaterniusSummonFace(){
  const {scene}=await new GLTFLoader().loadAsync(DONOR_URL);
  scene.updateMatrixWorld(true);
  const extraction=retainSkinnedHead(scene);
  if(extraction.headTriangles<20)throw Error('Summon face donor has no facial triangles');
  const sourceParts=[];
  const bounds=new THREE.Box3();
  const point=new THREE.Vector3();

  scene.traverse(mesh=>{
    if(!mesh.visible||!mesh.isSkinnedMesh||!mesh.geometry?.getAttribute('position'))return;
    const head=mesh.skeleton?.bones.find(b=>/^head$/i.test(b.name));
    if(!head)return;
    head.updateWorldMatrix(true,false);
    mesh.updateWorldMatrix(true,false);
    const toHead=head.matrixWorld.clone().invert();
    const original=mesh.geometry,indices=original.getIndex(),count=indices?.count??original.getAttribute('position').count;
    const uvIn=original.getAttribute('uv'),colorIn=original.getAttribute('color');
    if(count<3)return;
    const positions=new Float32Array(count*3),uvs=uvIn?new Float32Array(count*2):null,
      colors=colorIn?new Float32Array(count*3):null;
    const cache=new Map();
    for(let i=0;i<count;i++){
      const vertex=indices?indices.getX(i):i;
      let v=cache.get(vertex);
      if(!v){
        mesh.getVertexPosition(vertex,point);
        v=point.clone().applyMatrix4(mesh.matrixWorld).applyMatrix4(toHead);
        cache.set(vertex,v);
      }
      bounds.expandByPoint(v);
      positions[i*3]=v.x;positions[i*3+1]=v.y;positions[i*3+2]=v.z;
      if(uvIn){uvs[i*2]=uvIn.getX(vertex);uvs[i*2+1]=uvIn.getY(vertex);}
      if(colorIn){
        colors[i*3]=colorIn.getX(vertex);
        colors[i*3+1]=colorIn.getY(vertex);
        colors[i*3+2]=colorIn.getZ(vertex);
      }
    }
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
    if(uvs)geometry.setAttribute('uv',new THREE.BufferAttribute(uvs,2));
    if(colors)geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
    geometry.computeVertexNormals();
    const material=(Array.isArray(mesh.material)?mesh.material[0]:mesh.material).clone();
    material.side=THREE.DoubleSide;
    material.vertexColors=!!colors;
    sourceParts.push({geometry,material});
  });
  if(bounds.isEmpty()||!sourceParts.length)throw Error('Summon facial mesh could not be extracted');

  // Fit both donor skin and eyes together. Facial details remain exactly on the
  // donor surface and never become oversized floating spheres.
  const size=bounds.getSize(new THREE.Vector3());
  const center=bounds.getCenter(new THREE.Vector3());
  const scale=Math.min(.385/Math.max(.001,size.x),.49/Math.max(.001,size.y));
  if(!Number.isFinite(scale)||scale<=0)throw Error('Invalid summon face bounds');
  for(const {geometry} of sourceParts){
    const position=geometry.getAttribute('position');
    for(let i=0;i<position.count;i++){
      position.setXYZ(i,
        (position.getX(i)-center.x)*scale,
        2.335+(position.getY(i)-center.y)*scale,
        .075+(position.getZ(i)-center.z)*scale);
    }
    position.needsUpdate=true;
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
  }
  return sourceParts;
}
