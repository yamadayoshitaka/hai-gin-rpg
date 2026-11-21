import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {humanoidMonsterCostumeFor} from '../src/monster-character-cosplay-manifest.js';
import {GARGOYLE_SPECIES_REVISION,GARGOYLE_MATERIAL_ROLES,
 addGargoyleMonsterAnatomy,createGargoyleWingGeometry,
 createGargoyleHeadGeometry,createGargoyleTorsoGeometry,
 createGargoyleTailGeometry,createGargoyleLimbGeometry,
 createGargoyleSpireGeometry,createGargoyleStoneTexture,
 createGargoylePbrMaterial} from '../src/monster-gargoyle-sculpt.js';
import {createMineralLimbArticulator}
 from '../src/monster-mineral-limb-articulator.js';
const runtime=readFileSync(new URL('../src/monster-character-cosplay.js',import.meta.url),'utf8');
assert.match(runtime,/if\(profile\.id==='m042'\)addGargoyleMonsterAnatomy/);
assert.match(runtime,/else if\(fullBody\)addConstructMonsterCostume/);
assert.match(runtime,/if\(demonic&&!fullBody\)addDemonicFaceCosmetics/);
assert.match(runtime,/createGargoylePbrMaterial\(role,gargoyleTexture\)/);
assert.match(runtime,/gargoyleSculptEdition:profile\.id==='m042'\?GARGOYLE_SPECIES_REVISION/);
const design=humanoidMonsterCostumeFor('m042');
assert.equal(design.costume,'gargoyle');
assert.equal(design.construct,undefined);
assert.equal(GARGOYLE_SPECIES_REVISION,'m042-gothic-gargoyle-v1-20261121');
assert.equal(Object.keys(GARGOYLE_MATERIAL_ROLES).length,8);
const atlas=createGargoyleStoneTexture({size:64});
assert.equal(atlas.image.width,64);
assert.equal(atlas.image.height,64);
assert.ok(atlas.image.data.every(Number.isFinite));
assert.ok(new Set(atlas.image.data.filter((_,i)=>i%4===0)).size>30,
 'stone surface must have material variation and fissures');
