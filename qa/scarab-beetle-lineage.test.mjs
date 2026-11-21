import assert from 'node:assert/strict';
import test from 'node:test';
import {Box3,Vector3} from 'three';
import {MONSTER_BY_ID} from '../src/monster-catalog.js';
import {createMonsterModel,disposeMonsterSculpture,monsterSculptCacheStats}
 from '../src/monster-geometry.js';
import {startMonsterAction,animateMonsterModel} from '../src/monster-animation.js';
import {registeredMonsterModel} from '../src/creature-game-model-routing.js';
import {BEETLE_DONOR_ID,BEETLE_LINEAGE_IDS,BEETLE_LINEAGE_REVISION,isBeetleLineage}
 from '../src/scarab-beetle-lineage-sculpt.js';
import {M024_PBR_REVISION,m024PBRTextureStats}
 from '../src/m024-scarab-pbr-surface.js?v=m024-shared-beetle-chitin-pbr-v3-20261121';

assert.deepEqual([...BEETLE_LINEAGE_IDS].sort(),['m021','m022','m025']);
assert.equal(BEETLE_DONOR_ID,'m024');
for(const id of ['m023','m026','m027','m028','m029','m030'])
 assert.equal(isBeetleLineage(id),false,id+' must not inherit six-legged beetle rig');

for(const id of BEETLE_LINEAGE_IDS)for(const detail of ['low','high'])
 test(id+' '+detail+' inherits m024 geometry with distinct 3D species identity',()=>{
  const spec=MONSTER_BY_ID[id];
  const model=createMonsterModel(spec,{detail});
  try{
   const byName=name=>model.getObjectByName(name);
   const p=model.userData.pivots;
   assert.equal(model.userData.gameModelRevision,BEETLE_LINEAGE_REVISION);
   assert.equal(registeredMonsterModel(id).version,BEETLE_LINEAGE_REVISION);
   assert.equal(model.userData.beetleDonorId,'m024');
   assert.deepEqual(model.userData.beetleLineage,{
    speciesId:id,theme:{m021:'iron',m022:'fire',m025:'divine'}[id],
    legPairs:3,wingMembranes:4,donor:'m024',
   });
   assert.equal(model.userData.m024ConceptBasedSculpt,undefined,
    'donor identity leaked to target species');
   assert.equal(byName('m024-segmented-armored-thorax'),undefined,
    'donor mesh names must not survive into derived specimens');
   assert.ok(byName(id+'-segmented-armored-thorax')?.userData.closedAnatomicalHull);
   assert.ok(byName(id+'-engraved-beetle-head')?.userData.closedAnatomicalHull);
   assert.equal(byName(id+'-venom-crystal-0'),undefined,
    'poison crystal forest must never be copied');
   assert.equal(byName(id+'-toxic-saliva'),undefined,
    'poison saliva must not remain on non-toxic beetles');
   for(const side of ['L','R']){
    assert.equal(byName(id+'-elytra-shell-'+side)?.parent,p['elytron'+side]);
    assert.equal(byName(id+'-eye-'+side)?.parent,p.head);
    assert.equal(byName(id+'-mandible-'+side)?.parent,p.jaw);
    assert.equal(byName(id+'-curved-antenna-'+side)?.parent,p.head);
    for(let i=0;i<3;i++){
     const prefix='leg'+side+i;
     assert.equal(p[prefix].parent,p.torso);
     assert.equal(p[prefix+'Femur'].parent,p[prefix]);
     assert.equal(p[prefix+'Patella'].parent,p[prefix+'Femur']);
     assert.equal(p[prefix+'Tibia'].parent,p[prefix+'Patella']);
     assert.equal(p[prefix+'Tarsus'].parent,p[prefix+'Tibia']);
     assert.equal(byName(id+'-claw-'+side+'-'+i+'-a')?.parent,p[prefix+'Tarsus']);
    }
    for(const kind of ['upper','lower']){
     const mesh=byName(id+'-'+kind+'-translucent-wing-'+side);
     assert.ok(mesh?.isMesh);
     assert.equal(mesh.parent,p['wing'+side]);
     assert.equal(mesh.material.transparent,true);
     assert.equal(mesh.material.userData.m024PBR,'wing');
     assert.equal(mesh.material.userData.scarabPBRDonorId,'m024');
     assert.equal(mesh.material.userData.scarabPBRSpeciesId,id);
     assert.ok(mesh.material.alphaMap?.isDataTexture);
    }
    const eye=byName(id+'-eye-'+side);
    assert.equal(eye.material.userData.m024PBR,'eye');
    assert.ok(eye.material.clearcoat>.9);
    assert.equal(p['wing'+side].scale.x,
     {m021:.62,m022:.84,m025:1.12}[id]);
   }
   assert.ok(!p.legL3&&!p.legR3,'beetles must have precisely six legs');
   assert.equal(byName('m024-fang-venom-drop-L'),undefined);
   assert.equal(byName(id+'-long-venom-fang-L'),undefined);
   assert.equal(byName(id+'-venom-crystal-1'),undefined);
   const hornName={m021:'iron-charge-horn',m022:'flame-fork-L',
    m025:'solar-central-crown'}[id];
   const mainHorn=byName(id+'-'+hornName);
   assert.ok(mainHorn?.userData.rootedKeratin,'species-specific horn required');
   assert.equal(mainHorn.parent,p.head);
   const carapace=byName(id+'-elytra-shell-L');
   assert.equal(carapace.material.userData.m024PBR,'chitin');
   assert.equal(carapace.material.userData.m024SurfaceRevision,M024_PBR_REVISION);
   assert.ok(carapace.material.map?.isDataTexture);
   assert.ok(carapace.material.roughnessMap?.isDataTexture);
   if(detail==='high')assert.ok(carapace.material.normalMap?.isDataTexture);
   else assert.equal(carapace.material.normalMap,null);
   if(id==='m021'){
    assert.ok(!mainHorn.material.emissiveIntensity,'steel horn must not glow');
   }else if(id==='m022'){
    assert.ok(byName(id+'-flame-fork-R'),'fire beetle needs two flame horns');
    if(detail==='high')assert.ok(mainHorn.material.emissiveIntensity>0);
   }else{
    assert.ok(byName(id+'-solar-horn-L')&&byName(id+'-solar-horn-R'));
    assert.ok(byName(id+'-solar-wing-crest-L'));
   }
   let meshCount=0,triangles=0;
   model.traverse(node=>{
    if(!node.isMesh)return;
    meshCount++;
    const position=node.geometry.getAttribute('position');
    assert.ok(position?.count>2,node.name+' degenerate mesh');
    assert.ok(position.array.every(Number.isFinite),node.name+' invalid vertices');
    for(const attr of Object.values(node.geometry.attributes))
     assert.equal(attr.count,position.count,node.name+' malformed vertex buffer');
    if(node.geometry.index)assert.ok([...node.geometry.index.array]
     .every(i=>i<position.count),node.name+' invalid indices');
    triangles+=(node.geometry.index?.count||position.count)/3;
   });
   assert.ok(meshCount>=70,id+' donor lost shell, limbs or horns');
   assert.ok(triangles<900000,id+' Android polygon budget exceeded');
   model.updateMatrixWorld(true);
   const dimensions=new Box3().setFromObject(model).getSize(new Vector3());
   assert.ok(dimensions.x>1.1&&dimensions.z>1.35,
    'derived beetle no longer has a proper 3D silhouette');
   startMonsterAction(model,'walk',0);
   animateMonsterModel(model,.17);
   const leg=p.legL0.rotation.x,wing=p.wingL.rotation.z;
   animateMonsterModel(model,.48);
   assert.notEqual(p.legL0.rotation.x,leg,'donor leg pivot lost gait');
   assert.notEqual(p.wingL.rotation.z,wing,'donor wing pivot lost motion');
  }finally{disposeMonsterSculpture(model);}
  assert.equal(monsterSculptCacheStats().activeMaterials,0,
   'shared physical materials leaked after disposal');
 });

