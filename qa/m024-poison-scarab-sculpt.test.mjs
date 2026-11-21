import assert from 'node:assert/strict';
import test from 'node:test';
import {Box3,Vector3} from 'three';
import {MONSTER_BY_ID} from '../src/monster-catalog.js';
import {createMonsterModel,disposeMonsterSculpture} from '../src/monster-geometry.js';
import {startMonsterAction,animateMonsterModel} from '../src/monster-animation.js';
import {registeredMonsterModel} from '../src/creature-game-model-routing.js';
import {M024_SCARAB_REVISION} from '../src/m024-poison-scarab-sculpt.js';
import {M024_PBR_REVISION,m024PBRTextureStats}
 from '../src/m024-scarab-pbr-surface.js?v=m024-shared-beetle-chitin-pbr-v3b-20261121';

for(const detail of ['low','high']){
 test('m024 '+detail+' matches concept-art armor, six limbs, wings and venom',()=>{
  const model=createMonsterModel(MONSTER_BY_ID.m024,{detail});
  try{
   assert.equal(model.userData.gameModelRevision,M024_SCARAB_REVISION);
   assert.equal(registeredMonsterModel('m024').version,M024_SCARAB_REVISION);
   assert.ok(model.userData.m024ConceptBasedSculpt);
   assert.deepEqual(model.userData.m024Anatomy,
    {legPairs:3,wings:4,crystalCrown:true,venomMandibles:2});
   const p=model.userData.pivots,byName=name=>model.getObjectByName(name);
   assert.ok(byName('m024-segmented-armored-thorax').userData.closedAnatomicalHull);
   assert.ok(byName('m024-engraved-beetle-head').userData.closedAnatomicalHull);
   assert.ok(byName('m024-venom-crystal-0')?.userData.rootedKeratin);
   assert.ok(byName('m024-venom-crystal-1')?.userData.rootedKeratin);
   const verifyPBR=(name,kind)=>{
    const mesh=byName(name);
    assert.ok(mesh?.isMesh,name+' missing');
    const material=mesh.material;
    assert.equal(material.isMeshPhysicalMaterial,true,name+' must use PBR');
    assert.equal(material.userData.m024PBR,kind,name+' wrong PBR');
    assert.equal(material.userData.m024SurfaceRevision,M024_PBR_REVISION);
    assert.equal(material.userData.m024TextureResolution,detail==='low'?64:256);
    assert.ok(material.map?.isDataTexture,name+' needs actual albedo texture');
    assert.ok(material.roughnessMap?.isDataTexture,name+' needs actual roughness texture');
    if(detail==='high')assert.ok(material.normalMap?.isDataTexture,
     name+' needs actual normal texture');
    else assert.equal(material.normalMap,null,
     name+' should omit distant normal texture');
    assert.equal(material.userData.m024TextureOrigin,'bundled-deterministic-DataTexture');
    for(const texture of [material.map,material.normalMap,material.roughnessMap]){
     if(!texture)continue;
     assert.equal(texture.image.width,detail==='low'?64:256);
     assert.equal(texture.image.height,detail==='low'?64:256);
     assert.ok(texture.image.data.every(Number.isFinite),name+' corrupt image bytes');
    }
    return material;
   };
   verifyPBR('m024-segmented-armored-thorax','chitin');
   for(let i=0;i<(detail==='low'?4:6);i++){
    const horn=verifyPBR('m024-venom-crystal-'+i,'crystal');
    assert.ok(horn.clearcoat>.85,'crystal surface lost clearcoat');
    assert.ok(horn.roughness<.55,'crystals look matte');
    if(detail==='high')assert.ok(horn.emissiveMap?.isDataTexture,
     'glow should be masked to crystal inclusions');
   }
   for(const side of ['L','R']){
    assert.equal(byName('m024-elytra-shell-'+side)?.parent,p['elytron'+side]);
    assert.ok(byName('m024-long-venom-fang-'+side)?.userData.rootedKeratin);
    assert.equal(byName('m024-long-venom-fang-'+side)?.parent,p.jaw);
    verifyPBR('m024-long-venom-fang-'+side,'enamel');
    const eye=verifyPBR('m024-eye-'+side,'eye');
    assert.ok(eye.clearcoat>.9,'faceted eyes require optical gloss');
    assert.equal(byName('m024-curved-antenna-'+side)?.parent,p.head);
    assert.equal(byName('m024-eye-'+side)?.parent,p.head);
    for(let i=0;i<3;i++){
     const name='leg'+side+i;
     assert.equal(p[name].parent,p.torso);
     assert.equal(p[name+'Femur'].parent,p[name]);
     assert.equal(p[name+'Patella'].parent,p[name+'Femur']);
     assert.equal(p[name+'Tibia'].parent,p[name+'Patella']);
     assert.equal(p[name+'Tarsus'].parent,p[name+'Tibia']);
     assert.ok(byName('m024-knee-chitin-'+side+'-'+i));
     assert.ok(byName('m024-claw-'+side+'-'+i+'-a'));
    }
    const wing=p['wing'+side];
    assert.equal(wing.parent,p.torso);
    for(const kind of ['upper','lower']){
     const membrane=byName('m024-'+kind+'-translucent-wing-'+side);
     assert.equal(membrane.parent,wing);
     assert.equal(membrane.material.transparent,true);
     const wingPBR=verifyPBR(membrane.name,'wing');
     assert.ok(wingPBR.alphaMap?.isDataTexture,'wing lacks veined opacity');
     assert.equal(wingPBR.depthWrite,false,'translucent wing must not occlude itself');
     assert.ok(wingPBR.opacity<1,'wing must be translucent');
     assert.ok(membrane.geometry.getAttribute('position').count>10);
    }
    assert.ok(byName('m024-upper-wing-vein-'+side+'-0'));
   }
   assert.ok(!p.legL3&&!p.legR3,'beetles have exactly six legs');
   assert.ok(!p.raptorialL,'m024 must not inherit mantis claws');
   let meshes=0,vertices=0,faces=0;
   model.traverse(node=>{
    if(!node.isMesh)return;
    meshes++;
    const geometry=node.geometry,position=geometry.getAttribute('position');
    assert.ok(position?.count>=3,node.name+' has no geometry');
    assert.ok(position.array.every(Number.isFinite),node.name+' invalid vertices');
    for(const attribute of Object.values(geometry.attributes))
     assert.equal(attribute.count,position.count,node.name+' mismatched attributes');
    assert.ok(!geometry.index||Array.from(geometry.index.array).every(i=>i<position.count),
     node.name+' invalid triangle index');
    vertices+=position.count;
    faces+=(geometry.index?.count||position.count)/3;
   });
   assert.ok(meshes>=80,'missing sculpted anatomical parts: '+meshes);
   assert.ok(faces<900000,'mobile triangle ceiling breached: '+faces);
   const textures=m024PBRTextureStats();
   assert.equal(textures.atlasCount,detail==='low'?5:10,
    'exactly 5 reusable material atlases per quality tier');
   assert.ok(textures.textureCount>=11&&textures.textureCount<=30,
    'unbounded texture churn in mobile gallery: '+textures.textureCount);
   model.updateMatrixWorld(true);
   const bounds=new Box3().setFromObject(model).getSize(new Vector3());
   assert.ok(bounds.x>1.6&&bounds.z>1.7,'short or missing creature silhouette');
   assert.ok(bounds.y>1.55,'lost toxic crown or standing legs');
   startMonsterAction(model,'walk',0);
   animateMonsterModel(model,.16);
   const wingAngle=p.wingL.rotation.z,legAngle=p.legL0.rotation.x;
   animateMonsterModel(model,.51);
   assert.notEqual(p.wingL.rotation.z,wingAngle,'wing pivots must flap');
   assert.notEqual(p.legL0.rotation.x,legAngle,'six-legged gait must articulate');
  }finally{
   disposeMonsterSculpture(model);
  }
 });
}

test('mantis and eight-legged spiders retain their original family anatomy',()=>{
 for(const id of ['m023','m026','m027','m028','m029','m030']){
  const model=createMonsterModel(MONSTER_BY_ID[id],{detail:'low'});
  try{
   assert.equal(model.userData.m024ConceptBasedSculpt,undefined,id+' was overwritten');
   assert.equal(model.getObjectByName('m024-venom-crystal-0'),undefined);
   assert.equal(model.userData.speciesId,id);
  }finally{disposeMonsterSculpture(model);}
 }
});
