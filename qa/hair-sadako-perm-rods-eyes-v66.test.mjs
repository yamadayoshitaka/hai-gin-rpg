import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {sadakoInvisiblePermRodOffset,shapeSadakoVariantGuide,
 createScalpAnchoredWig,FACE_HAIR_RUNTIME_BUILD}
 from '../src/face-scalp-wig.js';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const box=new THREE.Box3(new THREE.Vector3(-1,-1,-1),
 new THREE.Vector3(1,1,1));
function guide(){
 return Array.from({length:19},(_,j)=>
  new THREE.Vector3(-.11,.91-j*.08,.31));
}
function molded(variant,params={}){
 const g=guide();
 shapeSadakoVariantGuide(g,{variant,box,zone:'fringeLeft',
  rootIndex:12,side:-1,front:true,...params});
 return g;
}
function delta(a,b){
 return Math.max(...a.map((p,i)=>p.distanceTo(b[i])));
}
function wig(styleId){
 const g=new THREE.SphereGeometry(.5,24,18);
 g.computeVertexNormals();
 const h=new THREE.Mesh(g,new THREE.MeshStandardMaterial());
 const w=createScalpAnchoredWig(h,{styleId,count:115,
  staticGroom:true,normalLayeredSingleMesh:false,visualFiberMultiplier:1,
  color:0x77553c});
 return {h,w,cleanup(){
  w.dispose();g.dispose();h.material.dispose();
 }};
}

test('invisible salon rods bend actual lower guides into rounded curls, not flat offsets',()=>{
 const straight=molded('straight');
 for(const variant of ['inward','outward']){
  const g=molded(variant);
  assert.deepEqual(g[0].toArray(),straight[0].toArray());
  assert.ok(delta(g,straight)>.36,
   'visible rod curvature must exceed a third of head width');
  const lower=g.slice(12).map(v=>v.y);
  assert.ok(Math.max(...lower)-Math.min(...lower)>.15);
  const d=sadakoInvisiblePermRodOffset(variant,.56,{
   side:-1,width:2,depth:2});
  assert.deepEqual(d,{x:0,y:0,z:0});
  assert.ok(g.at(-1).y>straight.at(-1).y+.22,
   'the guide must wrap UP at the tip of the hidden perm rod');
 }
 const inward=molded('inward'),outward=molded('outward');
 assert.ok(inward.at(-1).x>straight.at(-1).x+.15);
 assert.ok(outward.at(-1).x<straight.at(-1).x-.15);
 assert.notDeepEqual(inward[15].toArray(),outward[15].toArray());
});
test('sauvage is several visible small-rod waves throughout the midshaft',()=>{
 const straight=molded('straight'),waves=molded('sauvage');
 assert.deepEqual(waves[0].toArray(),straight[0].toArray());
 assert.ok(delta(waves,straight)>.19);
 let reversals=0,lastSlope=0;
 for(let i=6;i<waves.length;i++){
  const slope=(waves[i].x-straight[i].x)-
   (waves[i-1].x-straight[i-1].x);
  if(i>6&&slope*lastSlope<0)reversals++;
  lastSlope=slope;
 }
 assert.ok(reversals>=4,'several successive S-waves must be visible');
 assert.deepEqual(sadakoInvisiblePermRodOffset('straight',1),
  {x:0,y:0,z:0});
});
test('centre part opens both eyes and includes frontal crown canopy, not only fringe',()=>{
 const left=molded('center',{side:-1});
 const right=molded('center',{side:1});
 assert.ok(left[12].x<-.4);
 assert.ok(right[12].x>.2);
 const rear=molded('center',{front:false,zone:'backLeft'});
 assert.deepEqual(rear.map(p=>p.toArray()),guide().map(p=>p.toArray()));
 const w=wig('sadako-center-part-long'),r=w.w.getReport();
 assert.ok(r.sadakoFaceFrameLocks>0);
 assert.equal(r.sadakoActualBrowCutLocks,0);
 assert.equal(r.sadakoVisibleEyes,true);
 assert.equal(r.sadakoInvisibleRodGeometryRendered,false);
 w.cleanup();
});
test('bangs are actually cut near eyebrows while longer crown locks frame eyes',()=>{
 const b=molded('bangs',{bangsCut:true});
 const brow=box.min.y+box.getSize(new THREE.Vector3()).y*.767;
 assert.ok(Math.abs(b.at(-1).y-brow)<.035);
 assert.ok(b.at(-1).y>brow-.04);
 const crown=molded('bangs',{bangsCut:false,zone:'crown'});
 assert.ok(crown.at(-1).y<b.at(-1).y-.5);
 const w=wig('sadako-bangs-long'),r=w.w.getReport();
 assert.ok(r.sadakoActualBrowCutLocks>0);
 assert.ok(r.sadakoFaceFrameLocks>r.sadakoActualBrowCutLocks,
  'additional long crown canopy must sweep aside, not cover eyes');
 assert.equal(r.sadakoVisibleEyes,true);
 w.cleanup();
});
test('finished 3D meshes differ between straight, curled, waved and eye-clear cuts',()=>{
 const ids=['sadako-straight-long','sadako-inward-long',
  'sadako-outward-long','sadako-sauvage-long',
  'sadako-center-part-long','sadako-bangs-long'];
 const samples={};
 for(const id of ids){
  const x=wig(id);
  const hair=x.w.root.getObjectByName('REAL_ROOTED_SWEPT_HAIR_LOCKS');
  assert.ok(hair?.isMesh);
  assert.equal(x.w.root.children.filter(c=>/PERM_ROD/i.test(c.name)).length,0);
  const p=hair.geometry.getAttribute('position').array;
  samples[id]=new Float32Array(p);
  x.cleanup();
 }
 const a=samples[ids[0]];
 for(const id of ids.slice(1)){
  const v=samples[id];
  assert.equal(a.length,v.length);
  let different=0;
  for(let i=0;i<v.length;i+=3)
   if(Math.abs(a[i]-v[i])+
      Math.abs(a[i+1]-v[i+1])+
      Math.abs(a[i+2]-v[i+2])>.065)different++;
  assert.ok(different>a.length/3*.01,
   id+' must deform actual rendered hair, not just the style dropdown');
 }
});
test('studio builds use v66 model and keep dynamic physics, original buzz and mantle',()=>{
 assert.match(FACE_HAIR_RUNTIME_BUILD,/sadako-invisible-perm-rods-v66$/);
 const salon=read('face-mesh-studio.html'),body=read('face-body-studio.html');
 for(const html of [salon,body])
  assert.match(html,/20261121-sadako-invisible-perm-rods-v66/);
 assert.match(salon,/staticGroom:!isSadakoFamilyStyle\(chosen.styleId\)/);
 assert.match(body,/staticGroom:!isSadakoFamilyStyle\(hairSpec.styleId\)/);
 assert.match(body,/garmentCollisionResolver:mantleCollision/);
 const buzz=wig('buzz-cut'),r=buzz.w.getReport();
 assert.equal(r.closeCutFibreCount,30000);
 assert.equal(r.buzzSparseApprovedLookRestored,true);
 buzz.cleanup();
 assert.match(read('.github/workflows/hair-reselect-regression.yml'),
  /hair-sadako-perm-rods-eyes-v66\.test\.mjs/);
});
