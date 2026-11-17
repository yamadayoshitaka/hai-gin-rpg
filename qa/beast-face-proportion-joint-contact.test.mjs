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

test('feline joints use torso-anchored four-bone skin through motion',()=>{
 for(const id of ['m007','m008','m009','m010']){
  const model=make(id);
  try{
   const p=model.userData.pivots;
   assert.equal(p.head.parent,p.torso,id+' head remained root-fixed');
   const collar=node(model,'feline-head-neck-continuity-'+id);
   const body=node(model,'species-shoulder-rib-pelvis-'+id);
   assert.equal(collar.parent,p.head);
   assert.equal(body.userData.felineMusclesSculptedIntoTrunk,true);
   assert.equal(body.userData.closedAnatomicalHull,true);
   assert.ok(body.userData.anatomicalEndCaps>=48,
    'feline rib cage must be a real closed volume, not a hollow tube');
   const joints=limbNames.map(name=>{
    const skin=node(model,'feline-continuous-skin-'+name);
    assert.ok(skin.isSkinnedMesh&&skin.userData.felineContinuousSurface);
    assert.equal(skin.parent,p['leg'+name]);
    assert.equal(skin.skeleton.bones.length,4);
    assert.equal(skin.userData.felineSealedTop,true);
    assert.equal(skin.userData.felineSealedBottom,true);
    assert.equal(skin.userData.felineRootBuriedInTorso,true);
    const triangles=skin.geometry.index.count/3;
    const radial=32;
    const ringCount=(skin.geometry.getAttribute('position').count-2)/(radial+1);
    assert.ok(ringCount>=40&&Number.isInteger(ringCount));
    assert.equal(triangles,(ringCount-1)*radial*2+radial*2,
      'closed weighted skin must have two cap fans without old tubes');
    const pos=skin.geometry.getAttribute('position');
    const rootCentre=pos.count-2,pawCentre=pos.count-1;
    assert.ok(pos.getY(rootCentre)>.70);
    assert.ok(pos.getY(pawCentre)<-.58);
    assert.equal(skin.userData.felineEndCapTriangles,radial*2);
    assert.equal(skin.geometry.groups.length,0);
    assert.equal(skin.userData.torsoAnchoredProximalSkin,true);
    assert.equal(skin.skeleton.bones[0].parent,p.torso);
    assert.equal(skin.skeleton.bones[1].parent,p['leg'+name]);
    assert.equal(skin.skeleton.bones[2].parent,p['lower'+name]);
    assert.equal(skin.skeleton.bones[3].parent,p['toe'+name]);
    const weights=skin.geometry.getAttribute('skinWeight');
    const indices=skin.geometry.getAttribute('skinIndex');
    assert.ok(weights.count>800,id+' '+name+' must have real continuous rings');
    assert.ok(weights.getX(0)>.99,'top ring must be fixed to torso');
    assert.ok(weights.getW(weights.count-1)>.99,'paw tip must follow toe');
    for(let i=0;i<weights.count;i++){
     const sum=weights.getX(i)+weights.getY(i)+weights.getZ(i)+weights.getW(i);
     assert.ok(Math.abs(sum-1)<.00001,'all vertices must have normalised bone weights');
     assert.equal(indices.getX(i),0);
     assert.equal(indices.getY(i),1);
     assert.equal(indices.getZ(i),2);
     assert.equal(indices.getW(i),3);
    }
    assert.ok(!model.getObjectByName('feline-continuous-hock-'+name));
    assert.ok(!model.getObjectByName('feline-ankle-to-toe-fascia-'+name));
    return {name,skin};
   });
   const rearSkin=joints.find(j=>j.name==='rearL').skin;
   const firstVertex=new THREE.Vector3().fromBufferAttribute(
     rearSkin.geometry.getAttribute('position'),0);
   model.updateMatrixWorld(true);
   const toWorld=()=>{
    const v=firstVertex.clone();
    rearSkin.applyBoneTransform(0,v);
    return rearSkin.localToWorld(v);
   };
   const rootBefore=toWorld();
   p.legrearL.rotation.x=.50;
   model.updateMatrixWorld(true);
   const rootAfter=toWorld();
   assert.ok(rootBefore.distanceTo(rootAfter)<.005,
     id+' the skin attachment at hip follows the rotating thigh');
   p.legrearL.rotation.x=0;
   for(const action of ['idle','walk','run','attack','leap']){
    startMonsterAction(model,action,0);
    for(const t of [.04,.16,.31,.47,.71]){
     animateMonsterModel(model,t);
     model.updateMatrixWorld(true);
     assert.ok(boundsGap(box(collar),box(body))<.07,
      id+' '+action+' neck disconnected at '+t);
     for(const {name,skin} of joints){
      assert.ok(skin.skeleton.bones.every(b=>
        b.matrixWorld.elements.every(Number.isFinite)),
        id+' '+name+' '+action+' broken skinned joint at '+t);
      assert.ok(Number.isFinite(p['toe'+name].rotation.x));
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
