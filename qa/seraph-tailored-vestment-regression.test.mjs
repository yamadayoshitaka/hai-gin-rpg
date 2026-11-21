import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {addSeraphCelestialVestment,createSeraphTabardGeometry,
 createSeraphShoeGeometry,SERAPH_VESTMENT_REVISION}
 from '../src/seraph-celestial-wardrobe.js';
import {applySeraphTailoredMaterial,isSeraphTailoredRole,
 SERAPH_TAILORED_MATERIAL_REVISION,seraphTailoredMaterialStats}
 from '../src/seraph-celestial-materials.js';
import {REGAL_HUMANOID_WARDROBE,addRegalHumanoidOutfit}
 from '../src/monster-regal-garments.js';

function inspect(g){
 assert.ok(g.isBufferGeometry);
 const p=g.getAttribute('position'),uv=g.getAttribute('uv'),
  n=g.getAttribute('normal');
 assert.ok(g.index.count>30);
 assert.ok(p.count===uv.count&&p.count===n.count);
 for(const attr of [p,uv,n])for(const x of attr.array)assert.ok(Number.isFinite(x));
 const bb=new THREE.Box3().setFromBufferAttribute(p);
 assert.ok(!bb.isEmpty());return bb;
}
test('real angel boots replace spherical melted-chocolate shoe last',()=>{
 for(const detail of ['high','low']){
  const boot=createSeraphShoeGeometry({detail});
  const bounds=inspect(boot),dims=new THREE.Vector3();
  bounds.getSize(dims);
  assert.ok(dims.x>.2&&dims.x<.27,'shoe must be narrow: '+dims.x);
  assert.ok(dims.z>.57&&dims.z<.7,'shoe must have toe and heel: '+dims.z);
  assert.equal(boot.userData.seraphVestment,'last-shaped-boot');
  boot.dispose();
 }
 const high=createSeraphShoeGeometry({detail:'high'});
 const low=createSeraphShoeGeometry({detail:'low'});
 assert.ok(high.getAttribute('position').count>
  low.getAttribute('position').count*2,'near camera gets extra shoe topology');
 high.dispose();low.dispose();
});
test('silk tabard is contoured and UV mapped',()=>{
 for(const side of [-1,0,1]){
  const hi=createSeraphTabardGeometry({detail:'high',side});
  const lo=createSeraphTabardGeometry({detail:'low',side});
  inspect(hi);inspect(lo);
  assert.ok(hi.getAttribute('position').count>
   lo.getAttribute('position').count*2);
  hi.dispose();lo.dispose();
 }
});
test('full costume covers body and is attached to native moving bones',()=>{
 const group=()=>new THREE.Group();
 const frames={chest:group(),pelvis:group(),head:group(),
  legs:[group(),group()],calves:[group(),group()],
  feet:[group(),group()],arms:[group(),group()],
  forearms:[group(),group()]};
 const items=[],attach=(parent,geo,role,name,pos=[0,0,0],rot=[0,0,0])=>{
  const mesh=new THREE.Mesh(geo,new THREE.MeshStandardMaterial());
  mesh.name=name;mesh.position.set(...pos);mesh.rotation.set(...rot);
  parent.add(mesh);items.push({mesh,role,parent,name});return mesh;
 };
 const tubes=(parent,role,name,points,thickness)=>attach(parent,
  new THREE.TubeGeometry(new THREE.CatmullRomCurve3(
   points.map(v=>new THREE.Vector3(...v))),8,thickness,6,false),role,name);
 assert.equal(addRegalHumanoidOutfit({
  profile:{costume:'seraph_female'},frames,detail:'high',attach,tube:tubes
 }),true);
 assert.ok(items.length>=24,'not a one-piece cone');
 assert.ok(items.some(v=>v.role==='seraphBrocade'&&v.parent===frames.pelvis));
 assert.ok(items.some(v=>v.role==='seraphSatin'&&v.parent===frames.chest));
 assert.ok(items.some(v=>v.role==='seraphOrganza'));
 assert.ok(items.some(v=>v.role==='seraphGold'));
 assert.ok(items.some(v=>v.role==='summonBootLeather'));
 assert.ok(items.some(v=>v.role==='summonBootSole'));
 assert.ok(items.some(v=>v.name.includes('real-stitched-toe-boot')));
 assert.ok(!items.some(v=>v.role==='ivoryCloth'||v.role==='linen'),
  'brown burlap photo must not be mapped to dress');
 assert.equal(items.filter(v=>v.name.includes('continuous-gold-hip-belt')).length,1);
 assert.ok(frames.calves.every(f=>f.children.some(m=>m.name.includes('boot-shaft'))));
 assert.ok(frames.feet.every(f=>f.children.some(m=>m.name.includes('toe-boot'))));
 for(const item of items){inspect(item.mesh.geometry);
  item.mesh.geometry.dispose();item.mesh.material.dispose();}
 assert.match(SERAPH_VESTMENT_REVISION,/tailored/);
 assert.equal(REGAL_HUMANOID_WARDROBE.forest_spirit_female.leggings,'leaf');
 assert.ok(!REGAL_HUMANOID_WARDROBE.dragonkin_female.tailoredCelestial);
});
test('real ivory silk light response does not load brown diffuse photo',()=>{
 const silkRoles=['seraphSatin','seraphBrocade','seraphOrganza',
  'seraphLining','seraphGold','seraphEmbroidery'];
 for(const role of silkRoles){
  assert.ok(isSeraphTailoredRole(role));
  const m=new THREE.MeshPhysicalMaterial({color:0xfaf7ef});
  assert.ok(applySeraphTailoredMaterial(m,{role,detail:'high'}));
  assert.ok(m.userData.noBurlapDiffuse);
  assert.equal(m.userData.seraphTailoredRevision,
   SERAPH_TAILORED_MATERIAL_REVISION);
  assert.ok(m.roughness>.25&&m.roughness<.85);
  assert.ok(role==='seraphGold'?m.metalness>.5:true);
  if(role==='seraphSatin')assert.ok(m.normalMap&&m.map);
  m.dispose();
 }
 assert.equal(applySeraphTailoredMaterial(
  new THREE.MeshPhysicalMaterial(),{role:'skin'}),false);
 assert.ok(seraphTailoredMaterialStats().weaveAtlases>=2);
 const runtime=readFileSync(new URL('../src/monster-character-cosplay.js',import.meta.url),'utf8');
 assert.match(runtime,/applySeraphTailoredMaterial\(m,\{role,detail\}\)/);
 assert.match(runtime,/SERAPH_VESTMENT_REVISION/);
 assert.match(runtime,/profile\.costume==='seraph_female'\?0x696767/);
 const gallery=readFileSync(new URL('../summon-showcase.html',import.meta.url),'utf8');
 assert.match(gallery,/seraph-tailored-v3-20261122/);
});
