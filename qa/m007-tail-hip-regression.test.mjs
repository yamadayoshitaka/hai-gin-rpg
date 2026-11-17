import assert from 'node:assert/strict';
import * as THREE from 'three';
import {startMonsterAction,animateMonsterModel} from '../src/monster-animation.js';
import {MONSTER_BY_ID} from '../src/monster-catalog.js';
import {createMonsterModel,disposeMonsterSculpture}
 from '../src/monster-geometry.js';
import {felineMasterVariant} from '../src/feline-master-variants.js';

const profile=felineMasterVariant('m007');
assert.equal(profile.legReach,.84,
 'm007 hind thigh should no longer project far below the croup');

for(const detail of ['source','high','low']){
 const model=createMonsterModel(MONSTER_BY_ID.m007,{detail});
 try{
  const p=model.userData.pivots;
  for(const side of ['L','R'])for(const end of ['front','rear']){
   const leg=p['leg'+end+side],shin=p['lower'+end+side];
   assert.ok(leg&&shin,detail+' missing anatomical leg pivots');
   assert.ok(Math.abs(leg.scale.y-profile.legReach)<1e-6,
     detail+' should use shorter connected femur/upper limb');
   // The original sole position is preserved when shortening the source.
   const lowFoot=leg.position.y-leg.scale.y*.587;
   assert.ok(Math.abs(lowFoot-(.67-.587))<.002,
     detail+' should keep paws planted after shortening the leg');
  }
  const tail=p.tail,middle=p.tailMid,tip=p.tailTip;
  assert.equal(tail.parent,p.torso,detail+' tail must follow the torso');
  assert.equal(middle.parent,tail,detail+' caudal middle must follow the base');
  assert.equal(tip.parent,middle,detail+' tip must follow caudal articulation');
  assert.ok(tail.position.z<-.70&&tail.position.z>-.90,
    detail+' tail should emerge from the actual rear croup');
  for(const [parent,name] of [[tail,'feline-rooted-tail-m007'],
    [middle,'feline-tail-middle-m007']]){
   const mesh=parent.children.find(x=>x.name===name);
   assert.ok(mesh?.isMesh&&mesh.visible!==false,
     detail+' missing visible '+name);
   assert.ok(mesh.geometry.getIndex()?.count>60,
     detail+' tail must be capped 3D geometry, not a floating tip sphere');
   assert.equal(mesh.userData.felineTailClosedSource,true);
  }
  assert.ok(tip.children.some(x=>x.name==='feline-connected-tail-tip-m007'),
   detail+' tip must terminate on its own connected segment');
 }finally{
  disposeMonsterSculpture(model);
 }
}

for(const id of ['m005','m007','m008','m009','m010']){
 for(const detail of ['source','high','low']){
  const model=createMonsterModel(MONSTER_BY_ID[id],{detail});
  try{
   const p=model.userData.pivots,cat=id!=='m005';
   assert.equal(p.tail.parent,p.torso,id+' '+detail+' tail must follow croup');
   assert.equal(p.tailMid.parent,p.tail,id+' '+detail+' middle must follow root');
   assert.equal(p.tailTip.parent,p.tailMid,id+' '+detail+' tip must follow middle');
   for(const [parent,name] of [
    [p.tail,cat?'feline-rooted-tail-'+id:'m005-rooted-caudal-skin'],
    [p.tailMid,cat?'feline-tail-middle-'+id:'m005-middle-caudal-skin']
   ]){
    const hull=parent.getObjectByName(name);
    assert.ok(hull?.isMesh&&hull.geometry.getIndex()?.count>60,
     id+' '+detail+' must render full caudal hull '+name);
    assert.equal(hull.userData.closedAnatomicalHull,true,
     id+' '+detail+' tail needs a 3D cap at each section end');
   }
   for(const action of ['idle','walk','run','attack']){
    startMonsterAction(model,action,0);
    animateMonsterModel(model,action==='attack'?.4:.22);
    model.updateMatrixWorld(true);
    const tip=p.tailTip.getWorldPosition(new THREE.Vector3());
    const scale=model.userData.homeScale||1;
    assert.ok(tip.y>.08*scale,
     id+' '+detail+' '+action+' tail tip must stay above the ground');
   }
   if(cat){
    const nose=model.getObjectByName('feline-master-rhinarium-'+id);
    assert.equal(nose?.userData.felineNoseForwardOffset,.022);
    assert.ok(model.getObjectByName('feline-master-nostril-L'));
    assert.ok(model.getObjectByName('feline-master-nostril-R'));
    const whiskers=model.getObjectByName('feline-long-vibrissae-'+id);
    if(detail==='low')assert.equal(whiskers,undefined,
      id+' crowd LOD should not allocate whiskers');
    else{
     assert.equal(whiskers?.userData.felineWhiskers,8);
     assert.equal(whiskers.parent,p.head,
      id+' whisker roots must move with the head');
    }
   }
  }finally{disposeMonsterSculpture(model);}
 }
}

console.log('m005 and feline tail hulls, actions, noses and whiskers: PASS');
