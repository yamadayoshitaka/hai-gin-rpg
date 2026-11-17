import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createDetailedOutfit} from '../src/outfit-maintenance-model.js';

// Exercise the REAL procedural geometry with a complete anatomical landmark
// set. No WebGL context is required for the mesh/visibility contract.
function referenceBody(){
 const body=new THREE.Group();
 const joints={
  pelvis:[0,1.03,0],spine_03:[0,1.43,0],neck_01:[0,1.63,0],
  head:[0,1.74,0],clavicle_l:[-.17,1.50,0],clavicle_r:[.17,1.50,0],
  thigh_l:[-.11,.87,0],thigh_r:[.11,.87,0],
  foot_l:[-.11,.12,0],foot_r:[.11,.12,0]
 };
 for(const [name,xyz] of Object.entries(joints)){
  const bone=new THREE.Bone();bone.name=name;bone.position.set(...xyz);body.add(bone);
 }
 const donor=new THREE.Mesh(
  new THREE.BoxGeometry(.48,1.70,.27),
  new THREE.MeshStandardMaterial()
 );
 donor.position.y=.86;donor.name='reference-torso';body.add(donor);
 body.updateMatrixWorld(true);
 return body;
}
const texture=new THREE.Texture();
const textures=Object.fromEntries([
 'linen','linen-fine','steel','steel-grain','leather','damask',
 'gold-brocade','velvet'
].map(name=>[name,texture]));
function make(job,isProtagonist=false,quality='preview'){
 return createDetailedOutfit(job,'female',referenceBody(),textures,
  {quality,rarity:'N',isProtagonist});
}
for(const quality of ['preview','battle']){
 const ordinary=make('job01',false,quality);
 const back=ordinary.getObjectByName('anatomically-curved-rear-cuirass-lames');
 assert.ok(back?.isMesh,'armored swordsman must wear REAL rear steel in '+quality);
 const p=back.geometry.getAttribute('position'),idx=back.geometry.index;
 assert.ok(p.count>150&&idx.count>450,'four curved panels must be genuine multi-triangle metal');
 let minZ=Infinity,maxZ=-Infinity;
 for(let i=0;i<p.count;i++){minZ=Math.min(minZ,p.getZ(i));maxZ=Math.max(maxZ,p.getZ(i));}
 assert.ok(maxZ-minZ>.012,'anatomical armor must not be a flat card');
 assert.ok(!ordinary.getObjectByName('hero-protagonist-draped-mantle'),
  'ordinary swordsman must NOT wear protagonist-only cape');
 assert.ok(!ordinary.getObjectByName('heroic-cuirass-backplate'),
  'old rectangular board cannot return');
 const hero=make('job01',true,quality);
 const cape=hero.getObjectByName('hero-protagonist-draped-mantle');
 assert.ok(cape?.isMesh,'hero gets a draped cape in '+quality);
 assert.ok(cape.geometry.getAttribute('position').count>100,
  'hero cape must be curved real geometry, not a billboard');
 const thief=make('job06',false,quality);
 assert.ok(!thief.getObjectByName('anatomically-curved-rear-cuirass-lames'),
  'light-armored thief does not get plate steel');
 assert.ok(!thief.getObjectByName('hero-protagonist-draped-mantle'),
  'nonhero thief does not get a cape');
 const heroThief=make('job06',true,quality);
 assert.ok(heroThief.getObjectByName('hero-protagonist-draped-mantle'),
  'protagonist cape works for light occupations too');
}
const summoned=make('job10',true,'battle');
assert.ok(summoned.getObjectByName('three-dimensional-back-and-side-cape'),
 'existing job-authored cape retained for summoner');
assert.ok(!summoned.getObjectByName('hero-protagonist-draped-mantle'),
 'hero cape must not duplicate an existing job cape');
console.log('PASS: curved rear armor, light-job exclusion, hero-only cape, no duplicate capes at preview/battle quality');
