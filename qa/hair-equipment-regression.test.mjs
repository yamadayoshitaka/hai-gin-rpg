import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {EQUIPMENT_TYPES,equipmentForJob} from '../src/character-system/equipment-catalog.js';

const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dir=path.join(repo,'assets/characters/hair-fitted-v1');
const data=filename=>fs.readFileSync(path.join(dir,filename));

function readGLB(filename){
 const b=data(filename);
 assert.equal(b.toString('ascii',0,4),'glTF',filename+' magic');
 assert.equal(b.readUInt32LE(4),2,filename+' glTF version');
 assert.equal(b.readUInt32LE(8),b.length,filename+' total length');
 const jsonLength=b.readUInt32LE(12),jsonType=b.toString('ascii',16,20);
 assert.equal(jsonType,'JSON',filename+' JSON chunk');
 assert.ok(jsonLength>100&&jsonLength%4===0,filename+' nonempty aligned JSON');
 const json=JSON.parse(b.toString('utf8',20,20+jsonLength));
 let cursor=20+jsonLength;
 assert.ok(cursor+8<=b.length,filename+' BIN chunk header exists');
 const binLength=b.readUInt32LE(cursor),binType=b.toString('ascii',cursor+4,cursor+8);
 assert.equal(binType,'BIN\0',filename+' BIN chunk');
 cursor+=8;
 assert.equal(cursor+binLength,b.length,filename+' complete binary payload');
 assert.ok(json.buffers?.length===1&&json.buffers[0].byteLength<=binLength);
 const bytes={5120:1,5121:1,5122:2,5123:2,5125:4,5126:4};
 const components={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16};
 for(const [i,v] of json.bufferViews.entries()){
  assert.ok((v.byteOffset||0)+(v.byteLength||0)<=binLength,`${filename} view ${i} exceeds BIN`);
 }
 for(const [i,a] of json.accessors.entries()){
  assert.ok(a.count>0&&bytes[a.componentType]&&components[a.type],`${filename} accessor ${i} type`);
  if(a.bufferView===undefined)continue;
  const v=json.bufferViews[a.bufferView];assert.ok(v,`${filename} accessor ${i} view`);
  const itemBytes=bytes[a.componentType]*components[a.type];
  const stride=v.byteStride||itemBytes;
  assert.ok((a.byteOffset||0)+(a.count-1)*stride+itemBytes<=v.byteLength,`${filename} accessor ${i} overflow`);
  assert.equal(((v.byteOffset||0)+(a.byteOffset||0))%bytes[a.componentType],0,`${filename} accessor ${i} alignment`);
 }
 let triangles=0,meshes=0;
 for(const mesh of json.meshes||[])for(const primitive of mesh.primitives||[]){
  if(primitive.mode!==undefined)assert.equal(primitive.mode,4,filename+' only triangles');
  assert.ok(json.accessors[primitive.attributes?.POSITION],filename+' positions');
  const count=primitive.indices===undefined?json.accessors[primitive.attributes.POSITION].count:json.accessors[primitive.indices].count;
  assert.equal(count%3,0,filename+' complete triangles');
  triangles+=count/3;meshes++;
 }
 assert.ok(triangles>=100&&meshes>=1,filename+' nonempty hairstyle mesh');
 return {triangles,meshes,bytes:b.length};
}

let validated=0,triangleCount=0;
for(const [sex,styleCount] of [['male',14],['female',12]]){
 for(let i=1;i<=styleCount;i++){
  const id=String(i).padStart(2,'0');
  const lods=Array.from({length:3},(_,lod)=>readGLB(`${sex}_hair_${id}_lod${lod}.glb`));
  assert.ok(lods[0].triangles>lods[1].triangles&&lods[1].triangles>lods[2].triangles,
   `${sex} ${id} LOD triangles must strictly decrease`);
  assert.ok(lods.every(l=>l.bytes>1000),`${sex} ${id} hair source was truncated`);
  triangleCount+=lods[0].triangles;
  validated+=lods.length;
 }
}
assert.equal(validated,78,'26 styles × 3 LODs');
assert.match(data('ATTRIBUTION.md').toString('utf8'),/CC BY 4\.0/i,'external hairstyle credit required');
assert.equal(equipmentForJob('job01').armor,'plate');
assert.equal(equipmentForJob('job05').offhand,'shield');
assert.equal(EQUIPMENT_TYPES.shield.mount.bone,'lowerarm_l','shield must follow left forearm');
assert.equal(EQUIPMENT_TYPES.shield.mount.face,'+z','shield face must point toward enemies');

const source=fs.readFileSync(path.join(repo,'src/character-system/rigged-outfit-runtime.js'),'utf8');
const armor=fs.readFileSync(path.join(repo,'src/character-system/segmented-armor-runtime.js'),'utf8');
const cloth=fs.readFileSync(path.join(repo,'src/character-system/fitted-cloth-runtime.js'),'utf8');
const studio=fs.readFileSync(path.join(repo,'motion-external-test.html'),'utf8');
assert.match(source,/attachCharacterHair\(/,'costume must mount actual hair assets');
assert.match(source,/setHelmetVisible\(/,'helmet and hairstyle toggle must be connected');
assert.match(source,/maskBodyBelowNeck\(/,'underlying body triangles must be occluded');
assert.match(armor,/ARMOR_CLEARANCE\[d\.slot\]/,'each armor piece must have independent collision allowance');
assert.match(armor,/measureHeadLocalBounds/,'helmet must be fitted to the real head');
assert.match(cloth,/safeRadius\(/,'sleeve and trouser radius must use anatomical envelopes');
assert.match(studio,/initHairControls\(/,'preview must offer changeable hairstyles');

console.log(`PASS hairstyles: ${validated} nontruncated GLBs, 26 three-stage LOD sets, ${triangleCount} LOD0 triangles, armor/cloth/helmet/shield wiring`);
