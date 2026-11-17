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
    'm001-full-mane-'+id,
    'm002 must now inherit actual m001 facial coat; later wolves retain their family crown');
   if(id!=='m002'){
    assert.equal(model.userData.wolfKingDonorFullMane,true,
      'all derived wolves must receive the same full m001 groom recipe');
    assert.equal(model.userData.wolfKingDonorSource,'m001');
    assert.ok(model.userData.wolfKingDonorStrands>1400,
      'a thin dorsal strip is not the wolf king mane');
   }
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
test('m003/m004 wolf mouths use compact opposing dental arcs rather than floating black plates',async()=>{
 for(const id of ['m003','m004']){
  const wolf=createMonsterModel(MONSTER_BY_ID[id],{detail:'high'});
  try{
   const p=wolf.userData.pivots;
   const m=[],collect=[];
   wolf.traverse(n=>{if(n.isMesh)collect.push(n)});
   const tongue=collect.find(n=>n.name==='quadruped-tongue');
   const cavity=collect.find(n=>n.name==='quadruped-oral-cavity');
   assert.ok(tongue&&cavity);
   assert.ok(cavity.geometry.type!=='SphereGeometry',
    id+' old black circular mouth-plate still in scene');
   assert.ok(tongue.position.z<.16,id+' tongue sticks through muzzle');
   assert.ok(collect.filter(n=>n.userData.wolfShortEmbeddedCanine).length===2);
   assert.ok(collect.some(n=>n.name===id+'-upper-incisor-0'));
   assert.ok(collect.some(n=>n.name===id+'-lower-incisor-0'));
   p.head.updateWorldMatrix(true,true);
   const THREE=await import('three');
   const top=new THREE.Vector3(-.013,-.176,.392);
   const bottom=new THREE.Vector3(-.014,-.047,.148);
   for(const action of ['idle','walk','attack']){
    const {startMonsterAction,animateMonsterModel}=
      await import('../src/monster-animation.js');
    startMonsterAction(wolf,action,0);animateMonsterModel(wolf,action==='attack'?.42:.14);
    p.head.updateWorldMatrix(true,true);
    const a=p.head.localToWorld(top.clone());
    const b=p.jaw.localToWorld(bottom.clone());
    assert.ok(a.distanceTo(b)<.35,
      id+' opposing upper/lower teeth detached in '+action);
   }
  }finally{disposeMonsterSculpture(wolf)}
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
