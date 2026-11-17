import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {MONSTER_BY_ID} from '../src/monster-catalog.js';
import {createMonsterModel,disposeMonsterSculpture} from '../src/monster-geometry.js';
import {startMonsterAction,animateMonsterModel} from '../src/monster-animation.js';
import {wolfKingDonorFaceMatchScale,WOLF_KING_FACE_SCALE}
 from '../src/wolf-king-clone-source.js';

const limbNames=['frontL','frontR','rearL','rearR'];
const box=m=>new THREE.Box3().setFromObject(m);
const boundsGap=(a,b)=>{
 const axis=(x1,x2,y1,y2)=>Math.max(0,x1-y2,y1-x2);
 return Math.hypot(
  axis(a.min.x,a.max.x,b.min.x,b.max.x),
  axis(a.min.y,a.max.y,b.min.y,b.max.y),
  axis(a.min.z,a.max.z,b.min.z,b.max.z)
 );
};
const node=(model,name)=>{
 const part=model.getObjectByName(name);
 assert.ok(part?.isMesh,'Missing actual mesh: '+name);
 return part;
};
const make=id=>createMonsterModel(MONSTER_BY_ID[id],{detail:'high'});

test('m002 real face width/height matches SMALL m001 on-screen source',()=>{
 const m001=make('m001'),m002=make('m002');
 try{
  const skull1=box(node(m001,'organic-cranium-m001'));
  const skull2=box(node(m002,'organic-cranium-m002'));
  const size1=skull1.getSize(new THREE.Vector3());
  const size2=skull2.getSize(new THREE.Vector3());
  for(const dimension of ['x','y','z']){
   const ratio=size2[dimension]/size1[dimension];
   assert.ok(ratio>.82&&ratio<1.14,
    'm002 '+dimension+' face grew relative to m001: '+ratio);
  }
  const scale=wolfKingDonorFaceMatchScale('m002');
  const head=m002.userData.pivots.head,torso=m002.userData.pivots.torso;
  assert.equal(head.parent,torso,'m002 must follow the same moving torso');
  assert.ok(head.userData.m001DisplaySpaceFaceClone);
  for(const axis of ['x','y','z'])
   assert.ok(Math.abs(head.scale[axis]-scale[axis])<1e-6,
    'm002 missing physical face source ' + axis);
  assert.equal(WOLF_KING_FACE_SCALE.x,.64);
  assert.equal(m002.userData.m002HeadScaleSource,'m001-rendered-face');
  for(const name of ['m002-rhinarium','organic-cranium-m002'])
   assert.equal(node(m002,name).parent,head);
  assert.equal(m001.userData.pivots.head.parent,m001,
   'Never rescale or reparent the accepted m001 donor');
 }finally{
  disposeMonsterSculpture(m001);
  disposeMonsterSculpture(m002);
 }
});

test('all feline joints and nose-rooted head physically intersect while moving',()=>{
 for(const id of ['m007','m008','m009','m010']){
  const model=make(id);
  try{
   const p=model.userData.pivots;
   assert.equal(p.head.parent,p.torso,id+' head remained root-fixed');
   const collar=node(model,'feline-head-neck-continuity-'+id);
   const body=node(model,'species-shoulder-rib-pelvis-'+id);
   assert.equal(collar.parent,p.head);
   const joints=limbNames.map(name=>{
    const upper=node(model,'beast-upper-limb-'+name);
    const shin=node(model,'beast-shin-'+name);
    const knee=node(model,'feline-knee-continuity-'+name);
    const hock=node(model,'feline-continuous-hock-'+name);
    const toe=node(model,'feline-ankle-to-toe-fascia-'+name);
    assert.equal(knee.parent,p['lower'+name]);
    assert.equal(hock.parent,p['lower'+name]);
    assert.equal(toe.parent,p['toe'+name]);
    assert.equal(knee.userData.attachedKneeCapsule,true);
    assert.equal(hock.userData.ankleSocketSeal,true);
    return {name,upper,shin,knee,hock,toe};
   });
   for(const action of ['idle','walk','run','attack','leap']){
    startMonsterAction(model,action,0);
    for(const t of [.04,.16,.31,.47,.71]){
     animateMonsterModel(model,t);
     model.updateMatrixWorld(true);
     assert.ok(boundsGap(box(collar),box(body))<.07,
      id+' '+action+' neck disconnected at '+t);
     for(const {name,upper,shin,knee,hock,toe} of joints){
      assert.ok(boundsGap(box(upper),box(knee))<.09,
       id+' '+name+' '+action+' upper/knee separated at '+t);
      assert.ok(boundsGap(box(shin),box(knee))<.015,
       id+' '+name+' '+action+' shin/knee separated at '+t);
      assert.ok(boundsGap(box(shin),box(hock))<.025,
       id+' '+name+' '+action+' shin/hock separated at '+t);
      assert.ok(boundsGap(box(hock),box(toe))<.06,
       id+' '+name+' '+action+' hock/paw separated at '+t);
     }
    }
   }
  }finally{disposeMonsterSculpture(model)}
 }
});

test('protected m005 and m006 retain original small-LOD lineage',()=>{
 for(const id of ['m005','m006']){
  const model=createMonsterModel(MONSTER_BY_ID[id],{detail:'low'});
  try{
   assert.equal(model.userData.m002HeadScaleSource,undefined);
   assert.equal(model.userData.pivots.head.userData.m001DisplaySpaceFaceClone,undefined);
   assert.equal(model.getObjectByName('feline-continuous-hock-frontL'),undefined);
  }finally{disposeMonsterSculpture(model)}
 }
});
