import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {MONSTER_CATALOG,MONSTER_BY_ID} from '../src/monster-catalog.js';
import {humanoidMonsterCostumeFor} from '../src/monster-character-cosplay-manifest.js';
import {MONSTER_DETAIL_LEVELS,monsterResolutionFor}
 from '../src/monster-shape-kit.js';
import {createMonsterModel,disposeMonsterSculpture}
 from '../src/monster-geometry.js';
import {nonhumanMonsterStage} from '../src/nonhuman-model-quality.js';
import {APPROVED_REFERENCE_IDS,MONSTER_REFERENCE_FINISH_TARGETS,
 MONSTER_REFERENCE_FINISH_REVISION,referenceFinishProfile,
 getMonsterReferenceNormalMap,enhanceMonsterReferenceMaterial,
 monsterReferenceFinishCacheStats}
 from '../src/monster-reference-finish.js';
const approved=new Set(APPROVED_REFERENCE_IDS);
test('50 bestiary models split into 12 protected reference, 22 upgraded and 16 independent humanoids',()=>{
 assert.equal(MONSTER_CATALOG.length,50);
 assert.equal(approved.size,12);
 let upgraded=0,humanoid=0,protectedCount=0;
 for(const s of MONSTER_CATALOG){
  const isHuman=!!humanoidMonsterCostumeFor(s),profile=referenceFinishProfile(s);
  if(isHuman){humanoid++;assert.equal(profile,null,s.id+' human must not inherit animal skin');}
  else if(approved.has(s.id)){
   protectedCount++;assert.equal(profile,null,s.id+' reference donor must remain untouched');
  }else{
   upgraded++;assert.ok(profile,s.id+' lacks comparable surface plan');
   assert.ok(MONSTER_REFERENCE_FINISH_TARGETS.includes(s.family));
  }
 }
 assert.deepEqual({upgraded,humanoid,protectedCount},
  {upgraded:22,humanoid:16,protectedCount:12});
});
test('higher source/high geometry density without any mobile low-LOD growth',()=>{
 for(const s of MONSTER_CATALOG){
  const hi=monsterResolutionFor(s,'high'),lo=monsterResolutionFor(s,'low');
  if(referenceFinishProfile(s)){
   const base=MONSTER_DETAIL_LEVELS.high;
   assert.equal(hi.sphere[0],base.sphere[0]+nonhumanMonsterStage(s)+1,s.id);
   assert.equal(hi.sphere[1],base.sphere[1]+nonhumanMonsterStage(s)+1,s.id);
   assert.equal(hi.rod,base.rod+Math.ceil((nonhumanMonsterStage(s)+1)/2),s.id);
  }
  assert.deepEqual(lo,MONSTER_DETAIL_LEVELS.low,'mobile LOD grew '+s.id);
 }
});
test('real reusable normal data are finite, tiled and keep approved textures intact',()=>{
 const sources=['m001','m008','m011','m017','m023','m048'];
 for(const id of sources){
  const spec=MONSTER_BY_ID[id],tex=getMonsterReferenceNormalMap(spec,'high');
  assert.ok(tex?.isDataTexture,id+' missing real GPU normal data');
  assert.strictEqual(tex,getMonsterReferenceNormalMap(spec,'high'));
  assert.equal(tex.wrapS,THREE.RepeatWrapping);
  assert.equal(tex.wrapT,THREE.RepeatWrapping);
  assert.equal(tex.userData.species,id);
  assert.equal(tex.userData.monsterReferenceFinish,MONSTER_REFERENCE_FINISH_REVISION);
  assert.equal(tex.image.width,128);
  assert.equal(tex.image.data.length,128*128*4);
  assert.ok(tex.image.data.every(Number.isFinite));
  assert.ok(tex.image.data.some((v,i)=>i%4===0&&v!==128),'flat normal '+id);
  const physical=new THREE.MeshPhysicalMaterial({roughness:.8});
  assert.equal(enhanceMonsterReferenceMaterial(physical,{spec,role:'skin'}),true);
  assert.equal(physical.normalMap,tex);
  assert.ok(physical.normalScale.x>0);
  const donor=new THREE.DataTexture(new Uint8Array([128,128,255,255]),1,1);
  const existing=new THREE.MeshPhysicalMaterial({normalMap:donor});
  assert.equal(enhanceMonsterReferenceMaterial(existing,{spec,role:'skin'}),false);
  assert.equal(existing.normalMap,donor,'existing approved material overwritten');
  existing.dispose();donor.dispose();physical.dispose();
  assert.equal(enhanceMonsterReferenceMaterial(new THREE.MeshStandardMaterial(),{
   spec,detail:'low'}),false,'mobile LOD must remain unchanged');
 }
 for(const id of APPROVED_REFERENCE_IDS){
  assert.equal(getMonsterReferenceNormalMap(MONSTER_BY_ID[id],'high'),null);
 }
 assert.ok(monsterReferenceFinishCacheStats().normalMaps>=sources.length);
});
test('live mid-resolution geometry and material pass remain renderable across seven families',()=>{
 const ids=['m001','m008','m011','m016','m023','m020','m048'];
 for(const id of ids){
  const spec=MONSTER_BY_ID[id];
  let model;
  try{
   model=createMonsterModel(spec,{detail:'medium'});
   let triangles=0,meshes=0,normalSurfaces=0;
   model.traverse(n=>{
    if(!n.isMesh)return;
    meshes++;
    if(n.material){
     const mats=Array.isArray(n.material)?n.material:[n.material];
     if(mats.some(mat=>mat.normalMap))normalSurfaces++;
    }
    const a=n.geometry?.getAttribute('position');
    if(a)assert.ok(a.array.every(Number.isFinite),'broken geometry '+id);
    triangles+=Math.floor((n.geometry?.index?.count??a?.count??0)/3);
   });
   assert.ok(meshes>2&&triangles>100,id+' empty mesh');
   assert.ok(normalSurfaces>0,id+' missing PBR normal surface');
   const box=new THREE.Box3().setFromObject(model);
   assert.ok(!box.isEmpty());
   assert.ok([box.min.x,box.min.y,box.min.z,box.max.x,box.max.y,box.max.z]
    .every(Number.isFinite),'invalid bounds '+id);
  }finally{if(model)disposeMonsterSculpture(model);}
 }
});
