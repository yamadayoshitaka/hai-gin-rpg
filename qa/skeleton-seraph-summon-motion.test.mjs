import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {readFileSync,existsSync} from 'node:fs';
import {HUMANOID_MONSTER_COSTUMES} from '../src/monster-character-cosplay-manifest.js';
import {FEMALE_SUMMON_FORMS} from '../src/female-summon-forms.js';
import {buildM031SkeletonAnatomy,M031_SKELETON_ANATOMY_REVISION}
 from '../src/m031-skeleton-anatomy.js';
import {isFacialHairSourceMesh}
 from '../src/seraph-facial-hair-guard.js';
import {applySummonHumanoidPBR,summonHumanoidPBRStats,
 SUMMON_HUMANOID_PBR_REVISION} from '../src/summon-humanoid-pbr.js';
import {MONSTER_NATIVE_MOTION_SETS,buildMonsterNativeMotionVariants,
 selectMonsterMotionVariant,monsterMotionCoverage}
 from '../src/monster-licensed-motion-variants.js';

test('m031 is real exposed bone on the existing articulated GLB skeleton',()=>{
 const frames={head:new THREE.Group(),neck:new THREE.Group(),chest:new THREE.Group(),
  pelvis:new THREE.Group(),arms:[],forearms:[],hands:[],legs:[],calves:[],feet:[]};
 for(const key of ['arms','forearms','hands','legs','calves','feet'])
  frames[key]=[new THREE.Group(),new THREE.Group()];
 const roots=[frames.head,frames.chest,frames.pelvis,...frames.arms,
  ...frames.forearms,...frames.hands,...frames.legs,...frames.calves,...frames.feet];
 const meshes=[];
 const attach=(parent,geo,role,name,pos=[0,0,0],rot=[0,0,0])=>{
  const mesh=new THREE.Mesh(geo,new THREE.MeshStandardMaterial());
  mesh.name='monster-costume-'+name;mesh.position.set(...pos);
  mesh.rotation.set(...rot);mesh.userData.role=role;
  parent.add(mesh);meshes.push(mesh);return mesh;
 };
 const tube=(frame,role,name,pts,radius=.012)=>{
  const geom=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(
   pts.map(p=>new THREE.Vector3(...p))),14,radius,6,false);
  return attach(frame,geom,role,name);
 };
 const p=HUMANOID_MONSTER_COSTUMES.m031;
 assert.equal(p.boneOnly,true);
 assert.equal(p.hair,'bald');
 const rec=buildM031SkeletonAnatomy({profile:p,detail:'high',frames,attach,tube});
 assert.equal(rec.revision,M031_SKELETON_ANATOMY_REVISION);
 assert.equal(rec.visibleDonorSkin,false);
 assert.equal(rec.opaqueCoat,false);
 assert.equal(rec.sockets,2);
 assert.equal(rec.ribs,10);
 assert.ok(rec.longBones>=15);
 assert.equal(rec.fingers,8);
 assert.equal(rec.pelvis,2);
 assert.ok(meshes.some(m=>m.name==='monster-costume-m031-cranium'));
 assert.ok(meshes.some(m=>m.name==='monster-costume-m031-sternum-shaft'));
 assert.ok(meshes.every(m=>m.name.startsWith('monster-costume-m031-')));
 assert.ok(!meshes.some(m=>/cloak|breastplate|robe|human-face|mustache/.test(m.name)));
 for(const m of meshes){
  const p=m.geometry.getAttribute('position');
  assert.ok(p&&p.array.every(Number.isFinite),m.name+' invalid geometry');
  assert.ok(m.geometry.getAttribute('normal'),m.name+' missing normals');
 }
 assert.ok(frames.arms.every(g=>g.children.some(m=>/humerus/.test(m.name))));
 assert.ok(frames.calves.every(g=>g.children.some(m=>/tibia/.test(m.name))));
 const lowMeshes=[];
 const lowAttach=(frame,geo,role,name,pos=[0,0,0])=>{
  lowMeshes.push(geo);return new THREE.Mesh(geo,new THREE.MeshBasicMaterial());
 };
 const lo=buildM031SkeletonAnatomy({profile:p,detail:'low',frames,attach:lowAttach,
  tube:(frame,role,name,points,radius)=>lowAttach(frame,new THREE.TubeGeometry(
   new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),
   6,radius,4,false),role,name)});
 assert.ok(lo.lowLod);
 const highVerts=meshes.reduce((n,m)=>n+m.geometry.getAttribute('position').count,0);
 const lowVerts=lowMeshes.reduce((n,g)=>n+g.getAttribute('position').count,0);
 assert.ok(lowVerts<highVerts*.75,'crowd bones too heavy');
 for(const m of meshes){m.geometry.dispose();m.material.dispose()}
 for(const g of lowMeshes)g.dispose();
 for(const g of roots)g.clear();
});

