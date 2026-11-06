import assert from 'node:assert/strict';
import * as THREE from 'three';
import {attachArmorHeraldry} from '../src/character-system/armor-heraldry-runtime.js';

for(const rarity of ['N','R','UR']){
  const root=new THREE.Group(),chest=new THREE.Bone(),head=new THREE.Bone();
  chest.position.set(0,1.2,0);head.position.set(0,1.6,0);
  root.add(chest,head);
  const breastplate=new THREE.Mesh(new THREE.BoxGeometry(.48,.35,.18),new THREE.MeshStandardMaterial());
  breastplate.name='faceted_breastplate_reinforcement';
  breastplate.userData.equipmentSlot='chest';chest.add(breastplate);
  const helmet=new THREE.Mesh(new THREE.BoxGeometry(.31,.37,.32),new THREE.MeshStandardMaterial());
  helmet.name='armor-helmet-plate joined crown and nape guard';
  helmet.userData.equipmentSlot='helmet';head.add(helmet);
  const armor={objects:[breastplate,helmet],materials:[],diagnostics:{}};
  const textures={steel:new THREE.Texture()};
  const result=attachArmorHeraldry({root,armor,job:'job01',textures,rarity});
  assert.ok(result?.objects.length>0,`${rarity}: chest engraving must survive`);
  assert.equal(armor.objects.filter(o=>o.userData.equipmentSlot==='helmet-ornament').length,0,
    `${rarity}: a giant generated 3D band must not appear in front of the nose`);
  assert.equal(armor.diagnostics.rarity,rarity,`${rarity}: rarity styling lost`);
  for(const mesh of result.objects)mesh.geometry.dispose();
  for(const material of armor.materials)material.dispose();
  breastplate.geometry.dispose();helmet.geometry.dispose();
}
console.log('PASS: N/R/UR chest heraldry remains; no floating face-level helmet decorations');
