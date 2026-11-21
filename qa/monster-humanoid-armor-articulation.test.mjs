import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {humanoidMonsterCostumeFor}
 from '../src/monster-character-cosplay-manifest.js';
import {isFullBodyMonsterShell,isConstructCostume,
 CONSTRUCT_SHELL_SPECIES,addConstructMonsterCostume}
 from '../src/monster-construct-costume.js';
import {createMineralLimbArticulator,MONSTER_LIMB_FIT_REVISION,
 relaxMineralArmToBody}
 from '../src/monster-mineral-limb-articulator.js';
import {addDemonicFaceCosmetics}
 from '../src/monster-demon-cosmetics.js';

const source=readFileSync(new URL('../src/monster-character-cosplay.js',import.meta.url),'utf8');
const gothic=readFileSync(new URL('../src/monster-gothic-sculpt.js',import.meta.url),'utf8');
assert.match(source,/if\(gothic&&!fullBody\)addGothicMonsterSculpt/);
assert.match(source,/const royalOutfit=fullBody\?null:wardrobeFor\(profile\)/);
assert.match(source,/wingTailOnly:fullBody/);
assert.match(source,/createMineralLimbArticulator/);
assert.match(source,/mineralArticulator\?\.update\(action\)/);
assert.match(gothic,/if\(kind==='skeleton'\|\|kind==='death_knight'\|\|kind==='dark_knight'\)/,
 'Original skull-face plate source must be skipped by the runtime fullBody gate');
const ids=['m036','m037','m038','m039','m040','m042','m045'];
{
 const root=new THREE.Group(),chest=new THREE.Bone(),hips=new THREE.Bone();
 chest.name='spine_02';chest.position.set(0,1.40,0);
 hips.name='hips';hips.position.set(0,.76,0);
 const arm=new THREE.Bone(),fore=new THREE.Bone();
 arm.position.set(.53,1.48,0);
 fore.position.set(.26,.00,0);
 arm.add(fore);root.add(chest,hips,arm);root.updateMatrixWorld(true);
 assert.ok(relaxMineralArmToBody({
  bone:arm,next:fore,chest,hips,strength:1,spread:.7
 }), 'Idle source shoulder cannot be relaxed');
 const start=arm.getWorldPosition(new THREE.Vector3());
 const end=fore.getWorldPosition(new THREE.Vector3());
 assert.ok(end.y<start.y-.1,
  'Idle-stance correction raised the fist ABOVE the shoulder instead of down');
}

