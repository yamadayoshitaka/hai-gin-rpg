import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {
 createMummyWrapRibbon,createGothicMantle,
 createRibbedBreastplate,createGothicHorn,createGothicBatWing,
 createKnightSkullBrow,createGothicUpperLashFanGeometry,GOTHIC_MONSTER_KINDS,
 hasGothicMonsterSculpt,addGothicMonsterSculpt
} from '../src/monster-gothic-sculpt.js';
import {HUMANOID_MONSTER_COSTUMES,FEMALE_VAMPIRE_COSTUME,humanoidMonsterCostumeFor} from '../src/monster-character-cosplay-manifest.js';

function geometryContract(g,label){
 const p=g.getAttribute('position'),normal=g.getAttribute('normal'),
  uv=g.getAttribute('uv'),ix=g.index;
 assert.ok(p.count>20,label+' lacks 3D surface');
 assert.ok(ix.count>30,label+' lacks triangulated surface');
 assert.equal(normal.count,p.count,label+' lacks accurate normals');
 assert.equal(uv.count,p.count,label+' lacks UV map');
 assert.ok(p.array.every(Number.isFinite),label+' bad positions');
 assert.ok(normal.array.every(Number.isFinite),label+' bad normals');
 assert.ok(uv.array.every(Number.isFinite),label+' bad UVs');
}
for(const [label,create] of [
 ['mummy linen',createMummyWrapRibbon],
 ['tailored velvet',createGothicMantle],
 ['engraved breastplate',createRibbedBreastplate],
 ['real horn',createGothicHorn],
 ['scalloped wing',createGothicBatWing],
 ['skeletal cheekbone',createKnightSkullBrow]
]){
 const hi=create({detail:'high'}),lo=create({detail:'low'});
 geometryContract(hi,label+' high');geometryContract(lo,label+' low');
 assert.ok(hi.getAttribute('position').count>
    lo.getAttribute('position').count*1.8,
    label+' low LOD has too many vertices');
 hi.dispose();lo.dispose();
}
assert.ok(!hasGothicMonsterSculpt('imp'));
assert.equal(GOTHIC_MONSTER_KINDS.length,6);
const expected=[
 ['m034','vampire',['vampire-blackcoat-back','vampire-recessed-canine-','vampire-ruby-brooch']],
 ['m032','mummy',['mummy-head-linen','mummy-chest-linen','mummy-sunken-eye-']],
 ['m031','skeleton',['skeleton-skull-zygomatic-','skeleton-deep-orbit-','skeleton-battle-torn-cloak']],
 ['m033','death_knight',['death_knight-breastplate-','death_knight-lower-tooth-','death_knight-cursed-breast-sigil']],
 ['m044','succubus',['succubus-swept-horn-','succubus-wing-membrane-','succubus-corset-edge-']],
 ['m045','dark_knight',['dark_knight-breastplate-','dark_knight-battle-torn-cloak']]
];
const results=new Map();
const femaleVampire=humanoidMonsterCostumeFor('m034',{genderVariant:'female'});
assert.equal(femaleVampire,FEMALE_VAMPIRE_COSTUME);
assert.equal(femaleVampire.sex,'female');
assert.equal(femaleVampire.modelId,'Superhero_Female_FullBody');
assert.equal(humanoidMonsterCostumeFor('m034').modelId,'Superhero_Male_FullBody');
assert.equal(femaleVampire.costume,'vampire');
const gallery=readFileSync(new URL('../monster-manager.html',import.meta.url),'utf8');
const manifest=readFileSync(
 new URL('../src/monster-character-cosplay-manifest.js',import.meta.url),'utf8');
const runtime=readFileSync(
 new URL('../src/monster-character-cosplay.js',import.meta.url),'utf8');
assert.match(manifest,/FEMALE_VAMPIRE_COSTUME/,
 'A female version must use the same canonical female hero model');
assert.match(runtime,/genderVariant=null/,
 'The actual 3D runtime needs a selectable vampire variant');
