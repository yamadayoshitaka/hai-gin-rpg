import assert from 'node:assert/strict';
import {MONSTER_BY_ID} from '../src/monster-catalog.js';
import {createMonsterModel,disposeMonsterSculpture} from '../src/monster-geometry.js';
import {startMonsterAction,animateMonsterModel} from '../src/monster-animation.js';

const remeshed=['m001','m002','m003','m004'];
for(const id of remeshed){
 const model=createMonsterModel(MONSTER_BY_ID[id],{detail:'high'});
 try{
  const meshes=[];
  model.traverse(node=>{if(node.isMesh)meshes.push(node);});
  const limbs=meshes.filter(m=>m.userData.anatomicalLimb);
  assert.equal(limbs.length,8,id+' must have continuous upper and lower muscle shells');
  // The reference target is a long wolf snout and flexed digitigrade limbs,
  // never an attached white muzzle sphere or straight tubular legs.
  const snout=meshes.filter(m=>m.name==='beast-continuous-nasal-bridge-'+id);
  const jaw=meshes.filter(m=>m.name==='beast-integrated-mandible-'+id);
  assert.equal(snout.length,1,id+' must have a continuous authored nose bridge');
  assert.equal(jaw.length,1,id+' must have one shaped lower jaw instead of stacked balls');
  assert.ok(snout[0].userData.axialAnatomy,id+' snout must contain real cross-section geometry');
  const nasal=meshes.filter(m=>m.name===(id==='m001'?'wolf-nasal-cartilage':'beast-rhinarium-'+id));
  assert.equal(nasal.length,1,id+' rhinarium must not duplicate a round nose cap');
  for(const limb of limbs){
    const a=limb.geometry.getAttribute('position');
    let zMin=Infinity,zMax=-Infinity;
    for(let j=2;j<a.array.length;j+=3){
      zMin=Math.min(zMin,a.array[j]);zMax=Math.max(zMax,a.array[j]);
    }
    assert.ok(zMax-zMin>.12,id+' limb must contain a visible bend, not a straight column');
  }
  if(id==='m001'||id==='m002'){
    const p=model.userData.pivots;
    for(const side of ['L','R'])for(const segment of ['front','rear']){
      const name=segment+side;
      assert.ok(p['beastHock'+name]?.isGroup,id+' real hock/wrist missing '+name);
      assert.ok(p['beastToe'+name]?.isGroup,id+' metatarsal toe pivot missing '+name);
    }
    assert.ok(p.beastHockrearL.position.z<-.11,
      'Hind hock must sit behind the knee in the bind pose');
    assert.ok(p.beastToerearL.position.z>.16,
      'Hind foot needs a forward-projecting metatarsal');
    startMonsterAction(model,'walk',0);
    animateMonsterModel(model,.19);
    const first=p.beastHockrearL.rotation.x;
    animateMonsterModel(model,.49);
    assert.notEqual(p.beastHockrearL.rotation.x,first,
      id+' rear hock must flex during locomotion');
  }
  const keratin=meshes.filter(m=>m.userData.rootedKeratin);
  assert.ok(keratin.length>=11,id+' must have physically curved dorsal horns and canines');
  assert.equal(meshes.filter(m=>m.name==='beast-pupil').length,2,
    id+' needs pupils inside the existing eye sockets');
  assert.equal(meshes.filter(m=>m.name==='beast-corneal-glint').length,2,
    id+' needs two wet highlights on the iris surface');
  assert.ok(meshes.filter(m=>m.userData.furStrands).length>=6,
    id+' needs separate groomed fur batches for anatomy and articulated limbs');
  for(const mesh of [...limbs,...keratin]){
   assert.ok(mesh.geometry.getAttribute('position').array.every(Number.isFinite),
     id+' has non-finite anatomical geometry');
   assert.equal(mesh.geometry.getAttribute('normal').count,
     mesh.geometry.getAttribute('position').count,
     id+' has missing surface normals');
  }
  for(const leg of ['frontL','frontR','rearL','rearR'])
   assert.ok(model.userData.pivots['lower'+leg],id+' missing animated lower joint '+leg);
 }finally{disposeMonsterSculpture(model);}
}
// PR #345 protects the old ancient wolf; the mesh upgrade must not touch it.
const protectedWolf=createMonsterModel(MONSTER_BY_ID.m005,{detail:'high'});
try{
 let changed=0;
 protectedWolf.traverse(n=>{if(n.userData.anatomicalLimb||n.userData.rootedKeratin)changed++;});
 assert.equal(changed,0,'m005 protected source mesh must remain unchanged');
}finally{disposeMonsterSculpture(protectedWolf);}
console.log('Beast anatomical remesh: four species, eyes, fangs, horns, limbs, coat, protected m005 PASS');
