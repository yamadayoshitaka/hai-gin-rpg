import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

const ROOT=resolve(import.meta.dirname,'..');
const studio=readFileSync(resolve(ROOT,'hair-asset-studio.html'),'utf8');
const cap=readFileSync(resolve(ROOT,'src/v121-anatomical-hair-cap.js'),'utf8');
const hairPath=resolve(ROOT,'assets/characters/hair-fitted-v1/female_hair_01_lod0.glb');

function parseNativeHairCrown(path){
 const b=readFileSync(path);
 assert.equal(b.toString('ascii',0,4),'glTF');
 assert.equal(b.readUInt32LE(4),2);
 const jsonLength=b.readUInt32LE(12);
 const gltf=JSON.parse(b.toString('utf8',20,20+jsonLength));
 const binaryStart=20+jsonLength+8;
 const primitive=gltf.meshes[0].primitives[0];
 const readAccessor=(id)=>{
  const a=gltf.accessors[id],view=gltf.bufferViews[a.bufferView];
  const start=binaryStart+(view.byteOffset||0)+(a.byteOffset||0);
  const stride=view.byteStride||(a.type==='VEC3'?12:4);
  return {a,start,stride};
 };
 const pos=readAccessor(primitive.attributes.POSITION),ind=readAccessor(primitive.indices);
 assert.equal(pos.a.type,'VEC3');
 assert.equal(pos.a.componentType,5126);
 assert.equal(ind.a.componentType,5125);
 const position=i=>{
  const o=pos.start+i*pos.stride;
  return [b.readFloatLE(o),b.readFloatLE(o+4),b.readFloatLE(o+8)];
 };
 let centerCrown=0,upperCrown=0;
 for(let i=0;i<ind.a.count;i+=3){
  const a=position(b.readUInt32LE(ind.start+i*ind.stride));
  const c=position(b.readUInt32LE(ind.start+(i+1)*ind.stride));
  const d=position(b.readUInt32LE(ind.start+(i+2)*ind.stride));
  const x=(a[0]+c[0]+d[0])/3,y=(a[1]+c[1]+d[1])/3,z=(a[2]+c[2]+d[2])/3;
  if(y>-.03)upperCrown++;
  if(y>-.03&&x*x+z*z<.035*.035)centerCrown++;
 }
 return {centerCrown,upperCrown};
}

test('the actual female hair 01 GLB already closes its crown; the UI must not paint a scalp disc over it',()=>{
 const result=parseNativeHairCrown(hairPath);
 assert.ok(result.upperCrown>500,JSON.stringify(result));
 assert.ok(result.centerCrown>100,JSON.stringify(result));
 assert.match(studio,/id="capToggle" aria-pressed="false"/);
 assert.match(studio,/next\.cap=showCap\?createV121AnatomicalHairCap\(/);
 assert.doesNotMatch(studio,/next\.cap=createV121AnatomicalHairCap\(THREE,scalpSource/);
});
test('scalp underlay remains opt-in, follows the hair color, and can be inspected without recreating it at every selection',()=>{
 assert.match(studio,/if\(current&&show&&!current\.cap&&scalpSource\?\.skinMesh\)/);
 assert.match(studio,/current\.cap\.object\.visible=show/);
 assert.match(studio,/current\?\.cap\?\.setColor\(/);
 assert.match(studio,/current\?\.cap\?\.dispose\(\)/);
 assert.match(studio,/show\?'頭皮下地を非表示（検査用）':'頭皮下地を表示（検査用）'/);
});
test('the optional scalp shell and test fibers sit beneath the original 3.5 mm hair root clearance',()=>{
 assert.match(cap,/normal\.getX\(i\)\*\.0005/);
 assert.match(cap,/const bump=\.00065\+\.0002\*Math\.cos/);
});
