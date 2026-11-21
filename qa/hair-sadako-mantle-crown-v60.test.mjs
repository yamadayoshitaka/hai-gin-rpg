import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {createMantleHairCollision} from '../src/face-mantle-hair-collision.js';
import {createScalpAnchoredWig,FACE_HAIR_RUNTIME_BUILD} from '../src/face-scalp-wig.js';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
function fixture(){
 const head=new THREE.Mesh(new THREE.SphereGeometry(.50,24,16),
  new THREE.MeshStandardMaterial());
 head.geometry.computeBoundingBox();
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute([
  -.4,.15,-.29, .4,.15,-.29, -.4,-.8,-.29,.4,-.8,-.29
 ],3));
 geometry.setIndex([0,2,1,1,2,3]);
 const cape=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial());
 cape.name='hero-protagonist-draped-mantle';
 const actor=new THREE.Group();actor.add(head,cape);
 actor.updateWorldMatrix(true,true);
 const collision=createMantleHairCollision({getHead:()=>head,getMantle:()=>cape});
 return {head,cape,actor,collision};
}

test('v60 projects hair to the OUTSIDE of real cape triangles in head local space',()=>{
 const {head,cape,actor,collision}=fixture();
 assert.equal(collision.refresh(),true);
 assert.equal(collision.getReport().triangleCount,2);
 assert.ok(Math.abs(collision.rearAt(0,-.2)+.29)<1e-5);
 const hairPoint=new THREE.Vector3(0,-.2,-.23);
 assert.equal(collision.resolve(hairPoint,{side:'rear'}),true);
 assert.ok(hairPoint.z<-.29);
 assert.equal(collision.resolve(hairPoint,{side:'rear'}),false);
 assert.equal(collision.resolve(new THREE.Vector3(0,-.2,0),{side:'front'}),false);
 cape.position.z=-.16;actor.updateWorldMatrix(true,true);
 collision.refresh();
 const moved=new THREE.Vector3(0,-.2,-.29);
 assert.equal(collision.resolve(moved,{side:'rear'}),true);
 assert.ok(moved.z<-.45);
 assert.equal(collision.getReport().updates,2);
 cape.geometry.dispose();cape.material.dispose();
 head.geometry.dispose();head.material.dispose();
});

test('cape projection follows actual skinned-bone changes rather than bind-pose mesh',()=>{
 const {head,cape,actor}=fixture();
 cape.removeFromParent();cape.geometry.deleteAttribute('skinIndex');
 const weights=new Float32Array(4*4),indices=new Uint16Array(4*4);
 for(let i=0;i<4;i++)weights[i*4]=1;
 cape.geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(indices,4));
 cape.geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));
 const bone=new THREE.Bone();bone.name='clavicle_l';
 const skin=new THREE.SkinnedMesh(cape.geometry,cape.material);
 skin.name='hero-protagonist-draped-mantle';
 actor.add(bone,skin);actor.updateWorldMatrix(true,true);
 skin.bind(new THREE.Skeleton([bone]));
 const collision=createMantleHairCollision({getHead:()=>head,getMantle:()=>skin});
 assert.equal(collision.refresh(),true);
 const initial=collision.rearAt(0,-.2);
 bone.position.z=-.14;
 actor.updateWorldMatrix(true,true);
 collision.refresh();
 assert.ok(collision.rearAt(0,-.2)<initial-.10,
  'collision must follow bone-deformed mantle vertices');
 cape.geometry.dispose();cape.material.dispose();
 head.geometry.dispose();head.material.dispose();
});

test('wig keeps a continuous donor-derived crown undercoat and repels rear locks from cape',()=>{
 const geo=new THREE.SphereGeometry(.5,28,20);
 geo.computeVertexNormals();
 const head=new THREE.Mesh(geo,new THREE.MeshStandardMaterial());
 let actualContacts=0;
 const garment={
  resolve(point,{side}={}){
   if(side!=='rear'||point.y>.2||Math.abs(point.x)>.30||point.z<=-.42)
    return false;
   point.z=-.42;actualContacts++;return true;
  }
 };
 const wig=createScalpAnchoredWig(head,{styleId:'sadako-straight-long',
  count:180,visualFiberMultiplier:1,staticGroom:false,
  garmentCollisionResolver:garment,normalLayeredSingleMesh:false});
 const report=wig.getReport();
 assert.equal(report.sadakoSkinnedMantleCollision,true);
 assert.ok(report.v66RealCrownUnderlayTriangles>0,
  'intact donor crown triangles must fill exposed scalp gaps');
 assert.equal(report.sadakoCrownUnderlaySource,'actual-donor-scalp');
 assert.ok(actualContacts>0,'real mantle must be consulted for hair');
 assert.ok(report.mantleContactCount>0);
 wig.update(.06);
 assert.ok(wig.getReport().mantleContactCount>=report.mantleContactCount);
 const cap=wig.root.getObjectByName('REAL_SCALP_TRIANGLE_HAIR_CAP');
 assert.ok(cap.userData.donorScalpVertexCount<cap.geometry.attributes.position.count,
  'underlay must not generate additional hair follicles');
 wig.dispose();geo.dispose();head.material.dispose();
});

test('published editors and QA workflow load v60 with cloak refresh after pose update',()=>{
 assert.match(FACE_HAIR_RUNTIME_BUILD,/costume-neck-buzz-crown-v63$/);
 const body=read('face-body-studio.html');
 const face=read('face-mesh-studio.html');
 assert.match(body,/20261121-costume-neck-buzz-crown-v63/);
 assert.match(face,/20261121-costume-neck-buzz-crown-v63/);
 assert.match(body,/createMantleHairCollision/);
 assert.match(body,/garmentCollisionResolver:mantleCollision/);
 assert.match(body,/mantleCollision\.refresh\(\)/);
 assert.match(body,/wig\?\.update\(dt\)/);
 assert.match(read('.github/workflows/hair-reselect-regression.yml'),
  /hair-sadako-mantle-crown-v60\.test\.mjs/);
});
