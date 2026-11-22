import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {v110InitialFemaleFaceState} from '../src/face-initial-preview-v110.js';
import {defaultPartSelection,resolvePartSelection} from '../src/face-part-catalog-v32.js';
import {resolveEditedFaceControls} from '../src/face-state-v49.js';
import {makeIndependentFaceMaster} from '../src/independent-face-masters.js';
import {fairV111CheekResiduals} from '../src/face-v106-local-retopo.js';
import {createFaceExpressionAnimator,FACE_EXPRESSIONS}
 from '../src/face-expression-animation-v48.js';

/** Read actual CC0 GLB accessors; never pass a procedural fake head as proof. */
function realDonor(){
 const data=readFileSync(new URL(
  '../assets/master-sources/blender/realistic-head-animation.glb',import.meta.url));
 assert.equal(data.toString('ascii',0,4),'glTF');
 const jsonLength=data.readUInt32LE(12),
  gltf=JSON.parse(data.toString('utf8',20,20+jsonLength));
 const bin=20+jsonLength+8,primitive=gltf.meshes[0].primitives[0];
 function accessor(id){
  const a=gltf.accessors[id],size={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type],
   byteSize={5121:1,5123:2,5125:4,5126:4}[a.componentType],
   values=new Array(a.count*size).fill(0);
  const read=(type,at)=>type===5126?data.readFloatLE(at):
   type===5125?data.readUInt32LE(at):
   type===5123?data.readUInt16LE(at):data.readUInt8(at);
  if(a.bufferView!==undefined){
   const v=gltf.bufferViews[a.bufferView],start=bin+(v.byteOffset||0)+(a.byteOffset||0);
   const stride=v.byteStride||size*byteSize;
   for(let i=0;i<a.count;i++)for(let j=0;j<size;j++)
    values[i*size+j]=read(a.componentType,start+i*stride+j*byteSize);
  }
  if(a.sparse){
   const sp=a.sparse,iv=gltf.bufferViews[sp.indices.bufferView],
    vv=gltf.bufferViews[sp.values.bufferView];
   const ip=bin+(iv.byteOffset||0)+(sp.indices.byteOffset||0),
    vp=bin+(vv.byteOffset||0)+(sp.values.byteOffset||0);
   for(let i=0;i<sp.count;i++){
    const idx=read(sp.indices.componentType,ip+i*({5121:1,5123:2,5125:4}[sp.indices.componentType]));
    for(let j=0;j<size;j++)values[idx*size+j]=read(a.componentType,vp+(i*size+j)*byteSize);
   }
  }
  return values;
 }
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(
  accessor(primitive.attributes.POSITION),3));
 geometry.setIndex(accessor(primitive.indices));
 if(primitive.attributes.TEXCOORD_0!==undefined)
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(
   accessor(primitive.attributes.TEXCOORD_0),2));
 geometry.morphTargetsRelative=true;
 geometry.morphAttributes.position=(primitive.targets||[]).map(t=>
  new THREE.Float32BufferAttribute(accessor(t.POSITION),3));
 const root=new THREE.Group();
 const head=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial());
 head.name='CC0_SOURCE_GEO-head_animation_realistic';
 root.add(head);
 return {root,head,geometry};
}
function controls(parts){
 const selected=resolvePartSelection('female',parts);
 return resolveEditedFaceControls('female',selected.controls,
  parts.ageBand,parts.bodyType,{},false);
}
function visibleSkin(model){
 // Hair-only scalp clipping must not replace this original indexed source.
 return model.face.userData.originalHairScalpGeometry||model.face.geometry;
}

