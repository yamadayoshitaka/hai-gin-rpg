import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {
 v117ReferencePortraitField,sculptV117ReferencePortrait
} from '../src/face-v117-reference-portrait-mesh.js';
import {makeIndependentFaceMaster} from '../src/independent-face-masters.js';
import {defaultPartSelection,resolvePartSelection} from '../src/face-part-catalog-v32.js';
import {resolveEditedFaceControls} from '../src/face-state-v49.js';

function cc0Donor(){
 const data=readFileSync(new URL(
  '../assets/master-sources/blender/realistic-head-animation.glb',import.meta.url));
 assert.equal(data.toString('ascii',0,4),'glTF');
 const jsonLength=data.readUInt32LE(12),
  gltf=JSON.parse(data.toString('utf8',20,20+jsonLength));
 const bin=20+jsonLength+8,primitive=gltf.meshes[0].primitives[0];
 function accessor(id){
  const a=gltf.accessors[id],
   size={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type],
   byteSize={5121:1,5123:2,5125:4,5126:4}[a.componentType],
   values=new Array(a.count*size).fill(0);
  const read=(type,at)=>type===5126?data.readFloatLE(at):
   type===5125?data.readUInt32LE(at):
   type===5123?data.readUInt16LE(at):data.readUInt8(at);
  if(a.bufferView!==undefined){
   const v=gltf.bufferViews[a.bufferView],start=bin+(v.byteOffset||0)+(a.byteOffset||0),
    stride=v.byteStride||size*byteSize;
   for(let i=0;i<a.count;i++)for(let j=0;j<size;j++)
    values[i*size+j]=read(a.componentType,start+i*stride+j*byteSize);
  }
  if(a.sparse){
   const sp=a.sparse,iv=gltf.bufferViews[sp.indices.bufferView],
    vv=gltf.bufferViews[sp.values.bufferView],
    ip=bin+(iv.byteOffset||0)+(sp.indices.byteOffset||0),
    vp=bin+(vv.byteOffset||0)+(sp.values.byteOffset||0);
   for(let i=0;i<sp.count;i++){
    const idx=read(sp.indices.componentType,ip+i*({5121:1,5123:2,5125:4}[sp.indices.componentType]));
    for(let j=0;j<size;j++)
     values[idx*size+j]=read(a.componentType,vp+(i*size+j)*byteSize);
   }
  }
  return values;
 }
 const geo=new THREE.BufferGeometry();
 geo.setAttribute('position',new THREE.Float32BufferAttribute(
  accessor(primitive.attributes.POSITION),3));
 geo.setIndex(accessor(primitive.indices));
 if(primitive.attributes.TEXCOORD_0!==undefined)
  geo.setAttribute('uv',new THREE.Float32BufferAttribute(
   accessor(primitive.attributes.TEXCOORD_0),2));
 geo.morphTargetsRelative=true;
 geo.morphAttributes.position=(primitive.targets||[]).map(t=>
  new THREE.Float32BufferAttribute(accessor(t.POSITION),3));
 const root=new THREE.Group();
 const mesh=new THREE.Mesh(geo,new THREE.MeshStandardMaterial());
 mesh.name='CC0_SOURCE_GEO-head_animation_realistic';root.add(mesh);
 return {root,mesh,geo};
}
const controls=(body='normal',age='twenties')=>{
 const parts={...defaultPartSelection(),bodyType:body,ageBand:age};
 const sel=resolvePartSelection('female',parts);
 return resolveEditedFaceControls('female',sel.controls,age,body,{},false);
};
const geometry=m=>m.face.userData.originalHairScalpGeometry||m.face.geometry;
function sig(g){
 const p=g.getAttribute('position')?.array,
  normal=g.getAttribute('normal')?.array,idx=g.getIndex()?.array;
 assert.ok(p?.length&&normal?.length&&idx?.length);
 return {position:Array.from(p),normal:Array.from(normal),
  triangles:Array.from(idx),uv:g.getAttribute('uv')?
   Array.from(g.getAttribute('uv').array):null};
}

