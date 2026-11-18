import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {MONSTER_BY_ID} from '../src/monster-catalog.js';
import {createMonsterModel,disposeMonsterSculpture} from '../src/monster-geometry.js';
import {startMonsterAction,animateMonsterModel} from '../src/monster-animation.js';
import {SALAMANDER_LINEAGE_REVISION,SALAMANDER_LINEAGE,
 salamanderSkullFromMagma,salamanderTorsoFromMagma}
 from '../src/salamander-lineage-sculpt.js';
import {MAGMA_SALAMANDER_REVISION} from '../src/magma-salamander-sculpt.js';
import {registeredMonsterModel,resolveRegisteredMonsterModel}
 from '../src/creature-game-model-routing.js';

const ids=['m016','m017','m019'];
const otherReptiles=['m018','m020'];
const skullName=id=>id==='m019'?'m019-m001-sourced-closed-cranium':
 id+'-m019-derived-closed-cranium';
const getMeshes=root=>{
 const result=[];root.traverse(obj=>{if(obj.isMesh)result.push(obj)});
 return result;
};

test('m016/m017 share m019 physical source, but retain species-specific morphs',()=>{
 const donor=Array.from({length:11},(_,i)=>({
  z:.45-i*.12,y:(i-5)*.017,rx:.19+i*.011,ry:.15+i*.007
 }));
 const body=Array.from({length:7},(_,i)=>({
  z:.7-i*.2,y:1.3,rx:.40,ry:.36
 }));
 const before=JSON.stringify({donor,body});
 const skull=ids.map(id=>salamanderSkullFromMagma(donor,id));
 const torsos=ids.map(id=>salamanderTorsoFromMagma(body,id));
 assert.equal(JSON.stringify({donor,body}),before,'m001 donor geometry is immutable');
 for(let i=0;i<ids.length;i++){
  assert.equal(skull[i].length,donor.length);
  assert.equal(torsos[i].length,body.length);
  assert(skull[i].every((p,j)=>j===0||p.z<skull[i][j-1].z));
 }
 assert.notDeepEqual(skull[0],skull[1],'swamp and steel skulls cannot be identical');
 assert.notDeepEqual(skull[1],skull[2],'m019 horns alone do not define anatomy');
 assert.notDeepEqual(torsos[0],torsos[1],'flank and shoulder ratios must change');
 assert.equal(Object.keys(SALAMANDER_LINEAGE).length,3);
 assert.throws(()=>salamanderSkullFromMagma(donor,'m018'),/Unsupported/);
});

for(const id of ids){
 for(const detail of ['low','high']){
  test(id+' model is articulated, connected and nonempty at '+detail,()=>{
   const root=createMonsterModel(MONSTER_BY_ID[id],{detail});
   try{
    const piv=root.userData.pivots;
    assert.equal(root.userData.speciesId,id);
    assert.equal(root.userData.salamanderLineageRevision,
     SALAMANDER_LINEAGE_REVISION);
    assert.equal(root.userData.salamanderSourceSpecies,'m019');
    assert.equal(root.userData.salamanderConnectedLimbs,4);
    assert.equal(root.userData.salamanderLegReach,
     SALAMANDER_LINEAGE[id].legReach);
    assert.equal(root.userData.gameModelRevision,
     id==='m019'?MAGMA_SALAMANDER_REVISION:SALAMANDER_LINEAGE_REVISION);
    assert(piv.head&&piv.jaw&&piv.torso&&piv.tail&&piv.tailMid);
    assert.equal(piv.jaw.parent,piv.head,'mandible must turn with skull');
    assert.equal(piv.tail.parent,piv.torso,'tail must pitch with torso');
    assert.equal(piv.tail.scale.z,SALAMANDER_LINEAGE[id].tailLength);
    for(const limb of ['legfrontL','legfrontR','legrearL','legrearR']){
     assert(piv[limb].userData.salamanderShortPlantedLeg,limb);
     assert.equal(piv[limb].scale.y,SALAMANDER_LINEAGE[id].legReach);
     assert.equal(piv[limb.replace('leg','lower')].parent,piv[limb]);
    }
    const meshes=getMeshes(root);
    const nameSet=new Set(meshes.map(m=>m.name));
    assert(nameSet.has(skullName(id)));
    assert(nameSet.has(id+'-grand-horn-L'));
    assert(nameSet.has(id+'-grand-horn-R'));
    assert(nameSet.has(id+'-vertical-pupil-L'));
    assert(nameSet.has(id+'-vertical-pupil-R'));
    assert(nameSet.has(id+'-closed-caudal-root'));
    assert(nameSet.has(id+'-closed-caudal-mid'));
    assert(meshes.some(m=>m.name.startsWith(id==='m019'?
      'm019-lava-ridge-':id+'-rooted-dorsal-crest-')));
    assert(!meshes.some(m=>/wolf-mane|canine-fur/.test(m.name)));
    if(id!=='m019')
     assert(!meshes.some(m=>m.name.startsWith('m019-')),
      'derivative must not reuse another species\' visual objects');
    if(detail==='high'){
     assert(nameSet.has(id+'-nostril-L'));
     assert(nameSet.has(id+'-nostril-R'));
     assert(nameSet.has(id+'-head-anchored-throat'));
     assert(meshes.some(m=>m.name.startsWith(id+'-embedded-scale-')));
    }
    for(const mesh of meshes){
     const pos=mesh.geometry?.getAttribute('position');
     assert(pos?.count>0,mesh.name+' is a label, not real geometry');
     for(const i of [0,Math.floor(pos.count/2),pos.count-1])
      assert(Number.isFinite(pos.getX(i))&&Number.isFinite(pos.getY(i))&&
       Number.isFinite(pos.getZ(i)),mesh.name+' contains invalid vertices');
    }
    startMonsterAction(root,'run',0);
    for(const time of [0,.12,.33,.62,.9])animateMonsterModel(root,time);
    startMonsterAction(root,'attack',1);
    animateMonsterModel(root,1.13);
    root.updateMatrixWorld(true);
    const bounds=new THREE.Box3().setFromObject(root);
    assert(!bounds.isEmpty(),'geometry must have physical bounds');
    assert(bounds.max.y-bounds.min.y>.2,'not a flattened sprite');
   }finally{disposeMonsterSculpture(root)}
  });
 }
 test(id+' registered battlefield and summon routes are revisioned',()=>{
  const registered=registeredMonsterModel(id);
  const summon=registeredMonsterModel('summon_'+id);
  assert.equal(registered,summon);
  assert.equal(registered.version,id==='m019'?
   MAGMA_SALAMANDER_REVISION:SALAMANDER_LINEAGE_REVISION);
  assert.equal(registered.mobileVisualApproved,false,'visual signoff not inferred');
  assert.equal(resolveRegisteredMonsterModel(id,{
   storage:{getItem:()=>null},detail:'low',allowExternal:true
  }).externalSource,null,'crowd LOD stays procedural');
 });
}

test('hydra and sea leviathan retain their specialized silhouettes',()=>{
 for(const id of otherReptiles){
  const root=createMonsterModel(MONSTER_BY_ID[id],{detail:'low'});
  try{
   assert.equal(root.userData.salamanderLineageRevision,undefined);
   assert(!getMeshes(root).some(obj=>obj.name.includes('m019-derived')),
    id+' should not become a four-legged salamander');
  }finally{disposeMonsterSculpture(root)}
 }
});
