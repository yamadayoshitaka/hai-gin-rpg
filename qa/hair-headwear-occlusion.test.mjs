import assert from 'node:assert/strict';
import * as THREE from 'three';
import {headwearAllowsHair,maskHairGeometry,createVisibleHeadwearWisps} from '../src/character-system/hair-headwear-occlusion.js';

const head=new THREE.Box3(new THREE.Vector3(-.12,-.11,-.12),new THREE.Vector3(.12,.13,.12));
const fit={position:new THREE.Vector3(),scale:new THREE.Vector3(1,1,1)};
const geometry=new THREE.SphereGeometry(.17,36,24);
geometry.translate(0,.015,0);
const sourceCount=geometry.index.count;
for(const mode of ['helmet','hood']){
 const cut=maskHairGeometry(geometry,new THREE.Matrix4(),fit,head,mode);
 assert.ok(cut.sourceTriangles>100,`${mode}: source style must be real geometry`);
 assert.ok(cut.keptTriangles>0,`${mode}: safe strands should remain when available`);
 assert.ok(cut.keptTriangles<cut.sourceTriangles,`${mode}: intersecting headwear hair must be removed`);
 const position=cut.geometry.getAttribute('position');
 for(let i=0;i<cut.geometry.index.count;i++){
  const vertex=cut.geometry.index.getX(i);
  const point=new THREE.Vector3().fromBufferAttribute(position,vertex);
  assert.ok(headwearAllowsHair(point,head,mode),`${mode}: a rendered hair vertex enters the headpiece`);
 }
 assert.equal(maskHairGeometry(geometry,new THREE.Matrix4(),fit,head,mode).geometry,cut.geometry,
  `${mode}: clipped index buffer must be reused across identical soldiers`);
 const wisp=createVisibleHeadwearWisps(head,0x664632,mode);
 assert.ok(wisp.geometry.getAttribute('position').count>(mode==='hood'?2000:300),
   `${mode}: hair became a few sparse cards instead of a full face/neck fringe`);
 const p=wisp.geometry.getAttribute('position');
 let highFaceStrands=0;
 for(let i=0;i<p.count;i++){
  const point=new THREE.Vector3().fromBufferAttribute(p,i);
  if(mode==='hood'){
   assert.ok(point.y<=head.max.y-(head.max.y-head.min.y)*.16,
    'Hood strands must stay below the covered crown');
   assert.ok(point.z>=head.max.z-(head.max.z-head.min.z)*.08,
     'Hood fringe must sit at the exposed forehead, not inside the hood shell');
   if(point.y>head.max.y-(head.max.y-head.min.y)*.35)highFaceStrands++;
  }else assert.ok(point.y<head.max.y-(head.max.y-head.min.y)*.60,
    `${mode}: generated locks entered the covered crown`);
 }
 if(mode==='hood')assert.ok(highFaceStrands>500,'Hooded character needs full bangs at the exposed forehead, not just a few tiny cards');
 if(mode==='hood'){
  const roots=new Set();for(let i=0;i<56;i++)roots.add(p.getY(i*12).toFixed(4));
  assert.ok(roots.size>40,'Fringe roots must be staggered, not identical checkerboard cards');
 }
 wisp.geometry.dispose();wisp.material.dispose();
 console.log(`PASS ${mode}: ${cut.keptTriangles}/${cut.sourceTriangles} safely clipped triangles + visible wisps`);
}
geometry.dispose();
