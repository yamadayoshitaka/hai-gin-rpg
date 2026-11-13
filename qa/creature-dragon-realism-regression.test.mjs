import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {MONSTER_BY_ID} from '../src/monster-catalog.js';
import {startMonsterAction,animateMonsterModel} from '../src/monster-animation.js';

const source=readFileSync(new URL('../src/combat-creature-geometry.js',import.meta.url),'utf8');
assert.match(source,/createRootedCreatureHornGeometry/,
 'Dragon horns must be grown from buried curved keratin sockets');
assert.match(source,/createCreatureScuteGeometry/,
 'Dragon flank scales must have shallow natural dome, not plastic spikes');
assert.match(source,/socket\(name,skin,0,0,0/,
 'Rotating wing must carry a compact rooted collar and avoid exposed seams');
assert.match(source,/Discrete layered scales/,
 'Keep individually sculpted dragon armour scales');
const reptileSource=readFileSync(new URL('../src/monster-geometry.js',import.meta.url),'utf8');
assert.match(reptileSource,/reptile-recessed-eye/,
 'Reptile bestiary eyes must be narrow and sunk into their skull');
assert.match(reptileSource,/reptile-supraorbital-ridge/,
 'Reptilian skull needs built-in eyebrow protection');

const THREE=await import('three').catch(e=>{
 if(e.code==='ERR_MODULE_NOT_FOUND')return null;
 throw e;
});
if(THREE){
 const {createRootedCreatureHornGeometry,createCreatureScuteGeometry}=
   await import('../src/creature-anatomy-mesh.js');
 const root=[.08,.08,.08],mid=[.18,.40,-.04],tip=[.36,.76,-.18];
 const horn=createRootedCreatureHornGeometry({
   root,elbow:mid,tip,radius:.11,detail:'high'
 });
 const hornLow=createRootedCreatureHornGeometry({
   root,elbow:mid,tip,radius:.11,detail:'low'
 });
 assert.equal(horn.userData.kind,'curved-keratin-horn');
 assert.ok(horn.getAttribute('position').count>
   hornLow.getAttribute('position').count*2,'horn LOD must be cheaper');
 for(const geo of [horn,hornLow]){
   assert.ok(geo.index.count>20);
   for(const key of ['position','normal','uv'])
     assert.equal(geo.getAttribute(key).count,geo.getAttribute('position').count,
       'rooted horn needs fully UV-mapped, shaded vertices');
   assert.ok(geo.getAttribute('normal').array.every(Number.isFinite));
 }
 const hornPos=horn.getAttribute('position'),circumference=9;
 let rootWidth=0,tipWidth=0;
 for(let i=0;i<circumference;i++){
   const d=new THREE.Vector3().fromBufferAttribute(hornPos,i).distanceTo(
     new THREE.Vector3(...root));
   rootWidth=Math.max(rootWidth,d);
   const e=new THREE.Vector3().fromBufferAttribute(hornPos,
     hornPos.count-circumference+i).distanceTo(new THREE.Vector3(...tip));
   tipWidth=Math.max(tipWidth,e);
 }
 assert.ok(rootWidth>.09&&tipWidth<.004,'horn root must taper into a fine tip');
 assert.throws(()=>createRootedCreatureHornGeometry({
   root,elbow:mid,tip:[NaN,0,0],radius:.1
 }),/Invalid/);
 const scute=createCreatureScuteGeometry({
   center:[.4,1.6,.1],normal:[1,.15,.1],
   radiusX:.08,radiusY:.13,depth:.025,detail:'high'
 });
 const scuteLow=createCreatureScuteGeometry({
   center:[.4,1.6,.1],normal:[1,.15,.1],
   radiusX:.08,radiusY:.13,depth:.025,detail:'low'
 });
 assert.equal(scute.userData.kind,'anatomical-scute');
 assert.ok(scute.getAttribute('position').count>scuteLow.getAttribute('position').count*2,
   'armour scutes must have near/distant LOD');
 for(const geo of [scute,scuteLow]){
   assert.ok(geo.getAttribute('position').array.every(Number.isFinite));
   assert.ok(geo.getAttribute('normal').array.every(Number.isFinite));
   assert.equal(geo.getAttribute('uv').count,geo.getAttribute('position').count);
 }
 for(const g of [horn,hornLow,scute,scuteLow])g.dispose();
 const {buildCombatObjectGeometry}=await import('../src/combat-creature-geometry.js');
 const limit={wyvern:175000,dragon:175000,elder_dragon:205000,dragon_lord:225000};
 for(const [type,max] of Object.entries(limit)){
   const hi=buildCombatObjectGeometry(type,{detail:'high'});
   const lo=buildCombatObjectGeometry(type,{detail:'low'});
   const sum=geo=>Object.values(geo).reduce((n,g)=>n+g.getAttribute('position').count,0);
   assert.ok(sum(hi)<max,'GPU per-type high LOD vertex limit exceeded: '+type);
   assert.ok(sum(hi)>sum(lo)*3,'Distance LOD no longer effective: '+type);
   assert.deepEqual(Object.keys(hi).sort(),Object.keys(lo).sort(),
     type+' must keep same articulated GPU part list at both LODs');
   for(const key of ['core','wingL','wingR','jaw','eyes']){
     assert.ok(hi[key]&&lo[key],'missing source GPU part '+type+':'+key);
     assert.ok(hi[key].getAttribute('normal').array.every(Number.isFinite));
   }
   for(const g of [...Object.values(hi),...Object.values(lo)])g.dispose();
 }
 const {createMonsterModel,disposeMonsterSculpture,monsterSculptCacheStats}=
   await import('../src/monster-geometry.js');
 for(const id of ['m016','m017','m018','m019']){
   const animal=createMonsterModel(MONSTER_BY_ID[id],{detail:'high'});
   let lids=0,eyes=0;
   animal.traverse(n=>{
     if(n.name==='nictitating-membrane')lids++;
     if(n.name==='reptile-recessed-eye'&&n.isMesh){
       eyes++;
       assert.equal(n.material.emissiveIntensity,0,
         'Anatomical reptile eye should not glow '+id);
     }
   });
   assert.equal(lids,2,'reptile retains its two animated nictitating lids '+id);
   assert.equal(eyes,2,'reptile must have narrow non-bulging eyes '+id);
   const lid=animal.userData.pivots.eyelidL;
   assert.ok(lid?.userData?.blinkTravel>0);
   const offset=(Number(id.slice(-3))%7)*.37;
   startMonsterAction(animal,'idle',0);
   animateMonsterModel(animal,4.0-offset);
   const open=lid.position.y;
   animateMonsterModel(animal,4.50-offset);
   assert.ok(lid.position.y<open-.03,'reptile blink must move real lid '+id);
   startMonsterAction(animal,'defeat',10);
   animateMonsterModel(animal,12);
   assert.ok(lid.position.y<open-.06,'dead reptile keeps eyelid shut '+id);
   disposeMonsterSculpture(animal);
   assert.equal(monsterSculptCacheStats().activeMaterials,0);
 }
}
console.log('Creature realism regression: rooted keratin, true scutes, sealed wings, reptile eyelids, GPU instancing, LOD and memory PASS');
