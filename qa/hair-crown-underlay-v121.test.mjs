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

test('archived hair GLB remains inspectable but no studio path loads old assets',()=>{
 const result=parseNativeHairCrown(hairPath);
 assert.ok(result.upperCrown>500,JSON.stringify(result));
 assert.ok(result.centerCrown>100,JSON.stringify(result));
 assert.match(studio,/sculptHairFromHead\(THREE,scalpSource\.skinMesh/);
 assert.doesNotMatch(studio,/loader\.loadAsync\(item\.path\)/);
 assert.doesNotMatch(studio,/createV121AnatomicalHairCap\(THREE,scalpSource/);
});
test('legacy scalp overlay cannot cover newly sculpted crown',()=>{
 assert.match(studio,/id="capToggle" aria-pressed="false" disabled/);
 assert.match(studio,/next\.cap=null/);
 assert.doesNotMatch(studio,/next\.cap=showCap/);
 assert.match(studio,/\$\('capToggle'\)\.disabled=true/);
});
test('the optional scalp shell and test fibers sit beneath the original 3.5 mm hair root clearance',()=>{
 assert.match(cap,/normal\.getX\(i\)\*\.0005/);
 assert.match(cap,/const bump=\.00065\+\.0002\*Math\.cos/);
});
