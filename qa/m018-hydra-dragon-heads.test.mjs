import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {MONSTER_BY_ID} from '../src/monster-catalog.js';
import {createMonsterModel,disposeMonsterSculpture} from '../src/monster-geometry.js';
import {startMonsterAction,animateMonsterModel} from '../src/monster-animation.js';
import {M018_HYDRA_REVISION} from
 '../src/m018-hydra-sculpt.js?v=m018-purple-thorn-dragon-necks-v23-20261121';

for(const detail of ['low','high']){
 test('m018 '+detail+' retains base body and four planted limbs while creating 3 long dragon heads',()=>{
  const root=createMonsterModel(MONSTER_BY_ID.m018,{detail});
  try{
   const piv=root.userData.pivots;
   root.updateMatrixWorld(true);
   assert.equal(root.userData.speciesId,'m018');
   assert.equal(root.userData.gameModelRevision,M018_HYDRA_REVISION);
   assert.equal(root.userData.m018HydraRevision,M018_HYDRA_REVISION);
   assert.equal(root.userData.m018DragonHeadCount,3);
   assert.equal(root.userData.m018LongestNeck,2.17);
   assert.equal(root.userData.m018ExistingTorsoLegsTailPreserved,true);
   assert.equal(root.userData.m018PhysicalDragonHeads,true);
   assert(piv.torso&&piv.tail&&piv.tailMid,'preserve original rig');
   assert.equal(piv.tail.parent,root,
    'preserve the original m018 root-owned tail pivot, do not silently reparent');
   assert(root.getObjectByName('species-shoulder-rib-pelvis-m018')?.isMesh,
    'keep original m018 anatomical torso, not a fresh monster replacement');
   for(const id of ['frontL','frontR','rearL','rearR']){
    assert(piv['leg'+id],'do not delete original '+id);
    assert.equal(piv['lower'+id].parent,piv['leg'+id]);
   }
   const meshes=[];root.traverse(x=>{if(x.isMesh)meshes.push(x)});
   assert.equal(meshes.filter(x=>x.name.startsWith('m018-long-neck-')).length,3);
   assert.equal(meshes.filter(x=>x.name.startsWith('m018-dragon-cranium-')).length,3);
   assert.equal(meshes.filter(x=>x.name.startsWith('m018-dragon-mandible-')).length,3);
   assert.equal(meshes.filter(x=>x.name.startsWith('m018-dragon-nasal-ridge-')).length,3);
   assert(!meshes.some(x=>x.name==='organic-cranium-m018'),
    'do not overlay old generic single lizard head under dragon heads');
   for(const suffix of ['L','C','R']){
    const neckPivot=suffix==='C'?piv.head:piv['hydraHead'+suffix];
    const skull=piv['hydraSkull'+suffix];
    const jaw=suffix==='C'?piv.jaw:piv['hydraJaw'+suffix];
    assert(neckPivot&&skull&&jaw,suffix+' needs complete 3D chain');
    assert.equal(neckPivot.parent,piv.torso);
    assert.equal(skull.parent,neckPivot);
    assert.equal(jaw.parent,skull);
    assert.equal(neckPivot.userData.m018IndependentNeck,true);
    assert.equal(skull.userData.m018DragonFace,true);
    assert.equal(jaw.userData.m018DragonMandible,true);
    const length=suffix==='C'?2.17:1.54;
    assert.equal(neckPivot.userData.m018NeckLength,length);
    assert.equal(skull.position.y,length,'neck must be extended at least 1.54 units');
    const throat=root.getObjectByName('m018-long-neck-'+suffix);
    assert(throat?.isMesh&&throat.parent===neckPivot);
    assert(throat.visible&&throat.material.visible);
    assert(throat.userData.cappedTubularSkin);
    assert.equal(throat.userData.m018ContinuousNeck,true);
    assert.equal(throat.userData.m018NeckSource,'m018-existing-torso');
    const scute=root.getObjectByName('m018-throat-scute-'+suffix);
    assert.equal(scute?.parent,neckPivot);
    const spine=root.getObjectByName('m018-neck-venom-spine-'+suffix);
    assert.equal(spine?.parent,neckPivot);
    assert(spine.material.color.b>spine.material.color.g,'violet venom spines match the design');
    const cranium=root.getObjectByName('m018-dragon-cranium-'+suffix);
    assert.equal(cranium.userData.m018DragonWedge,true);
    assert.equal(cranium.parent,skull);
    assert(cranium.geometry.getAttribute('position').count>100);
    assert(cranium.geometry.getIndex().count>100);
    assert(root.getObjectByName('m018-dragon-nasal-ridge-'+suffix)?.isMesh);
    for(const side of ['L','R']){
     assert(root.getObjectByName('m018-dragon-eye-'+suffix+'-'+side)?.isMesh);
     assert(root.getObjectByName('m018-dragon-pupil-'+suffix+'-'+side)?.isMesh);
     const horn=root.getObjectByName('m018-dragon-horn-'+suffix+'-'+side);
     assert(horn?.isMesh&&horn.userData.m018RootedDragonHorn,
      'all heads must have true dragon horns');
     assert(root.getObjectByName('m018-dragon-nostril-'+suffix+'-'+side)?.isMesh);
     assert(root.getObjectByName('m018-upper-fang-'+suffix+'-'+side+'-0')?.isMesh);
    }
   }
   const thorns=meshes.filter(x=>x.name.startsWith('m018-rooted-toxic-thorn-'));
   assert.equal(thorns.length,detail==='low'?6:12);
   assert(thorns.every(x=>x.parent===piv.torso),'toxins must be rooted in original back');
   assert(meshes.every(x=>x.geometry?.getAttribute('position')?.count>0),
    'all hydra components must be real nonempty 3D meshes');
   const bounds=new THREE.Box3().setFromObject(root);
   assert(!bounds.isEmpty()&&bounds.max.y>bounds.min.y);
   // Side heads and mandibles are animated alongside the center's real jaw.
   startMonsterAction(root,'roar',0);
   animateMonsterModel(root,.23);
   assert.equal(piv.hydraSkullL.rotation.y,-.48);
   assert.equal(piv.hydraSkullR.rotation.y,.48);
   assert(piv.hydraJawL.rotation.x>.1);
   assert(piv.hydraJawR.rotation.x>.1);
   assert(Math.abs(piv.hydraHeadL.rotation.y)>.02);
   assert(Math.abs(piv.hydraHeadR.rotation.y)>.02);
   startMonsterAction(root,'run',1);
   animateMonsterModel(root,1.17);
   const after=new THREE.Box3().setFromObject(root);
   assert(!after.isEmpty(),'animation must not remove heads');
   assert(root.getObjectByName('m018-long-neck-C')?.visible);
  }finally{disposeMonsterSculpture(root);}
 });
}
test('replacing m018 face does not replace unrelated reptile skulls',()=>{
 for(const id of ['m016','m017','m019','m020']){
  const root=createMonsterModel(MONSTER_BY_ID[id],{detail:'low'});
  try{
   assert(!root.getObjectByName('m018-long-neck-C'));
   assert.equal(root.userData.m018DragonHeadCount,undefined);
  }finally{disposeMonsterSculpture(root);}
 }
});
