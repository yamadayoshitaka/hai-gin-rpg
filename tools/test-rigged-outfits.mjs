// Geometry-only regression test: runs without a browser or WebGL.
// Requires three@0.160.x. Verifies 16 styles x 2 sexes, complete skin weights
// and no mesh shift in the bind pose, then verifies actual trouser articulation.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import {JOBS,JOB_COUTURE,outfitStyle,createDetailedOutfit} from '../src/outfit-maintenance-model.js';
import {attachFittedCloth} from '../src/character-system/fitted-cloth-runtime.js';
import {EQUIPMENT_PRESETS,assertEquipmentCatalog} from '../src/character-system/equipment-catalog.js';
import {skinOutfitDetails} from '../src/character-system/rigged-outfit-runtime.js';

function mockRig(sex){
 const gltf=JSON.parse(fs.readFileSync(`assets/characters/quaternius-outfits/${sex==='female'?'Female':'Male'}_Peasant.gltf`,'utf8'));
 const joints=new Set(gltf.skins[0].joints);
 const objects=gltf.nodes.map((data,i)=>{
  const object=joints.has(i)?new THREE.Bone():new THREE.Object3D();object.name=data.name||`node_${i}`;
  if(data.translation)object.position.fromArray(data.translation);
  if(data.rotation)object.quaternion.fromArray(data.rotation);
  if(data.scale)object.scale.fromArray(data.scale);
  return object;
 });
 const children=new Set();gltf.nodes.forEach((n,i)=>{for(const idx of n.children||[]){objects[i].add(objects[idx]);children.add(idx)}});
 const group=new THREE.Group();objects.forEach((o,i)=>{if(!children.has(i))group.add(o)});
 group.updateMatrixWorld(true);
 const skeleton=new THREE.Skeleton(gltf.skins[0].joints.map(i=>objects[i]));skeleton.calculateInverses();
 const geom=new THREE.BufferGeometry();geom.setAttribute('position',new THREE.Float32BufferAttribute([0,.1,0,.1,.2,0,0,.2,.1],3));
 geom.setAttribute('skinIndex',new THREE.Uint16BufferAttribute([0,0,0,0,0,0,0,0,0,0,0,0],4));
 geom.setAttribute('skinWeight',new THREE.Float32BufferAttribute([1,0,0,0,1,0,0,0,1,0,0,0],4));
 const mesh=new THREE.SkinnedMesh(geom,new THREE.MeshStandardMaterial());group.add(mesh);mesh.bind(skeleton);
 group.updateMatrixWorld(true);
 return {group,skeleton};
}

const textures=Object.fromEntries(['linen','leather','steel','velvet','damask','gold-brocade'].map(n=>[n,new THREE.Texture()]));
assertEquipmentCatalog();
assert.equal(Object.keys(EQUIPMENT_PRESETS).length,16);
assert.equal(new Set(JOBS.map(([id])=>id)).size,16,'job IDs must be unique');
assert.deepEqual(Object.keys(JOB_COUTURE).sort(),JOBS.map(([id])=>id).sort(),
  'all 16 roles must have authored photo-PBR couture, not shared default colours');
