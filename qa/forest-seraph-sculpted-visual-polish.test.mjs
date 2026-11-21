import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {FEMALE_SUMMON_FORMS} from '../src/female-summon-forms.js';
import {createFemaleSummonLeaf,addFemaleSummonCostume}
 from '../src/female-summon-costumes.js';
import {addForestSpiritTailoredOutfit,FOREST_SPIRIT_TAILORED_REVISION}
 from '../src/forest-spirit-tailored-wardrobe.js';
import {REGAL_HUMANOID_WARDROBE,addRegalHumanoidOutfit}
 from '../src/monster-regal-garments.js';
import {applyForestSpiritPBR,isForestSpiritMaterialRole,forestSpiritPBRStats,
 FOREST_SPIRIT_PBR_REVISION} from '../src/forest-spirit-pbr.js';
import {addSeraphCelestialVestment,SERAPH_VESTMENT_REVISION}
 from '../src/seraph-celestial-wardrobe.js';
import {applySummonFootwearPBR,detachSummonFootwearPBR}
 from '../src/summon-footwear-pbr.js';

function fixture(){
 const group=()=>new THREE.Group();
 const frames={head:group(),chest:group(),pelvis:group(),
  arms:[group(),group()],forearms:[group(),group()],
  legs:[group(),group()],calves:[group(),group()],
  feet:[group(),group()]};
 const objects=[];
 const attach=(parent,geometry,role,name,p=[0,0,0],rot=[0,0,0])=>{
  const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial());
  mesh.name=name;mesh.userData.role=role;
  mesh.position.set(...p);mesh.rotation.set(...rot);
  parent.add(mesh);objects.push(mesh);return mesh;
 };
 const tube=(parent,role,name,points,radius=.003)=>
  attach(parent,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(
   points.map(p=>new THREE.Vector3(...p))),10,radius,6,false),role,name);
 return {frames,objects,attach,tube,dispose(){
  for(const mesh of objects){mesh.geometry.dispose();mesh.material.dispose();}
 }};
}
function check(g,label){
 assert.ok(g.isBufferGeometry,label);
 const pos=g.getAttribute('position'),uv=g.getAttribute('uv'),
  nor=g.getAttribute('normal');
 assert.ok(pos?.count>10,label+' has no vertices');
 assert.equal(pos.count,uv?.count,label+' lacks UV');
 assert.equal(pos.count,nor?.count,label+' lacks normals');
 assert.ok((g.index?.count??pos.count)>18,label+' missing triangles');
 for(const a of [pos,uv,nor])assert.ok(a.array.every(Number.isFinite),label+' invalid float');
}
test('Forest leaves are sculpted 3D veined blades with asymmetry and cheap mobile LOD',()=>{
 const high=createFemaleSummonLeaf({detail:'high',size:.31,variety:3});
 const low=createFemaleSummonLeaf({detail:'low',size:.31,variety:3});
 check(high,'leaf high');check(low,'leaf low');
 assert.equal(high.userData.curvedLeafBlade,true);
 assert.equal(high.userData.realLeafMidrib,true);
 assert.ok(high.getAttribute('position').count>low.getAttribute('position').count*2);
 const p=high.getAttribute('position');
 let minZ=Infinity,maxZ=-Infinity;
 for(let i=0;i<p.count;i++){
  minZ=Math.min(minZ,p.getZ(i));maxZ=Math.max(maxZ,p.getZ(i));
 }
 assert.ok(maxZ-minZ>.03,'blade needs real 3D depth and curved midrib');
 assert.ok(high.userData.leafVariety===3);
 high.dispose();low.dispose();
});
test('Forest leaf skirt retains 360-degree ring and all species anatomy',()=>{
 const prof=FEMALE_SUMMON_FORMS.forest_archer;
 const hi=fixture(),lo=fixture();
 for(const [f,detail,count] of [[hi,'high',36],[lo,'low',20]]){
  assert.equal(addFemaleSummonCostume({...f,profile:prof,detail}),true);
  const outer=f.objects.filter(o=>o.userData.forestCanopyOuterLayer);
  assert.equal(outer.length,count);
  assert.equal(outer.filter(o=>o.userData.forestCanopyTier===0).length,count/2);
  assert.ok(outer.every(o=>o.parent===f.frames.pelvis));
  const sizes=outer.map(o=>o.geometry.getAttribute('position'))
   .map(p=>Math.max(...Array.from({length:p.count},(_,i)=>p.getY(i))));
  assert.ok(Math.max(...sizes)<.40,'leaves must not cover whole character like giant cards');
  assert.ok(f.objects.some(o=>o.name.includes('wood-antler-trunk')&&o.userData.role==='forestBark'));
  for(const o of outer)check(o.geometry,o.name);
 }
 hi.dispose();lo.dispose();
});
test('Forest fitted cloth and footwear are separate articulated genuine mesh layers',()=>{
 const prof=FEMALE_SUMMON_FORMS.forest_archer;
 assert.equal(REGAL_HUMANOID_WARDROBE.forest_spirit_female.tailoredForest,true);
 for(const detail of ['low','high']){
  const f=fixture();
  assert.equal(addRegalHumanoidOutfit({...f,profile:prof,detail}),true);
  const named=name=>f.objects.filter(x=>x.name.includes(name));
  for(const name of ['fitted-fern-silk-bodice','forest-silk-underskirt',
   'front-embroidered-mantle','shoulder-tailored-layer','split-side-drape',
   'forest-anatomical-toe-boot','forest-tapered-boot-shaft']){
   assert.ok(named(name).length>=1,'missing '+name);
  }
  assert.equal(named('forest-anatomical-toe-boot').length,2);
  assert.equal(named('forest-flat-sole').length,2);
  assert.ok(named('forest-anatomical-toe-boot')
   .every(x=>f.frames.feet.includes(x.parent)));
  assert.ok(named('forest-tapered-boot-shaft')
   .every(x=>f.frames.calves.includes(x.parent)));
  assert.ok(f.objects.some(o=>o.userData.role==='forestSilk'));
  assert.ok(f.objects.some(o=>o.userData.role==='forestBrass'));
  assert.ok(!f.objects.some(o=>o.name.includes('full-foot-boot')),
   'old melted sphere must not remain on ranger');
  for(const o of f.objects)check(o.geometry,o.name);
  f.dispose();
 }
 assert.match(FOREST_SPIRIT_TAILORED_REVISION,/forest-bone-fitted/);
});
test('Forest leaf, silk, leather, bark, brass stay physically distinct',()=>{
 const kinds={leaf:'leaf',forestDeep:'leaf',forestMint:'leaf',
  forestSilk:'silk',forestBrocade:'brocade',forestBark:'bark',
  forestLeatherTrim:'leather',forestBrass:'brass',forestBlossom:'silk'};
 for(const [role,kind] of Object.entries(kinds)){
  assert.equal(isForestSpiritMaterialRole(role),true);
  const m=new THREE.MeshPhysicalMaterial({color:0xff00ff});
  assert.equal(applyForestSpiritPBR(m,{role,detail:'high'}),true);
  assert.equal(m.userData.forestSpeciesMaterial,kind);
  assert.equal(m.userData.forestSpiritPBRRevision,FOREST_SPIRIT_PBR_REVISION);
  assert.ok(m.normalMap?.isTexture&&m.roughnessMap?.isTexture);
  assert.equal(m.map,null,'no ugly linen/velvet color photo '+role);
  assert.ok(m.metalness>0?role==='forestBrass':true);
  m.dispose();
 }
 assert.ok(forestSpiritPBRStats().atlasPairs>=3);
 const skin=new THREE.MeshPhysicalMaterial();
 assert.equal(applyForestSpiritPBR(skin,{role:'skin'}),false);
 skin.dispose();
});
test('Seraph enhancement retains original wardrobe and adds little sculpted details',()=>{
 const f=fixture();
 assert.equal(addSeraphCelestialVestment({...f,detail:'high'}),true);
 for(const n of ['central-chest-jewel-rim','central-starlight-jewel',
  'shoulder-clasp-jewel','hip-garland-chain','hip-garland-pendant']){
  assert.ok(f.objects.some(x=>x.name.includes(n)),n);
 }
 assert.ok(SERAPH_VESTMENT_REVISION.includes('tailored'));
 assert.ok(f.objects.some(x=>x.name.includes('real-stitched-toe-boot')));
 f.dispose();
});
test('Forest footwear is matte dyed and CC0 leather roughness/normal only',()=>{
 const m=new THREE.MeshStandardMaterial({color:0xffffff});
 m.userData.forestFootwear=true;
 assert.equal(applySummonFootwearPBR(m,{role:'summonBootLeather',detail:'low'}),true);
 assert.equal(m.map,null);
 assert.equal(m.color.getHex(),0x655745);
 assert.ok(m.normalMap?.isTexture&&m.roughnessMap?.isTexture);
 assert.equal(m.userData.forestMatteLeather,true);
 detachSummonFootwearPBR(m);m.dispose();
 const code=readFileSync(new URL('../src/monster-character-cosplay.js',import.meta.url),'utf8');
 assert.match(code,/profile\.costume==='forest_spirit_female'&&role==='summonBootLeather'/);
 assert.match(code,/applyForestSpiritPBR\(m,\{role,detail\}\)/);
 assert.match(code,/FOREST_SPIRIT_PBR_REVISION/);
});
