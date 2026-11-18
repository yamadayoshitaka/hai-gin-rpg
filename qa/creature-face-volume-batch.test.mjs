import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
 CREATURE_FACE_VOLUME_METRICS,CREATURE_FACE_VOLUME_PRESETS,
 creatureFaceVolume,sculptAxialFacePoint,sculptVerticalFacePoint
} from '../src/creature-face-volume.js';
import {MONSTER_BY_ID} from '../src/monster-catalog.js';
import {createMonsterAnatomicalLoft,MORTAL_HEAD_RINGS}
 from '../src/monster-realistic-loft.js';

const species=['wolf','horse','wyvern','dragon','elder_dragon','dragon_lord',
 'forest_archer','seraph_guardian','beast','feline','reptile','avian',
 'undead','fiend','aquatic'];
assert.equal(CREATURE_FACE_VOLUME_METRICS.length,7);
for(const id of species){
 const p=creatureFaceVolume(id);
 assert.equal(Object.isFrozen(p),true,'Mutable facial anatomy '+id);
 for(const name of CREATURE_FACE_VOLUME_METRICS)
  assert.ok(Number.isFinite(p[name])&&p[name]>0&&p[name]<.14,
   'Invalid '+id+' '+name);
}
for(const id of ['m032','m034','m003','m044','m048']){
 const spec=MONSTER_BY_ID[id];
 const p=creatureFaceVolume(spec.id,spec.family);
 assert.ok(p?.cheekDepth>0&&p?.orbitalDepth>0,'Missing monster face preset '+id);
}
assert.ok(creatureFaceVolume('m032','undead').orbitalDepth>
 creatureFaceVolume('m034','undead').orbitalDepth,
 'Desiccated mummy sockets must be deeper than vampire sockets');

const zero=Object.fromEntries(CREATURE_FACE_VOLUME_METRICS.map(k=>[k,0]));
const lord=creatureFaceVolume('dragon_lord');
// A 3/4-angle cross-section really expands the zygomatic muscle volume,
// instead of just painting a cheek texture.
const angle=Math.asin(-.33),x=.36,y=3.70,z=1.19,t=.51;
const before=sculptAxialFacePoint(x,y,z,t,angle,zero);
const after=sculptAxialFacePoint(x,y,z,t,angle,lord);
assert.ok(after[0]>before[0]+.026,
 'Dragon cheek must have observable real lateral volume in 3/4 view');
const noOrbit={...lord,orbitalDepth:0},upperAngle=Math.asin(.18);
const withOrbit=sculptAxialFacePoint(.44,3.80,1.20,.51,upperAngle,lord);
const withoutOrbit=sculptAxialFacePoint(.44,3.80,1.20,.51,upperAngle,noOrbit);
assert.ok(withOrbit[0]<withoutOrbit[0]-.010,
 'Dragon eye socket must be recessed below its temporal/cheek ridge');
const beforeNose=sculptAxialFacePoint(0,3.5,1.66,.76,Math.PI/2,zero);
const afterNose=sculptAxialFacePoint(0,3.5,1.66,.76,Math.PI/2,lord);
assert.ok(afterNose[2]>beforeNose[2]+.020,
 'Dragon nose bridge must project forward as real geometry');
const beforeBack=sculptAxialFacePoint(.18,3.7,.40,.12,Math.PI*.30,zero);
const afterBack=sculptAxialFacePoint(.18,3.7,.40,.12,Math.PI*.30,lord);
assert.ok(afterBack[2]<beforeBack[2]-.030,'Occiput must extend behind the skull');

const vampire=creatureFaceVolume('m034','undead');
const mortalBase=sculptVerticalFacePoint(.16,-.04,.20,.42,.68,.73,zero);
const mortalFace=sculptVerticalFacePoint(.16,-.04,.20,.42,.68,.73,vampire);
assert.ok(mortalFace[2]>mortalBase[2]+.012,
 'Vampire cheekbones must project in 3/4 profile');
const withoutMortalOrbit=sculptVerticalFacePoint(.10,.06,.21,.60,.49,.87,
 {...vampire,orbitalDepth:0});
const withMortalOrbit=sculptVerticalFacePoint(.10,.06,.21,.60,.49,.87,vampire);
assert.ok(withMortalOrbit[2]<withoutMortalOrbit[2]-.017,
 'Humanlike monster needs anatomical orbital depth');
const baseLoft=createMonsterAnatomicalLoft(MORTAL_HEAD_RINGS,{
 detail:'high',kind:'face'
});
const depthLoft=createMonsterAnatomicalLoft(MORTAL_HEAD_RINGS,{
 detail:'high',kind:'face',faceVolume:vampire
});
assert.equal(depthLoft.getAttribute('position').count,
 baseLoft.getAttribute('position').count,
 'Volume should be sculpted into SAME head mesh, not add floating parts');
const a=baseLoft.getAttribute('position'),b=depthLoft.getAttribute('position');
let changed=0,maxZ=0,changedSide=0;
for(let i=0;i<a.count;i++){
 const d=Math.abs(a.getZ(i)-b.getZ(i));
 if(d>.008){changed++;maxZ=Math.max(maxZ,d);}
 if(Math.abs(a.getX(i)-b.getX(i))>.004)changedSide++;
}
assert.ok(changed>200&&changedSide>50&&maxZ>.025,
 'Continuous humanoid face requires real front/side surface relief');
assert.ok(b.array.every(Number.isFinite));
assert.ok(depthLoft.getAttribute('normal').array.every(Number.isFinite));
baseLoft.dispose();depthLoft.dispose();

const {buildCombatObjectGeometry}=
 await import('../src/combat-creature-geometry.js');
const budgets={wolf:125000,horse:155000,wyvern:175000,dragon:175000,
 elder_dragon:205000,dragon_lord:225000};