assert.match(gallery,/id="vampireSex"/,
 'Show a male/female vampire model switch in the actual game viewer');
assert.match(gallery,/genderVariant:id==='m034'\?byId\('vampireSex'\).value:null/,
 'The displayed monster must respect the female vampire selection');
function fixture(detail){
 const make=()=>new THREE.Group();
 const frames={head:make(),chest:make(),
  arms:[make(),make()],forearms:[make(),make()],
  calves:[make(),make()],legs:[make(),make()]};
 const nodes=[],attach=(parent,geometry,role,name,p=[0,0,0],r=[0,0,0])=>{
  const m=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial());
  m.name='monster-costume-'+name;m.userData.role=role;
  m.position.set(...p);m.rotation.set(...r);parent.add(m);nodes.push(m);return m;
 };
 const tube=(frame,role,name,points,radius=.015)=>{
  const geom=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(
   points.map(p=>new THREE.Vector3(...p))),detail==='high'?15:6,
   radius,detail==='high'?8:5,false);
  return attach(frame,geom,role,name);
 };
 return {frames,nodes,attach,tube};
}
for(const [id,costume,needles] of expected){
 const profile=HUMANOID_MONSTER_COSTUMES[id];
 assert.equal(profile.costume,costume);
 const hi=fixture('high'),lo=fixture('low');
 assert.equal(addGothicMonsterSculpt({profile,detail:'high',...hi}),true);
 assert.equal(addGothicMonsterSculpt({profile,detail:'low',...lo}),true);
 for(const name of needles)assert.ok(
  hi.nodes.some(o=>o.name.includes(name)),id+' missing '+name);
 assert.ok(hi.nodes.length>=9,id+' has too few sculpted components');
 const face=hi.nodes.filter(o=>o.name.includes('monster-costume-'));
 assert.equal(face.length,hi.nodes.length);
 for(const node of [...hi.nodes,...lo.nodes]){
  const pos=node.geometry.getAttribute('position');
  assert.ok(pos.array.every(Number.isFinite),id+'/'+node.name+' invalid vertices');
  assert.ok(node.geometry.getAttribute('normal').array.every(Number.isFinite));
  assert.ok(node.geometry.getAttribute('uv')?.array.every(Number.isFinite));
  assert.ok(node.parent?.isGroup,id+' detached accessory '+node.name);
 }
 const vertexCount=ns=>ns.reduce((n,o)=>n+o.geometry.getAttribute('position').count,0);
 const highVerts=vertexCount(hi.nodes),lowVerts=vertexCount(lo.nodes);
 assert.ok(highVerts>lowVerts*1.8,id+' insufficient LOD reduction '+highVerts+'/'+lowVerts);
 assert.ok(highVerts<30000,id+' unreasonable mobile costume geometry '+highVerts);
 if(id==='m034'){
  assert.ok(hi.nodes.some(o=>o.name.includes('vampire-blackcoat-back')&&
    o.parent===hi.frames.chest),'Vampire cape must follow spine');
  assert.equal(hi.nodes.filter(o=>o.name.includes('vampire-recessed-canine-')&&
    o.parent===hi.frames.head).length,2,
    'Both vampire fangs must move with actual head');
 }
 if(id==='m034'||id==='m044'){
  for(const sculpt of [hi,lo]){
   const lashes=sculpt.nodes.filter(o=>o.name.includes('-upper-lashes-'));
   assert.equal(lashes.length,2,id+' needs both native-eye eyelash fans');
   for(const node of lashes){
    assert.strictEqual(node.parent,sculpt.frames.head,
     'Eyelashes must move with canonical Head bone');
    assert.equal(node.userData.role,'makeup','No emissive fake iris materials');
    assert.equal(node.geometry.userData.kind,'gothic-canonical-upper-lash-fan');
    const p=node.geometry.getAttribute('position'),
     uv=node.geometry.getAttribute('uv'),normal=node.geometry.getAttribute('normal');
    assert.equal(uv.count,p.count);assert.equal(normal.count,p.count);
    assert.ok(p.array.every(Number.isFinite));
    assert.ok(node.geometry.index.count>=24);
   }
   assert.ok(sculpt.nodes.every(o=>!/(vampire-blood-iris|vampire-orbital-shadow|succubus-narrow-crimson-iris|succubus-eye-makeup)/.test(o.name)),
    'Duplicate artificial iris or heavy eye sphere: '+id);
  }
 }
 if(id==='m032'){
  assert.ok(hi.nodes.filter(o=>o.name.includes('mummy-')&&
    o.geometry.userData.kind==='mummy-wrapped-linen-ribbon').length>=7,
    'Mummy linen must be physical ribbons, not cylindrical strings');
 }
 if(id==='m044'){
  assert.equal(hi.nodes.filter(o=>o.geometry.userData.kind==='scalloped-bat-wing-membrane'&&
    o.parent===hi.frames.chest).length,2);
 }
 results.set(id,{highVerts,lowVerts,meshes:hi.nodes.length});
 for(const n of [...hi.nodes,...lo.nodes]){
  n.geometry.dispose();n.material.dispose();
 }
}
// Preserve the real imported eye lens; verify near/distant geometry budget.
for(const side of [-1,1]){
 const high=createGothicUpperLashFanGeometry({side,detail:'high'});
 const low=createGothicUpperLashFanGeometry({side,detail:'low'});
 assert.ok(high.getAttribute('position').count>low.getAttribute('position').count*1.9);
 assert.ok(high.getAttribute('position').count<100,'Mobile lash vertices ceiling');
 for(const g of [high,low]){
  const a=g.getAttribute('position');
  assert.ok(a.array.every(Number.isFinite));
  assert.equal(g.getAttribute('uv').count,a.count);
  assert.equal(g.getAttribute('normal').count,a.count);
  assert.ok(g.getAttribute('normal').array.every(Number.isFinite));
  assert.ok(g.index.count>=24);
 }
 high.dispose();low.dispose();
}
assert.throws(()=>createGothicUpperLashFanGeometry({side:0}),/Lash side/);
const variant=fixture('high');
assert.equal(addGothicMonsterSculpt({profile:FEMALE_VAMPIRE_COSTUME,detail:'high',...variant}),true);
assert.equal(variant.nodes.filter(o=>o.name.includes('vampire-upper-lashes-')).length,2);
assert.equal(variant.nodes.filter(o=>/vampire-blood-iris|vampire-orbital-shadow/.test(o.name)).length,0);
for(const n of variant.nodes){n.geometry.dispose();n.material.dispose();}
const costumeSource=readFileSync(
 new URL('../src/monster-character-cosplay.js',import.meta.url),'utf8');
