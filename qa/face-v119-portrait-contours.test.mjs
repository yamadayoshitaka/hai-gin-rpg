import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {v119PortraitContourWeights,sculptV119PortraitContours} from '../src/face-v119-portrait-contours.js';
import {makeIndependentFaceMaster} from '../src/independent-face-masters.js';

function realDonor(){
 const data=readFileSync(new URL('../assets/master-sources/blender/realistic-head-animation.glb',import.meta.url));
 assert.equal(data.toString('ascii',0,4),'glTF');
 const gltf=JSON.parse(data.toString('utf8',20,20+data.readUInt32LE(12)));
 const binStart=20+data.readUInt32LE(12)+8;
 const mesh=gltf.meshes[0].primitives[0];
 function accessor(id){
  const a=gltf.accessors[id],size={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type];
  const bytes={5121:1,5123:2,5125:4,5126:4}[a.componentType];
  const result=new Array(a.count*size).fill(0);
  const read=(type,p)=>type===5126?data.readFloatLE(p):
   type===5125?data.readUInt32LE(p):type===5123?data.readUInt16LE(p):data.readUInt8(p);
  if(a.bufferView!==undefined){
   const view=gltf.bufferViews[a.bufferView],base=binStart+(view.byteOffset||0)+(a.byteOffset||0);
   for(let i=0;i<a.count;i++)for(let k=0;k<size;k++)
    result[i*size+k]=read(a.componentType,base+i*(view.byteStride||size*bytes)+k*bytes);
  }
  if(a.sparse){
   const sparse=a.sparse,iv=gltf.bufferViews[sparse.indices.bufferView],vv=gltf.bufferViews[sparse.values.bufferView];
   const ip=binStart+(iv.byteOffset||0)+(sparse.indices.byteOffset||0);
   const vp=binStart+(vv.byteOffset||0)+(sparse.values.byteOffset||0);
   const idxBytes={5121:1,5123:2,5125:4}[sparse.indices.componentType];
   for(let i=0;i<sparse.count;i++){
    const dest=read(sparse.indices.componentType,ip+i*idxBytes);
    for(let j=0;j<size;j++)result[dest*size+j]=read(a.componentType,vp+(i*size+j)*bytes);
   }
  }
  return result;
 }
 const geo=new THREE.BufferGeometry();
 geo.setAttribute('position',new THREE.Float32BufferAttribute(accessor(mesh.attributes.POSITION),3));
 geo.setIndex(accessor(mesh.indices));
 if(mesh.attributes.TEXCOORD_0!==undefined)
  geo.setAttribute('uv',new THREE.Float32BufferAttribute(accessor(mesh.attributes.TEXCOORD_0),2));
 geo.morphTargetsRelative=true;
 geo.morphAttributes.position=(mesh.targets||[]).map(t=>new THREE.Float32BufferAttribute(accessor(t.POSITION),3));
 const root=new THREE.Group(),head=new THREE.Mesh(geo,new THREE.MeshStandardMaterial());
 head.name='CC0_SOURCE_GEO-head_animation_realistic';root.add(head);
 return {root,geo};
}
const positions=master=>master.face.userData.originalHairScalpGeometry||
 master.face.geometry;
const identity=geo=>({
 positions:Array.from(geo.getAttribute('position').array),
 uv:Array.from(geo.getAttribute('uv').array),
 index:Array.from(geo.getIndex().array)
});
test('v119 bilateral fields protect eye/ear/back and target both cheek/jaw zones',()=>{
 const a=v119PortraitContourWeights({xn:.42,yn:.50,zn:.94});
 const b=v119PortraitContourWeights({xn:-.42,yn:.50,zn:.94});
 const low=v119PortraitContourWeights({xn:.44,yn:.41,zn:.94});
 const back=v119PortraitContourWeights({xn:.42,yn:.50,zn:.12});
 assert.deepEqual(a,b);
 assert.ok(a.cheek>.1&&low.lower>.1);
 assert.equal(back.front,0);
 assert.equal(back.cheek,0);
});
test('v119 GLB source: both genders receive real connected topology changes',()=>{
 const source=realDonor();
 const donorBefore=source.geo.getAttribute('position').array.slice();
 for(const gender of ['female','male']){
  const base=makeIndependentFaceMaster(source.root,gender,{
   enableV117ReferencePortrait:true,enableV119PortraitContours:false
  });
  const changed=makeIndependentFaceMaster(source.root,gender,{
   enableV117ReferencePortrait:true,enableV119PortraitContours:true
  });
  const a=identity(positions(base)),b=identity(positions(changed));
  const report=changed.report.v119PortraitContours;
  console.log('V119_REAL_HEAD_'+gender.toUpperCase(),JSON.stringify(report));
  assert.equal(report.applied,true,JSON.stringify(report));
  assert.ok(report.changedVertices>=12);
  assert.equal(report.foldedTriangles,0);
  assert.equal(report.newVertices,0);
  assert.ok(report.acceptScale>0);
  assert.notDeepEqual(b.positions,a.positions);
  assert.deepEqual(b.index,a.index,'Do not change mesh triangles');
  assert.deepEqual(b.uv,a.uv,'Do not change face UVs');
  assert.equal(changed.face.userData.v88NativeOralRig?.ready,true);
  assert.ok(changed.parts.getObjectByName('LEFT_UPPER_ANATOMICAL_EYELID'));
  assert.ok(changed.parts.getObjectByName('RIGHT_CURVED_IRIS'));
 }
 assert.deepEqual(Array.from(source.geo.getAttribute('position').array),Array.from(donorBefore));
});
test('v119 first paint is identical after switch/rebuild and opt-out leaves v117 as-is',()=>{
 const source=realDonor();
 const first=makeIndependentFaceMaster(source.root,'female',{
  enableV117ReferencePortrait:true,enableV119PortraitContours:true
 });
 const male=makeIndependentFaceMaster(source.root,'male',{
  enableV117ReferencePortrait:true,enableV119PortraitContours:true
 });
 const again=makeIndependentFaceMaster(source.root,'female',{
  enableV117ReferencePortrait:true,enableV119PortraitContours:true
 });
 assert.equal(male.report.v119PortraitContours.gender,'male');
 assert.deepEqual(identity(positions(first)),identity(positions(again)));
 const aged=makeIndependentFaceMaster(source.root,'female',{
  femaleControls:{ageBand:'sixties'},enableV119PortraitContours:true
 });
 assert.equal(aged.report.v119PortraitContours.applied,false);
 assert.equal(aged.report.v119PortraitContours.reason,'protect-non-reference-age');
});
