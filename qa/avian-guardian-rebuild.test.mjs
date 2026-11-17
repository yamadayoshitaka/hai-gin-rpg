import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {MONSTER_BY_ID} from '../src/monster-catalog.js';
import {createMonsterModel,disposeMonsterSculpture} from '../src/monster-geometry.js';
import {startMonsterAction,animateMonsterModel} from '../src/monster-animation.js';
import {AVIAN_REFRESH_IDS,AVIAN_REALISM_REVISION,avianProfile}
 from '../src/avian-guardian-sculpt.js';

const meshes=root=>{
 const out=[];root.traverse(node=>{if(node.isMesh)out.push(node);});
 return out;
};
const triangles=root=>meshes(root).reduce((acc,m)=>{
 const positions=m.geometry.getAttribute('position');
 assert.ok(positions?.count>2,m.name+' needs actual vertices');
 for(const n of positions.array)assert.ok(Number.isFinite(n),
   m.name+' has broken vertex coordinates');
 const n=m.geometry.index?.count??positions.count;
 return acc+n/3;
},0);
const build=(id,detail='high')=>createMonsterModel(MONSTER_BY_ID[id],{detail});
test('four distinct avian masters reuse the real 82-feather guardian wing',()=>{
 assert.deepEqual(AVIAN_REFRESH_IDS,['m011','m012','m013','m014']);
 const distinct=new Set();
 for(const id of AVIAN_REFRESH_IDS){
  const model=build(id);
  try{
   assert.equal(model.userData.avianRebuildRevision,AVIAN_REALISM_REVISION);
   assert.equal(model.userData.avianGameSourceRevision,AVIAN_REALISM_REVISION);
   assert.equal(model.userData.avianGuardianGeometryDonor,'seraph_guardian');
   distinct.add(model.userData.avianAnatomicalKind);
   const p=model.userData.pivots;
   assert.equal(p.wingL.parent,p.torso);
   assert.equal(p.wingR.parent,p.torso);
   assert.equal(p.wingElbowL.parent,p.wingL);
   assert.equal(p.wingWristL.parent,p.wingElbowL);
   assert.equal(p.tail.parent,p.torso);
   assert.equal(p.head.parent,p.torso);
   for(const suffix of ['L','R']){
    const wing=model.getObjectByName('avian-guardian-three-layer-wing-'+id+'-'+suffix);
    assert.ok(wing?.isMesh&&wing.visible,id+' missing guardian-derived feather wing');
    assert.equal(wing.parent,p['wing'+suffix]);
    assert.equal(wing.userData.angelSource,'seraph_guardian');
    assert.equal(wing.userData.angelFeatherLayers,3);
    assert.equal(wing.userData.angelFeathersPerSide,82);
    assert.ok(wing.userData.angelDonorGeometryTriangles>1000);
    assert.ok(wing.geometry.getAttribute('normal'));
    assert.ok(wing.geometry.getAttribute('uv'));
    assert.ok(wing.geometry.getAttribute('color'));
    assert.ok(wing.geometry.getAttribute('position').count>15000);
    assert.equal(wing.userData.ownedGeometry,true);
    assert.equal(wing.userData.ownedEffectMaterial,true);
   }
   const body=model.getObjectByName('avian-keel-rib-cavity-'+id);
   const plumage=model.getObjectByName('avian-layered-body-plumage-'+id);
   const tail=model.getObjectByName('avian-tail-rooted-streamers-'+id);
   assert.ok(body?.userData.avianClosedThorax);
   assert.ok(plumage?.userData.curvedAvianFeathers>100);
   assert.ok(tail?.userData.curvedAvianFeathers>=9);
   assert.equal(model.getObjectByName('avian-cranium-'+id)?.userData.avianRealCranium,true);
   assert.ok(model.getObjectByName('avian-hooked-beak-'+id)?.userData.avianHookedKeratin);
   for(const suffix of ['L','R']){
    assert.ok(p['avianFoot'+(id==='m012'?'Front':'')+suffix]);
    assert.ok(p['birdAnkle'+(id==='m012'?'Front':'')+suffix]);
   }
   assert.ok(triangles(model)<500000,id+' over playable triangle budget');
  }finally{disposeMonsterSculpture(model);}
 }
 assert.equal(distinct.size,4,'eagle, griffin, phoenix and owl are not one reskinned bird');
});
test('phoenix has richer source geometry, warm feathers and long articulated tail',()=>{
 const counts={};
 for(const detail of ['source','high','medium','low']){
  const m=build('m013',detail);
  try{
   counts[detail]=triangles(m);
   const wing=m.getObjectByName('avian-guardian-three-layer-wing-m013-L');
   assert.ok(wing);
   assert.equal(wing.userData.angelFeathersPerSide,
     detail==='low'||detail==='medium'?18:82);
   assert.ok(m.getObjectByName('avian-articulated-crest-m013'));
   const tail=m.getObjectByName('avian-tail-rooted-streamers-m013');
   assert.equal(tail.userData.curvedAvianFeathers,
     detail==='low'?5:19);
   assert.ok(m.getObjectByName('avian-layered-body-plumage-m013'));
   assert.equal(wing.material.emissiveIntensity,.21);
   const coords=wing.geometry.getAttribute('position');
   const color=wing.geometry.getAttribute('color');
   let ember=0;
   for(let j=0;j<color.count;j+=Math.max(1,Math.floor(color.count/190))){
    if(color.getX(j)>color.getZ(j)*1.15)ember++;
   }
   assert.ok(ember>20,'fire feathers must be physically recoloured rather than plain angel ivory');
   const bounding=new THREE.Box3().setFromObject(m);
   assert.ok(bounding.getSize(new THREE.Vector3()).x>4,
     'phoenix must have a cathedral-scale wing silhouette');
   assert.ok(coords.count>900,'phoenix wings need curved 3D feather geometry');
  }finally{disposeMonsterSculpture(m);}
 }
 assert.ok(counts.source>counts.high*1.7,
   'source wing must be genuinely finer than in-game near model');
 assert.ok(counts.high>counts.low*1.5,
   'crowd LOD must remove significant feather triangles');
 assert.ok(counts.source<2_000_000,'source must fit the preview GPU limit');
 assert.ok(counts.high<500000,'near battle model must fit the FPS budget');
});
test('griffin has four independently animated legs; owl has facial disks',()=>{
 const griffin=build('m012');
 const owl=build('m014');
 try{
  for(const suffix of ['L','R']){
   assert.ok(griffin.userData.pivots['legFront'+suffix]);
   assert.ok(griffin.userData.pivots['legRear'+suffix]);
   assert.ok(owl.getObjectByName('owl-facial-disc-'+suffix));
   assert.ok(owl.getObjectByName('owl-iris-'+(suffix==='L'?-1:1)));
  }
  for(const model of [griffin,owl]){
   for(const action of ['idle','walk','run','attack','special','defeat']){
    startMonsterAction(model,action,0);
    animateMonsterModel(model,action==='defeat'?.9:.32);
    model.updateMatrixWorld(true);
    for(const suffix of ['L','R']){
     for(const name of ['wing','wingElbow','wingWrist']){
      const b=model.userData.pivots[name+suffix];
      assert.ok(b&&[b.rotation.x,b.rotation.y,b.rotation.z].every(Number.isFinite),
       model.userData.speciesId+' '+action+' has invalid wing joint '+name);
     }
    }
   }
  }
 }finally{
  disposeMonsterSculpture(griffin);
  disposeMonsterSculpture(owl);
 }
});
test('m015 humanlike Tengu remains on the previous independently maintained path',()=>{
 const m=build('m015','high');
 try{
  assert.equal(avianProfile('m015'),null);
  assert.equal(m.userData.avianRebuildRevision,undefined);
  assert.equal(m.getObjectByName('avian-guardian-three-layer-wing-m015-L'),undefined);
  assert.ok(m.userData.pivots.wingL&&m.userData.pivots.legL);
 }finally{disposeMonsterSculpture(m);}
});