const manager=readFileSync(new URL('../monster-manager.html',import.meta.url),'utf8');
assert.match(costumeSource,/addGothicMonsterSculpt\(/);
assert.match(costumeSource,/gothicSculptEdition/);
assert.match(costumeSource,/decorateMonsterPhotoMaterial/,
 'Bundled linen, velvet, leather and steel photo texture needed');
assert.match(costumeSource,/detachMonsterPhotoMaterial/,
 'Shared photo-textures must detach from disposed instance materials');
assert.match(costumeSource,/if\(!gothic&&costume==='mummy'\)/,
 'Do not draw old ribbon-string mummy over new linen fabric');
assert.match(costumeSource,/if\(!gothic&&costume==='skeleton'\)/,
 'Do not render the old toy sphere skull over new anatomy');
assert.match(costumeSource,/if\(!gothic&&!demonic&&!femaleSummon&&profile.wings\)/,
 'Do not overlay triangle wings over proper bat membranes');
assert.match(costumeSource,/node\.material=Array\.isArray\(node\.material\)/,
 'Source hero material must be cloned before recoloring');
assert.match(manager,/createCosplayedHumanoidMonster/,
 'Gothic sculpt must be available in actual bestiary 3D viewer');
console.log('Gothic character-based monster QA PASS',Object.fromEntries(results));
