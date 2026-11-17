import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {applyHeroineSkinMaterial} from '../src/heroine-skin-material.js';
import {v65NasalCartilageDelta,femaleInnerFeatureDelta} from '../src/independent-face-masters.js';
import {v65IrisOpticalTones,v65ScleralShading,v63IrisOpticalTones,v67NaturalEyeMakeup,v70IrisOpticalTones,v70FaceReliefShadow}
 from '../src/face-feature-meshes.js';
import {v65ExpressionMuscleDelta,FACE_EXPRESSIONS}
 from '../src/face-expression-animation-v48.js';
import {makePonytailMicrofibers,makeStyleSpecificHair}
 from '../src/face-wig-ornaments-v49.js';
import {repairRealCrownScalpHoles,appendRealCrownUnderlay,uniqueHairFibreStations,v63WigScalpTone,v67ScalpMatchedLockTone} from '../src/face-scalp-wig.js';

test('v70: real iris pigment, anatomical shadows and studio fivefold hair fidelity',()=>{
 const mid=v70IrisOpticalTones(.52,.82,{female:true});
 const rim=v70IrisOpticalTones(.98,.82,{female:true});
 const rotated=v70IrisOpticalTones(.52,1.92,{female:true});
 assert.equal(mid.length,3);
 assert.ok(mid.every(v=>Number.isFinite(v)&&v>=.28&&v<=1.25));
 assert.ok(rim[0]<mid[0],'limbal ring must be darker than iris core');
 assert.ok(mid.some((v,i)=>Math.abs(v-rotated[i])>.003),
  'multi-angle iris fibres must produce non-flat 3D vertex pigments');
 const orbital=v70FaceReliefShadow({nx:.145,ny:.73,lidY:.684,front:1});
 assert.ok(orbital>.03&&orbital<.2);
 assert.equal(v70FaceReliefShadow({nx:.145,ny:.73,front:0}),0);
 assert.ok(v70FaceReliefShadow({nx:.94,ny:.22,front:1})<.001);
 const faceStudio=readFileSync('face-mesh-studio.html','utf8');
 const bodyStudio=readFileSync('face-body-studio.html','utf8');
 assert.match(faceStudio,/visualFiberMultiplier:10,staticGroom:true/,'tenfold rooted fibre count supersedes the retired fivefold QA baseline');
 assert.match(bodyStudio,/<option value="10" selected>10倍/,'full-body studio should use the matching tenfold hair option');
 assert.match(bodyStudio,/applyHeroineSkinMaterial\(model\.face\)/);
 assert.match(bodyStudio,/applyHeroineSkinMaterial\(next\.face\)/);
});
test('v65: nose cartilage never touches cheeks, eye sockets or rear skull',()=>{
 for(const xn of [-1,-.9,-.4,-.28,.28,.35,.75,1]){
  const d=v65NasalCartilageDelta({xn,yn:.55,zn:.9,depth:.18,height:.24});
  assert.equal(d.dy,0);
  assert.equal(d.dz,0);
 }
 for(const zn of [.0,.15,.30]){
  const d=v65NasalCartilageDelta({xn:.15,yn:.55,zn,depth:.18,height:.24});
  assert.equal(d.dz,0);
 }
 for(const x of [.025,.075,.125,.150,.195,.225,.269]){
  const a=v65NasalCartilageDelta({xn:x,yn:.55,zn:.9,depth:.2,height:.25});
  const b=v65NasalCartilageDelta({xn:-x,yn:.55,zn:.9,depth:.2,height:.25});
  assert.deepEqual(a,b,'nose alar cartilage should be bilateral');
  assert.ok(Math.abs(a.dz)<.002,'do not create a fake external nose sphere');
  assert.ok(Math.abs(a.dy)<.001,'nose alar y movement must be subtle');
 }
 const original=femaleInnerFeatureDelta({xn:.15,yn:.55,zn:.90,
  offsetX:.012,depth:.2,height:.25});
 assert.ok(Number.isFinite(original.dz));
 assert.ok(Math.abs(original.dz)>.0001);
});
test('v65: optical iris has natural dark edge, 3D radial chromatic detail',()=>{
 for(const female of [true,false]){
  const avg=(fn,r)=>Array.from({length:64},(_,i)=>
    fn(r,2*Math.PI*i/64,{female})[0]).reduce((a,b)=>a+b,0)/64;
  assert.ok(avg(v65IrisOpticalTones,.98)<avg(v65IrisOpticalTones,.52)*.73,
   'rim retains dark limbal outline');
  const ring=[];
  let changed=false;
  for(let i=0;i<64;i++){
   const a=2*Math.PI*i/64,rgb=v65IrisOpticalTones(.65,a,{female});
   assert.equal(rgb.length,3);
   for(const v of rgb)assert.ok(v>=.28&&v<=1.27);
   if(Math.abs(rgb[0]-v63IrisOpticalTones(.65,a,{female})[0])>.002)
    changed=true;
   ring.push(rgb[0]);
  }
  assert.ok(changed,'v65 actually changes the iris shader vertex pigment');
  assert.ok(Math.max(...ring)-Math.min(...ring)>.085);
 }
 const upper=v65ScleralShading(.5,.99);
 const central=v65ScleralShading(.5,.50);
 const corner=v65ScleralShading(.02,.50);
 assert.ok(upper[0]<central[0]&&corner[0]<central[0]);
 assert.ok(central[0]>central[2],'white of eye must not be flat paper white');
});
test('v65: 22 expressions move real cheek, alar and inner brow; neutral stays exact zero',()=>{
 assert.equal(Object.keys(FACE_EXPRESSIONS).length,22);
 for(const id of Object.keys(FACE_EXPRESSIONS)){
  for(const [ax,ny] of [[.32,.57],[.077,.557],[.085,.740]]){
   const a=v65ExpressionMuscleDelta({ax,ny,front:1,expression:FACE_EXPRESSIONS[id]});
   assert.ok(Number.isFinite(a.dy)&&Number.isFinite(a.dz),id);
   assert.ok(Math.abs(a.dy)<.008&&Math.abs(a.dz)<.008,id);
  }
 }
 for(const [ax,ny] of [[.32,.57],[.077,.557],[.085,.740]]){
  assert.deepEqual(v65ExpressionMuscleDelta({
    ax,ny,front:1,expression:FACE_EXPRESSIONS.neutral}),{dy:0,dz:0});
 }
 const smile=v65ExpressionMuscleDelta({ax:.32,ny:.57,front:1,
  expression:FACE_EXPRESSIONS.smile});
 const angry=v65ExpressionMuscleDelta({ax:.077,ny:.557,front:1,
  expression:FACE_EXPRESSIONS.angry});
 assert.ok(smile.dy>.001&&smile.dz>.001);
 assert.ok(angry.dy>0,'frown should slightly contract nasal alae');
 assert.deepEqual(v65ExpressionMuscleDelta({ax:.077,ny:.557,front:0,
  expression:FACE_EXPRESSIONS.angry}),{dy:0,dz:0});
});
test('v65: side ponytail owns 48 fine 3D hairs in only one additional draw mesh',()=>{
 const origin=new THREE.Vector3(-.23,.75,-.1),dims=new THREE.Vector3(.7,1.0,.6);
 const bundle=makePonytailMicrofibers(origin,dims,-1,false,new THREE.Color(0x8b3f38));
 assert.equal(bundle.name,'PONYTAIL_MICROFIBER_BUNDLE_V65');
 assert.equal(bundle.userData.v65FiberCount,48);
 assert.equal(bundle.userData.v65DrawMeshCount,1);
 assert.equal(bundle.userData.v65RootAttached,true);
 assert.ok(bundle.geometry.getAttribute('position').count>=48*19*4);
 assert.ok(bundle.geometry.getAttribute('color').count>=48*19*4);
 assert.ok(bundle.geometry.getIndex().count>10000);
 for(const x of bundle.geometry.getAttribute('position').array)
  assert.ok(Number.isFinite(x));
 bundle.geometry.dispose();bundle.material.dispose();
 const box=new THREE.Box3(new THREE.Vector3(-.5,0,-.5),
  new THREE.Vector3(.5,1,.5));
 const anchor=[];
 for(let i=0;i<80;i++){
  const a=i*2*Math.PI/80;
  anchor.push({p:new THREE.Vector3(.40*Math.cos(a),.75,.38*Math.sin(a)-.02)});
 }
 const hair=makeStyleSpecificHair('female-side-ponytail',box,new THREE.Color(0x874a3d),
  {scalpCandidates:anchor});
 assert.equal(hair.meshes.filter(m=>m.name==='PONYTAIL_MICROFIBER_BUNDLE_V65').length,1);
 assert.equal(hair.meshes.filter(m=>m.name.startsWith('PONYTAIL_FALLING_LOCK')).length,14);
 assert.equal(hair.meshes.filter(m=>m.name.startsWith('PONYTAIL_SCALP_FEED')).length,7);
 for(const mesh of hair.meshes){mesh.geometry.dispose();mesh.material.dispose();}
});