function fakeRig(){
 const model=new THREE.Group(),frames={};
 const parents={};
 for(const side of ['l','r']){
  const i=side==='l'?0:1;
  const arm=new THREE.Bone();arm.name='upperarm_'+side;
  arm.position.set(side==='l'?.52:-.52,1.5,0);
  const fore=new THREE.Bone();fore.name='lowerarm_'+side;
  fore.position.set(0,-.28,0);arm.add(fore);
  const hand=new THREE.Bone();hand.name='hand_'+side;
  hand.position.set(0,-.27,0);fore.add(hand);
  const leg=new THREE.Bone();leg.name='thigh_'+side;
  leg.position.set(side==='l'?.18:-.18,.92,0);
  const calf=new THREE.Bone();calf.name='calf_'+side;
  calf.position.set(0,-.42,0);leg.add(calf);
  const foot=new THREE.Bone();foot.name='foot_'+side;
  foot.position.set(0,-.46,0);calf.add(foot);
  model.add(arm,leg);
  parents[i]={arm,fore,hand,leg,calf,foot};
 }
 const mk=(bone)=>{const f=new THREE.Group();bone.add(f);return f;};
 frames.arms=parentsArray('arm');frames.forearms=parentsArray('fore');
 frames.hands=parentsArray('hand');frames.legs=parentsArray('leg');
 frames.calves=parentsArray('calf');frames.feet=parentsArray('foot');
 function parentsArray(k){return [mk(parents[0][k]),mk(parents[1][k])];}
 for(const key of ['head','neck','chest','pelvis']){
  const bone=new THREE.Bone();bone.name='tester-'+key;
  bone.position.set(0,key==='head'?1.95:key==='neck'?1.70:key==='chest'?1.45:.90,0);
  model.add(bone);frames[key]=mk(bone);
 }
 model.updateMatrixWorld(true);
 return {model,frames,parents};
}
function sculptTest(id,detail='high'){
 const {model,frames,parents}=fakeRig();
 const profile=humanoidMonsterCostumeFor(id),meshes=[];
 const attach=(frame,geo,role,name,p=[0,0,0],rot=[0,0,0])=>{
  const m=new THREE.Mesh(geo,new THREE.MeshStandardMaterial());
  m.name=name;m.userData.role=role;m.position.set(...p);m.rotation.set(...rot);
  m.scale.z=-1;m.userData.monsterCosplay=true;
  frame.add(m);meshes.push(m);return m;
 };
 const tube=(frame,role,name,points,radius=.01)=>{
  const path=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));
  return attach(frame,new THREE.TubeGeometry(path,8,radius,5),role,name);
 };
 assert.equal(addConstructMonsterCostume({
  frames,profile,detail,attach,tube
 }),true,'Fullbody anatomically connected '+id);
 assert.ok(meshes.length>=49,'Missing sculpt pieces '+id);
 assert.equal(frames.chest.userData.golemShellParts,meshes.length);
 const fitter=createMineralLimbArticulator({model,frames,id});
 assert.equal(fitter.segments.length,8);
 assert.equal(fitter.revision,MONSTER_LIMB_FIT_REVISION);
 for(const action of ['idle','walk','attack','special']){
  parents[0].arm.rotation.z=action==='idle'?1.2:.3;
  parents[1].fore.rotation.x=.65;
  model.updateMatrixWorld(true);
  assert.equal(fitter.update(action),8,'Lost a limb shell when posed '+action);
  for(const item of fitter.segments){
   assert.equal(item.mesh.userData.limbBoneFit,true);
   assert.ok(item.mesh.userData.boneDistance>.12);
   assert.ok(item.mesh.scale.y>.2&&item.mesh.scale.y<1.7);
   // The shell's ray must aim toward the actual child joint even in a
   // bent pose; otherwise the missing forearm sits inside the torso.
   const aimed=new THREE.Vector3(0,-1,0).applyQuaternion(item.mesh.quaternion);
   const child=item.nextFrame.getWorldPosition(new THREE.Vector3());
   const root=item.frame.getWorldPosition(new THREE.Vector3());
   item.frame.worldToLocal(child);
   const desired=child.normalize();
   assert.ok(aimed.angleTo(desired)<.002,'Limb shell targets wrong joint');
  }
 }
 const names=meshes.map(m=>m.name);
 if(id==='m045'){
  assert.ok(names.some(n=>n.includes('narrow-slit-visor')));
  assert.ok(names.some(n=>n.includes('helmet-central-metal-crest')));
  assert.ok(!names.some(n=>/skull-zygomatic|lower-tooth|human-hair/.test(n)));
 }
 if(id==='m042'){
  assert.ok(names.some(n=>n.includes('craggy-brow-horn')));
  assert.ok(!names.some(n=>/skirt|loin-plate|bodice/.test(n)));
  const demons=[];
  addDemonicFaceCosmetics({
   profile,frames,detail,wingTailOnly:true,
   attach:(frame,geo,role,name,p=[0,0,0])=>{
    const m=attach(frame,geo,role,name,p);demons.push(name);return m;
   },tube:(frame,role,name,pts,rad)=>{
    demons.push(name);return tube(frame,role,name,pts,rad);
   }
  });
  assert.ok(demons.some(n=>n.includes('membranous-wing')));
  assert.ok(demons.some(n=>n.includes('flexible-demon-tail')));
  assert.ok(!demons.some(n=>/loin-plate|stone-chest|upper-eyeliner/.test(n)),
   'Gargoyle should have wings and tail, not a skirt or doll makeup');
 }
 for(const m of meshes){m.geometry.dispose();m.material.dispose();}
 console.log('ANIMATED SHELL',id,detail,meshes.length,
  profile.costume,'4 action postures');
}
for(const id of ids){
 const profile=humanoidMonsterCostumeFor(id);
 assert.ok(isFullBodyMonsterShell(profile));
 assert.equal(isConstructCostume(profile),!['m042','m045'].includes(id));
 assert.ok(CONSTRUCT_SHELL_SPECIES[profile.costume]);
 for(const lod of ['high','medium','low'])sculptTest(id,lod);
}
for(const id of ['m031','m032','m033','m034','m035','m041','m043','m044'])
 assert.equal(isFullBodyMonsterShell(humanoidMonsterCostumeFor(id)),false);
console.log('PASS: 7 armoured monsters, bone-to-bone moving arms and legs, stone gargoyle and black knight without human costume');
