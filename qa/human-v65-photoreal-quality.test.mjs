import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {v65NasalCartilageDelta,femaleInnerFeatureDelta} from '../src/independent-face-masters.js';
import {v65IrisOpticalTones,v65ScleralShading,v63IrisOpticalTones}
 from '../src/face-feature-meshes.js';
import {v65ExpressionMuscleDelta,FACE_EXPRESSIONS}
 from '../src/face-expression-animation-v48.js';
import {makePonytailMicrofibers,makeStyleSpecificHair}
 from '../src/face-wig-ornaments-v49.js';

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
