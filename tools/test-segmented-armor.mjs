// Test real Blender-exported breastplate, helmet, gauntlets, greaves and boots
// against both 65-bone Quaternius skeletons without requiring a GPU/browser.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {attachSegmentedArmor} from '../src/character-system/segmented-armor-runtime.js';

const loader=new GLTFLoader();
const loadModel=async path=>{
  const b=fs.readFileSync(path.replace(/^\.\//,''));
  return loader.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');
};
function rig(sex){
  const data=JSON.parse(fs.readFileSync(`assets/characters/quaternius-outfits/${sex==='male'?'Male':'Female'}_Ranger.gltf`));
  const selected=new Set(data.skins[0].joints);
  const nodes=data.nodes.map((n,i)=>{
    const o=selected.has(i)?new THREE.Bone():new THREE.Object3D();o.name=n.name||'';
    if(n.translation)o.position.fromArray(n.translation);
    if(n.rotation)o.quaternion.fromArray(n.rotation);
    if(n.scale)o.scale.fromArray(n.scale);
    return o;
  });
  data.nodes.forEach((n,i)=>{for(const index of n.children||[])nodes[i].add(nodes[index])});
  const dressed=new THREE.Group();nodes.filter(n=>!n.parent).forEach(n=>dressed.add(n));
  const root=new THREE.Group();root.add(dressed);
  const scene=new THREE.Scene();scene.add(root);scene.updateMatrixWorld(true);
  return {root,dressed,nodes};
}
const materials=Object.fromEntries(['steel','gold-brocade'].map(k=>[k,new THREE.Texture()]));
let examined=0;
for(const sex of ['male','female']){
  const {root,dressed,nodes}=rig(sex);
  const result=await attachSegmentedArmor({root,dressed,sex,textures:materials,loadModel});
  const objects=result.objects;
  assert.ok(objects.length>=40,`${sex} not all modular armor pieces loaded: ${objects.length}`);
  const slots=new Set(objects.map(x=>x.userData.equipmentSlot));
  for(const slot of ['helmet','chest','shoulder','gauntlet','hip','thigh','knee','shin','boot-upper','boot-foot'])
    assert.ok(slots.has(slot),`${sex} missing ${slot}`);
  for(const piece of objects){
    assert.ok(piece.parent?.isBone,`${sex}/${piece.name} not anchored to a skeleton bone`);
    assert.ok(piece.geometry.attributes.uv,`${sex}/${piece.name} lacks steel grain UVs`);
    const box=new THREE.Box3().setFromObject(piece),size=box.getSize(new THREE.Vector3());
    const center=box.getCenter(new THREE.Vector3());
    assert.ok(Math.abs(center.x)<1.15&&center.y>-.2&&center.y<2.25,`${sex}/${piece.name} detached: ${center.toArray()}`);
    assert.ok(size.x<.85&&size.y<.8&&size.z<.7,`${sex}/${piece.name} giant armor piece: ${size.toArray()}`);
  }
  const helmet=objects.find(o=>o.userData.equipmentSlot==='helmet');
  assert.ok(helmet);
  const chestplate=objects.find(o=>o.name.includes('Faceted_breastplate_reinforcement'));
  assert.ok(chestplate,'breastplate surface missing');
  const armorFront=new THREE.Box3().setFromObject(chestplate).getCenter(new THREE.Vector3());
  const chestBone=nodes.find(x=>x.name==='spine_03');
  assert.ok(armorFront.z<chestBone.getWorldPosition(new THREE.Vector3()).z-.05,
    `${sex} cuirass is sunk into the body, front Z=${armorFront.z}`);
  const before=helmet.getWorldPosition(new THREE.Vector3());
  const head=nodes.find(x=>x.name==='Head');assert.ok(head);
  head.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),.40));
  root.updateMatrixWorld(true);
  const after=helmet.getWorldPosition(new THREE.Vector3());
  assert.ok(after.distanceTo(before)>.005,`${sex} helmet is not following its head bone`);
  examined+=objects.length;
}
console.log(`PASS steel plate outfit on male/female; ${examined} independent bone-mounted meshes`);