for(const id of ['wolf','horse','wyvern','dragon','elder_dragon','dragon_lord',
 'forest_archer','seraph_guardian']){
 const high=buildCombatObjectGeometry(id,{detail:'high'});
 const low=buildCombatObjectGeometry(id,{detail:'low'});
 if(budgets[id])assert.deepEqual(Object.keys(high).sort(),Object.keys(low).sort(),
  'Must retain articulated GPU part contract '+id);
 else for(const name of Object.keys(low))
  assert.ok(high[name],'High LOD lost its base humanoid part '+id+'/'+name);
 const vertices=o=>Object.values(o).reduce((n,g)=>
  n+g.getAttribute('position').count,0);
 if(budgets[id])assert.ok(vertices(high)<budgets[id],
  id+' high LOD exceeds existing GPU budget '+vertices(high));
 assert.ok(vertices(high)>vertices(low)*2,'LOD collapsed '+id);
 const parts=budgets[id]?['core','eyes']:['core','faceFallback'];
 for(const p of parts)assert.ok(high[p]&&low[p],id+' missing '+p);
 for(const g of [...Object.values(high),...Object.values(low)]){
  const p=g.getAttribute('position');
  assert.ok(p.array.every(Number.isFinite),'NaN volume geometry '+id);
  assert.ok(g.getAttribute('normal').array.every(Number.isFinite));
  g.dispose();
 }
}
const {createMonsterModel,disposeMonsterSculpture,monsterSculptCacheStats}=
 await import('../src/monster-geometry.js');
const organisms=[
 ...Array.from({length:10},(_,i)=>'m'+String(i+1).padStart(3,'0')),
 ...Array.from({length:4},(_,i)=>'m'+String(i+11).padStart(3,'0')),
 ...Array.from({length:5},(_,i)=>'m'+String(i+16).padStart(3,'0')),
 ...Array.from({length:5},(_,i)=>'m'+String(i+31).padStart(3,'0')),
 ...Array.from({length:5},(_,i)=>'m'+String(i+41).padStart(3,'0')),
 'm048','m050',
];
for(const id of organisms){
 const model=createMonsterModel(MONSTER_BY_ID[id],{detail:'high'});
 let volume=0;
 model.traverse(n=>{
  if(!n.isMesh||!n.userData.anatomyLoft||
     n.geometry.userData.anatomy!=='face')return;
  assert.equal(n.geometry.userData.faceVolumeApplied,true);
  volume++;
 });
 assert.ok(volume>=1,'No continuous sculpted face surface on '+id);
 assert.ok(model.userData.pivots.head,'Face pose pivot removed '+id);
 if(['m001','m006','m016','m020'].includes(id))
  assert.ok(model.userData.pivots.jaw,
    'Opening jaws must remain independent on '+id);
 disposeMonsterSculpture(model);
 assert.equal(monsterSculptCacheStats().activeMaterials,0,
  'Material leak after facial mesh replacement '+id);
}
assert.equal(organisms.length,31,'Batch coverage changed unexpectedly');

const {avianProfile}=await import('../src/avian-guardian-sculpt.js');
for(const id of ['m011','m012','m013','m014']){
 for(const detail of ['high','low']){
  const bird=createMonsterModel(MONSTER_BY_ID[id],{detail});
  const crania=[];
  bird.traverse(node=>{
   if(node.isMesh&&node.name==='avian-cranium-'+id)crania.push(node);
  });
  assert.equal(crania.length,1,id+' '+detail+' must use one moving cranium, not a second face ball');
  const skull=crania[0];
  assert.ok(skull.userData.avianRealCranium);
  assert.ok(skull.userData.anatomyLoft,id+' '+detail+' must sculpt the actual skull');
  assert.equal(skull.geometry.userData.anatomy,'face',id+' '+detail+' no facial relief geometry');
  assert.equal(skull.geometry.userData.faceVolumeApplied,true);
  assert.ok(skull.userData.closedAnatomicalHull,id+' skull caps should not disappear');
  assert.equal(skull.parent,bird.userData.pivots.head,id+' sculpt follows head animations');
  assert.ok(skull.geometry.getAttribute('position').array.every(Number.isFinite));
  assert.ok(skull.geometry.getAttribute('normal').array.every(Number.isFinite));
  assert.ok(skull.geometry.getIndex().count>200);
  if(id==='m011'&&detail==='high'){
   // Check an actual vertex, not just a metadata flag. The middle (third)
   // skull station is z=.06, y=.055, rx=.235*head; frontal relief is
   // sculpted into this position before buffer normals are generated.
   const radial=36,steps=4,row=2*steps,idx=row*(radial+1);
   const baselineX=.235*avianProfile(id).head*
     (1+.004*Math.sin(.06*3.1)*Math.sin(Math.PI/2));
   const expected=sculptAxialFacePoint(baselineX,.055,.06,.5,0,
     creatureFaceVolume(id,'avian'));
   const p=skull.geometry.getAttribute('position');
   for(const [actual,coordinate] of [[p.getX(idx),0],[p.getY(idx),1],[p.getZ(idx),2]])
    assert.ok(Math.abs(actual-expected[coordinate])<.00001,
     'm011 actual cranium vertex did not receive physical facial sculpt on axis '+coordinate);
   assert.ok(p.getX(idx)>baselineX+.002,'m011 skull facial silhouette has no real lateral relief');
  }
  disposeMonsterSculpture(bird);
  assert.equal(monsterSculptCacheStats().activeMaterials,0,'avian sculpt leaked GPU material '+id);
 }
}

console.log('One-batch face depth PASS: 7 controls, 8 summon species, 31 monster heads, physical 3/4 relief, jaw, LOD, GPU and disposal');