test('v65: small topological crown hole is repaired from its true scalp boundary only',()=>{
 const box=new THREE.Box3(new THREE.Vector3(-.4,0,-.4),
  new THREE.Vector3(.4,1,.4));
 const outer=[[-.24,.94,-.24],[.24,.94,-.24],[.24,.94,.24],[-.24,.94,.24]];
 const inner=[[-.024,.94,-.024],[.024,.94,-.024],[.024,.94,.024],[-.024,.94,.024]];
 const verts=[],normals=[];
 for(let i=0;i<4;i++){
  const j=(i+1)%4;
  for(const p of [outer[i],outer[j],inner[j],outer[i],inner[j],inner[i]]){
   verts.push(...p);normals.push(0,1,0);
  }
 }
 const original=verts.length;
 const repair=repairRealCrownScalpHoles(verts,normals,box);
 assert.equal(repair.repairCount,1,'center crown hole closed with real boundary');
 assert.equal(repair.triangles,4);
 assert.equal(verts.length,original+repair.triangles*9);
 assert.equal(normals.length,verts.length);
 assert.equal(repair.noFullWigCap,true);
 assert.ok(verts.slice(0,original).every((x,i)=>x===[
  ...Array.from({length:4},(_,k)=>{
   const j=(k+1)%4;return [outer[k],outer[j],inner[j],outer[k],inner[j],inner[k]].flat();
  }).flat()][i]),'existing donor head triangles must remain untouched');
});

