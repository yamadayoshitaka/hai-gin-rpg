import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {integrateMouthIntoFace,poseIntegratedMouth}
 from '../src/face-integrated-mouth-v82.js';

/** Parse only the mesh-accessor data from the ACTUAL bundled CC0 head.
 * This avoids browser/ImageBitmap dependencies and catches failures that
 * small synthetic spheres cannot reproduce. The source asset stays intact.
 */
function sourceGeometry(){
 const bytes=readFileSync(new URL(
  '../assets/master-sources/blender/realistic-head-animation.glb',import.meta.url));
 assert.equal(bytes.toString('ascii',0,4),'glTF');
 assert.equal(bytes.readUInt32LE(4),2);
 const jsonLength=bytes.readUInt32LE(12);
 const gltf=JSON.parse(bytes.toString('utf8',20,20+jsonLength));
 const bufferOffset=20+jsonLength+8;
 const glb=bytes;
 const primitive=gltf.meshes[0].primitives[0];
 const readAccessor=id=>{
  const a=gltf.accessors[id],view=gltf.bufferViews[a.bufferView];
  const width=({SCALAR:1,VEC2:2,VEC3:3,VEC4:4})[a.type];
  const componentBytes=({5121:1,5123:2,5125:4,5126:4})[a.componentType];
  assert.ok(width&&componentBytes);
  const stride=view.byteStride||width*componentBytes;
  const start=bufferOffset+(view.byteOffset||0)+(a.byteOffset||0);
  const values=[];
  for(let i=0;i<a.count;i++)for(let k=0;k<width;k++){
   const at=start+i*stride+k*componentBytes;
   values.push(a.componentType===5126?glb.readFloatLE(at):
    a.componentType===5125?glb.readUInt32LE(at):
    a.componentType===5123?glb.readUInt16LE(at):
    glb.readUInt8(at));
  }
  return {array:values,width,count:a.count,componentType:a.componentType};
 };
 const position=readAccessor(primitive.attributes.POSITION);
 const index=readAccessor(primitive.indices);
 const geo=new THREE.BufferGeometry();
 geo.setAttribute('position',new THREE.Float32BufferAttribute(position.array,3));
 geo.setIndex(index.array);
 if(primitive.attributes.TEXCOORD_0!==undefined){
  const uv=readAccessor(primitive.attributes.TEXCOORD_0);
  geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv.array,2));
 }
 // Seven real facial blendshapes from the source Blender head.
 const morphs=primitive.targets?.map(target=>
  readAccessor(target.POSITION))||[];
 geo.morphAttributes.position=morphs.map(m=>
  new THREE.Float32BufferAttribute(m.array,3));
 return {geo,morphs:morphs.length,glbVertexCount:position.count};
}

test('V82 actual CC0 face is cut/stiched with all original 7 blendshapes',()=>{
 const {geo,morphs,glbVertexCount}=sourceGeometry();
 assert.ok(glbVertexCount>3000);
 assert.equal(morphs,7);
 const face=new THREE.Mesh(geo,new THREE.MeshStandardMaterial());
 geo.computeBoundingBox();
 const box=geo.boundingBox,size=box.getSize(new THREE.Vector3());
 const cx=(box.min.x+box.max.x)/2,cy=box.min.y+size.y*.509;
 const report=integrateMouthIntoFace(face,{
  centerX:cx,centerY:cy,halfWidth:size.x*.057,
  headHeight:size.y,surfaceZ:box.max.z*.91
 });
 assert.equal(report.integrated,true,
  'Do not fall back to the old floating mouth for the real donor');
 assert.ok(report.removedTriangles>150);
 assert.ok(report.boundaryEdges>25);
 assert.ok(geo.getAttribute('position').count>glbVertexCount);
 assert.equal(geo.groups.length,0,
  'Old GLB material groups must not truncate the new stitched mesh');
 assert.equal(geo.morphAttributes.position.length,7);
 for(const morph of geo.morphAttributes.position)
  assert.equal(morph.count,geo.getAttribute('position').count,
   'Original blendshape must grow together with the stitched mouth');
 const upper=report.pairs.find(p=>p.sign>0&&Math.abs(p.t)<.45);
 const lower=report.pairs.find(p=>p.sign<0&&Math.abs(p.t)<.45);
 assert.ok(upper&&lower);
 const positions=geo.getAttribute('position');
 const yBefore=[positions.getY(upper.inner),positions.getY(lower.inner)];
 assert.equal(poseIntegratedMouth(face,{smile:1,open:1,cheek:.8}),true);
 assert.ok(positions.getY(upper.inner)>yBefore[0],
  'Upper lip must rise with cheeks and zygomaticus');
 assert.ok(positions.getY(lower.inner)<yBefore[1],
  'The lower jaw must open the actual skin aperture');
 assert.equal(poseIntegratedMouth(face,{smile:1,open:1,cheek:.8}),false,
  'The mobile renderer avoids recomputing identical mouth poses');
 geo.dispose();face.material.dispose();
});
