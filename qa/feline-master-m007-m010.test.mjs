import test from 'node:test';
import assert from 'node:assert/strict';
import {MONSTER_BY_ID} from '../src/monster-catalog.js';
import {FELINE_SOURCE_MODEL,FELINE_QUALITY_WAVE_IDS,
 felineMasterVariant,felineAnatomicalSections}
 from '../src/feline-master-variants.js';
import {createMonsterModel,disposeMonsterSculpture}
 from '../src/monster-geometry.js';
import {registeredMonsterModel} from '../src/creature-game-model-routing.js';
import {REFERENCE_CROWN_QUALITY,BEAST_REFERENCE_QUALITY_REVISION,
 referenceBeastTorsoStations,referenceDoubleCoat}
 from '../src/beast-reference-quality.js';

const ids=['m007','m008','m009','m010'];
const mesh=model=>{const all=[];model.traverse(x=>{if(x.isMesh)all.push(x)});return all};
const get=(m,n)=>mesh(m).find(x=>x.name===n);
test('m007 is a lean cat master with independently generated lion/leopard/tiger morphs',()=>{
 assert.deepEqual(FELINE_QUALITY_WAVE_IDS,ids);
 assert.equal(felineMasterVariant('m006'),null,
  'protected original black panther is not a master donor');
 const w=ids.map(id=>felineMasterVariant(id));
 assert.ok(w.every(v=>v.source===FELINE_SOURCE_MODEL));
 assert.ok(w.every(v=>v.qualityDonor==='m001'&&
   v.qualityRevision===BEAST_REFERENCE_QUALITY_REVISION));
 assert.equal(REFERENCE_CROWN_QUALITY.high.rows,53);
 assert.equal(REFERENCE_CROWN_QUALITY.high.columns,17);
 assert.equal(REFERENCE_CROWN_QUALITY.high.layers,2);
 assert.equal(REFERENCE_CROWN_QUALITY.source.rows,72);
 assert.equal(REFERENCE_CROWN_QUALITY.source.layers,3);
 assert.equal(referenceDoubleCoat([{
   root:[.1,.2,.3],mid:[.2,.3,.4],tip:[.3,.4,.5],
   normal:[1,0,0],width:.01
 }]).length,2,'real m001 double-coat recipe must be reused');
 assert.ok(w[0].headWidth<w[1].headWidth);
 assert.ok(w[2].torsoWidth<w[0].torsoWidth);
 assert.ok(w[3].torsoWidth>w[0].torsoWidth);
 assert.ok(w[1].maneLength>w[0].maneLength);
 assert.ok(w[0].saberToothLength>w[1].saberToothLength);
 for(const p of w){
  const stations=felineAnatomicalSections(p);
  assert.equal(stations.length,8);
  assert.deepEqual(stations,referenceBeastTorsoStations({
   width:p.torsoWidth,length:p.torsoLength,
   centerY:p.torsoHeight,shape:'feline'
  }),'cat torso must be a morphological transform of m001 eight stations');
  assert.ok(stations.every((x,i)=>i===0||stations[i-1].z>x.z));
  const record=registeredMonsterModel(p.id);
  assert.equal(record.version,'m001-quality-derived-feline-v4-20261117');
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
   const eyeL=get(model,'feline-iris-L');
   const orbit=get(model,'feline-master-orbit-L');
   assert.ok(orbit&&eyeL.position.z>orbit.position.z,
    'predatory cat iris must project ahead of the skull, not appear as a dot');
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
   assert.equal(model.userData.felineQualityInheritedFrom,'m001');
   assert.equal(model.userData.referenceQualityRevision,
     BEAST_REFERENCE_QUALITY_REVISION);
   assert.equal(model.userData.felineReferenceFurDensityMultiplier,2);
   assert.equal(model.userData.felineReferenceCrownRows,
     REFERENCE_CROWN_QUALITY.high.rows);
   assert.equal(model.userData.felineReferenceCrownLayers,
     REFERENCE_CROWN_QUALITY.high.layers);
   assert.equal(model.userData.felineReferenceSeamCount,4);
   assert.equal(mesh(model).filter(x=>x.userData.m001ReferenceSeam).length,4,
    'm001-style shoulder/hip bridge must be actual skin meshes');
   assert.equal(model.userData.felineMasterVariant,variant.archetype);
   assert.equal(model.userData.felineFaceWidthRatio,variant.headWidth);
   assert.equal(model.userData.felineTorsoWidth,variant.torsoWidth);
   const fur=p.head.children.filter(x=>x.isMesh&&x.userData.furStrands>0);
   assert.equal(fur.length,3,
    'cat source coat should stay merged in 3 shade batches');
   assert.ok(model.userData.felineFurGuides>800,
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
   assert.equal(model.userData.felineReferenceFurDensityMultiplier,undefined);
   assert.equal(model.userData.felineReferenceSeamCount,undefined);
   if(id!=='m006')assert.equal(model.userData.pivots.toefrontL,undefined,
     'low crowd geometry must not allocate high-detail toe groups: '+id);
  }finally{disposeMonsterSculpture(model);}
 }
 const protectedModel=createMonsterModel(MONSTER_BY_ID.m006,{detail:'high'});
 try{
  assert.equal(protectedModel.userData.felineMasterSource,undefined);
  assert.equal(get(protectedModel,'feline-master-rhinarium-m006'),undefined);
  assert.ok(get(protectedModel,'nose'),'original m006 nose remains');
 }finally{disposeMonsterSculpture(protectedModel);}
});
