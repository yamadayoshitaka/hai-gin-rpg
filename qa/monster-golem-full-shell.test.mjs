import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {humanoidMonsterCostumeFor}
 from '../src/monster-character-cosplay-manifest.js';
import {CONSTRUCT_COSTUME_KINDS,CONSTRUCT_SHELL_SPECIES,
 CONSTRUCT_FULL_SHELL_REVISION,addConstructMonsterCostume}
 from '../src/monster-construct-costume.js';

const source=readFileSync(new URL('../src/monster-character-cosplay.js',import.meta.url),'utf8');
assert.match(source,/if\(construct&&node\.isMesh\)\{/,
 'The human avatar must disappear, not be painted gray under a chest plate');
assert.match(source,/node\.visible=false;\s*node\.userData\.constructDonorConcealed=true/,
 'Clothes, eyes, bare face, head and hands must be hidden by runtime');
assert.match(source,/const groom=construct\?null:fullBody\?null:attachCanonicalCharacterGroom/,
 'No human hair or wig should grow on a crystal/stone golem');
assert.match(source,/const conceptFinish=fullBody\?Object\.freeze/,
 'Old floating humanoid decorations must not obscure new golem shell');
assert.match(source,/const mineral=construct\?CONSTRUCT_SHELL_SPECIES/,
 'Golem mineral palette must not come from human skin/clothes');
assert.match(source,/photographicHumanAlbedo:false/,
 'A donor velvet photograph must not darken the amethyst shell');
assert.match(source,/node\.visible=visible;delete node\.userData\.constructDonorConcealed/,
 'Concealed donor visibility must be safely restored at disposal');
assert.match(source,/constructShellParts:construct\?frames\.chest\.userData\.golemShellParts/,
 'Runtime must record actual geometry, not only the named concept');
assert.equal(CONSTRUCT_COSTUME_KINDS.length,5);
assert.equal(CONSTRUCT_FULL_SHELL_REVISION,'golem-anatomical-facets-v3-20261121');

const roles=new Set(['constructBase','constructFacet','constructTrim',
 'constructCore','constructDark']);
const frameSet=()=>({
 head:new THREE.Group(),neck:new THREE.Group(),chest:new THREE.Group(),
 pelvis:new THREE.Group(),arms:[new THREE.Group(),new THREE.Group()],
 forearms:[new THREE.Group(),new THREE.Group()],
 legs:[new THREE.Group(),new THREE.Group()],
 calves:[new THREE.Group(),new THREE.Group()],
 feet:[new THREE.Group(),new THREE.Group()]
});
const allFrames=f=>[f.head,f.neck,f.chest,f.pelvis,
 ...f.arms,...f.forearms,...f.legs,...f.calves,...f.feet];
let total=0;
for(const [index,id] of ['m036','m037','m038','m039','m040'].entries()){
 const profile=humanoidMonsterCostumeFor(id);
 const design=CONSTRUCT_SHELL_SPECIES[profile.costume];
 assert(design&&design.theme);
 assert.notEqual(design.base,design.dark);
 assert.notEqual(design.base,design.core);
 const counts=[];
 for(const detail of ['high','medium','low']){
  const frames=frameSet(),meshes=[];
  const attach=(frame,geometry,role,name,pos=[0,0,0],rot=[0,0,0])=>{
   const m=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial());
   m.name=name;m.userData.role=role;m.position.set(...pos);
   m.rotation.set(...rot);frame.add(m);meshes.push(m);return m;
  };
  const tube=(frame,role,name,points,radius)=>{
   const line=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));
   return attach(frame,new THREE.TubeGeometry(line,12,radius,5,false),
    role,name);
  };
  assert.equal(addConstructMonsterCostume({
   THREE,frames,profile,detail,attach,tube
  }),true);
  counts.push(meshes.length);total+=meshes.length;
  assert.ok(meshes.length>(detail==='high'?50:42),
   id+' has incomplete all-body geometry');
  assert.ok(meshes.length<140,id+' is too expensive for mobile LOD');
  assert.equal(frames.chest.userData.golemFullShellRevision,
   CONSTRUCT_FULL_SHELL_REVISION);
  assert.equal(frames.chest.userData.golemShellParts,meshes.length);
  for(const frame of allFrames(frames)){
   assert.ok(frame.children.length>0,
    'Exposed or disconnected joint on '+id+'/'+detail);
  }
  const names=meshes.map(m=>m.name);
  for(const name of ['complete-geometric-skull','integrated-chin-jaw',
   'full-rib-cage','complete-pelvis','solid-neck-joint',
   'full-mineral-hand-0','full-mineral-hand-1',
   'complete-arched-foot-0','complete-arched-foot-1',
   'inlaid-energy-stone']){
   assert.ok(names.some(x=>x.endsWith(name)),
    'Missing full cover '+id+'/'+detail+'/'+name);
  }
  for(const mesh of meshes){
   assert.ok(mesh.userData.golemFullShell,id+'/'+mesh.name);
   assert.equal(mesh.userData.golemSpecies,id);
   assert.equal(mesh.userData.boneAnchored,true);
   assert.ok(roles.has(mesh.userData.role),
    'Human cloth/skin material used for '+id+'/'+mesh.name);
   const a=mesh.geometry.getAttribute('position');
   assert.ok(a?.count>=3&&a.array.every(Number.isFinite));
   assert.ok(mesh.geometry.getAttribute('normal'),
    'Unlit custom geometry '+mesh.name);
   mesh.geometry.dispose();mesh.material.dispose();
  }
 }
 assert.ok(counts[0]>=counts[2],id+' high LOD weaker than low');
 console.log('Golem source coverage',index+1,id,profile.costume,
  'high/mid/low',counts.join('/'),'palette',design.theme);
}
assert.equal(addConstructMonsterCostume({
 profile:humanoidMonsterCostumeFor('m034')}),false);
console.log('PASS: five golems fully mineral-covered with moving bones, hands, neck, soles, three LOD tiers; total meshes',total);
