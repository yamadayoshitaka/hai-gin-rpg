/**
 * Exercise cleanup against real binary hair GLBs, not synthetic meshes.
 * Minimal GLB accessor reader so CI needs no Three.js/npm runtime install.
 */
import {readFileSync} from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {cleanDetachedHairGeometry} from '../src/hair-island-cleanup-v1.js';
function readMeshes(filename){
 const buffer=readFileSync(new URL('../assets/characters/hair-fitted-v1/'+filename,import.meta.url));
 assert.equal(buffer.toString('ascii',0,4),'glTF');
 assert.equal(buffer.readUInt32LE(4),2);
 let offset=12,json=null,bin=null;
 while(offset<buffer.length){
  const len=buffer.readUInt32LE(offset),type=buffer.readUInt32LE(offset+4);
  if(type===0x4e4f534a)json=JSON.parse(buffer.toString('utf8',offset+8,offset+8+len));
  if(type===0x004e4942)bin=buffer.subarray(offset+8,offset+8+len);
  offset+=len+8;
 }
 assert.ok(json&&bin);
 const size={5121:1,5123:2,5125:4,5126:4};
 function accessor(id){
  const a=json.accessors[id],v=json.bufferViews[a.bufferView];
  assert.ok(!a.sparse);
  const components={SCALAR:1,VEC3:3}[a.type];
  assert.ok(components);
  const stride=v.byteStride||size[a.componentType]*components;
  const readValue=(index,component)=>{
   const p=(v.byteOffset||0)+(a.byteOffset||0)+stride*index+
    component*size[a.componentType];
   switch(a.componentType){
    case 5121:return bin.readUInt8(p);
    case 5123:return bin.readUInt16LE(p);
    case 5125:return bin.readUInt32LE(p);
    case 5126:return bin.readFloatLE(p);
    default:throw Error('Unsupported accessor '+a.componentType);
   }
  };
  return {count:a.count,readValue,components};
 }
 const result=[];
 for(const m of json.meshes||[])for(const primitive of m.primitives||[]){
  const p=accessor(primitive.attributes.POSITION);
  const index=primitive.indices!==undefined?accessor(primitive.indices):null;
  const triangles=Math.floor((index?index.count:p.count)/3);
  let newIndices=Array.from({length:triangles*3},(_,i)=>
   index?index.readValue(i,0):i);
  const positions={count:p.count,
   getX:i=>p.readValue(i,0),
   getY:i=>p.readValue(i,1),
   getZ:i=>p.readValue(i,2)};
  const geo={
   groups:[{start:0,count:triangles*3,materialIndex:0}],
   getAttribute:key=>key==='position'?positions:null,
   getIndex:()=>({count:newIndices.length,getX:i=>newIndices[i]}),
   setIndex:arr=>{newIndices=arr},
   clearGroups(){this.groups=[]},
   addGroup(start,count,materialIndex){this.groups.push({start,count,materialIndex})},
   computeBoundingSphere(){},
   computeBoundingBox(){}
  };
  result.push({geo,triangles});
 }
 return result;
}
for(const name of ['female_hair_01_lod0.glb','female_hair_02_lod0.glb',
 'female_hair_08_lod0.glb','male_hair_01_lod0.glb']){
 test('cleanup preserves real hairstyle source '+name,()=>{
  const parts=readMeshes(name);
  let original=0,kept=0,removed=0;
  for(const {geo,triangles} of parts){
   original+=triangles;
   const result=cleanDetachedHairGeometry(geo);
   kept+=result.keptTriangles;removed+=result.removedTriangles;
  }
  assert.ok(original>1000);
  assert.ok(kept>=original*.85,'must not destroy entire original hair silhouette');
  assert.equal(kept+removed,original);
  console.log('GLB geometry audit',name,{original,kept,removed});
 });
}
