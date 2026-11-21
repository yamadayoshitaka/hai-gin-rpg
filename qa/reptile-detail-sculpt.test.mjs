import assert from 'node:assert/strict';
import test from 'node:test';
import {Box3,Scene,Vector3} from 'three';
import {MONSTER_BY_ID} from '../src/monster-catalog.js';
import {createMonsterModel,disposeMonsterSculpture} from '../src/monster-geometry.js';
import {animateMonsterModel,startMonsterAction} from '../src/monster-animation.js';
import {createRegisteredBattleMonster} from '../src/battle-registered-monster-model.js';
import {createMonsterSummonRenderer} from '../src/monster-summon-renderer.js';
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

for(const [id,target,nativeMinimum] of [['m020',12,10.5],['m048',10,8]]){
 test(id+' elongated body keeps its giant battle and summon scale',()=>{
  const cellSize=1.12;
  const enemy=createRegisteredBattleMonster(MONSTER_BY_ID[id],{detail:'low',cellSize});
  const scene=new Scene(),summons=createMonsterSummonRenderer(scene,{cellSize});
  const lengthOf=obj=>new Box3().setFromObject(obj).getSize(new Vector3()).z;
  try{
   assert.equal(Math.round(lengthOf(enemy.root)*100),Math.round(target*cellSize*100));
   const model=enemy.currentModel();
   const nativeLength=lengthOf(model)/enemy.root.scale.x;
   assert.ok(nativeLength>=nativeMinimum,id+' natural body was not elongated: '+nativeLength);
   const restScale=enemy.root.scale.x;
   enemy.update(.33,'attack');
   enemy.update(.73,'attack');
   assert.equal(enemy.root.scale.x,restScale);
   const entry={id:1,type:'summon_'+id,x:6,z:6};
   summons.sync([entry],0);
   const summon=summons.actualModel(1);
   assert.ok(summon?.userData.seaDragonSilhouette);
   const fitting=summon.parent.parent;
   const summonScale=fitting.scale.x;
   assert.equal(Math.round(nativeLength*summonScale*100),Math.round(target*cellSize*100));
   assert.ok(lengthOf(summon)>target*cellSize*.82,'summon still spans most of its resting length');
   entry.attackStartedAt=.15;
   summons.sync([entry],.5);
   assert.equal(fitting.scale.x,summonScale);
  }finally{enemy.dispose();summons.dispose();}
 });
}