test('v66: underlay copies real donor top triangles without changing source geometry',()=>{
 const g=new THREE.BufferGeometry();
 const positions=[0,.97,0,-.08,.89,-.08,.08,.89,-.08,
  0,.97,0,.08,.89,-.08,.08,.89,.08,
  0,.97,0,.08,.89,.08,-.08,.89,.08,
  0,.97,0,-.08,.89,.08,-.08,.89,-.08];
 g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
 g.computeVertexNormals();
 const original=g.getAttribute('position').array.slice();
 const box=new THREE.Box3(new THREE.Vector3(-.5,0,-.5),
  new THREE.Vector3(.5,1,.5));
 const counts=[];
 for(const style of ['natural','soft','full']){
  const v=[],n=[];
  const report=appendRealCrownUnderlay(g,box,v,n,style);
  assert.ok(report.triangles>=4);
  assert.equal(v.length,n.length);
  assert.equal(v.length,report.triangles*9);
  counts.push(report.triangles);
  for(const number of v)assert.ok(Number.isFinite(number));
 }
 assert.equal(new Set(counts).size,1);
 assert.deepEqual(Array.from(g.getAttribute('position').array),Array.from(original),
  'real donor head must be untouched');
 g.dispose();
});


test('v67: static microhair stations are strictly increasing with no degenerate hair-tip segments',()=>{
 for(const n of [4,6,8,11,13]){
  const stations=uniqueHairFibreStations(n);
  assert.equal(stations[0],0);
  assert.equal(stations.at(-1),n);
  assert.ok(stations.every((v,i)=>i===0||v>stations[i-1]));
 }
});
test('v67: true crown underlay also covers the upper side roots, without false full-sphere cap',()=>{
 const geo=new THREE.BufferGeometry();
 geo.setAttribute('position',new THREE.Float32BufferAttribute([
  .195,.96,.01, .215,.91,.00, .18,.91,.07
 ],3));
 geo.computeVertexNormals();
 const box=new THREE.Box3(new THREE.Vector3(-.5,0,-.5),
  new THREE.Vector3(.5,1,.5));
 const v=[],normals=[];
 const result=appendRealCrownUnderlay(geo,box,v,normals,'natural');
 assert.equal(result.triangles,1);
 assert.equal(v.length,9);
 assert.equal(normals.length,9);
 geo.dispose();
});

