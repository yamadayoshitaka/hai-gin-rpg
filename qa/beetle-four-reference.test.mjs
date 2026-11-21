import assert from 'node:assert/strict';
import test from 'node:test';
import {MONSTER_BY_ID} from '../src/monster-catalog.js';
import {createMonsterModel,disposeMonsterSculpture,monsterSculptCacheStats}
 from '../src/monster-geometry.js';
import {BEETLE_CONCEPT_SPECIES,BEETLE_CONCEPT_REVISION}
 from '../src/beetle-concept-upgrade.js';

assert.deepEqual([...BEETLE_CONCEPT_SPECIES],['m021','m022','m024','m025']);

const cases={
 m021:{part:'central-steel-keel',surface:'chitin',metal:.70,
  horn:'iron-charge-horn',tip:'iron-horn-tip',wing:'#bb835b'},
 m022:{part:'burgundy-overlap-L',surface:'chitin',metal:0,
  horn:'central-rhinoceros-horn',tip:'central-horn-tip',wing:'#ec914b'},
 m024:{part:'poison-pod-L-0',surface:'crystal',metal:0,
  horn:'concept-central-toxic-rhinoceros-horn',
  tip:'concept-toxic-horn-tip',wing:'#c0d98a'},
 m025:{part:'gilded-plate-L-0',surface:'chitin',metal:.60,
  horn:'solar-central-crown',tip:'solar-horn-tip',wing:'#f9d36f'},
};
for(const detail of ['low','high'])for(const id of BEETLE_CONCEPT_SPECIES)
 test(id+' '+detail+' has actual 3D armor, central horn and wings from reference',()=>{
  const model=createMonsterModel(MONSTER_BY_ID[id],{detail});
  try{
   const p=model.userData.pivots,cfg=cases[id],byName=n=>model.getObjectByName(n);
   assert.equal(model.userData.beetleConceptRevision,BEETLE_CONCEPT_REVISION);
   assert.equal(model.userData.beetleConceptReference,
    'four-species-20261121-user-approved-2d');
   const part=byName(id+'-concept-'+cfg.part);
   assert.ok(part?.isMesh,'reference-specific armor must be actual mesh');
   assert.ok(part.geometry.getAttribute('position').count>10);
   assert.equal(part.material.userData.m024PBR,cfg.surface);
   assert.ok(part.material.map?.isDataTexture);
   assert.ok(part.material.roughnessMap?.isDataTexture);
   if(cfg.metal>.0)assert.ok(part.material.metalness>=cfg.metal);
   const main=byName(id+'-'+cfg.horn);
   assert.ok(main?.userData.rootedKeratin,'central horn not present');
   assert.equal(main.parent,p.head);
   assert.ok(Math.abs(main.geometry.userData.root[0])<.001,
    'central horn must originate at forehead center X=0');
   for(const side of ['L','R']){
    const tip=byName(id+'-'+cfg.tip+'-'+side);
    assert.ok(tip?.userData.rootedKeratin,'central horn fork missing '+side);
    assert.equal(tip.parent,p.head,'fork must follow animated head');
    assert.ok(Math.abs(tip.geometry.userData.root[0])<.001,
     'fork must grow from same central horn stem');
    assert.ok(p['wing'+side]&&p['leg'+side+'0']&&p['leg'+side+'2'],
     'beetle rig must preserve three pairs of legs and flapping wings');
    const wing=byName(id+'-upper-translucent-wing-'+side);
    assert.ok(wing?.isMesh&&wing.material.alphaMap?.isDataTexture,
     'must retain genuine veined translucent membranes');
   }
   assert.equal(p.legL3,undefined,'beetles do not have spider legs');
   if(id==='m021'){
    assert.ok(byName('m021-concept-rivet-L-0-A'),'missing riveted steel');
    assert.ok(byName('m021-concept-thigh-armor-L-0'));
    assert.ok(part.material.metalness>.7,'steel must read as metal');
   }
   if(id==='m022'){
    assert.ok(byName('m022-concept-red-dorsal-shell'));
    assert.ok(part.material.clearcoat>.9,'red lacquer must shine');
   }
   if(id==='m025'){
    assert.ok(byName('m025-concept-gold-crown-R'));
    assert.ok(byName('m025-concept-crown-ruby'));
    assert.ok(byName('m025-concept-horn-engraving-L'),
     'real 3D gold linework must be on the single horn');
    assert.ok(byName('m025-concept-winged-gold-crest-L-0'));
    assert.ok(byName('m025-concept-leg-ruby-L-0')||detail==='low');
    assert.ok(part.material.metalness>.60);
   }
   if(id==='m024'){
    assert.ok(byName('m024-concept-poison-pod-R-0'));
    assert.ok(byName('m024-concept-horn-vein-L'));
    assert.ok(part.material.emissiveIntensity>.15,'sacs must glow green');
    assert.equal(part.material.userData.m024PBR,'crystal');
    assert.ok(byName('m024-venom-crystal-0'),
     'smaller original poison crystals must remain');
   }
   let triangles=0;
   model.traverse(node=>{
    if(!node.isMesh)return;
    const position=node.geometry.getAttribute('position');
    assert.ok(position?.array.every(Number.isFinite),
     node.name+' contains invalid position');
    assert.ok(node.geometry.getAttribute('normal')?.array.every(Number.isFinite),
     node.name+' contains invalid normals');
    triangles+=(node.geometry.index?.count||position.count)/3;
   });
   assert.ok(triangles<900000,'mobile polygon budget breached: '+triangles);
  }finally{
   disposeMonsterSculpture(model);
  }
  assert.equal(monsterSculptCacheStats().activeMaterials,0,
   'new decorative mesh material leaked after disposal');
 });