test('v111 actual GLB: first normal equals normal after thin, byte-for-byte geometry, indices and normals',()=>{
 const source=realDonor(),original=source.geometry.getAttribute('position').array.slice();
 const starting=defaultPartSelection();
 const first=v110InitialFemaleFaceState({savedPreset:null,parts:starting,controls:{}});
 assert.equal(first.parts.bodyType,'normal');
 assert.equal(first.parts.ageBand,'twenties');
 const make=parts=>makeIndependentFaceMaster(source.root,'female',{
  femaleControls:controls(parts),enableV106LocalRetopo:true,
  partSelection:resolvePartSelection('female',parts).ids
 });
 const beforeControls=controls(first.parts);
 const initial=make(first.parts);
 const sourceAfterInitial=source.geometry.getAttribute('position').array.slice();
 const thin=make({...first.parts,bodyType:'thin'});
 const sourceAfterThin=source.geometry.getAttribute('position').array.slice();
 const normalAgain=make({...first.parts,bodyType:'normal'});
 const afterControls=controls({...first.parts,bodyType:'normal'});
 assert.deepEqual(beforeControls,afterControls,'Normal controls changed through reselect');
 const drift=(a,b)=>{
  let changed=0,max=0,first=-1;
  for(let i=0;i<a.length;i++)if(a[i]!==b[i]){
   changed++;max=Math.max(max,Math.abs(a[i]-b[i]));
   if(first<0)first=i;
  }
  const nonFinite=a.reduce((acc,x,i)=>{
   if(!Number.isFinite(x)){acc.count++;if(acc.first.length<8)acc.first.push([i,x]);}
   return acc;
  },{count:0,first:[]});
  const badB=b.reduce((acc,x,i)=>{
   if(!Number.isFinite(x)){acc.count++;if(acc.first.length<8)acc.first.push([i,x]);}
   return acc;
  },{count:0,first:[]});
  return {changed,max,first,count:a.length,nonFiniteA:nonFinite,nonFiniteB:badB,
   firstSamples:[first,first+1,first+2].map(i=>({i,a:a[i],b:b[i]}))};
 };
 for(const name of ['position','normal','uv','color']){
  const a=visibleSkin(initial).getAttribute(name)?.array,
   b=visibleSkin(normalAgain).getAttribute(name)?.array;
  assert.ok(a&&b,'Missing attribute '+name);
  const comparison=drift(a,b);
  assert.equal(comparison.changed,0,name+' changed after thin -> normal: '+
   JSON.stringify({comparison,
    originalDriftAfterInitial:drift(original,sourceAfterInitial),
    originalDriftAfterThin:drift(original,sourceAfterThin),
    originalDriftAtEnd:drift(original,source.geometry.getAttribute('position').array),
    initialControls:beforeControls,normalControls:afterControls,
    firstReport:initial.report.v106LocalRetopo,
    finalReport:normalAgain.report.v106LocalRetopo}));
 }
 assert.deepEqual(Array.from(visibleSkin(initial).getIndex().array),
  Array.from(visibleSkin(normalAgain).getIndex().array),
  'Triangle connectivity must be deterministic');
 const report=initial.report.v106LocalRetopo;
 assert.equal(report?.applied,true,JSON.stringify(report));
 assert.equal(report?.v111CheekSurface?.sourceVertexPositionsChanged,true,JSON.stringify(report));
 assert.ok(report.v111CheekSurface.changed>0);
 assert.equal(report.v111CheekSurface.windingChecked,true);
 assert.equal(report.lipRingIndicesPreserved,true);
 assert.ok(report.v110BroadVertices<report.addedVertices,
  'Do not concentrate all tessellation in the cheeks');
 assert.deepEqual(Array.from(source.geometry.getAttribute('position').array),
  Array.from(original),'Original GLB source was modified');
 const thinXYZ=visibleSkin(thin).getAttribute('position').array;
 assert.notDeepEqual(Array.from(thinXYZ),Array.from(visibleSkin(initial).getAttribute('position').array),
  'Body selection must still affect original geometry');
 for(const model of [initial,thin,normalAgain]){
  const geometry=visibleSkin(model),p=geometry.getAttribute('position');
  const normals=geometry.getAttribute('normal');
  for(let i=0;i<p.count*3;i++)assert.ok(Number.isFinite(p.array[i])&&
   Number.isFinite(normals.array[i]),'Non-finite source vertex/normal');
 }
 source.geometry.dispose();source.head.material.dispose();
});

test('v111 isolated cheek Z fairing keeps protected lip/nasal/eyelid landmarks unchanged',()=>{
 const geometry=new THREE.SphereGeometry(.14,72,56),p=geometry.getAttribute('position');
 geometry.computeBoundingBox();
 const box=geometry.boundingBox,d=box.getSize(new THREE.Vector3());
 const protectedSet=new Set();
 for(let i=0;i<p.count;i++){
  const x=Math.abs(p.getX(i)/(.5*d.x));
  const y=(p.getY(i)-box.min.y)/d.y;
  if(x<.31||y>.67||y<.41||x>.78)protectedSet.add(i);
 }
 const original=p.array.slice();
 const report=fairV111CheekResiduals(geometry,protectedSet);
 assert.ok(report.changed>0,JSON.stringify(report));
 assert.equal(report.windingChecked,true);
 assert.ok(report.maxDisplacement<d.z*.015);
 const after=geometry.getAttribute('position');
 for(let i=0;i<after.count;i++){
  assert.equal(after.getX(i),original[i*3]);
  assert.equal(after.getY(i),original[i*3+1]);
  if(protectedSet.has(i))assert.equal(after.getZ(i),original[i*3+2],
   'Protected anatomical boundary moved: '+i);
 }
 assert.ok(geometry.getAttribute('normal').array.every(Number.isFinite));
 geometry.dispose();
});

test('v111 studio holds face invisible until initial wigs are built and requires a single shared face ESM',()=>{
 const html=readFileSync(new URL('../face-mesh-studio.html',import.meta.url),'utf8');
 const init=html.slice(html.indexOf('async function init(){'));
 const hidden=init.indexOf('model.root.visible=false;'),
  wig=init.indexOf('try{rebuildWig();}'),
  maleWig=init.indexOf('try{rebuildMaleHair();}'),
  show=init.indexOf('selectGender(initialGender);');
 assert.ok(hidden>=0&&hidden<wig&&wig<maleWig&&maleWig<show);
 assert.ok(!init.slice(hidden,show).includes('await new Promise(resolve=>requestAnimationFrame'),
  'Incomplete model must never be painted while hair is still building');
 assert.match(init,/dataset\.faceMeshReady='v111'/);
 assert.match(html,/20261122-v111-guarded-cheek/);
 const source=readFileSync(new URL('../src/independent-face-masters.js',import.meta.url),'utf8');
 assert.match(source,/face-feature-meshes\.js\?v=20261122-v111-guarded-cheek/);
});

test('v111 five FACS expressions remain available for actual oral/skin rig',()=>{
 for(const key of ['neutral','softSmile','laugh','angry','surprised'])
  assert.ok(FACE_EXPRESSIONS[key],key+' must remain in the animation rig');
 const {root,geometry,head}=realDonor();
 const model=makeIndependentFaceMaster(root,'female',{
  femaleControls:controls(defaultPartSelection()),enableV106LocalRetopo:true
 });
 const rig=createFaceExpressionAnimator({face:model.face,parts:model.parts},
  {autoBlink:false});
 for(const expression of ['neutral','softSmile','laugh','angry','surprised']){
  rig.setExpression(expression);
  rig.update(.12);
  assert.equal(rig.getState().expression,expression);
  assert.ok(model.face.geometry.getAttribute('position').array.every(Number.isFinite),
   expression+' has invalid cheek/lip positions');
 }
 rig.dispose();geometry.dispose();head.material.dispose();
});
