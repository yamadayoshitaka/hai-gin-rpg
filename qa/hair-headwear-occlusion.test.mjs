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
 assert.ok(wisp.geometry.getAttribute('position').count>50,`${mode}: no visible face/neck fringe`);
 const p=wisp.geometry.getAttribute('position');
 for(let i=0;i<p.count;i++){
  const point=new THREE.Vector3().fromBufferAttribute(p,i);
  assert.ok(point.y<head.max.y-.07,`${mode}: generated locks entered the covered crown`);
 }
 wisp.geometry.dispose();wisp.material.dispose();
 console.log(`PASS ${mode}: ${cut.keptTriangles}/${cut.sourceTriangles} safely clipped triangles + visible wisps`);
}
geometry.dispose();
