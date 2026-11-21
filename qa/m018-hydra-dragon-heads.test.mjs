import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createRegisteredBattleMonster} from '../src/battle-registered-monster-model.js';
import {createMonsterSummonRenderer} from '../src/monster-summon-renderer.js';
import {MONSTER_BY_ID} from '../src/monster-catalog.js';
import {createMonsterModel,disposeMonsterSculpture} from '../src/monster-geometry.js';
import {startMonsterAction,animateMonsterModel} from '../src/monster-animation.js';
import {M018_HYDRA_REVISION} from
 '../src/m018-hydra-sculpt.js?v=m018-webgl-skin-rooted-horns-v26-20261121';

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
   assert.equal(piv.tailTip.parent,piv.tailMid);
   const tailSkin=root.getObjectByName('m018-continuous-caudal-skin');
   assert(tailSkin?.isSkinnedMesh&&tailSkin.userData.cappedTubularSkin);
   assert.equal(tailSkin.frustumCulled,false);
   assert.equal(tailSkin.skeleton.bones.length,3);
   const tailGeo=tailSkin.geometry,{radialSegments,tubularSegments}=tailGeo.parameters;
   const tipIndex=(radialSegments+1)*tubularSegments;
   const atRest=tailSkin.getVertexPosition(tipIndex,new THREE.Vector3());
   piv.tailMid.rotation.y=.46;
   piv.tailTip.rotation.y=-.26;
   root.updateMatrixWorld(true);
   const flexed=tailSkin.getVertexPosition(tipIndex,new THREE.Vector3());
   assert(atRest.distanceTo(flexed)>.18);
   const weight=tailGeo.getAttribute('skinWeight');
   for(let i=0;i<weight.count;i++){
    assert.ok(Math.abs(weight.getX(i)+weight.getY(i)-1)<1e-6);
   }
   assert(Array.from(weight.array).some(v=>v>0&&v<1),'intermediate rings must blend both bones');
   piv.tailMid.rotation.y=0;
   piv.tailTip.rotation.y=0;
   root.updateMatrixWorld(true);
   for(const id of ['frontL','frontR','rearL','rearR']){
    assert(piv['leg'+id],'do not delete original '+id);
    assert.equal(piv['lower'+id].parent,piv['leg'+id]);
    const talon=root.getObjectByName('m018-rooted-talon-'+id);
    assert.equal(talon?.parent,piv['toe'+id]);
    assert.equal(talon.userData.rootedKeratin,true);
    const joint=piv['lower'+id];
    assert(Math.abs(joint.position.x)>.2,'limb should splay outwards');

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
     assert.equal(horn.parent,skull);
     const origin=skull.localToWorld(new THREE.Vector3(...horn.geometry.userData.root));
     const outward=new THREE.Vector3(side==='L'?-.41:.41,.84,-.35)
      .transformDirection(skull.matrixWorld);
     const exit=new THREE.Raycaster(origin,outward).intersectObject(cranium,false);
     assert.equal(exit.length%2,1,'the root of the horn must start inside the closed skull');
     assert.ok(exit[0].distance>.03,'the visible horn must extend from a buried root');
     assert(root.getObjectByName('m018-dragon-nostril-'+suffix+'-'+side)?.isMesh);
     assert(root.getObjectByName('m018-upper-fang-'+suffix+'-'+side+'-0')?.isMesh);
    }
   }
   const thorns=meshes.filter(x=>/^m018-rooted-toxic-thorn-\d+$/.test(x.name));
   assert.equal(thorns.length,detail==='low'?6:12);
   assert(thorns.every(x=>x.parent===piv.torso),'toxins must be rooted in original back');
   for(const mesh of meshes){
    const {geometry}=mesh;
    const vertices=geometry.getAttribute('position').count;
    assert(vertices>0,mesh.name+' must contain renderable vertices');
    for(const [name,attribute] of Object.entries(geometry.attributes)){
     assert.equal(attribute.count,vertices,mesh.name+' / '+name+' WebGL attribute count');
     assert(attribute.array.every(Number.isFinite),mesh.name+' / '+name+' must be finite');
    }
    assert(geometry.index?.array.every(i=>i<vertices)??true,
     mesh.name+' can only index uploaded vertices');
   }
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

test('m018 enemy and summon use four visual cells without resizing during actions',()=>{
 const spec=MONSTER_BY_ID.m018;
 const cells=4,cellSize=1.18;
 for(const detail of ['low','high']){
  const monster=createRegisteredBattleMonster(spec,{detail,cellSize});
  try{
   const rest=new THREE.Box3().setFromObject(monster.root);
   assert.ok(Math.abs(rest.max.z-rest.min.z-cells*cellSize)<.001);
   const scale=monster.root.scale.x;
   monster.update(0,'attack');
   monster.update(.4,'attack');
   assert.equal(monster.root.scale.x,scale);
  }finally{monster.dispose();}
 }
 const scene=new THREE.Scene();
 const renderer=createMonsterSummonRenderer(scene,{cellSize});
 try{
  renderer.sync([{id:1,type:'summon_m018',x:6,z:6}],0);
  const actor=scene.getObjectByName('SummonedBestiary_m018');
  assert(actor);
  const live=new THREE.Box3().setFromObject(actor);
  assert.ok(Math.abs(live.max.z-live.min.z-cells*cellSize)<.14);
 }finally{renderer.dispose();}
});
