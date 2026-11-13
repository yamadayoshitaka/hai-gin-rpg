import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createCreatureGumSocketGeometry,createCreatureFittedHemGeometry}
 from '../src/creature-seam-geometry.js';
import {buildCombatObjectGeometry,CREATURE_VISUAL_SPECS}
 from '../src/combat-creature-geometry.js';
import {createMonsterModel,disposeMonsterSculpture,monsterSculptCacheStats}
 from '../src/monster-geometry.js';
import {MONSTER_BY_ID} from '../src/monster-catalog.js';

const V=point=>new THREE.Vector3(...point);
const validate=(geo,kind)=>{
 assert.equal(geo.userData.kind,kind);
 const p=geo.getAttribute('position'),uv=geo.getAttribute('uv');
 assert.ok(p.count>20&&geo.index.count>35);
 assert.equal(p.count,uv.count);
 for(const role of ['position','normal','uv'])
  assert.ok(geo.getAttribute(role).array.every(Number.isFinite),
    'Invalid organic seam '+role);
};
const base=[.35,.42,.12],tip=[.37,.61,.15],radius=.045;
const gums=createCreatureGumSocketGeometry({base,tip,radius});
const gumsLow=createCreatureGumSocketGeometry({base,tip,radius,detail:'low'});
validate(gums,'buried-gingival-fang-root');
validate(gumsLow,'buried-gingival-fang-root');
assert.ok(gums.getAttribute('position').count>gumsLow.getAttribute('position').count,
 'Far LOD tooth seam must be less detailed');
const first=V(base),gumCoords=gums.getAttribute('position');
let minDistance=Infinity;
for(let i=0;i<gumCoords.count;i++)
 minDistance=Math.min(minDistance,
  first.distanceTo(new THREE.Vector3().fromBufferAttribute(gumCoords,i)));
assert.ok(minDistance<radius*1.6,'Soft-tissue socket does not grip tooth base');
assert.throws(()=>createCreatureGumSocketGeometry({
 base,tip:[NaN,.2,.3],radius}),/Invalid/);
assert.throws(()=>createCreatureGumSocketGeometry({
 base,tip:base,radius}),/Invalid/);

const fabric=createCreatureFittedHemGeometry({
 center:[.14,1.6,.14],axis:[.3,-1,.2],
 radiusX:.14,radiusZ:.12,width:.06,thickness:.013
});
const fabricLow=createCreatureFittedHemGeometry({
 center:[.14,1.6,.14],axis:[.3,-1,.2],
 radiusX:.14,radiusZ:.12,width:.06,thickness:.013,detail:'low'
});
validate(fabric,'rolled-attached-fabric-hem');
validate(fabricLow,'rolled-attached-fabric-hem');
assert.ok(fabric.getAttribute('position').count>
 fabricLow.getAttribute('position').count*1.5,
 'Hem LOD must be cheaper at distance');
assert.throws(()=>createCreatureFittedHemGeometry({
 center:[0,0,0],axis:[0,0,0],radiusX:.13,radiusZ:.11}),/Invalid/);
for(const geo of [gums,gumsLow,fabric,fabricLow])geo.dispose();

function countColor(geometry,tint){
 const colors=geometry?.getAttribute('color');
 if(!colors)return 0;
 const c=new THREE.Color(tint);let count=0;
 for(let i=0;i<colors.count;i++)
  if(Math.abs(colors.getX(i)-c.r)<.0008&&
     Math.abs(colors.getY(i)-c.g)<.0008&&
     Math.abs(colors.getZ(i)-c.b)<.0008)count++;
 return count;
}
const types=['wolf','wyvern','dragon','elder_dragon','dragon_lord',
 'forest_archer','seraph_guardian'];
const limits={wolf:125000,wyvern:175000,dragon:175000,
 elder_dragon:205000,dragon_lord:225000};
