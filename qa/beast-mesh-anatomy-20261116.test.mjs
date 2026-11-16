import assert from 'node:assert/strict';
import {MONSTER_BY_ID} from '../src/monster-catalog.js';
import {createMonsterModel,disposeMonsterSculpture} from '../src/monster-geometry.js';

const remeshed=['m001','m002','m003','m004'];
for(const id of remeshed){
 const model=createMonsterModel(MONSTER_BY_ID[id],{detail:'high'});
 try{
  const meshes=[];
  model.traverse(node=>{if(node.isMesh)meshes.push(node);});
  const limbs=meshes.filter(m=>m.userData.anatomicalLimb);
  assert.equal(limbs.length,8,id+' must have continuous upper and lower muscle shells');
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
