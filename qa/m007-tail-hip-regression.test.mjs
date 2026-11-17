import assert from 'node:assert/strict';
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
console.log('m007 tail root / articulated continuity / compact hips / planted feet: PASS');
