import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {fitImportedArmorOverHuman} from '../src/character-system/ai-armor-human-fit.js';

test('fitting resizes imported armor, never the real anatomy or its rig',()=>{
 const scene=new THREE.Scene();
 const human=new THREE.Group(),armor=new THREE.Group();
 const hmesh=new THREE.Mesh(new THREE.BoxGeometry(.65,1.78,.35));
 hmesh.position.y=.89;human.add(hmesh);
 const gmesh=new THREE.Mesh(new THREE.BoxGeometry(2,5,1.5));
 gmesh.position.y=2.5;armor.add(gmesh);
 scene.add(human,armor);
 const saved={scale:human.scale.clone(),position:human.position.clone()};
 const original={scale:armor.scale.clone(),position:armor.position.clone()};
 const result=fitImportedArmorOverHuman(human,armor);
 assert.equal(human.scale.equals(saved.scale),true);
 assert.equal(human.position.equals(saved.position),true);
 assert.ok(Math.abs(result.worldHeight-1.78)<.001);
 assert.ok(result.floorError<.001);
 assert.equal(result.rigReady,false);
 assert.equal(result.armorParts,1);
 result.restore();
 assert.equal(armor.scale.equals(original.scale),true);
 assert.equal(armor.position.equals(original.position),true);
});
test('fit rejects empty meshes and impossible dimensions without mutating body',()=>{
 const person=new THREE.Group(),garment=new THREE.Group();
 assert.throws(()=>fitImportedArmorOverHuman(person,garment),/サイズ/);
 const bone=new THREE.Bone();person.add(bone);
 assert.throws(()=>fitImportedArmorOverHuman(person,garment),/サイズ/);
});
