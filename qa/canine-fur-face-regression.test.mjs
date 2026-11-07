import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {generateCanineFurGuides,canineFurGuideStats} from '../src/canine-fur-guides.js';
import {MONSTER_CATALOG} from '../src/monster-catalog.js';

const dense=generateCanineFurGuides({
 center:[0,1,0],radii:[.48,.36,.78],rows:30,around:38,length:.12,width:.026,
});
const sparse=generateCanineFurGuides({
 center:[0,1,0],radii:[.48,.36,.78],rows:10,around:14,length:.11,width:.023,
});
assert.ok(dense.length>500,'The close-up coat needs visible layered strands');
assert.ok(dense.length>sparse.length*4,'Distance LOD must be substantially lighter');
assert.equal(canineFurGuideStats(dense).invalid,0,'Coat guide positions must be finite');
assert.deepEqual(canineFurGuideStats(dense).shades.sort(),['light','shadow','skin']);
for(const g of dense){
 assert.ok(g.tip[2]<g.root[2],'Hair must follow the canine rearward coat grain');
 assert.ok(g.width>.005&&g.width<.08,'Hair blades must remain fine');
}
// Pure geometry/guide checks work even in the no-dependencies architecture
// runner. The full WebGL geometry checks run when the browser CI installs three.
const THREE=await import('three').catch(error=>{
 if(error.code==='ERR_MODULE_NOT_FOUND')return null;
 throw error;
});
if(THREE){
 const [{buildCanineFurRibbonGeometry},{buildCombatObjectGeometry},
   {createMonsterModel,disposeMonsterSculpture,monsterSculptCacheStats}]=await Promise.all([
     import('../src/canine-fur-ribbons.js'),
     import('../src/combat-creature-geometry.js'),
     import('../src/monster-geometry.js')
   ]);
const ribbons=buildCanineFurRibbonGeometry(dense);
const positions=ribbons.getAttribute('position');
assert.ok(positions.count>=dense.length*5);
assert.equal(ribbons.getAttribute('uv').count,positions.count);
assert.ok(ribbons.getAttribute('normal')?.count===positions.count);
assert.equal(ribbons.userData.strands,dense.length);
ribbons.dispose();

const wolfHi=buildCombatObjectGeometry('wolf',{detail:'high'});
const wolfLow=buildCombatObjectGeometry('wolf',{detail:'low'});
assert.ok(wolfHi.core&&wolfHi.eyes&&wolfHi.jaw&&wolfHi.tail);
assert.ok(wolfHi.core.getAttribute('position').count>
  wolfLow.core.getAttribute('position').count*4,'Wolf fur and face should retain meaningful near LOD');
assert.ok(wolfHi.core.getAttribute('uv').count>1000);
assert.ok(wolfHi.core.getAttribute('position').count<125000,
  'Even the richly furred grey wolf must respect the GPU instancing vertex budget');
for(const geometry of Object.values(wolfHi))geometry.dispose();
for(const geometry of Object.values(wolfLow))geometry.dispose();

const wolves=MONSTER_CATALOG.filter(spec=>spec.family==='beast');
assert.equal(wolves.length,5,'Exactly five independently defined wolf monsters');
for(const spec of wolves){
 const high=createMonsterModel(spec,{detail:'high'});
 const hairs=[];
 let eyeCount=0;
 high.traverse(node=>{
  if(node.isMesh&&node.userData.furStrands)hairs.push(node);
  if(node.isMesh&&node.name==='eye')eyeCount++;
 });
 const count=hairs.reduce((a,h)=>a+h.userData.furStrands,0);
 assert.ok(count>700,spec.id+' should have coat, mane, cheek and tail fur');
 assert.ok(hairs.length<=12,spec.id+' fur must be batched, not hundreds of objects');
 assert.ok(eyeCount>=2,spec.id+' needs individual small eyes under a brow ridge');
 assert.ok(hairs.every(h=>h.material.userData.photoSurface==='fur'||
      h.material.userData.monsterCacheKey.includes('shadow')),
   spec.id+' should keep the original fur PBR materials');
 disposeMonsterSculpture(high);
 assert.equal(monsterSculptCacheStats().activeMaterials,0,
   'After a creature switch no canine materials should leak');

 const low=createMonsterModel(spec,{detail:'low'});
 let lowFur=0;
 low.traverse(n=>lowFur+=n.userData.furStrands||0);
 assert.equal(lowFur,0,spec.id+' low LOD must use the shared coat photo tile only');
 disposeMonsterSculpture(low);
 assert.equal(monsterSculptCacheStats().activeMaterials,0);
}

}else{
 console.log('Geometry checks deferred: three is not installed in architecture-only CI');
}

const source=readFileSync(new URL('../src/combat-creature-geometry.js',import.meta.url),'utf8');
assert.match(source,/addCoat\('core'/,'Summoned wolf should have real physical coat blades');
assert.match(source,/joint\('core',0x181a1b/,'Wolf nostrils should be distinct');
const gallery=readFileSync(new URL('../summon-showcase.html',import.meta.url),'utf8');
assert.match(gallery,/selected==='wolf'\)\{/,'Wolf must have a direct face close-up');
const version=gallery.match(/3D鑑賞 v(4\.4\.\d+)/);
assert.ok(version,'Viewer must display its current model revision');
assert.ok(gallery.includes("combat-world-object-renderer.js?v="+version[1]),
  'The world-object renderer import must be cache-busted with the same revision');
const manager=readFileSync(new URL('../monster-manager.html',import.meta.url),'utf8');
assert.match(manager,/value="procedural"/,'Keep original, high-quality procedural model as default');
assert.match(manager,/戦闘は未置換/,'Never silently substitute external low-poly combat models');
console.log('Canine coat (5 beasts + summon), muzzle/eyes, GPU near/far LOD, fur map, material release and safe external fallback PASS');