test('v68: stronger eyeshadow hugs the anatomical upper eyelid and avoids male/rear pigment',()=>{
 const at=v67NaturalEyeMakeup({nx:.123,ny:.725,front:1,lidY:.695,gender:'female'});
 const away=v67NaturalEyeMakeup({nx:.02,ny:.89,front:1,lidY:.695,gender:'female'});
 const rear=v67NaturalEyeMakeup({nx:.123,ny:.725,front:0,lidY:.695,gender:'female'});
 const male=v67NaturalEyeMakeup({nx:.123,ny:.725,front:1,lidY:.695,gender:'male'});
 assert.ok(at.shadow>.80&&at.shadow<=.95,'fivefold female upper-eyelid pigment');
 assert.ok(away.shadow<.00001);
 assert.equal(rear.shadow,0);
 assert.deepEqual(male,{shadow:0,lowerLift:0});
 const lower=v67NaturalEyeMakeup({nx:.123,ny:.640,front:1,lidY:.695,gender:'female'});
 assert.ok(lower.lowerLift>.006&&lower.lowerLift<.009);
 assert.ok(lower.shadow<.018,'lower eyelid must not become a smoky under-eye bag');
});
test('v67: rooted 3D hair shades start at true scalp tone and fade without hair-root bands',()=>{
 const box=new THREE.Box3(new THREE.Vector3(-.5,0,-.5),new THREE.Vector3(.5,1,.5));
 const points=[new THREE.Vector3(-.11,.89,.12),
  new THREE.Vector3(.12,.92,-.10)];
 for(const point of points){
  const scalp=v63WigScalpTone(point.x,point.y,point.z,box);
  for(const layer of [0,1,2,3]){
   assert.equal(v67ScalpMatchedLockTone(point,box,0,33,layer),scalp);
   const next=v67ScalpMatchedLockTone(point,box,.015,33,layer);
   assert.ok(Math.abs(next-scalp)<.01,'hair root would reveal a dark seam');
   for(const t of [.10,.25,.50,.90]){
    const tone=v67ScalpMatchedLockTone(point,box,t,33,layer);
    assert.ok(Number.isFinite(tone)&&tone>=.78&&tone<=1.11);
   }
  }
 }
});

test('v67: natural real skin highlights avoid plastic shine without mutating sculpt',()=>{
 const geometry=new THREE.SphereGeometry(.22,16,12);
 const face=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({
  color:0xf0d9cb,roughness:.94,metalness:0
 }));
 const original=Array.from(geometry.getAttribute('position').array);
 const result=applyHeroineSkinMaterial(face);
 assert.equal(result.applied,true);
 assert.equal(face.material.roughness,.74);
 assert.equal(face.material.metalness,0);
 assert.ok(face.material.clearcoat<=.04);
 assert.ok(face.material.sheen<=.08);
 assert.equal(face.userData.v67SoftSkinSpecular,true);
 assert.deepEqual(Array.from(geometry.getAttribute('position').array),original);
 face.material.dispose();geometry.dispose();
});
