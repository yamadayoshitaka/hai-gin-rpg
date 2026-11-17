import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {MONSTER_BY_ID} from '../src/monster-catalog.js';
import {createMonsterModel,disposeMonsterSculpture} from '../src/monster-geometry.js';
import {startMonsterAction,animateMonsterModel} from '../src/monster-animation.js';
import {AVIAN_REFRESH_IDS,AVIAN_REALISM_REVISION,avianProfile}
 from '../src/avian-guardian-sculpt.js';

const meshes=root=>{
 const out=[];root.traverse(node=>{if(node.isMesh)out.push(node);});
 return out;
};
const triangles=root=>meshes(root).reduce((acc,m)=>{
 const positions=m.geometry.getAttribute('position');
 assert.ok(positions?.count>2,m.name+' needs actual vertices');
 for(const n of positions.array)assert.ok(Number.isFinite(n),
   m.name+' has broken vertex coordinates');
 const n=m.geometry.index?.count??positions.count;
 return acc+n/3;
},0);
const build=(id,detail='high')=>createMonsterModel(MONSTER_BY_ID[id],{detail});
test('four distinct avian masters reuse the real 82-feather guardian wing',()=>{
 assert.deepEqual(AVIAN_REFRESH_IDS,['m011','m012','m013','m014']);
 const distinct=new Set();
 for(const id of AVIAN_REFRESH_IDS){
  const model=build(id);
  try{
   assert.equal(model.userData.avianRebuildRevision,AVIAN_REALISM_REVISION);
   assert.equal(model.userData.avianGameSourceRevision,AVIAN_REALISM_REVISION);
   assert.equal(model.userData.avianGuardianGeometryDonor,'seraph_guardian');
   distinct.add(model.userData.avianAnatomicalKind);
   const p=model.userData.pivots;
   assert.equal(p.wingL.parent,p.torso);
   assert.equal(p.wingR.parent,p.torso);
   assert.equal(p.wingElbowL.parent,p.wingL);
   assert.equal(p.wingWristL.parent,p.wingElbowL);
   assert.equal(p.tail.parent,p.torso);
   assert.equal(p.head.parent,p.torso);
   for(const suffix of ['L','R']){
    const wing=model.getObjectByName('avian-guardian-three-layer-wing-'+id+'-'+suffix);
    assert.ok(wing?.isMesh&&wing.visible,id+' missing guardian-derived feather wing');
    assert.equal(wing.parent,p['wing'+suffix]);
    assert.equal(wing.userData.angelSource,'seraph_guardian');
    assert.equal(wing.userData.angelFeatherLayers,3);
    assert.equal(wing.userData.angelFeathersPerSide,82);
    assert.ok(wing.userData.angelDonorGeometryTriangles>1000);
    assert.ok(wing.geometry.getAttribute('normal'));
    assert.ok(wing.geometry.getAttribute('uv'));
    assert.ok(wing.geometry.getAttribute('color'));
    assert.ok(wing.geometry.getAttribute('position').count>15000);
    assert.equal(wing.userData.ownedGeometry,true);
    assert.equal(wing.userData.ownedEffectMaterial,true);
   }
   const body=model.getObjectByName('avian-keel-rib-cavity-'+id);
   const plumage=model.getObjectByName('avian-layered-body-plumage-'+id);
   const tail=model.getObjectByName('avian-tail-rooted-streamers-'+id);
   assert.ok(body?.userData.avianClosedThorax);
   assert.ok(plumage?.userData.curvedAvianFeathers>100);
   assert.ok(tail?.userData.curvedAvianFeathers>=9);
   assert.equal(model.getObjectByName('avian-cranium-'+id)?.userData.avianRealCranium,true);
   assert.ok(model.getObjectByName('avian-hooked-beak-'+id)?.userData.avianHookedKeratin);
   for(const suffix of ['L','R']){
    assert.ok(p['avianFoot'+(id==='m012'?'Front':'')+suffix]);
    assert.ok(p['birdAnkle'+(id==='m012'?'Front':'')+suffix]);
   }
   assert.ok(triangles(model)<500000,id+' over playable triangle budget');
  }finally{disposeMonsterSculpture(model);}
 }
 assert.equal(distinct.size,4,'eagle, griffin, phoenix and owl are not one reskinned bird');
});
test('phoenix has richer source geometry, warm feathers and long articulated tail',()=>{
 const counts={};
 for(const detail of ['source','high','medium','low']){
  const m=build('m013',detail);
  try{
   counts[detail]=triangles(m);
   const wing=m.getObjectByName('avian-guardian-three-layer-wing-m013-L');
   assert.ok(wing);
   assert.equal(wing.userData.angelFeathersPerSide,
     detail==='low'||detail==='medium'?18:82);
   assert.ok(m.getObjectByName('avian-articulated-crest-m013'));
   const tail=m.getObjectByName('avian-tail-rooted-streamers-m013');
   assert.equal(tail.userData.curvedAvianFeathers,
     detail==='low'?5:detail==='medium'?17:31);
   assert.ok(m.getObjectByName('avian-layered-body-plumage-m013'));
   assert.equal(wing.material.emissiveIntensity,.21);
   const coords=wing.geometry.getAttribute('position');
   const color=wing.geometry.getAttribute('color');
   let ember=0;
   for(let j=0;j<color.count;j+=Math.max(1,Math.floor(color.count/190))){
    if(color.getX(j)>color.getZ(j)*1.15)ember++;
   }
   assert.ok(ember>20,'fire feathers must be physically recoloured rather than plain angel ivory');
   const bounding=new THREE.Box3().setFromObject(m);
   assert.ok(bounding.getSize(new THREE.Vector3()).x>4,
     'phoenix must have a cathedral-scale wing silhouette');
   assert.ok(coords.count>900,'phoenix wings need curved 3D feather geometry');
  }finally{disposeMonsterSculpture(m);}
 }
 assert.ok(counts.source>counts.high*1.7,
   'source wing must be genuinely finer than in-game near model');
 assert.ok(counts.high>counts.low*1.5,
   'crowd LOD must remove significant feather triangles');
 assert.ok(counts.source<2_000_000,'source must fit the preview GPU limit');
 assert.ok(counts.high<500000,'near battle model must fit the FPS budget');
});
test('phoenix v3 keeps giant wings/tail and small head, but enlarges continuous thorax',()=>{
 const recipe=avianProfile('m013');
 assert.ok(recipe.wing[0]>=1.20&&recipe.wing[1]>=1,
  'guardian feather donor must scale to genuinely enlarged phoenix wings');
 assert.ok(recipe.tail>=3.2&&recipe.body>=1.15&&recipe.head<.75,
  'large chest must retain an independently tiny skull and giant tail');
 const m=build('m013','high');
 try{
  assert.equal(m.userData.phoenixSlenderAnatomy,false);
  assert.equal(m.userData.phoenixExpandedThorax,true);
  assert.equal(m.userData.phoenixTorsoRadiusX,.365);
  assert.equal(m.userData.phoenixTorsoRadiusY,.468);
  assert.equal(m.userData.phoenixNoExternalEars,true);
  assert.equal(m.userData.phoenixWingSpanFactor,recipe.wing[0]);
  const chest=m.getObjectByName('avian-keel-rib-cavity-m013');
  assert.equal(chest.userData.avianClosedThorax,true);
  const scales=m.getObjectByName('avian-layered-body-plumage-m013');
  assert.equal(scales.userData.imbricatedKeratinScales,true);
  assert.equal(scales.userData.phoenixBellyScaleMultiplier,3);
  assert.equal(scales.userData.phoenixAbdomenLargeScaleWidth,.069);
  assert.deepEqual(scales.userData.phoenixScaleWidths,{min:.020,max:.069});
  assert.equal(scales.userData.scaleCount,23*48);
  assert.equal(m.userData.phoenixDenseScaleCount,23*48);
  assert.equal(scales.userData.mergedFeatherBatches,1,
   'more overlapping scales must not create one draw call per scale');
  const head=m.getObjectByName('avian-cranium-m013');
  head.geometry.computeBoundingBox();
  assert.ok(head.geometry.boundingBox.max.x-head.geometry.boundingBox.min.x<.40,
   'small phoenix skull must stay narrow');
  assert.equal(head.userData.phoenixSmallElongatedHead,true);
  assert.equal(head.userData.phoenixNoEars,true);
  const beak=m.getObjectByName('avian-hooked-beak-m013');
  assert.equal(beak.userData.phoenixLongNarrowBeak,true);
  assert.ok(m.getObjectByName('phoenix-long-beak-nostril-L'));
  assert.ok(m.getObjectByName('phoenix-long-beak-nostril-R'));
  const crest=m.getObjectByName('avian-articulated-crest-m013');
  assert.equal(crest.userData.phoenixAllBackCrest,true);
  assert.equal(crest.userData.phoenixNoEarTufts,true);
  crest.geometry.computeBoundingBox();
  assert.ok(crest.geometry.boundingBox.min.z< -1.45,
   'slicked-back head feathers must trail behind the small skull');
  const tail=m.getObjectByName('avian-tail-rooted-streamers-m013');
  assert.equal(tail.userData.phoenixLongTailFan,true);
  assert.equal(tail.userData.curvedAvianFeathers,31);
  assert.ok(tail.userData.phoenixTailLength>4.55);
  tail.geometry.computeBoundingBox();
  assert.ok(tail.geometry.boundingBox.min.z< -4.7,
   'enlarged phoenix tail must have actual long geometry, not a particle-only effect');
 }finally{disposeMonsterSculpture(m);}
});
test('phoenix chicken-thigh shanks retain grounded toes and 3x overlapping plates on every articulated limb',()=>{
 for(const detail of ['source','high','medium','low']){
  const m=build('m013',detail),p=m.userData.pivots;
  try{
   const ribs=m.getObjectByName('avian-keel-rib-cavity-m013');
   ribs.geometry.computeBoundingBox();
   const box=ribs.geometry.boundingBox;
   assert.ok(box.max.x-box.min.x>.68,
    'm013 rib cage should visibly expand instead of only increasing a catalog multiplier');
   assert.ok(box.max.y-box.min.y>.80,
    'more substantial abdomen must keep an organic rib/keel silhouette');
   const neck=m.getObjectByName('phoenix-neck-fine-grading-scutes');
   const head=m.getObjectByName('phoenix-fine-head-scales');
   assert.equal(neck?.userData.phoenixScalesShrinkTowardsFace,true);
   assert.equal(neck.userData.phoenixScaleWidthBase,.040);
   assert.equal(neck.userData.phoenixScaleWidthTip,.009);
   assert.equal(head?.userData.phoenixFaceMicroScales,true);
   assert.equal(head.parent,p.head);
   assert.equal(head.userData.phoenixScaleWidthMax,.010);
   for(const side of ['L','R']){
    const thigh=m.getObjectByName('phoenix-long-thigh-scutes-'+side);
    const shank=m.getObjectByName('phoenix-chicken-shank-scutes-'+side);
    const toes=m.getObjectByName('phoenix-foot-toe-scutes-'+side);
    const forearm=m.getObjectByName('phoenix-wing-forearm-scutes-'+side);
    const hand=m.getObjectByName('phoenix-wing-hand-scutes-'+side);
    assert.equal(p['leg'+side].userData.phoenixLongSlimThigh,true);
    assert.ok(p['leg'+side].userData.phoenixThighLength>.53);
    assert.ok(p['leg'+side].userData.phoenixThighRadius<.09);
    assert.equal(p['birdAnkle'+side].userData.phoenixChickenShank,true);
    assert.equal(p['avianFoot'+side].userData.phoenixChickenToes,4);
    for(const [mesh,bone] of [
     [thigh,p['leg'+side]],[shank,p['birdAnkle'+side]],
     [toes,p['avianFoot'+side]],[forearm,p['wingElbow'+side]],
     [hand,p['wingWrist'+side]]]){
     assert.equal(mesh?.parent,bone,'scale mesh must follow actual animated bone');
     assert.equal(mesh.userData.phoenixAttachedScutes,true);
     assert.equal(mesh.userData.phoenixScaleWidth,.069);
     assert.ok(mesh.geometry.getAttribute('position').count>=20);
    }
   }
   assert.equal(m.userData.phoenixChickenLegRig,true);
   const actions=['idle','walk','run','attack','special','leap'];
   for(const action of actions){
    startMonsterAction(m,action,0);
    animateMonsterModel(m,.26);
    m.updateMatrixWorld(true);
    for(const side of ['L','R']){
     const foot=p['avianFoot'+side];
     const pos=foot.getWorldPosition(new THREE.Vector3());
     assert.ok(pos.y>=-.25&&pos.y<3,
       'bird feet must not be detached or sunk deep into floor: '+detail+action);
     assert.ok(Number.isFinite(pos.x+pos.y+pos.z));
    }
   }
  }finally{disposeMonsterSculpture(m);}
 }
});
test('phoenix feather waves travel across both wings, swept crest and tail without CPU rebuilding',()=>{
 const m=build('m013','high');
 try{
  assert.equal(m.userData.phoenixWaveMeshCount,4);
  for(const part of m.userData.phoenixWaveMeshes){
   assert.equal(part.userData.phoenixWaveDynamic,true);
   assert.equal(part.userData.phoenixWaveGPU,true);
   assert.equal(part.userData.ownedGeometry,true);
   const material=part.material;
   const shader={uniforms:{},
    vertexShader:'#include <common>\\nvoid main(){\\n#include <begin_vertex>\\n}'};
   material.onBeforeCompile(shader);
   assert.ok(shader.vertexShader.includes('uniform float phoenixWaveTime;'));
   assert.ok(shader.vertexShader.includes('transformed.y +='));
   assert.ok(shader.vertexShader.includes('avianDistance'));
   assert.ok(!shader.vertexShader.includes('\\\\nuniform'),
    'GLSL uniform declarations cannot contain literal backslash-n');
   assert.ok(shader.uniforms.phoenixWavePower);
  }
  const waveParts=m.userData.phoenixWaveMeshes;
  const geometries=waveParts.map(p=>p.geometry);
  startMonsterAction(m,'run',0);
  animateMonsterModel(m,.2);
  for(const part of waveParts){
   const state=part.material.userData.phoenixWaveState;
   assert.equal(state.power,1.12);
   assert.ok(Number.isFinite(state.time));
   assert.equal(state.uniformTime.value,state.time);
   assert.equal(state.uniformPower.value,state.power);
  }
  assert.deepEqual(waveParts.map(p=>p.geometry),geometries,
   'traveling wing wave cannot reallocate the feather meshes every frame');
  startMonsterAction(m,'idle',0);
  animateMonsterModel(m,.4);
  assert.ok(waveParts.every(p=>p.material.userData.phoenixWaveState.power<1),
   'idle should produce calm feather-wave flow, not attack-strength flapping');
 }finally{disposeMonsterSculpture(m);}
});
test('griffin has four independently animated legs; owl has facial disks',()=>{
 const griffin=build('m012');
 const owl=build('m014');
 try{
  for(const suffix of ['L','R']){
   assert.ok(griffin.userData.pivots['legFront'+suffix]);
   assert.ok(griffin.userData.pivots['legRear'+suffix]);
   assert.ok(owl.getObjectByName('owl-facial-disc-'+suffix));
   assert.ok(owl.getObjectByName('owl-iris-'+(suffix==='L'?-1:1)));
  }
  for(const model of [griffin,owl]){
   for(const action of ['idle','walk','run','attack','special','defeat']){
    startMonsterAction(model,action,0);
    animateMonsterModel(model,action==='defeat'?.9:.32);
    model.updateMatrixWorld(true);
    for(const suffix of ['L','R']){
     for(const name of ['wing','wingElbow','wingWrist']){
      const b=model.userData.pivots[name+suffix];
      assert.ok(b&&[b.rotation.x,b.rotation.y,b.rotation.z].every(Number.isFinite),
       model.userData.speciesId+' '+action+' has invalid wing joint '+name);
     }
    }
   }
  }
 }finally{
  disposeMonsterSculpture(griffin);
  disposeMonsterSculpture(owl);
 }
});
test('m015 humanlike Tengu remains on the previous independently maintained path',()=>{
 const m=build('m015','high');
 try{
  assert.equal(avianProfile('m015'),null);
  assert.equal(m.userData.avianRebuildRevision,undefined);
  assert.equal(m.getObjectByName('avian-guardian-three-layer-wing-m015-L'),undefined);
  assert.ok(m.userData.pivots.wingL&&m.userData.pivots.legL);
 }finally{disposeMonsterSculpture(m);}
});
