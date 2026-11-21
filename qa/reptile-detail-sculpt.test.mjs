import assert from 'node:assert/strict';
import test from 'node:test';
import {Vector3} from 'three';
import {MONSTER_BY_ID} from '../src/monster-catalog.js';
import {createMonsterModel,disposeMonsterSculpture} from '../src/monster-geometry.js';
import {animateMonsterModel,startMonsterAction} from '../src/monster-animation.js';
import {registeredMonsterModel} from '../src/creature-game-model-routing.js';

for(const id of ['m016','m017','m019','m020','m048','m050']){
 for(const detail of ['low','high'])test(id+' '+detail+' displays a continuous animated tail',()=>{
  const model=createMonsterModel(MONSTER_BY_ID[id],{detail});
  try{
   assert.equal(model.userData.gameModelRevision,registeredMonsterModel(id).version);
   const p=model.userData.pivots;
   const marine=id==='m020'||id==='m048';
   const tail=model.getObjectByName(id+(marine?'-marine-serpent-skin':'-continuous-caudal-skin'));
   assert.ok(tail?.isSkinnedMesh&&tail.userData.cappedTubularSkin);
   assert.equal(tail.parent,marine?p.torso:p.tail);
   assert.equal(tail.skeleton.bones.length,marine?7:3);
   const vertex=tail.geometry.attributes.position.count-1;
   model.updateMatrixWorld(true);
   const rest=tail.getVertexPosition(vertex,new Vector3());
   startMonsterAction(model,'walk',0);
   animateMonsterModel(model,.31);
   model.updateMatrixWorld(true);
   assert.ok(rest.distanceTo(tail.getVertexPosition(vertex,new Vector3()))>.02);
   model.traverse(mesh=>{
    if(!mesh.isMesh)return;
    const {geometry}=mesh;
    const vertices=geometry.attributes.position.count;
    for(const [name,attribute] of Object.entries(geometry.attributes))
     assert.equal(attribute.count,vertices,mesh.name+' '+name);
    assert.ok(geometry.index?.array.every(i=>i<vertices)??true,mesh.name);
   });
   if(marine){
    assert.ok(p.head.getWorldPosition(new Vector3()).y-p.spineRear.getWorldPosition(new Vector3()).y>1.35);
    assert.equal(model.getObjectByName(id+'-pectoral-sail-L').parent,p.torso);
    assert.equal(model.getObjectByName(id+'-cheek-fin-L').parent,p.head);
    assert.equal(p.jaw.parent,p.head);
    assert.ok(p.spineRear&&!p.legfrontL,'marine body uses undulation');
    assert.equal(model.getObjectByName(id+'-rooted-horn-L').parent,p.head);
    assert.equal(model.getObjectByName(id+'-caudal-fin-R').parent,p.tailTip);
   }else{
    for(const suffix of ['frontL','frontR','rearL','rearR'])
     assert.equal(p['lower'+suffix].parent,p['leg'+suffix]);
   }
  }finally{disposeMonsterSculpture(model);}
 });
}