assert.equal(new Set(JOBS.map(([id])=>outfitStyle(id).concept)).size,16,'every occupation needs its own design concept');
for(const [job] of JOBS){assert.ok(outfitStyle(job).concept,`missing description for ${job}`)}
for(const [job] of JOBS){const style=outfitStyle(job);
  if(style.gear==='sword'||style.gear==='dagger'||style.gear==='shield'||style.gear==='axe'){
    const part=style.gear==='shield'?'Shield_Wooden':style.gear==='axe'?'Axe_Bronze':'Sword_Bronze';
    assert.ok(fs.existsSync(`assets/props/fantasy-megakit/${part}.gltf`),`${job} equipment file missing`);
  }
}
let total=0,minimum=Infinity,previewMax=0,battleMax=0;
for(const sex of ['male','female']){
 for(const [job] of JOBS){
  const {group}=mockRig(sex);
  const style=outfitStyle(job);
  const detail=createDetailedOutfit(job,sex,group,textures);group.add(detail);
  const result=skinOutfitDetails(detail,group);
  assert.equal(result.boneCount,65,`${sex}/${job} bone count`);
  assert.ok(result.weightedVertices>500,`${sex}/${job} detail vertex count`);
  assert.equal(detail.getObjectByName('anatomical-segmented-breastplate'),undefined,'barrel chest must be removed');
  assert.ok(detail.userData.triangles>0,`${sex}/${job} detail is empty`);
  previewMax=Math.max(previewMax,detail.userData.triangles);
  assert.equal(detail.userData.motif,JOB_COUTURE[job].motif,`${sex}/${job} motif missing`);
  assert.ok(detail.children.some(m=>m.name.startsWith('insignia-')||m.name==='circle-signature'),
    `${sex}/${job} unique role insignia missing`);
  if(style.armor){
    assert.ok(detail.getObjectByName('heroic-cuirass-shell')?.isSkinnedMesh,`${sex}/${job} curved front plate missing`);
    assert.equal(detail.getObjectByName('waist-belt'),undefined,`${sex}/${job} floating waist hoop reintroduced`);
    assert.equal(detail.getObjectByName('double-stitched-short-hem'),undefined,`${sex}/${job} duplicate hip ring reintroduced`);
    assert.equal(detail.children.some(m=>m.name.includes('photo-leather-harness')),false,
      `${sex}/${job} leather straps obstruct the steel breastplate`);
    assert.ok(detail.children.some(m=>m.name.startsWith('cuirass-faulds-')),`${sex}/${job} armor skirt lamella missing`);
  }
  assert.ok(detail.userData.materials.every(m=>m.map&&m.bumpMap),
    `${sex}/${job} must use actual photographic fabric/metal texture maps`);
  minimum=Math.min(minimum,result.weightedVertices);
  detail.traverse(o=>{
   if(!o.isSkinnedMesh)return;
   const positions=o.geometry.attributes.position,weights=o.geometry.attributes.skinWeight;
   for(let i=0;i<positions.count;i+=Math.max(1,Math.floor(positions.count/32))){
    let sum=0;for(let j=0;j<4;j++)sum+=weights.getComponent(i,j);
    assert.ok(Math.abs(sum-1)<1e-4,`${sex}/${job}/${o.name} skin weights ${sum}`);
    const rest=new THREE.Vector3().fromBufferAttribute(positions,i),skinned=o.applyBoneTransform(i,rest.clone());
    assert.ok(rest.distanceTo(skinned)<1e-3,`${sex}/${job}/${o.name} bind-pose displacement ${rest.distanceTo(skinned)}`);
   }
  });
  total++;
  detail.traverse(o=>{if(o.isMesh){o.geometry.dispose();const mats=Array.isArray(o.material)?o.material:[o.material];for(const m of mats)m.dispose()}});
 }
}
assert.equal(total,32);
// The 1000v1000 GPU source must retain all job silhouettes and badges without
// paying the high-poly inspection tessellation cost on every representative.
for(const sex of ['male','female'])for(const [job] of JOBS){
  const {group}=mockRig(sex);
  const detail=createDetailedOutfit(job,sex,group,textures,{quality:'battle'});
  const preview=createDetailedOutfit(job,sex,group,textures,{quality:'preview'});
  assert.ok(detail.userData.triangles<preview.userData.triangles,
    `${sex}/${job} battle detail must be lighter than preview`);
  assert.ok(detail.userData.triangles<16000,`${sex}/${job} battle outfit exceeds source budget`);
  battleMax=Math.max(battleMax,detail.userData.triangles);
  assert.equal(detail.userData.motif,preview.userData.motif);
  group.add(detail);const result=skinOutfitDetails(detail,group);
  assert.equal(result.boneCount,65,`${sex}/${job} battle source rig mismatch`);
  detail.traverse(o=>{if(o.isMesh)o.geometry.dispose()});
  preview.traverse(o=>{if(o.isMesh)o.geometry.dispose()});
  for(const m of [...detail.userData.materials,...preview.userData.materials])m.dispose();
}
// Bone-mounted sleeves and trousers must stay continuous when moving joints.
{
 const {group,skeleton}=mockRig('male');
 const detail=createDetailedOutfit('job01','male',group,textures);group.add(detail);skinOutfitDetails(detail,group);
 const cloth=attachFittedCloth({dressed:group,style:outfitStyle('job01'),textures});
 assert.equal(cloth.objects.length,8,'two arms x two segments, two legs x two segments');
 for(const sleeve of cloth.objects)assert.ok(sleeve.parent?.isBone,`not attached to bone: ${sleeve.name}`);
 const sleeve=detail.getObjectByName('heroic-cuirass-shell');assert.ok(sleeve?.isSkinnedMesh);
 const pos=sleeve.geometry.attributes.position;
 const scaledRoot=new THREE.Group();scaledRoot.scale.setScalar(.8);scaledRoot.add(group);scaledRoot.updateMatrixWorld(true);
 for(let i=0;i<Math.min(20,pos.count);i++){
  const p=new THREE.Vector3().fromBufferAttribute(pos,i);
  assert.ok(p.distanceTo(sleeve.applyBoneTransform(i,p.clone()))<1e-3,'scaled rig bind pose shifted');
 }
 const before=[];for(let i=0;i<Math.min(50,pos.count);i++)before.push(sleeve.applyBoneTransform(i,new THREE.Vector3().fromBufferAttribute(pos,i)));
 const arm=skeleton.bones.find(b=>b.name==='pelvis');assert.ok(arm);
 arm.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),.35));
 group.updateMatrixWorld(true);
 let moved=0;for(let i=0;i<before.length;i++)moved=Math.max(moved,before[i].distanceTo(sleeve.applyBoneTransform(i,new THREE.Vector3().fromBufferAttribute(pos,i))));
 assert.ok(moved>.002,`belt did not follow the pelvis: ${moved}`);
}
console.log(`PASS 16 jobs x 2 sexes = ${total} preview + 32 battle photo-PBR skinned outfits; minimum ${minimum} weighted vertices; worst detail triangles preview=${previewMax}, battle=${battleMax}`);
