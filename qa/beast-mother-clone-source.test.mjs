import test from 'node:test';
import assert from 'node:assert/strict';
import {MONSTER_BY_ID} from '../src/monster-catalog.js';
import {createMonsterModel,disposeMonsterSculpture} from '../src/monster-geometry.js';
import {startMonsterAction,animateMonsterModel}
 from '../src/monster-animation.js';
import {wolfKingCloneMorph,WOLF_KING_DERIVED_IDS,
 copyWolfKingSourceRings,WOLF_CLONE_SOURCE_REVISION}
 from '../src/wolf-king-clone-source.js';
import {felineMasterVariant,FELINE_SOURCE_MODEL}
 from '../src/feline-master-variants.js';

const meshes=m=>{const a=[];m.traverse(n=>{if(n.isMesh)a.push(n)});return a};
const find=(m,n)=>meshes(m).find(x=>x.name===n);
const bounds=m=>{const p=m.geometry.getAttribute('position');let min=Infinity,max=-Infinity;
 for(let i=0;i<p.count;i++){min=Math.min(min,p.getZ(i));max=Math.max(max,p.getZ(i));}
 return {min,max};
};
const limbs=['frontL','frontR','rearL','rearR'];

test('m001 is a copied PHYSICAL donor, not a generic replacement for m002-m004',()=>{
 assert.deepEqual(WOLF_KING_DERIVED_IDS,['m002','m003','m004']);
 const mother=Object.freeze([
  Object.freeze({z:.355,y:-.16,rx:.026,ry:.030}),
  Object.freeze({z:.270,y:-.04,rx:.171,ry:.121}),
  Object.freeze({z:-.335,y:.025,rx:.243,ry:.176}),
  Object.freeze({z:-.635,y:-.032,rx:.050,ry:.062})
 ]);
 for(const id of WOLF_KING_DERIVED_IDS){
  const copy=copyWolfKingSourceRings(mother,id);
  assert.equal(copy.length,mother.length);
  assert.notStrictEqual(copy[0],mother[0],id+' must own independent morphology');
  assert.deepEqual(Object.keys(copy[0]),Object.keys(mother[0]));
  assert.equal(copy[0].rx,mother[0].rx*wolfKingCloneMorph(id).faceX);
  assert.notEqual(copy[0].z,mother[0].z);
 }
 assert.equal(wolfKingCloneMorph('m005'),null,'protected wolf original unchanged');
 assert.equal(felineMasterVariant('m006'),null,'protected panther original unchanged');
});

test('all cloned wolves visibly contain real m001-based skull, nose, joint sleeves',()=>{
 for(const id of WOLF_KING_DERIVED_IDS){
  const model=createMonsterModel(MONSTER_BY_ID[id],{detail:'high'});
  try{
   assert.equal(model.userData.clonedFromSpecies,'m001');
   assert.equal(model.userData.cloneSourceRevision,WOLF_CLONE_SOURCE_REVISION);
   assert.equal(model.userData.cloneMethod,'physical-m001-rings-then-species-morph');
   const skull=find(model,'organic-cranium-'+id);
   const rhinarium=find(model,id==='m002'?'m002-rhinarium':'beast-rhinarium-'+id);
   const bridge=find(model,'beast-continuous-nasal-bridge-'+id);
   assert.ok(skull&&rhinarium&&bridge,id+' needs physical donor topology');
   assert.equal(skull.userData.m001SourceDonor,'M001_CRANIUM_RINGS');
   assert.ok(bounds(rhinarium).max>bounds(bridge).max+.015,
     id+' wet nose must be visibly forward of nasal bridge');
   assert.equal(model.userData.pivots.jaw.parent,model.userData.pivots.head,
     id+' opening mandible must inherit skull pivot');
   const all=meshes(model);
   assert.equal(all.filter(x=>x.userData.jointSeamSleeve).length,4);
   assert.equal(all.filter(x=>x.userData.kneeUpperCover).length,4);
   assert.equal(all.filter(x=>x.userData.kneeLowerCover).length,4);
   for(const name of limbs){
    assert.ok(model.userData.pivots['leg'+name]);
    assert.ok(model.userData.pivots['lower'+name]);
   }
   for(const part of all){
    const a=part.geometry.getAttribute('position');
    assert.ok(a?.array.every(Number.isFinite),id+': '+part.name+' invalid geometry');
   }
   // No support-frame scaling: bone lengths and the attached coat stay aligned
   // on idle/walk/run/attack. Real per-vertex skinning is NOT asserted here.
   for(const action of ['idle','walk','run','attack']){
    startMonsterAction(model,action,0);
    let frozen=null;
    for(const time of [.08,.18,.30,.43]){
     animateMonsterModel(model,time);
     const lengths=limbs.map(n=>model.userData.pivots['leg'+n].scale.y);
     assert.ok(lengths.every(Number.isFinite));
     if(frozen)assert.deepEqual(lengths,frozen,id+' '+action+' stretched bone');
     frozen=lengths;
    }
   }
  }finally{disposeMonsterSculpture(model);}
 }
});

test('m007 is the feline physical mother; m008-m010 inherit nose and attached feet',()=>{
 for(const id of ['m007','m008','m009','m010']){
  const variant=felineMasterVariant(id);
  assert.equal(variant.physicalCloneMother,'m007');
  const model=createMonsterModel(MONSTER_BY_ID[id],{detail:'high'});
  try{
   assert.equal(model.userData.physicalCloneMother,'m007');
   assert.equal(model.userData.felineMasterSource,FELINE_SOURCE_MODEL);
   const nose=find(model,'feline-master-rhinarium-'+id);
   const muzzle=find(model,'feline-master-short-muzzle-'+id);
   assert.ok(nose&&muzzle,'missing source-derived nose and mouth '+id);
   assert.ok(bounds(nose).max>bounds(muzzle).max+.04,
    id+' nasal cartilage must show ahead of light-colored upper lip');
   const fascia=meshes(model).filter(x=>x.userData.donorSurfaceOverlap);
   assert.equal(fascia.length,4,'all four feline ankles need connected surface '+id);
   for(const name of limbs)
    assert.equal(find(model,'feline-ankle-to-toe-fascia-'+name).parent,
      model.userData.pivots['toe'+name]);
   assert.equal(model.userData.pivots.tail.parent,model.userData.pivots.torso,
     'animated tail should follow the moving cat torso');
   for(const action of ['idle','walk','run','attack']){
    startMonsterAction(model,action,0);
    for(const time of [.13,.25,.39]){
     animateMonsterModel(model,time);
     for(const name of limbs){
      const limb=model.userData.pivots['leg'+name];
      assert.ok([limb.rotation.x,limb.rotation.y,limb.scale.y]
       .every(Number.isFinite));
     }
    }
   }
  }finally{disposeMonsterSculpture(model);}
 }
});
