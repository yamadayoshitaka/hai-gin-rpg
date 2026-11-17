import test from 'node:test';
import assert from 'node:assert/strict';
import {MONSTER_BY_ID} from '../src/monster-catalog.js';
import {createMonsterModel,disposeMonsterSculpture}
 from '../src/monster-geometry.js';
import {startMonsterAction,animateMonsterModel}
 from '../src/monster-animation.js';
import {copyWolfKingSourceRings,copiedWolfEyeSurfaceZ}
 from '../src/wolf-king-clone-source.js';

const allMeshes=root=>{const items=[];root.traverse(n=>{if(n.isMesh)items.push(n)});return items};
const get=(root,name)=>allMeshes(root).find(n=>n.name===name);
const limbs=['frontL','frontR','rearL','rearR'];

test('wolf copies carve BOTH eye sockets and fit genuine optical disks to skull',()=>{
 for(const id of ['m002','m003','m004']){
  const model=createMonsterModel(MONSTER_BY_ID[id],{detail:'high'});
  try{
   assert.equal(model.userData.clonedCanineEyeSocketsCarved,true,id);
   assert.equal(model.userData.clonedCanineVisibleEyes,2,id);
   assert.equal(model.userData.cloneOpticalDepthFromSurface,true,id);
   const skull=get(model,'organic-cranium-'+id);
   assert.equal(skull.userData.canineEyeSocketsRecessed,true);
   assert.ok(skull.userData.canineEyeSocketSculptedVertices>0,id+' no carved eye sockets');
   const eyeMeshes=allMeshes(model).filter(x=>x.userData.recessedCanineEye);
   assert.ok(eyeMeshes.length>=8,id+' missing iris/pupil/lids');
   const orbits=eyeMeshes.filter(x=>x.name==='beast-orbit');
   const irises=eyeMeshes.filter(x=>x.name==='eye');
   assert.equal(orbits.length,2,id+' both orbits');
   assert.equal(irises.length,2,id+' both irises');
   for(const eye of [...orbits,...irises]){
    assert.ok(Number.isFinite(eye.userData.derivedEyeSurfaceZ));
    assert.ok(Math.abs(eye.position.z-eye.userData.derivedEyeSurfaceZ)<.060,
      id+' eye should fit donor skull, not live at old fixed +Z');
    assert.ok(eye.parent===model.userData.pivots.head);
   }
   assert.ok(irises.every(eye=>eye.scale.x>1.1&&eye.scale.y>1.1));
   assert.equal(allMeshes(model).filter(n=>n.userData.jointSeamSleeve).length,4);
   if(id==='m002'){
    assert.equal(model.userData.m002EyeFrontCorrected,true);
    assert.equal(model.userData.m002OpticalHairClearance,true);
    assert.ok(model.userData.m002HairGuidesKept>900,
      'm002 should retain real cheek coat, not erase the whole face');
   }
   for(const action of ['idle','walk','run','attack']){
    startMonsterAction(model,action,0);
    for(const t of [.09,.22,.38]){
     animateMonsterModel(model,t);
     const p=model.userData.pivots;
     for(const name of limbs)
      assert.ok(Number.isFinite(p['leg'+name].rotation.x));
     assert.equal(orbits[0].parent,p.head,
       'eye must follow animated head, not remain in world space');
    }
   }
  }finally{disposeMonsterSculpture(model)}
 }
});

test('feline mother has visible eyes, cheek-root fur and head-following throat',()=>{
 for(const id of ['m007','m008','m009','m010']){
  const model=createMonsterModel(MONSTER_BY_ID[id],{detail:'high'});
  try{
   const all=allMeshes(model),p=model.userData.pivots;
   assert.ok(model.userData.felineCheekFurRoots>200,id+' face still bald');
   assert.equal(model.userData.felineCheekFurSource,'real-cranium-ring-interpolation');
   const eyeL=get(model,'feline-iris-L'),eyeR=get(model,'feline-iris-R');
   const orbitL=get(model,'feline-master-orbit-L');
   assert.ok(eyeL&&eyeR&&orbitL,'two visible feline irises');
   assert.ok(eyeL.position.z>orbitL.position.z+.014,
    'iris should remain ahead of the shaded socket');
   assert.ok(eyeL.userData.visibleAnteriorIris);
   const collar=get(model,'feline-head-neck-continuity-'+id);
   assert.ok(collar?.isMesh,'neck continuity was only a label');
   assert.equal(collar.parent,p.head,
    'collar must follow head animation, not rigid torso');
   assert.equal(collar.userData.followsHeadPitch,true);
   const headFur=p.head.children.filter(n=>n.isMesh&&n.userData.furStrands>0);
   assert.equal(headFur.length,4,
     'three existing cheek coat batches plus one batched whisker mesh');
    assert.equal(headFur.filter(n=>n.userData.felineWhiskers===8).length,1,
     'whiskers must use exactly one additional draw call');
   for(const action of ['idle','walk','run','attack']){
    startMonsterAction(model,action,0);
    for(const t of [.13,.24,.42]){
     animateMonsterModel(model,t);
     assert.ok([p.head.rotation.x,p.head.rotation.y,p.head.rotation.z]
      .every(Number.isFinite),id+' invalid head motion');
     assert.equal(collar.parent,p.head);
    }
   }
  }finally{disposeMonsterSculpture(model)}
 }
});

test('m005 inherits donor ocular sculpt; m006 cat scalp, without low-LOD hair',()=>{
 for(const id of ['m005','m006']){
  const model=createMonsterModel(MONSTER_BY_ID[id],{detail:'high'});
  try{
   if(id==='m005'){
    assert.equal(model.userData.clonedFromSpecies,'m001');
    assert.equal(model.userData.clonedCanineEyeSocketsCarved,true);
   }else{
    assert.equal(model.userData.clonedFromSpecies,'m001');
    assert.ok(model.userData.felineCheekFurRoots>200);
    assert.equal(model.userData.clonedCanineEyeSocketsCarved,undefined);
   }
  }finally{disposeMonsterSculpture(model)}
 }
 for(const id of ['m002','m007']){
  const low=createMonsterModel(MONSTER_BY_ID[id],{detail:'low'});
  try{
   assert.equal(low.userData.felineCheekFurRoots,undefined);
   assert.equal(low.userData.m002OpticalHairClearance,undefined);
   assert.equal(low.userData.detail,'low');
  }finally{disposeMonsterSculpture(low)}
 }
});
