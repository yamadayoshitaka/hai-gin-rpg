import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {needsSwordsmanFinish,projectSteelUV} from '../src/character-system/ai-swordsman-steel-finish.js';

test('untextured white mesh is eligible, existing PBR photo mesh preserved by default',()=>{
 assert.equal(needsSwordsmanFinish(new THREE.MeshBasicMaterial({color:0xffffff})),true);
 const m=new THREE.MeshStandardMaterial({map:new THREE.Texture()});
 assert.equal(needsSwordsmanFinish(m),false);
});
test('white indexed box gets real UVs while source geometry remains unchanged',()=>{
 const source=new THREE.BoxGeometry(1,2,.5);
 source.deleteAttribute('uv');
 const before=source.index.count;
 const {geometry,generated}=projectSteelUV(source);
 assert.equal(generated,true);
 assert.notEqual(geometry,source);
 assert.equal(source.getAttribute('uv'),undefined);
 assert.ok(geometry.getAttribute('uv'));
 assert.equal(geometry.getAttribute('uv').count,before);
 const u=geometry.getAttribute('uv');
 assert.ok(u.getX(0)!==u.getX(u.count-1)||u.getY(0)!==u.getY(u.count-1));
 geometry.dispose();source.dispose();
});
test('already mapped armor does not clone or discard good UVs',()=>{
 const source=new THREE.BoxGeometry(1,2,.5);
 const x=projectSteelUV(source);
 assert.equal(x.generated,false);assert.equal(x.geometry,source);
 source.dispose();
});
test('invalid input cannot be made into a fake photo-textured geometry',()=>{
 const geometry=new THREE.BufferGeometry();
 assert.throws(()=>projectSteelUV(geometry),/頂点/);
});
