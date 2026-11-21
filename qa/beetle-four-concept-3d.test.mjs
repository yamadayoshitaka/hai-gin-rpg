import assert from 'node:assert/strict';
import test from 'node:test';
import {MONSTER_BY_ID} from '../src/monster-catalog.js';
import {createMonsterModel,disposeMonsterSculpture,monsterSculptCacheStats}
 from '../src/monster-geometry.js';
import {BEETLE_CONCEPT_SPECIES,BEETLE_CONCEPT_REVISION}
 from '../src/beetle-concept-upgrade.js';
import {startMonsterAction,animateMonsterModel} from '../src/monster-animation.js';

assert.deepEqual(BEETLE_CONCEPT_SPECIES,['m021','m022','m024','m025']);
const materialCheck=(model,name,finish,kind)=>{
 const mesh=model.getObjectByName(name);
 assert.ok(mesh?.isMesh,'missing actual 3D mesh '+name);
 assert.ok(mesh.geometry?.getAttribute('position')?.count>=3);
 const material=mesh.material;
 assert.ok(material?.isMeshPhysicalMaterial,'non-PBR: '+name);
 assert.equal(material.userData.m024PBR,kind);
 assert.equal(material.userData.scarabPBRSpeciesId,model.userData.speciesId);
 assert.equal(material.userData.m024TextureOrigin,'bundled-deterministic-DataTexture');
 assert.ok(material.map?.isDataTexture);
 assert.ok(material.roughnessMap?.isDataTexture);
 if(finish==='ironPlate')assert.ok(material.metalness>=.75);
 if(finish==='divineGold')assert.ok(material.metalness>=.60);
 if(finish==='crimsonLacquer'||finish==='toxicLacquer')
  assert.ok(material.clearcoat>=.9);
 if(finish==='toxicGlass')assert.ok(material.emissiveIntensity>=.20);
 return mesh;
};
for(const species of BEETLE_CONCEPT_SPECIES)for(const detail of ['low','high']){
 test(species+' four-beetle concept actually builds moving geometry '+detail,()=>{
  const model=createMonsterModel(MONSTER_BY_ID[species],{detail});
  try{
   const p=model.userData.pivots;
   const get=n=>model.getObjectByName(species+'-concept-'+n);
   assert.equal(model.userData.beetleConceptRevision,BEETLE_CONCEPT_REVISION);
   assert.equal(model.userData.beetleConceptReference,
    'four-species-20261121-user-approved-2d');
   for(const side of ['L','R']){
    for(let i=0;i<3;i++){
     assert.ok(p['leg'+side+i+'Femur']);
     assert.ok(p['leg'+side+i+'Patella']);
    }
    const wing=p['wing'+side];
    assert.ok(wing);
    assert.ok(model.getObjectByName(
     (species==='m024'?'m024':species)+'-upper-translucent-wing-'+side));
   }
   assert.equal(p.legL3,undefined,'eight-legged spider not a beetle');
   if(species==='m021'){
    const cover=materialCheck(model,
     species+'-concept-iron-elytra-L-0','ironPlate','chitin');
    assert.equal(cover.parent,p.elytronL);
    assert.equal(get('central-steel-keel')?.parent,p.torso);
    assert.ok(get('rivet-L-0-A'),'missing raised rivet');
    const guard=get('thigh-armor-L-0');
    assert.equal(guard?.parent,p.legL0Femur,'leg plating must move');
    assert.ok(model.getObjectByName(species+'-iron-horn-tip-L'));
   }else if(species==='m022'){
    const lacquer=materialCheck(model,
     species+'-concept-burgundy-overlap-L','crimsonLacquer','chitin');
    assert.equal(lacquer.parent,p.elytronL);
    assert.equal(get('red-dorsal-shell')?.parent,p.torso);
    assert.equal(get('red-cheek-L')?.parent,p.head);
    assert.ok(model.getObjectByName(species+'-central-rhinoceros-horn'));
    assert.ok(model.getObjectByName(species+'-central-horn-tip-L'));
   }else if(species==='m025'){
    const gold=materialCheck(model,
     species+'-concept-gilded-plate-L-0','divineGold','chitin');
    assert.equal(gold.parent,p.elytronL);
    const etching=materialCheck(model,
     species+'-concept-filigree-L-0','divineGold','chitin');
    assert.equal(etching.parent,p.elytronL);
    assert.ok(get('crown-ruby'));
    assert.ok(get('winged-gold-crest-L-0'));
    assert.ok(model.getObjectByName(species+'-solar-horn-tip-L'));
    assert.equal(model.getObjectByName(species+'-solar-horn-L'),undefined);
   }else{
    const pod=materialCheck(model,
     species+'-concept-poison-pod-L-0','toxicGlass','crystal');
    assert.equal(pod.parent,p.elytronL);
    const ridge=materialCheck(model,
     species+'-concept-poison-dorsal-ridge','toxicLacquer','chitin');
    assert.equal(ridge.parent,p.torso);
    assert.ok(get('poison-rim-L-0'));
    assert.ok(get('central-toxic-rhinoceros-horn'));
    assert.ok(get('toxic-horn-tip-L'));
    assert.ok(get('horn-vein-L'));
   }
   const seen=new Set();
   let triangles=0;
   model.traverse(o=>{
    if(!o.isMesh)return;
    seen.add(o.name);
    const positions=o.geometry.getAttribute('position');
    assert.ok(positions?.array.every(Number.isFinite),
     'nonfinite vertices in '+species+':'+o.name);
    for(const attribute of Object.values(o.geometry.attributes))
     assert.equal(attribute.count,positions.count,
      'buffer length mismatch: '+o.name);
    const index=o.geometry.index;
    if(index)assert.ok([...index.array].every(i=>i<positions.count),
     'invalid index: '+o.name);
    triangles+=(index?.count||positions.count)/3;
   });
   assert.ok(triangles<900000,'mobile triangle budget exceeded');
   const count=[...seen].filter(n=>n.startsWith(species+'-concept-')).length;
   assert.ok(count>=10,'new concept not actually represented in mesh tree');
   startMonsterAction(model,'walk',0);
   animateMonsterModel(model,.13);
   const foot=p.legL0.rotation.x,wing=p.wingL.rotation.z;
   animateMonsterModel(model,.45);
   assert.notEqual(p.legL0.rotation.x,foot,'legs frozen');
   assert.notEqual(p.wingL.rotation.z,wing,'wings frozen');
  }finally{
   disposeMonsterSculpture(model);
  }
  assert.equal(monsterSculptCacheStats().activeMaterials,0,
   species+' leaks cache materials');
 });
}
test('mantis and arachnids remain untouched by beetle-only concept meshes',()=>{
 for(const species of ['m023','m026','m027','m028','m029','m030']){
  const model=createMonsterModel(MONSTER_BY_ID[species],{detail:'low'});
  try{
   assert.equal(model.userData.beetleConceptRevision,undefined);
   assert.equal(model.userData.beetleConceptReference,undefined);
  }finally{disposeMonsterSculpture(model);}
 }
});
