import test from 'node:test';
import assert from 'node:assert/strict';
import {MONSTER_BY_ID} from '../src/monster-catalog.js';
import {createMonsterModel,disposeMonsterSculpture}
 from '../src/monster-geometry.js';

test('first quality wave physically changes m002/m003/m004, not only metadata',()=>{
 for(const id of ['m002','m003','m004']){
  const model=createMonsterModel(MONSTER_BY_ID[id],{detail:'high'});
  try{
   assert.equal(model.userData.referenceGroomWave,
    id==='m002'?'m001-source-m002':'canine-m002-m004',
    'm002 must now inherit actual m001 facial coat; later wolves retain their family crown');
   const head=model.userData.pivots.head;
   const coats=head.children.filter(x=>x.isMesh&&x.userData.furStrands>0);
   assert.equal(coats.length,3,
    'keep three shade batches, not thousands of separate fur meshes: '+id);
   const total=coats.reduce((sum,x)=>sum+x.userData.furStrands,0);
   assert.ok(total>650,
    'new anatomical crown needs real geometry on model '+id+', got '+total);
   const skull=head.children.find(x=>x.name==='organic-cranium-'+id);
   assert.ok(skull&&skull.geometry?.getAttribute('position'),
    'head groom needs existing anatomical surface');
   const hairs=coats.flatMap(coat=>{
    const v=coat.geometry.getAttribute('position'),result=[];
    for(let i=0;i+4<v.count;i+=5){
     const x=(v.getX(i)+v.getX(i+1))*.5;
     const y=(v.getY(i)+v.getY(i+1))*.5;
     const z=(v.getZ(i)+v.getZ(i+1))*.5;
     if(y>.19&&y<.295&&z>-.35&&z<.27&&z-v.getZ(i+4)>.045)
      result.push({x,z});
    }
    return result;
   });
   assert.ok(hairs.length>120,'crown needs actual rearward hair: '+id);
   assert.ok(hairs.some(h=>h.x<-.07)&&hairs.some(h=>h.x>.07),
    'both sides need a natural rear-directed flow: '+id);
  }finally{disposeMonsterSculpture(model);}
 }
});
test('low LOD and m005/m006 protected donors are not modified',()=>{
 for(const id of ['m002','m003','m004','m005','m006']){
  const low=createMonsterModel(MONSTER_BY_ID[id],{detail:'low'});
  try{
   assert.equal(low.userData.referenceGroomWave,undefined);
   assert.equal(low.userData.detail,'low');
  }finally{disposeMonsterSculpture(low);}
 }
 for(const id of ['m005','m006']){
  const high=createMonsterModel(MONSTER_BY_ID[id],{detail:'high'});
  try{assert.equal(high.userData.referenceGroomWave,undefined);}
  finally{disposeMonsterSculpture(high);}
 }
});
