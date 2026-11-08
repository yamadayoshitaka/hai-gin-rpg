import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {CREATURE_VISUAL_SPECS,buildCombatObjectGeometry} from '../src/combat-creature-geometry.js';

/**
 * Stage-1 SOURCE visual geometry checks, NOT playable mobile LOD budgets.
 * Never reject a high-detail master solely for having many vertices.
 * Existing separate battle/mobile tests may still enforce performance caps.
 */
test('all eight summon source references construct finite readable anatomy with actual eyes',()=>{
 assert.equal(Object.keys(CREATURE_VISUAL_SPECS).length,8);
 const stats=[];
 for(const [type,spec] of Object.entries(CREATURE_VISUAL_SPECS)){
  const parts=buildCombatObjectGeometry(type,{detail:'high'});
  try{
   assert.ok(parts.core,type+' has no core anatomy');
   assert.ok(parts.eyes,type+' has no distinct eyes');
   let meshCount=0,vertices=0,triangles=0;
   const coreBox=new THREE.Box3();
   for(const [part,geometry] of Object.entries(parts)){
    assert.ok(geometry?.isBufferGeometry,type+' '+part+' not mesh geometry');
    const p=geometry.getAttribute('position');
    assert.ok(p?.count>0,type+' '+part+' empty');
    for(let i=0;i<p.count;i++){
     const x=p.getX(i),y=p.getY(i),z=p.getZ(i);
     assert.ok(Number.isFinite(x)&&Number.isFinite(y)&&Number.isFinite(z),
       type+' '+part+' has non-finite vertex '+i);
    }
    if(part==='core'){geometry.computeBoundingBox();coreBox.copy(geometry.boundingBox)}
    vertices+=p.count;triangles+=(geometry.getIndex()?.count??p.count)/3;meshCount++;
   }
   const dim=coreBox.getSize(new THREE.Vector3());
   assert.ok(dim.y>.1&&dim.x>.1&&dim.z>.1,type+' has flat/missing torso');
   assert.ok(meshCount>=3&&vertices>1000,type+' detailed geometry disappeared');
   assert.ok(spec.anatomy,type+' missing anatomy declaration');
   if(type==='horse')assert.ok(parts.legFrontL&&parts.legBackR&&parts.equipment,
      'horse needs legs and saddle as distinct anatomy/equipment');
   if(['dragon','elder_dragon','wyvern','dragon_lord'].includes(type))
    assert.ok(parts.wingL&&parts.wingR,type+' needs paired wings');
   stats.push({type,meshCount,vertices,triangles:Math.round(triangles)});
  }finally{
   for(const geometry of Object.values(parts))geometry.dispose();
  }
 }
 console.log('STAGE1_CREATURE_SOURCE_GEOMETRY '+JSON.stringify(stats));
});
test('highest built-in summon detail remains richer than its gameplay low LOD',()=>{
 for(const type of Object.keys(CREATURE_VISUAL_SPECS)){
  const high=buildCombatObjectGeometry(type,{detail:'high'});
  const low=buildCombatObjectGeometry(type,{detail:'low'});
  try{
   const count=parts=>Object.values(parts).reduce((n,g)=>n+g.getAttribute('position').count,0);
   assert.ok(count(high)>count(low),type+' source inspection must preserve finer shape');
   // There is deliberately NO maximum polygon count for source masters.
  }finally{
   for(const geometry of [...Object.values(high),...Object.values(low)])geometry.dispose();
  }
 }
});