test('v117 front and side anatomy fields cover full cheeks/jaw and compact nose, never the rear head',()=>{
 const cheek=v117ReferencePortraitField({xn:.47,yn:.52,zn:.95});
 const lower=v117ReferencePortraitField({xn:-.48,yn:.42,zn:.95});
 const nose=v117ReferencePortraitField({xn:.05,yn:.57,zn:.96});
 const bridge=v117ReferencePortraitField({xn:.055,yn:.66,zn:.95});
 assert.ok(cheek.cheek>.12,JSON.stringify(cheek));
 assert.ok(lower.lower>.15,JSON.stringify(lower));
 assert.ok(nose.tip>.30,JSON.stringify(nose));
 assert.ok(bridge.bridge>.10,JSON.stringify(bridge));
 const rear=v117ReferencePortraitField({xn:.47,yn:.52,zn:.1});
 assert.equal(rear.front,0);
 assert.equal(rear.cheek,0);
 const left=v117ReferencePortraitField({xn:-.46,yn:.51,zn:.96});
 const right=v117ReferencePortraitField({xn:.46,yn:.51,zn:.96});
 assert.deepEqual(left,right,'Symmetrical reference geometry');
});

test('v117 actual GLB: cheek/nose/lower-face changes in connected indexed mesh, preserves UV/index and source',()=>{
 const original=cc0Donor();
 const donor=original.geo.getAttribute('position').array.slice();
 const reference=makeIndependentFaceMaster(original.root,'female',{
  femaleControls:controls(),enableV117ReferencePortrait:false
 });
 const result=makeIndependentFaceMaster(original.root,'female',{
  femaleControls:controls(),enableV117ReferencePortrait:true
 });
 const p=geometry(result),b=geometry(reference);
 const report=result.report.v117ReferencePortrait;
 console.log('V117_REAL_DONOR_REFERENCE',JSON.stringify(report));
 assert.equal(report?.applied,true,JSON.stringify(report));
 assert.equal(report?.version,117);
 assert.equal(report?.sourceVertexCount,3490);
 assert.equal(report?.newVertices,0);
 assert.equal(report?.triangleFoldovers,0);
 assert.ok(report.changedVertices>20,'A real anatomical vertex redesign is required');
 assert.ok(report.cheekCandidates>5&&report.noseCandidates>3);
 assert.ok(report.smoothedCheekVertices>=0);
 assert.equal(report.originalIndicesPreserved,true);
 assert.equal(p.getAttribute('position').count,3490);
 assert.deepEqual(Array.from(p.getIndex().array),Array.from(b.getIndex().array));
 assert.deepEqual(Array.from(p.getAttribute('uv').array),
  Array.from(b.getAttribute('uv').array),'Do not change original UVs');
 assert.deepEqual(Array.from(original.geo.getAttribute('position').array),
  Array.from(donor),'Original donor GLB must be immutable');
 assert.notDeepEqual(Array.from(p.getAttribute('position').array),
  Array.from(b.getAttribute('position').array));
 for(const attr of ['position','normal']){
  for(const n of p.getAttribute(attr).array)
   assert.ok(Number.isFinite(n),'No non-finite vertex or normal');
 }
 assert.equal(result.face.userData.v88NativeOralRig?.ready,true,
  'Teeth, tongue and mouth rig must still be attached');
 assert.ok(result.parts.getObjectByName('LEFT_UPPER_ANATOMICAL_EYELID'),
  'The newly sculpted skin must share the actual moving lids');
 assert.ok(result.parts.getObjectByName('RIGHT_CURVED_IRIS'),
  'No iris geometry may disappear after sculpt');
 assert.equal(result.report.sourceGeometryIndependent,true);
});

test('v117 real GLB: first normal equals normal after thin -> normal, even with hair/skin/parts',()=>{
 const source=cc0Donor(),base=controls();
 const first=makeIndependentFaceMaster(source.root,'female',{
  femaleControls:base,enableV117ReferencePortrait:true
 });
 const thin=makeIndependentFaceMaster(source.root,'female',{
  femaleControls:controls('thin'),enableV117ReferencePortrait:true
 });
 const again=makeIndependentFaceMaster(source.root,'female',{
  femaleControls:base,enableV117ReferencePortrait:true
 });
 const A=sig(geometry(first)),B=sig(geometry(again));
 assert.deepEqual(A,B,'First paint and body reselect must be identical');
 assert.notDeepEqual(A.position,sig(geometry(thin)).position,
  'Body size must still alter actual vertex positions');
});

test('v117 male and non-20s faces are unchanged; no source 3D mutation',()=>{
 const source=cc0Donor(),before=source.geo.getAttribute('position').array.slice();
 const male=makeIndependentFaceMaster(source.root,'male',{
  maleControls:{},enableV117ReferencePortrait:true
 });
 assert.equal(male.report.v117ReferencePortrait.applied,false);
 const aged=makeIndependentFaceMaster(source.root,'female',{
  femaleControls:controls('normal','sixties'),
  enableV117ReferencePortrait:true
 });
 assert.equal(aged.report.v117ReferencePortrait.applied,false);
 assert.deepEqual(Array.from(source.geo.getAttribute('position').array),
  Array.from(before));
});