test('the source scarab keeps its own poison/green crystal silhouette',()=>{
 const model=createMonsterModel(MONSTER_BY_ID.m024,{detail:'low'});
 try{
  assert.equal(model.userData.beetleDonorId,undefined);
  assert.ok(model.userData.m024ConceptBasedSculpt);
  assert.ok(model.getObjectByName('m024-venom-crystal-0'));
  assert.ok(model.getObjectByName('m024-long-venom-fang-L'));
  assert.ok(model.getObjectByName('m024-fang-venom-drop-R'));
 }finally{disposeMonsterSculpture(model);}
});

test('mantis and five spider species retain non-beetle anatomy',()=>{
 for(const id of ['m023','m026','m027','m028','m029','m030']){
  const model=createMonsterModel(MONSTER_BY_ID[id],{detail:'low'});
  try{
   assert.equal(model.userData.beetleDonorId,undefined,id+' was overwritten');
   assert.equal(model.getObjectByName(id+'-elytra-shell-L'),undefined);
   if(id==='m023')assert.ok(model.userData.pivots.raptorialL);
   else assert.ok(model.userData.pivots.legL3,id+' lost fourth leg pair');
  }finally{disposeMonsterSculpture(model);}
 }
});

test('shared chitin/wing PBR atlas is not duplicated for each beetle',()=>{
 const info=m024PBRTextureStats();
 assert.ok(info.atlasCount<=10,'one 5-surface set per LOD must be shared');
 assert.ok(info.textureCount<=30,'atlas reuse must avoid duplicate GPU uploads');
});
