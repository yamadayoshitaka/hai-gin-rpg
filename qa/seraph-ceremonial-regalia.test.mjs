import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {addSeraphCeremonialRegalia,createSeraphFittedFoot,
 createSeraphDrapedPanel,createSeraphFrontTabard,
 SERAPH_REGALIA_REVISION} from '../src/seraph-ceremonial-regalia.js';
import {applySeraphCeremonialMaterial,
 SERAPH_CEREMONIAL_MATERIAL_REVISION,SERAPH_CLOTH_CC0_SOURCE}
 from '../src/seraph-ceremonial-material.js';
import {FEMALE_SUMMON_FORMS} from '../src/female-summon-forms.js';

const bounds=g=>new THREE.Box3().setFromBufferAttribute(g.getAttribute('position'));
function valid(g,label){
 const v=g.getAttribute('position'),uv=g.getAttribute('uv'),
  n=g.getAttribute('normal');
 assert.ok(v?.count>12,label+' must be a real mesh');
 assert.equal(uv?.count,v.count,label+' requires texture UV');
 assert.equal(n?.count,v.count,label+' requires vertex normal');
 assert.ok(v.array.every(Number.isFinite));
 assert.ok(uv.array.every(Number.isFinite));
 assert.ok(n.array.every(Number.isFinite));
}
test('new boot toe is elongated, flat and slimmer than old chocolate sphere',()=>{
 const top=createSeraphFittedFoot({detail:'high'});
 const sole=createSeraphFittedFoot({detail:'high',sole:true});
 const low=createSeraphFittedFoot({detail:'low'});
 for(const g of [top,sole,low])valid(g,'boot');
 const b=bounds(top),s=bounds(sole);
 assert.ok(b.max.z-b.min.z>.5,'boot shape must extend to a real toe');
 assert.ok(b.max.y-b.min.y<.25,'boot cannot be a big spherical ball');
 assert.ok(s.max.y-s.min.y<.055,'flat stitched outsole, not a giant bubble');
 assert.ok(s.max.y<b.min.y+.06,'sole below foot');
 assert.ok(top.getAttribute('position').count>low.getAttribute('position').count*1.5);
 for(const g of [top,sole,low])g.dispose();
});
test('ceremonial gown uses a curved 3D tabard and layered fabric',()=>{
 for(const factory of [createSeraphDrapedPanel,createSeraphFrontTabard]){
  const hi=factory({detail:'high'}),lo=factory({detail:'low'});
  valid(hi,factory.name);valid(lo,factory.name);
  assert.ok(hi.getAttribute('position').count>
    lo.getAttribute('position').count*2);
  hi.dispose();lo.dispose();
 }
});
test('the full design attaches to authentic moving bones, never to world root',()=>{
 const frames={chest:new THREE.Group(),pelvis:new THREE.Group(),
  head:new THREE.Group(),
  arms:[new THREE.Group(),new THREE.Group()],
  forearms:[new THREE.Group(),new THREE.Group()],
  legs:[new THREE.Group(),new THREE.Group()],
  calves:[new THREE.Group(),new THREE.Group()],
  feet:[new THREE.Group(),new THREE.Group()]};
 const list=[];
 const attach=(parent,geometry,role,name,p=[0,0,0],r=[0,0,0])=>{
  const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial());
  mesh.name=name;mesh.position.set(...p);mesh.rotation.set(...r);
  parent.add(mesh);list.push({mesh,role,parent});return mesh;
 };
 const tube=(frame,role,name,points,radius)=>{
  return attach(frame,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(
   points.map(p=>new THREE.Vector3(...p))),12,radius,6,false),role,name);
 };
 assert.equal(addSeraphCeremonialRegalia({profile:FEMALE_SUMMON_FORMS.seraph_guardian,
  detail:'high',frames,attach,tube}),true);
 assert.ok(list.length>=35,'need genuinely layered gown and leather boots');
 const named=name=>list.filter(x=>x.mesh.name.includes(name));
 assert.equal(named('fitted-foot-boot').length,2,'one real fitted boot for each foot');
 assert.equal(named('tailored-leather-outsole').length,2);
 assert.equal(named('tapered-leather-shaft').length,2);
 assert.equal(named('fitted-shin-vamp').length,2);
 assert.equal(named('silk-drape').length,3);
 assert.ok(named('center-hanging-heraldic-panel').length===1);
 assert.equal(list.filter(x=>x.role==='seraphSatin').length>5,true);
 assert.equal(list.filter(x=>x.role==='seraphBrocade').length>=2,true);
 for(const x of list){
  assert.ok(x.parent.isGroup);
  assert.ok(x.mesh.parent===x.parent);
  valid(x.mesh.geometry,x.mesh.name);
  x.mesh.geometry.dispose();x.mesh.material.dispose();
 }
 assert.ok(SERAPH_REGALIA_REVISION.includes('v3'));
});
test('fine satin keeps its ivory tone and never uses burlap albedo',()=>{
 assert.equal(SERAPH_CLOTH_CC0_SOURCE.license,'CC0');
 assert.match(SERAPH_CLOTH_CC0_SOURCE.page,/polyhaven.com\/a\/crepe_satin/);
 for(const role of ['seraphSatin','seraphBrocade','seraphGoldTrim',
  'seraphLeatherInset','seraphCapeLining']){
  const m=new THREE.MeshStandardMaterial({color:'red'});
  assert.equal(applySeraphCeremonialMaterial(m,{role,detail:'low'}),true);
  assert.equal(m.map,null);
  assert.ok(m.userData.seraphCeremonialRevision===SERAPH_CEREMONIAL_MATERIAL_REVISION);
  if(role==='seraphGoldTrim'){
   assert.ok(m.metalness>.7);
  }else{
   assert.ok(m.normalMap&&m.roughnessMap);
   assert.equal(m.metalness,0);
  }
  m.dispose();
 }
 const skin=new THREE.MeshStandardMaterial();
 assert.equal(applySeraphCeremonialMaterial(skin,{role:'skin'}),false);
 skin.dispose();
});
test('no texture or costume overhaul on forest, dragon and unrelated monsters',()=>{
 const runtime=readFileSync(new URL('../src/monster-character-cosplay.js',import.meta.url),'utf8');
 assert.match(runtime,/if\(profile\.costume==='seraph_female'\)\s*addSeraphCeremonialRegalia/);
 assert.match(runtime,/else addRegalHumanoidOutfit/);
 assert.match(runtime,/applySeraphCeremonialMaterial\(m,\{role,detail\}\)/);
 const material=readFileSync(new URL('../src/monster-cosplay-pigmentation.js',import.meta.url),'utf8');
 assert.match(material,/profile\.costume==='seraph_female'/);
 const footwear=readFileSync(new URL('../src/summon-footwear-pbr.js',import.meta.url),'utf8');
 assert.match(footwear,/seraphMatteLeatherFallback/);
 assert.match(footwear,/material\.userData\.seraphFootwear/);
 assert.match(footwear,/material\.map=null/);
 const gallery=readFileSync(new URL('../summon-showcase.html',import.meta.url),'utf8');
 assert.match(gallery,/seraph-ceremonial-regalia-v3-20261122/);
});
