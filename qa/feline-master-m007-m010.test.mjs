import test from 'node:test';
import assert from 'node:assert/strict';
import {MONSTER_BY_ID} from '../src/monster-catalog.js';
import {FELINE_SOURCE_MODEL,FELINE_QUALITY_WAVE_IDS,
 felineMasterVariant,felineAnatomicalSections}
 from '../src/feline-master-variants.js';
import {createMonsterModel,disposeMonsterSculpture}
 from '../src/monster-geometry.js';
import {registeredMonsterModel} from '../src/creature-game-model-routing.js';

const ids=['m007','m008','m009','m010'];
const mesh=model=>{const all=[];model.traverse(x=>{if(x.isMesh)all.push(x)});return all};
const get=(m,n)=>mesh(m).find(x=>x.name===n);
test('m007 is a lean cat master with independently generated lion/leopard/tiger morphs',()=>{
 assert.deepEqual(FELINE_QUALITY_WAVE_IDS,ids);
 assert.equal(felineMasterVariant('m006'),null,
  'protected original black panther is not a master donor');
 const w=ids.map(id=>felineMasterVariant(id));
 assert.ok(w.every(v=>v.source===FELINE_SOURCE_MODEL));
 assert.ok(w[0].headWidth<w[1].headWidth);
 assert.ok(w[2].torsoWidth<w[0].torsoWidth);
 assert.ok(w[3].torsoWidth>w[0].torsoWidth);
 assert.ok(w[1].maneLength>w[0].maneLength);
 assert.ok(w[0].saberToothLength>w[1].saberToothLength);
 for(const p of w){
  const stations=felineAnatomicalSections(p);
  assert.equal(stations.length,8);
  assert.ok(stations.every((x,i)=>i===0||stations[i-1].z>x.z));
  const record=registeredMonsterModel(p.id);
  assert.equal(record.version,'feline-m007-master-v1-20261117');
  assert.equal(record.mobileVisualApproved,false,
   'Android visual signoff is not implied by geometry QA');
 }
});
test('four actual 3D feline sculpts have narrow heads and continuous cat anatomy',()=>{
 const records=[];
 for(const id of ids){
  const model=createMonsterModel(MONSTER_BY_ID[id],{detail:'high'});
  try{
   const p=model.userData.pivots,variant=felineMasterVariant(id);
   const head=get(model,'organic-cranium-'+id);
   const bridge=get(model,'feline-master-short-muzzle-'+id);
   const rhinarium=get(model,'feline-master-rhinarium-'+id);
   const jaw=get(model,'feline-master-mandible-'+id);
   const earL=get(model,'feline-master-ear-root-L');
   const eyeL=get(model,'feline-master-iris-L');
   const saber=get(model,'feline-master-upper-canine-'+id+'-L');
   const body=get(model,'species-shoulder-rib-pelvis-'+id);
   assert.ok(head&&bridge&&rhinarium&&jaw&&earL&&eyeL&&saber&&body,
    'all major cat parts must exist as actual source meshes: '+id);
   assert.equal(jaw.parent,p.jaw);
   assert.equal(p.jaw.parent,p.head,
    'jaw must turn together with the cat head rather than floating');
   assert.ok(!mesh(model).some(x=>/horn-root-socket/.test(x.name||'')),
    'do not put generic variant-2 goat horns on the lion');
   assert.equal(model.userData.felineMasterSource,FELINE_SOURCE_MODEL);
   assert.equal(model.userData.felineMasterVariant,variant.archetype);
   assert.equal(model.userData.felineFaceWidthRatio,variant.headWidth);
   assert.equal(model.userData.felineTorsoWidth,variant.torsoWidth);
   const fur=p.head.children.filter(x=>x.isMesh&&x.userData.furStrands>0);
   assert.equal(fur.length,3,
    'cat source coat should stay merged in 3 shade batches');
   assert.ok(model.userData.felineFurGuides>220,
    'cat hair must be rooted in 3D on cranial surface');
   for(const limb of ['frontL','frontR','rearL','rearR']){
    assert.ok(get(model,'beast-upper-limb-leg'+limb)||get(model,'beast-upper-limb-'+limb),
      'cat upper limb must be a lofted source mesh: '+id+' '+limb);
    assert.ok(p['toe'+limb]?.userData.felinePad,
      'paws must have articulated digitigrade toe pads: '+id+' '+limb);
   }
   const pos=rhinarium.geometry.getAttribute('position');
   let noseHalf=0;
   for(let i=0;i<pos.count;i++)noseHalf=Math.max(noseHalf,Math.abs(pos.getX(i)));
   assert.ok(Math.abs(noseHalf-variant.noseWidth)<.007,
    'wet nose must match each feline master proportion: '+id);
   records.push({id,noseHalf,headWidth:variant.headWidth,
      torsoWidth:variant.torsoWidth,fur:fur.reduce((n,x)=>n+x.userData.furStrands,0)});
  }finally{disposeMonsterSculpture(model);}
 }
 assert.ok(records.find(r=>r.id==='m009').torsoWidth <
    records.find(r=>r.id==='m008').torsoWidth*.85);
});
test('protected m006 and low LOD remain free of new heavy feline coat',()=>{
 for(const id of ['m006',...ids]){
  const model=createMonsterModel(MONSTER_BY_ID[id],{detail:'low'});
  try{
   assert.equal(model.userData.felineFurGuides,undefined);
   assert.equal(model.userData.felineMasterSource,undefined);
  }finally{disposeMonsterSculpture(model);}
 }
 const protectedModel=createMonsterModel(MONSTER_BY_ID.m006,{detail:'high'});
 try{
  assert.equal(protectedModel.userData.felineMasterSource,undefined);
  assert.equal(get(protectedModel,'feline-master-rhinarium-m006'),undefined);
  assert.ok(get(protectedModel,'nose'),'original m006 nose remains');
 }finally{disposeMonsterSculpture(protectedModel);}
});
