import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {FEMALE_SUMMON_FORMS} from '../src/female-summon-forms.js';
import {addFemaleSummonCostume} from '../src/female-summon-costumes.js';
import {applyMonsterMaterialPigment}
 from '../src/monster-cosplay-pigmentation.js';
import {wardrobeFor} from '../src/monster-regal-garments.js';
import {decorateMonsterPhotoMaterial}
 from '../src/monster-photo-pbr.js';

const profile=FEMALE_SUMMON_FORMS.forest_archer;
assert.equal(profile.skin,0xe1b496,'Elf skin must remain human-colored');
assert.ok(profile.forestGreen,'This appearance is explicitly forest green');
assert.equal(profile.cloth,0x338c51);
assert.equal(profile.leaf,0x39be67);
assert.equal(profile.forestMint,0x92de69);
assert.equal(wardrobeFor(profile).bodice,'leaf');
assert.equal(wardrobeFor(profile).hem,'leaf');

const clothMap=new THREE.Texture();
const normal=new THREE.Texture();
const donor=new THREE.MeshStandardMaterial({
 color:0x17171b,map:clothMap,normalMap:normal
});
const final=applyMonsterMaterialPigment(donor,'cloth',profile);
assert.equal(final.map,null,
 'Donor black garment base map must not multiply away vivid green');
assert.equal(final.normalMap,normal,
 'Keep texture geometry detail when correcting the dark donor garment');
assert.equal(final.color.getHex(),profile.cloth);
assert.equal(donor.map,clothMap,'Original donor GLB material must be untouched');
assert.equal(donor.color.getHex(),0x17171b);
assert.equal(final.userData.forestOpaqueEmeraldOutfit,true);
const skin=applyMonsterMaterialPigment(donor,'skin',profile);
assert.equal(skin.map,clothMap,'Never remove original skin texture');
assert.ok(skin.color.r>skin.color.g&&skin.color.g>skin.color.b,
 'Forest Spirit must not have green skin');
const other=applyMonsterMaterialPigment(donor,'cloth',FEMALE_SUMMON_FORMS.seraph_guardian);
assert.equal(other.map,clothMap,'Only Forest Spirit gets the special cloth fix');
for(const m of [donor,final,skin,other])m.dispose();
clothMap.dispose();normal.dispose();

const sampleMaterial=new THREE.MeshStandardMaterial({color:profile.leaf});
decorateMonsterPhotoMaterial(sampleMaterial,{
 family:'undead',speciesId:'forest_archer',role:'bandage'
});
assert.equal(sampleMaterial.userData.photoSurface,'linen',
 'Forest foliage must not get the original dark burgundy velvet albedo');
sampleMaterial.dispose();

function createFixture(){
 const frames={head:new THREE.Group(),chest:new THREE.Group(),
  pelvis:new THREE.Group(),forearms:[new THREE.Group(),new THREE.Group()]};
 const objects=[];
 const attach=(frame,geo,role,name,p=[0,0,0],rot=[0,0,0])=>{
  const mesh=new THREE.Mesh(geo,new THREE.MeshBasicMaterial());
  mesh.userData.role=role;
  mesh.name=name;mesh.position.set(...p);mesh.rotation.set(...rot);
  frame.add(mesh);objects.push(mesh);return mesh;
 };
 const tube=(frame,role,name,points,radius=.012)=>
  attach(frame,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(
   points.map(p=>new THREE.Vector3(...p))),9,radius,6,false),role,name);
 return {frames,objects,attach,tube,dispose(){
  for(const mesh of objects){mesh.geometry.dispose();mesh.material.dispose();}
 }};
}
for(const detail of ['low','high']){
 const fixture=createFixture();
 assert.equal(addFemaleSummonCostume({...fixture,profile,detail}),true);
 const foliage=fixture.objects.filter(x=>x.userData.forestCanopyOuterLayer);
 assert.equal(foliage.length,detail==='high'?36:20,
  'Forest requires two full rings of leafy outside panels on all 3D angles');
 assert.equal(foliage.filter(x=>x.userData.forestCanopyTier===0).length,
  detail==='high'?18:10);
 assert.equal(foliage.filter(x=>x.userData.forestCanopyTier===1).length,
  detail==='high'?18:10);
 assert.ok(foliage.every(x=>x.parent===fixture.frames.pelvis),
  'All forest robe leaves must follow native pelvis animation');
 assert.ok(foliage.every(x=>
  ['leaf','forestDeep','forestMint'].includes(x.userData.role)),
  'Skirt must be covered by explicitly green materials');
 for(const mesh of foliage){
  const p=mesh.geometry.getAttribute('position');
  assert.ok(p?.count>15&&p.array.every(Number.isFinite));
 }
 assert.ok(fixture.objects.some(x=>x.name.includes('forest-woven-cape')&&
  x.userData.role==='forestDeep'));
 fixture.dispose();
}

const runtime=readFileSync(new URL('../src/monster-character-cosplay.js',import.meta.url),'utf8');
assert.match(runtime,/leaf:'bandage',forestMint:'bandage',forestDeep:'bandage'/,
 'Leaf surface must map to pale linen, never black velvet');
assert.match(runtime,/profile\.forestGreen\?'bandage':'fabric'/,
 'Forest-owned cloth must use linen when photo-textured');
console.log('Forest Spirit emerald material, source GLB isolation and 360° leaf over-robe: PASS');
