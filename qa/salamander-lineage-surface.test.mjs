import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {MONSTER_BY_ID} from '../src/monster-catalog.js';
import {createMonsterModel,disposeMonsterSculpture} from '../src/monster-geometry.js';
import {salamanderLineageSurface} from
 '../src/salamander-lineage-surface.js?v=m016-m017-salamander-quality-v21-20261121';

for(const id of ['m016','m017'])for(const detail of ['low','high']){
 test(id+' '+detail+': species-colored PBR and physically connected four limbs',()=>{
  const surface=salamanderLineageSurface(id,detail);
  assert.equal(salamanderLineageSurface(id,detail),surface,
   'shared cached maps; never allocate textures once per limb');
  assert.equal(surface.resolution,detail==='low'?96:192);
  assert.notEqual(salamanderLineageSurface('m016',detail),
   salamanderLineageSurface('m017',detail),
   'swamp scales and steel scales must not be the same skin');
  const color=surface.albedo.image.data;
  let dark=0,light=0;
  for(let i=0;i<color.length;i+=4){
   if(color[i]<165)dark++;
   if(color[i]>203)light++;
  }
  assert(dark>color.length/4*.02,'skin needs natural dark texture');
  assert(light>color.length/4*.02,'skin needs physical highlights');
  for(const name of ['albedo','normal','roughness']){
   assert.equal(surface[name].isDataTexture,true);
   assert.equal(surface[name].image.width,surface.resolution);
   assert.equal(surface[name].image.height,surface.resolution);
  }
  assert.equal(surface.emissive,undefined,
   'water/steel salamanders must not inherit orange magma');
  const root=createMonsterModel(MONSTER_BY_ID[id],{detail});
  try{
   root.updateMatrixWorld(true);
   const meshes=[];root.traverse(o=>{if(o.isMesh)meshes.push(o)});
   const body=root.getObjectByName('species-shoulder-rib-pelvis-'+id);
   assert(body?.isMesh);
   assert.equal(root.userData.salamanderVisibleLimbSegments,8,
    'four animals legs need one upper and one shin each');
   assert.equal(root.userData.salamanderWearingSpeciesSkin,id);
   const material=body.material;
   assert.equal(material.userData.salamanderLineagePBR,id);
   assert.equal(material.map,surface.albedo);
   assert.equal(material.normalMap,surface.normal);
   assert.equal(material.roughnessMap,surface.roughness);
   for(const name of ['frontL','frontR','rearL','rearR']){
    const leg=root.userData.pivots['leg'+name];
    const knee=root.userData.pivots['lower'+name];
    const toe=root.userData.pivots['toe'+name];
    assert(leg&&knee&&toe);
    assert.equal(knee.parent,leg);
    assert.equal(toe.parent,knee);
    assert.equal(leg.userData.salamanderDerivedPhysicalLimbs,true);
    assert.equal(leg.userData.salamanderEmbeddedHipSocket,true);
    assert.equal(toe.userData.salamanderGroundedPaw,true);
    assert.equal(toe.userData.salamanderToeCount,detail==='low'?3:4);
    const upper=root.getObjectByName(id+'-organic-upper-'+name);
    const shin=root.getObjectByName(id+'-organic-shin-'+name);
    const pad=root.getObjectByName(id+'-organic-metatarsal-'+name);
    const fascia=root.getObjectByName(id+'-embedded-shoulder-hip-fascia-'+name);
    for(const mesh of [upper,shin,pad,fascia]){
     assert(mesh?.isMesh,mesh?.name||id+' '+name+' missing');
     assert.equal(mesh.material.userData.salamanderLineagePBR,id);
     assert.equal(mesh.material.map,material.map,
      'torso, anchored shoulder and moving toes share the same texture');
     assert.equal(mesh.material.normalMap,material.normalMap);
     assert.equal(mesh.material.roughnessMap,material.roughnessMap);
     assert(mesh.geometry.getAttribute('uv')?.count>20);
    }
    assert.equal(upper.parent,leg);
    assert.equal(shin.parent,knee);
    assert.equal(fascia.parent,root.userData.pivots.torso);
    assert.equal(upper.userData.salamanderSingleVisibleLimb,true);
    assert.equal(shin.userData.salamanderSingleVisibleLimb,true);
    assert(!upper.frustumCulled&&!shin.frustumCulled);
    assert(upper.material.metalness<(id==='m017'?.20:.05));
    assert(!meshes.some(m=>m.name==='joint-'+name),
      'legacy detached knee sphere is removed');
    const padPoint=toe.getWorldPosition(new THREE.Vector3());
    assert(padPoint.y>-.20&&padPoint.y<.28,
      'paw pivot must remain close to ground at bind pose');
    const count=detail==='low'?3:4;
    for(let digit=0;digit<count;digit++){
     const finger=root.getObjectByName(
      id+'-organic-digit-'+name+'-'+digit);
     const claw=root.getObjectByName(
      id+'-rooted-claw-'+name+'-'+digit);
     assert(finger?.isMesh&&claw?.isMesh);
     assert.equal(finger.parent,toe);
     assert.equal(claw.parent,toe);
     assert.equal(finger.material.map,material.map);
     assert.equal(claw.userData.salamanderRootedClaw,true);
    }
   }
   assert(!meshes.some(m=>m.name.startsWith('m019-mobile-')),
    'must not copy m019 model pieces onto another character');
   assert(!meshes.some(m=>/m019.*(?:lava|molten)/i.test(m.name)),
    'swamp and steel species have different biological identity');
  }finally{disposeMonsterSculpture(root);}
 });
}
test('other reptile anatomy remains independent',()=>{
 for(const id of ['m018','m020']){
  const root=createMonsterModel(MONSTER_BY_ID[id],{detail:'low'});
  try{assert.equal(root.userData.salamanderVisibleLimbSegments,undefined);}
  finally{disposeMonsterSculpture(root);}
 }
});
