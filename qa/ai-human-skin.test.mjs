import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {applyHumanSkinPreview,restoreHumanSkinPreview} from '../src/character-system/ai-human-skin-preview.js';

test('untextured AI humanoid receives neutral nonmetal skin PBR, not armor steel',()=>{
 const root=new THREE.Group();
 const base=new THREE.MeshBasicMaterial({color:0xffffff});
 const mesh=new THREE.Mesh(new THREE.BoxGeometry(1,2,.5),base);
 mesh.name='human_skin';root.add(mesh);
 const result=applyHumanSkinPreview(root);
 assert.equal(result.applied,1);
 assert.equal(mesh.material.isMeshPhysicalMaterial,true);
 assert.equal(mesh.material.metalness,0);
 assert.ok(mesh.material.roughness>.5);
 assert.ok(mesh.material.color.r>.5);
 const undone=restoreHumanSkinPreview(root);
 assert.equal(undone.restored,1);
 assert.equal(mesh.material,base);
});
test('existing textured AI skin and face are never overwritten',()=>{
 const root=new THREE.Group(),tex=new THREE.Texture();
 const m=new THREE.MeshStandardMaterial({map:tex});
 const face=new THREE.Mesh(new THREE.BoxGeometry(.4,.5,.25),m);
 face.name='face';root.add(face);
 assert.equal(applyHumanSkinPreview(root).applied,0);
 assert.equal(face.material,m);
 assert.equal(restoreHumanSkinPreview(root).restored,0);
});