for(const type of types){
 const high=buildCombatObjectGeometry(type,{detail:'high'});
 const low=buildCombatObjectGeometry(type,{detail:'low'});
 const size=parts=>Object.values(parts).reduce((n,g)=>
  n+g.getAttribute('position').count,0);
 if(limits[type])assert.ok(size(high)<limits[type],
   'New tooth roots must NOT break mobile instance budget '+type+' '+size(high));
 assert.ok(size(high)>size(low)*1.45,'LOD gone '+type);
 if(type==='wolf'){
  assert.ok(countColor(high.jaw,0x493d3a)>30);
  assert.ok(countColor(low.jaw,0x493d3a)>20);
 }else if(type==='dragon_lord'){
  assert.ok(countColor(high.jaw,0x553a33)>45);
  assert.ok(countColor(low.jaw,0x553a33)>20);
  assert.ok(countColor(high.core,0x553a33)>15,
    'Upper fang socket must stay fixed to skull');
 }else if(['wyvern','dragon','elder_dragon'].includes(type)){
  assert.ok(countColor(high.jaw,0x553934)>30);
  assert.ok(countColor(low.jaw,0x553934)>20);
 }else{
  for(const part of ['core','armL','armR','legBackL','legBackR'])
   assert.ok(high[part]&&low[part],'Missing hem parent '+type+'/'+part);
  // Clothing trims are under identical parent part for near/far LOD;
  // donor Quaternius face remains independent.
  assert.ok(countColor(high.core,type==='seraph_guardian'?0xf0d8b6:0xb4b16c)>30,
   'Missing rolled collar '+type);
 }
 for(const geometry of [...Object.values(high),...Object.values(low)]){
  assert.ok(geometry.getAttribute('position').array.every(Number.isFinite));
  assert.ok(geometry.getAttribute('normal').array.every(Number.isFinite));
  geometry.dispose();
 }
}
const matching=name=>name==='m034-gingival-canine-L-root';
for(const id of ['m001','m004','m006','m032','m033','m034','m035','m043','m045']){
 const spec=MONSTER_BY_ID[id],model=createMonsterModel(spec,{detail:'high'});
 let sockets=0;
 model.traverse(object=>{
   if(!object.isMesh)return;
   const g=object.geometry;
   if(object.name.endsWith('-root')&&object.name.startsWith('rooted-claw-')){
     sockets++;
     validate(g,'buried-gingival-fang-root');
     assert.ok(object.parent?.isGroup,'Claw socket not attached to animated parent');
   }
 });
 if(['m001','m004','m006','m043'].includes(id))
  assert.ok(sockets>=2,'No embedded nails for '+id);
 if(id==='m034'){
  const find=name=>model.getObjectByName(name);
  for(const side of ['L','R']){
   const tooth=find('m034-gingival-canine-'+side+'-root');
   assert.ok(tooth?.isMesh,'Vampire fang gum absent '+side);
   assert.strictEqual(tooth.parent,model.userData.pivots.head,
    'Canines must follow head pose');
   assert.ok(find('m034-sleeve-cuff-'+side)?.isMesh,
    'Missing rolled jacket sleeve seam '+side);
   assert.strictEqual(find('m034-sleeve-cuff-'+side).parent,
    model.userData.pivots['arm'+side],
    'Sleeve cuff must follow the arm, not torso');
   assert.strictEqual(find('m034-boot-top-'+side).parent,
    model.userData.pivots['ankle'+side],
    'Boot hem should follow articulated ankle');
  }
  assert.strictEqual(find('m034-tailored-rolled-collar').parent,
    model.userData.pivots.torso,'Collar must follow upper body');
  const point=new THREE.Vector3();
  const cuff=find('m034-sleeve-cuff-L');
  const vertex=cuff.geometry.getAttribute('position');
  const original=new THREE.Vector3().fromBufferAttribute(vertex,4);
  model.updateMatrixWorld(true);
  cuff.localToWorld(point.copy(original));
  const before=point.clone();
  model.userData.pivots.armL.rotation.x=.35;
  model.updateMatrixWorld(true);
  cuff.localToWorld(point.copy(original));
  assert.ok(before.distanceTo(point)>.005,
   'Clothing must remain attached when elbow/shoulder bends');
 }
 disposeMonsterSculpture(model);
 assert.equal(monsterSculptCacheStats().activeMaterials,0,
  'Owned hem/gum materials should be disposed after '+id);
}
console.log('One-batch fangs/claws and clothing seams PASS: gum root depth, same-part animation, cuffs, collar, boots, mobile GPU and LOD');