test('m031 render path hides original human face/hair, retains donor bones',()=>{
 const source=readFileSync(new URL('../src/monster-character-cosplay.js',
  import.meta.url),'utf8');
 assert.match(source,/const skeletal=profile\.id==='m031'/);
 assert.match(source,/if\(\(construct\|\|skeletal\)&&node\.isMesh\)/);
 assert.match(source,/buildM031SkeletonAnatomy\(/);
 assert.match(source,/skeletonDonorSkinConcealed:/);
 assert.match(source,/const groom=construct\|\|skeletal\|\|fullBody\?null/);
 assert.match(source,/if\(gothic&&!fullBody&&!skeletal\)/);
});

test('seraph beard removal checks material and node without hiding lashes',()=>{
 const mesh=(name,material)=>({isMesh:true,name,material:
   new THREE.MeshStandardMaterial({name:material})});
 for(const n of ['Beard','Mustache','Moustache','Facial_Hair',
   'Goatee','sideburns','Mesh Beard 002']){
  assert.equal(isFacialHairSourceMesh(mesh(n,'Material')),true,n);
 }
 assert.equal(isFacialHairSourceMesh(mesh('Mesh_120','Beard_Material')),true);
 for(const n of ['Eyebrow','Eyelash','Scalp','Fitted-Crown','Head',
   'seraph-face-open','forelock','hair-strands']){
  assert.equal(isFacialHairSourceMesh(mesh(n,'GenericMaterial')),false,n);
 }
 assert.equal(FEMALE_SUMMON_FORMS.seraph_guardian.noBeard,true);
 const hair=readFileSync(new URL('../src/monster-humanoid-hair.js',
  import.meta.url),'utf8');
 assert.match(hair,/style==='seraph-face-open'&&front>\.24/);
});

test('summon-specific wings, forest leaves and dragonkin scales get PBR',()=>{
 const cases=[
  ['seraph_guardian','seraphWing','feather'],
  ['seraph_guardian','gold','brushedGold'],
  ['forest_archer','leaf','leaf'],
  ['forest_archer','forestMint','leaf'],
  ['dragon_lord','dragonScale','scale'],
  ['dragon_lord','membrane','membrane']
 ];
 for(const [id,role,kind] of cases){
  const mat=new THREE.MeshStandardMaterial();
  assert.equal(applySummonHumanoidPBR(mat,{id,role,detail:'high'}),true,
   id+'/'+role);
  assert.equal(mat.userData.summonSurfaceKind,kind);
  assert.equal(mat.userData.summonPbrRevision,SUMMON_HUMANOID_PBR_REVISION);
  assert.ok(mat.map?.isDataTexture&&mat.normalMap?.isDataTexture&&
   mat.roughnessMap?.isDataTexture,id+'/'+role+' missing triple PBR');
  assert.ok(mat.normalMap.image.data.every(Number.isFinite));
  mat.dispose();
 }
 const shared=new THREE.MeshStandardMaterial();
 applySummonHumanoidPBR(shared,{id:'seraph_guardian',role:'seraphWing',detail:'high'});
 const same=new THREE.MeshStandardMaterial();
 applySummonHumanoidPBR(same,{id:'seraph_guardian',role:'feather',detail:'high'});
 assert.equal(shared.normalMap,same.normalMap,'shared GPU atlas');
 assert.equal(applySummonHumanoidPBR(new THREE.MeshStandardMaterial(),{
  id:'seraph_guardian',role:'seraphWing',detail:'low'}),false);
 const protectedSource=new THREE.MeshStandardMaterial();
 protectedSource.map=new THREE.Texture();
 assert.equal(applySummonHumanoidPBR(protectedSource,{
  id:'dragon_lord',role:'dragonScale',detail:'high'}),false);
 assert.equal(summonHumanoidPBRStats().species,3);
});

test('real CC0 authored motion variations use existing compatible donor clips',()=>{
 const inventory=JSON.parse(readFileSync(
  new URL('../motion-external-inventory.json',import.meta.url),'utf8'));
 const raw=inventory.find(x=>/UAL2_Standard\.glb$/.test(x.file));
 assert.ok(raw);
 assert.ok(existsSync(new URL('../assets/characters/quaternius-base/animations.glb',
  import.meta.url)));
 assert.ok(raw.clips.includes('Sword_Regular_B'));
 assert.ok(raw.clips.includes('Sword_Heavy_Combo'));
 assert.ok(raw.clips.includes('NinjaJump_Start'));
 assert.ok(raw.clips.includes('Zombie_Walk_Fwd_Loop'));
 const names=new Set(['hips','spine_02','head','upperarm_l','upperarm_r']);
 const clips=raw.clips.map(name=>new THREE.AnimationClip(name,1,
  [...names].map(bone=>new THREE.QuaternionKeyframeTrack(
   bone+'.quaternion',[0,1],[0,0,0,1,0,0,0,1]))));
 const model=new THREE.Group();
 const mixer=new THREE.AnimationMixer(model);
 const bank=buildMonsterNativeMotionVariants(THREE,{
  clips,targetNames:names,mixer,profile:HUMANOID_MONSTER_COSTUMES.m031
 });
 const m=monsterMotionCoverage(bank);
 assert.ok(m.namedClips>=14,'must actually register authored motion choices');
 assert.ok((bank.attack||[]).length>=4);
 assert.ok((bank.leap||[]).length>=2);
 assert.ok((bank.idle||[]).some(v=>/Zombie_/.test(v.name)));
 assert.notEqual(selectMonsterMotionVariant(bank,'attack',0).name,
  selectMonsterMotionVariant(bank,'attack',1).name);
 assert.equal(selectMonsterMotionVariant(bank,'unavailable',0),null);
 for(const [kind,patterns] of Object.entries(MONSTER_NATIVE_MOTION_SETS))
  assert.ok(patterns.every(n=>typeof n==='string'),kind);
});