for(const role of Object.keys(GARGOYLE_MATERIAL_ROLES)){
 const mat=createGargoylePbrMaterial(role,atlas);
 assert.equal(mat.userData.gargoyleSpecies,'m042');
 assert.equal(mat.userData.humanClothMaterial,false);
 assert.equal(mat.userData.photographicHumanAlbedo,false);
 assert.equal(mat.type,'MeshPhysicalMaterial');
 if(!['gargoyleEye','gargoyleMembrane'].includes(role)){
  assert.strictEqual(mat.map,atlas);
  assert.strictEqual(mat.bumpMap,atlas);
  assert.ok(mat.bumpScale>0);
 }
 mat.dispose();
}
atlas.dispose();
for(const [name,create] of [
 ['head',()=>createGargoyleHeadGeometry({detail:'high'})],
 ['torso',()=>createGargoyleTorsoGeometry({detail:'high'})],
 ['pelvis',()=>createGargoyleTorsoGeometry({detail:'high',region:'pelvis'})],
 ['upperArm',()=>createGargoyleLimbGeometry({detail:'high',part:'upperArm'})],
 ['wing',()=>createGargoyleWingGeometry({detail:'high'})],
 ['tail',()=>createGargoyleTailGeometry({detail:'high'})],
 ['horn',()=>createGargoyleSpireGeometry({detail:'high'})]
]){
 const geo=create();
 assert.ok(geo.attributes.position.count>25,name+' lacks mesh');
 assert.equal(geo.attributes.normal.count,geo.attributes.position.count);
 assert.equal(geo.attributes.uv.count,geo.attributes.position.count);
 assert.ok(geo.attributes.position.array.every(Number.isFinite));
 assert.ok(geo.index.count>30,name+' lacks faces');
 geo.dispose();
}
function bones(){
 const model=new THREE.Group(),frames={};
 const base=(name,x,y,z)=>{
  const b=new THREE.Bone();b.name=name;b.position.set(x,y,z);
  return b;
 };
 frames.chest=new THREE.Group();frames.pelvis=new THREE.Group();
 frames.head=new THREE.Group();frames.neck=new THREE.Group();
 for(const [k,y] of [['chest',1.38],['pelvis',.81],
  ['head',1.89],['neck',1.73]]){
  const b=base('gargoyle-'+k,0,y,0);
  b.add(frames[k]);model.add(b);
 }
 for(const [group,first,second,third,x,y,step,secondStep] of [
  ['arms','upperarm','lowerarm','hand',.44,1.5,-.30,-.28],
  ['legs','thigh','calf','foot',.16,.89,-.43,-.45]
 ]){
  for(let side=0;side<2;side++){
   const sign=side===0?1:-1,suffix=side===0?'l':'r';
   const top=base(first+'_'+suffix,sign*x,y,0);
   const middle=base(second+'_'+suffix,0,step,0);
   const bottom=base(third+'_'+suffix,0,secondStep,0);
   top.add(middle);middle.add(bottom);model.add(top);
   const names=group==='arms'?['arms','forearms','hands']:
    ['legs','calves','feet'];
   for(const [key,bone] of names.map((name,i)=>[name,[top,middle,bottom][i]])){
    frames[key]??=[null,null];frames[key][side]=new THREE.Group();
    bone.add(frames[key][side]);
   }
  }
 }
 return {model,frames};
}
for(const detail of ['source','high','medium','low']){
 const {model,frames}=bones(),meshes=[];
 const attach=(frame,geometry,role,name,pos=[0,0,0],rot=[0,0,0])=>{
  const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial());
  mesh.name=name;mesh.userData.role=role;mesh.position.set(...pos);
  mesh.rotation.set(...rot);frame.add(mesh);meshes.push(mesh);return mesh;
 };
 const tube=(frame,role,name,points,radius=.01)=>{
  const path=new THREE.CatmullRomCurve3(points.map(x=>new THREE.Vector3(...x)));
  return attach(frame,new THREE.TubeGeometry(path,detail==='low'?6:15,radius,5),role,name);
 };
 assert.equal(addGargoyleMonsterAnatomy({
  profile:design,detail,frames,attach,tube
 }),true);
 assert.equal(frames.chest.userData.golemFullShellRevision,GARGOYLE_SPECIES_REVISION);
 assert.equal(frames.chest.userData.golemShellParts,meshes.length);
 assert.equal(frames.chest.userData.gargoyleWingCount,2,'both wings missing');
 assert.equal(frames.chest.userData.gargoyleClawCount,14,
  'each hand and foot requires visible articulated talons');
 assert.ok(meshes.length>65&&meshes.length<180,
  'mobile draw-call budget or species quality: '+meshes.length);
 const names=meshes.map(m=>m.name);
 for(const required of ['angular-demon-face','chiseled-muscular-torso',
  'sinewy-rock-pelvis','upper-arm-shell-0','forearm-shell-1',
  'long-jointed-stone-tail','scalloped-leather-stone-wing-0',
  'scalloped-leather-stone-wing-1','recurved-temple-horn-0',
  'curved-stone-hand-claw-1','raptor-stone-toe-1']){
  assert.ok(names.some(n=>n.includes(required)),required+' missing /'+detail);
 }
 for(const forbidden of ['inlaid-energy-stone','core-bezel',
  'golem-m042','loin-plate','full-skirt','round-eye','human-cloth']){
  assert.ok(!names.some(n=>n.includes(forbidden)),
   'Toy golem geometry leaked: '+forbidden);
 }
 const rig=createMineralLimbArticulator({model,frames,id:'m042'});
 assert.equal(rig.segments.length,8);
 for(const action of ['idle','walk','attack','special']){
  model.updateMatrixWorld(true);
  assert.equal(rig.update(action),8);
 }
 for(const mesh of meshes){
  assert.equal(mesh.userData.gargoyleSpecies,'m042');
  assert.equal(mesh.userData.boneAnchored,true);
  assert.equal(mesh.userData.golemFullShell,true);
  assert.ok(GARGOYLE_MATERIAL_ROLES[mesh.userData.role]);
  assert.ok(mesh.geometry.getAttribute('position').array.every(Number.isFinite));
  mesh.geometry.dispose();mesh.material.dispose();
 }
 console.log('PASS m042 sculpt',detail,'bones',rig.segments.length,'meshes',meshes.length,
  'wings',frames.chest.userData.gargoyleWingCount,'talons',
  frames.chest.userData.gargoyleClawCount);
}
assert.equal(addGargoyleMonsterAnatomy({profile:humanoidMonsterCostumeFor('m038')}),false);
console.log('PASS unique gargoyle silhouette, original carved rock material, claws, horns, wings, tail and moving rig');
