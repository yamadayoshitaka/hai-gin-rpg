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
 back.geometry.computeBoundingBox();
 const rearBox=back.geometry.boundingBox;
 assert.ok(rearBox.max.y<1.60,
  'rear metal must end BELOW clavicles / hair instead of rising behind the head');
 assert.ok(rearBox.max.x-rearBox.min.x<.60,
  'rear metal must stay on scapulae, not extend outside upper-arm joints');
 assert.ok(!ordinary.getObjectByName('hero-protagonist-draped-mantle'),
  'ordinary swordsman must NOT wear protagonist-only cape');
 assert.ok(!ordinary.getObjectByName('heroic-cuirass-backplate'),
  'old rectangular board cannot return');
 const hero=make('job01',true,quality);
 const cape=hero.getObjectByName('hero-protagonist-draped-mantle');
 assert.ok(cape?.isMesh,'hero gets a draped cape in '+quality);
 assert.ok(cape.geometry.getAttribute('position').count>100,
  'hero cape must be curved real geometry, not a billboard');
 // Previous code used PI/2..3PI/2 and put the entire cape on ONE side
 // of the body. Check both X sides AND the negative-Z back hemisphere.
 cape.geometry.computeBoundingBox();
 const capeBounds=cape.geometry.boundingBox;
 assert.ok(capeBounds.min.x < -.10 && capeBounds.max.x > .10,
  'protagonist mantle must wrap symmetrically across BOTH shoulders');
 assert.ok(capeBounds.min.z + cape.position.z < -.12,
  'mantle must hang BEHIND real back armor in negative Z');
 assert.ok(capeBounds.max.z <= .005,
  'rear mantle must not wrap across the character face/front');
 assert.equal(cape.userData.shoulderCape?.anchor,'both-clavicles',
  'cape must attach to BOTH shoulder endpoints, not a waist cylinder');
 assert.equal(cape.userData.shoulderCape?.clothPanel,true);
 assert.ok(capeBounds.max.z<rearBox.min.z-.02,
  'every cape panel vertex must sit behind the armored back (no clipping)');
 assert.ok(Math.abs(capeBounds.max.y-1.53)<.10,
  'cape top seam must be at clavicle height, not above the head');
 assert.ok(capeBounds.max.x-capeBounds.min.x>.55,
  'cape hem must spread beyond the armored back without wrapping forward');
 assert.ok(cape.geometry.getAttribute('position').count < (quality==='battle'?500:1800),
  'hero mantle must keep mobile battle vertex budget bounded');
 const thief=make('job06',false,quality);
 assert.ok(!thief.getObjectByName('anatomically-curved-rear-cuirass-lames'),
  'light-armored thief does not get plate steel');
 assert.ok(!thief.getObjectByName('hero-protagonist-draped-mantle'),
  'nonhero thief does not get a cape');
 const heroThief=make('job06',true,quality);
 assert.ok(heroThief.getObjectByName('hero-protagonist-draped-mantle'),
  'protagonist cape works for light occupations too');
}
const reinforced=make('job05',false,'battle');
assert.ok(reinforced.getObjectByName('anatomically-curved-rear-cuirass-lames'),
 'shield fighter must also have centered back steel');
const summoned=make('job10',true,'battle');
assert.ok(summoned.getObjectByName('three-dimensional-back-and-side-cape'),
 'existing job-authored cape retained for summoner');
const jobCape=summoned.getObjectByName('three-dimensional-back-and-side-cape');
jobCape.geometry.computeBoundingBox();
assert.ok(jobCape.geometry.boundingBox.min.x < -.1&&jobCape.geometry.boundingBox.max.x>.1,
 'existing job cape also uses a symmetrical negative-Z rear hemisphere');
assert.ok(!summoned.getObjectByName('hero-protagonist-draped-mantle'),
 'hero cape must not duplicate an existing job cape');
console.log('PASS: curved rear armor, light-job exclusion, hero-only cape, no duplicate capes at preview/battle quality');
