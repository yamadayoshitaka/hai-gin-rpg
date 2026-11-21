import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {MONSTER_BY_ID} from '../src/monster-catalog.js';
import {createMonsterModel,disposeMonsterSculpture,monsterSculptCacheStats}
 from '../src/monster-geometry.js';
import {startMonsterAction,animateMonsterModel}
 from '../src/monster-animation.js';
import {M023_MANTIS_SCULPT_REVISION,M023_WALKING_PAIR_COUNT,
 M023_RAPTORIAL_PAIR_COUNT} from '../src/m023-mantis-sculpt.js';

test('m023 is a six-limbed mantis rather than an eight-legged beetle',()=>{
 assert.equal(M023_WALKING_PAIR_COUNT,2);
 assert.equal(M023_RAPTORIAL_PAIR_COUNT,1);
 const model=createMonsterModel(MONSTER_BY_ID.m023,{detail:'high'});
 try{
  assert.equal(model.userData.m023MantisSculpt,M023_MANTIS_SCULPT_REVISION);
  assert.equal(model.userData.gameModelRevision,M023_MANTIS_SCULPT_REVISION);
  assert.equal(model.userData.m023NoBeetleBody,true);
  const p=model.userData.pivots;
  for(const side of ['L','R']){
   for(const i of [0,1,2])assert.ok(p['leg'+side+i],
    'six walking/raptorial anchors: '+side+i);
   assert.ok(p['raptorial'+side]);
   assert.ok(p['raptorialElbow'+side]);
   assert.ok(p['wing'+side]);
   assert.ok(p['leg'+side+'0'].getObjectByName('raptorial'+side),
    'forelimb must inherit gait and scythe strike from a common root');
  }
  assert.ok(p.head&&p.jaw&&p.torso);
  let scythes=0,eyes=0,serrations=0,walking=0,triHead=0,
   segmented=0,veins=0,vertices=0,triangles=0;
  model.traverse(mesh=>{
   if(!mesh.isMesh)return;
   const a=mesh.geometry.getAttribute('position');
   const normals=mesh.geometry.getAttribute('normal');
   const uv=mesh.geometry.getAttribute('uv');
   assert.ok(a&&normals&&uv,'m023 PBR geometry incomplete '+mesh.name);
   assert.ok(a.array.every(Number.isFinite),'NaN in '+mesh.name);
   assert.ok(normals.array.every(Number.isFinite),'NaN normal '+mesh.name);
   vertices+=a.count;
   triangles+=Math.floor((mesh.geometry.index?.count??a.count)/3);
   if(mesh.name==='m023-continuous-sickle-blade'){
    scythes++;assert.equal(mesh.userData.mantisSickle,true);
    assert.equal(mesh.userData.rootedKeratin,true);
   }
   if(mesh.name==='m023-side-compound-eye'){
    eyes++;assert.equal(mesh.userData.compoundEye,true);
   }
   if(mesh.name.startsWith('m023-rooted-sickle-serration'))serrations++;
   if(mesh.name==='m023-walking-coxa')walking++;
   if(mesh.name==='m023-triangular-sculpted-cranium'){
    triHead++;assert.equal(mesh.userData.mantisTriangularHead,true);
   }
   if(mesh.name==='m023-elongated-articulated-abdomen'){
    segmented++;assert.equal(mesh.userData.mantisSegmentedAbdomen,true);
    assert.equal(mesh.userData.closedAnatomicalHull,true);
   }
   if(mesh.name==='m023-fitted-tegmen-vein')veins++;
   assert.notEqual(mesh.name,'insect-segmented-thorax-m023',
    'old generic beetle body must not render');
  });
  assert.equal(scythes,2);
  assert.equal(eyes,2);
  assert.equal(triHead,1);
  assert.equal(segmented,1);
  assert.equal(walking,4);
  assert.ok(serrations>=14);
  assert.ok(veins>=8);
  assert.ok(vertices>2000&&triangles<125000,
   'high-quality model stays within Android near LOD budget');
  const bounds=new THREE.Box3().setFromObject(model);
  assert.ok(!bounds.isEmpty());
  assert.ok(bounds.min.y>-.25,'mantis must stay close to ground');
  assert.ok(bounds.max.y>1.8,'sculpt must have a tall praying mantis silhouette');
  for(const action of ['idle','walk','run','attack','special']){
   startMonsterAction(model,action,0);
   const p=animateMonsterModel(model,.43);
   assert.equal(p.action,action);
  }
  assert.ok(model.userData.pivots.raptorialElbowL);
 }finally{
  disposeMonsterSculpture(model);
  assert.equal(monsterSculptCacheStats().activeMaterials,0,
   'no borrowed PBR material leaks after creature is destroyed');
 }
});
test('m023 mobile low LOD retains all motion pivots with fewer polygons',()=>{
 const hi=createMonsterModel(MONSTER_BY_ID.m023,{detail:'high'});
 const lo=createMonsterModel(MONSTER_BY_ID.m023,{detail:'low'});
 const count=model=>{
  let n=0;
  model.traverse(mesh=>{if(mesh.isMesh)n+=mesh.geometry.index?.count??0;});
  return n;
 };
 try{
  assert.ok(count(lo)<count(hi)*.7,'low LOD must be materially cheaper');
  for(const side of ['L','R'])
   for(const name of ['leg'+side+'0','leg'+side+'1','leg'+side+'2',
    'raptorial'+side,'raptorialElbow'+side,'wing'+side])
    assert.ok(lo.userData.pivots[name],name+' must survive low LOD');
  let lowSerrations=0;
  lo.traverse(n=>{if(n.name.startsWith('m023-rooted-sickle-serration'))
   lowSerrations++;});
  assert.equal(lowSerrations,0,'low crowd must not allocate scythe barbs');
  assert.ok(!lo.userData.pivots.legL3,'mantis cannot have a fourth walking pair');
 }finally{
  disposeMonsterSculpture(hi);disposeMonsterSculpture(lo);
 }
});
