import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {MONSTER_BY_ID} from '../src/monster-catalog.js';
import {createMonsterModel,disposeMonsterSculpture} from '../src/monster-geometry.js';
import {startMonsterAction,animateMonsterModel} from '../src/monster-animation.js';
import {MAGMA_SALAMANDER_REVISION,MAGMA_SALAMANDER_LEG_REACH,
 magmaSkullFromWolfKing,magmaTorsoFromWolfKing} from '../src/magma-salamander-sculpt.js';

test('m019 is an explicitly m001-derived original salamander, not a copied wolf',()=>{
 const donor=[{z:.5,y:0,rx:.1,ry:.1},{z:.4,y:0,rx:.2,ry:.2},
 {z:.3,y:0,rx:.3,ry:.3},{z:.2,y:0,rx:.4,ry:.3},
 {z:.1,y:0,rx:.4,ry:.3},{z:0,y:0,rx:.3,ry:.3},
 {z:-.1,y:0,rx:.25,ry:.2},{z:-.2,y:0,rx:.15,ry:.15}];
 const m=magmaSkullFromWolfKing(donor);
 assert.equal(m.length,donor.length);
 assert(m.every((p,i)=>i===0||p.z<m[i-1].z));
 assert(m.some((p,i)=>p.rx!==donor[i].rx));
 assert.equal(donor[0].rx,.1,'m001 donor must remain unmodified');
 const body=magmaTorsoFromWolfKing(Array.from({length:8},(_,i)=>({
  z:1-i*.25,y:1.3,rx:.4,ry:.35
 })));
 assert.equal(body.length,8);
 assert(body.every(x=>x.rx>.4&&x.ry>.35));
 assert.equal(MONSTER_BY_ID.m019.family,'reptile');
});

for(const detail of ['low','high']){
 test('m019 real 3D mesh and motion / '+detail,()=>{
  const model=createMonsterModel(MONSTER_BY_ID.m019,{detail});
  try{
   assert.equal(model.userData.m019SculptRevision,MAGMA_SALAMANDER_REVISION);
   assert.equal(model.userData.clonedFromSpecies,'m001');
   assert.equal(model.userData.speciesId,'m019');
   assert.equal(model.userData.m019ShortLegReach,MAGMA_SALAMANDER_LEG_REACH);
   const meshes=[],nameSet=new Set();
   model.traverse(o=>{if(o.isMesh){meshes.push(o);nameSet.add(o.name)}});
   assert(meshes.length>0,'real triangle meshes are required');
   assert(nameSet.has('m019-m001-sourced-closed-cranium'));
   const skull=meshes.find(m=>m.name==='m019-m001-sourced-closed-cranium');
   assert.equal(skull.geometry.userData.faceVolumeApplied,true,
    'm019 must preserve the existing physically sculpted facial surface');
   assert(nameSet.has('m019-grand-horn-L')&&nameSet.has('m019-grand-horn-R'),
    'both large horns must follow the head pivot');
   assert(nameSet.has('m019-vertical-pupil-L')&&nameSet.has('m019-vertical-pupil-R'));
   assert(nameSet.has('m019-amber-iris-L')&&nameSet.has('m019-amber-iris-R'));
   assert([...nameSet].some(n=>n.startsWith('m019-lava-ridge-')));
   assert(![...nameSet].some(n=>n.includes('wolf-mane')||n.includes('canine-fur')),
    'salamander must not grow the m001 fur coat');
   const pivot=model.userData.pivots;
   assert(pivot?.head&&pivot?.torso&&pivot?.tail);
   for(const legId of ['legfrontL','legfrontR','legrearL','legrearR']){
    const leg=pivot[legId];
    assert(leg?.userData.m019ShortPlantedLeg,legId+' must be short');
    assert.equal(leg.scale.y,MAGMA_SALAMANDER_LEG_REACH);
    assert(leg.position.y<.55,'hip must lower with shortened legs');
    const lowerId=legId.replace('leg','lower');
    assert(pivot[lowerId]?.parent===leg,'lower joint must follow upper leg');
   }
   for(const id of ['m019-grand-horn-L','m019-grand-horn-R',
    'm019-amber-iris-L','m019-amber-iris-R']){
    const obj=meshes.find(o=>o.name===id);
    assert.equal(obj.parent,pivot.head,id+' detached from head');
   }
   for(const obj of meshes){
    const p=obj.geometry?.getAttribute('position');
    assert(p?.count>0,obj.name+' missing geometry');
    for(let i=0;i<p.count;i++){
     assert(Number.isFinite(p.getX(i))&&Number.isFinite(p.getY(i))&&
      Number.isFinite(p.getZ(i)),obj.name+' has invalid vertex');
    }
   }
   assert.doesNotThrow(()=>{
    startMonsterAction(model,'walk',0);
    for(const time of [0,.15,.4,.85,1.1])animateMonsterModel(model,time);
   });
   model.updateMatrixWorld(true);
   const bounds=new THREE.Box3().setFromObject(model);
   assert(!bounds.isEmpty(),'m019 bounds must be nonempty');
   assert(bounds.max.y>bounds.min.y&&bounds.max.z>bounds.min.z);
  }finally{disposeMonsterSculpture(model)}
 });
}

test('m019 does not change other reptile silhouettes',()=>{
 const other=createMonsterModel(MONSTER_BY_ID.m016,{detail:'low'});
 try{
  assert.equal(other.userData.m019SculptRevision,undefined);
  const names=[];
  other.traverse(obj=>{if(obj.isMesh)names.push(obj.name)});
  assert(!names.some(n=>n.startsWith('m019-')));
 }finally{disposeMonsterSculpture(other)}
});
