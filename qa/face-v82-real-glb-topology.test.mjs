import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {createFaceExpressionAnimator,FACE_EXPRESSIONS}
 from '../src/face-expression-animation-v48.js';
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

test('V84 actual GLB skin avoids mouth-triangle reversal for ALL 22 expressions',()=>{
 const {geo}=sourceGeometry();
 const face=new THREE.Mesh(geo,new THREE.MeshStandardMaterial());
 face.name='FEMALE_INDEPENDENT_CLAY_FACE';
 geo.computeBoundingBox();
 const bounds=geo.boundingBox.clone(),size=bounds.getSize(new THREE.Vector3());
 const centerX=(bounds.min.x+bounds.max.x)/2;
 const mouthY=bounds.min.y+size.y*.509;
 face.userData.v83SafeOriginalMouthTopology=true;
 face.userData.actualMouthCreaseY=mouthY;
 const baseline=geo.getAttribute('position').array.slice();
 const index=geo.getIndex().array;
 const sensitive=[];
 for(let k=0;k<index.length;k+=3){
  const ids=[index[k],index[k+1],index[k+2]];
  const cx=ids.reduce((s,i)=>s+baseline[i*3],0)/3;
  const cy=ids.reduce((s,i)=>s+baseline[i*3+1],0)/3;
  const cz=ids.reduce((s,i)=>s+baseline[i*3+2],0)/3;
  if(Math.abs(cx-centerX)<size.x*.15 &&
     Math.abs(cy-mouthY)<size.y*.065 &&
     cz>bounds.min.z+size.z*.56)sensitive.push(ids);
 }
 assert.ok(sensitive.length>80,
  'Safety test must cover the actual open-mouth region, not an empty mask');
 const cross=(positions,[a,b,c])=>{
  const i=a*3,j=b*3,k=c*3;
  const ab=[positions[j]-positions[i],
   positions[j+1]-positions[i+1],positions[j+2]-positions[i+2]];
  const ac=[positions[k]-positions[i],
   positions[k+1]-positions[i+1],positions[k+2]-positions[i+2]];
  return [ab[1]*ac[2]-ab[2]*ac[1],
   ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]];
 };
 const animator=createFaceExpressionAnimator({face,parts:new THREE.Group()},
  {autoBlink:false});
 const pos=geo.getAttribute('position');
 for(const expression of Object.keys(FACE_EXPRESSIONS)){
  animator.setExpression(expression);
  const state=animator.getState();
  assert.equal(state.v84JawOpeningQuarantined,true);
  assert.equal(state.v84OralSkinInversionGuard,true);
  assert.equal(state.mouthOpen,0,
   expression+' cannot advertise opening without a real lip aperture');
  let reversed=0,checked=0,maxDelta=0;
  for(const ids of sensitive){
   const orig=cross(baseline,ids),current=cross(pos.array,ids);
   const a2=orig.reduce((s,v)=>s+v*v,0);
   const b2=current.reduce((s,v)=>s+v*v,0);
   if(a2<1e-17||b2<1e-17)continue;
   checked++;
   if(orig.reduce((s,v,i)=>s+v*current[i],0)<0)reversed++;
   for(const i of ids){
    const dy=pos.getY(i)-baseline[i*3+1];
    maxDelta=Math.max(maxDelta,Math.abs(dy));
   }
  }
  assert.ok(checked>65);
  assert.equal(reversed,0,
   expression+' must not invert real donor mouth triangles');
  assert.ok(maxDelta<size.y*.017,
   expression+' must not yank original mouth into overlapping skin');
 }
 animator.dispose();geo.dispose();face.material.dispose();
});
