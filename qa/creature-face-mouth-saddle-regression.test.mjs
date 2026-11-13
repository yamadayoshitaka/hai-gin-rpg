import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {MONSTER_BY_ID} from '../src/monster-catalog.js';
const geometrySource=readFileSync(new URL('../src/combat-creature-geometry.js',import.meta.url),'utf8');
const humanoidSource=readFileSync(new URL('../src/combat-humanoid-summons.js',import.meta.url),'utf8');
const bestiarySource=readFileSync(new URL('../src/monster-geometry.js',import.meta.url),'utf8');
const rendererSource=readFileSync(new URL('../src/combat-world-object-renderer.js',import.meta.url),'utf8');
assert.match(geometrySource,/True upper\/lower lip junction/,
 'A wolf must have a split jaw with an animated oral cavity');
assert.match(geometrySource,/Lip fissure tracks the lower mandible/,
 'Horse mouth must follow its moving lower mandible');
assert.match(geometrySource,/Oral cavity is a separate lower-jaw surface/,
 'Dragon oral cavity must be attached to the articulated jaw');
assert.match(geometrySource,/Contoured leather saddle-pad/,
 'Wolf saddle cannot be two floating chair-like spheres');
assert.match(geometrySource,/Continuous, rib-following saddle felt/,
 'Horse saddle must follow its back profile');
assert.match(geometrySource,/profile\('equipment',0x342c2a/,
 'Wolf saddle uses equipment material, not wolf-fur');
assert.match(humanoidSource,/continuous cranium and jaw/,
 'Humanoid fallback should have real jaw/cheek proportions');
assert.match(humanoidSource,/continuous from the chin to the clavicle/,
 'Angel and forest-elf heads must blend into the neck');
assert.match(rendererSource,/replacedFace=detail==='high'&&part==='faceFallback'/,
 'Donor head replaces fallback face without overlapping two heads');
assert.match(bestiarySource,/quadruped-oral-cavity/,
 'Bestseller quadrupeds should have a genuine articulated mouth');
const THREE=await import('three').catch(e=>{
 if(e.code==='ERR_MODULE_NOT_FOUND')return null;
 throw e;
});
if(THREE){
 const {buildCombatObjectGeometry}=await import('../src/combat-creature-geometry.js');
 const {createMonsterModel,disposeMonsterSculpture,monsterSculptCacheStats}=
   await import('../src/monster-geometry.js');
 function verts(parts){return Object.values(parts).reduce((sum,geo)=>
   sum+geo.getAttribute('position').count,0);}
 function tagged(geo,color){
   const expected=new THREE.Color(color);
   const a=geo.getAttribute('color');
   let count=0;
   for(let i=0;i<a.count;i++)
     if(Math.abs(a.getX(i)-expected.r)+Math.abs(a.getY(i)-expected.g)+
       Math.abs(a.getZ(i)-expected.b)<.001)count++;
   return count;
 }
 const mouthColors={wolf:0x2b181b,horse:0x382924,
   wyvern:0x251c20,dragon:0x251c20,elder_dragon:0x251c20};
 const budgets={wolf:125000,horse:155000,wyvern:175000,
   dragon:175000,elder_dragon:205000,dragon_lord:225000};
 for(const type of Object.keys(budgets)){
   const high=buildCombatObjectGeometry(type,{detail:'high'});
   const low=buildCombatObjectGeometry(type,{detail:'low'});
   assert.ok(high.jaw&&low.jaw,'Jaw must remain independently animated: '+type);
   assert.ok(verts(high)<budgets[type],
     'Full creature must respect mobile vertex budget: '+type+' '+verts(high));
   assert.ok(verts(high)>verts(low)*3,
     'High and low geometry should retain distinct detail: '+type);
   if(mouthColors[type]){
     assert.ok(tagged(high.jaw,mouthColors[type])>35,
       'Mouth interior must be a real jaw mesh: '+type);
   }
   if(['wolf','horse','wyvern','dragon','elder_dragon'].includes(type))
     assert.ok(high.equipment&&low.equipment,
       'Saddle straps should use a separate equipment batch: '+type);
   for(const part of Object.values(high).concat(Object.values(low))){
     const pos=part.getAttribute('position'),normal=part.getAttribute('normal'),
       uv=part.getAttribute('uv');
     assert.ok(pos?.array.every(Number.isFinite),'Invalid mouth/saddle vertex: '+type);
     assert.equal(normal?.count,pos.count,'Missing smooth normals: '+type);
     assert.equal(uv?.count,pos.count,'Missing fabric/mouth UVs: '+type);
   }
   for(const part of Object.values(high).concat(Object.values(low)))part.dispose();
 }
 for(const type of ['forest_archer','seraph_guardian']){
   const high=buildCombatObjectGeometry(type,{detail:'high'});
   const low=buildCombatObjectGeometry(type,{detail:'low'});
   const skin=type==='seraph_guardian'?0xe9cfc1:0xe4b9a1;
   assert.ok(high.faceFallback&&low.faceFallback,'No offline face '+type);
   assert.ok(tagged(high.core,skin)>60,
     'Neck transition must match fallback face and hands '+type);
   assert.ok(tagged(high.faceFallback,skin)>100,
     'Human-shaped skull should be continuous rather than spheres '+type);
   const vertices=high.faceFallback.getAttribute('position');
   let minY=Infinity,maxY=-Infinity;
   for(let i=0;i<vertices.count;i++){minY=Math.min(minY,vertices.getY(i));maxY=Math.max(maxY,vertices.getY(i));}
   assert.ok(minY<2.14&&maxY>2.54,
     'Head contour must reach the neck without an open seam '+type);
   assert.ok(high.armL&&high.armR&&high.legBackL&&high.legBackR,
     'Body must keep independently articulated limbs '+type);
   for(const g of Object.values(high).concat(Object.values(low)))g.dispose();
 }
 for(const id of ['m001','m005','m006','m007','m010','m016','m020']){
   const model=createMonsterModel(MONSTER_BY_ID[id],{detail:'high'});
   const jaw=model.userData.pivots.jaw;
   assert.ok(jaw,'Quadruped missing jaw pivot '+id);
   let cavity=0,tongue=0,eyes=0,irises=0,lids=0;
   model.traverse(o=>{
     if(o.name==='quadruped-oral-cavity'){cavity++;assert.equal(o.parent,jaw);}
     if(o.name==='quadruped-tongue'){tongue++;assert.equal(o.parent,jaw);}
     if(o.name.startsWith('feline-iris-')){irises++;assert.equal(o.material.emissiveIntensity,0);}
     if(o.name.startsWith('feline-slit-pupil-'))eyes++;
     if(o.name.startsWith('feline-upper-eyelid-'))lids++;
   });
   assert.equal(cavity,1,'No oral cavity '+id);
   assert.equal(tongue,1,'No tongue '+id);
   if(MONSTER_BY_ID[id].family==='feline'){
     assert.equal(irises,2,'Feline missing paired irises '+id);
     assert.equal(eyes,2,'Feline missing slit pupils '+id);
     assert.equal(lids,2,'Feline missing overhanging eyelids '+id);
   }
   disposeMonsterSculpture(model);
   assert.equal(monsterSculptCacheStats().activeMaterials,0,
     'Leaked bestiary material '+id);
 }
}
console.log('Creature face/mouth/saddle QA PASS: 3D oral split, animal irises, fitting saddles, neck/head coherence, LOD and instancing');
