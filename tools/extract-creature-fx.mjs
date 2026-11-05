/**
 * Trim the user's Library model.glb effect catalog to the five ground-impact
 * meshes used by creatures. This is an asset build step, not a runtime parser.
 *
 * node tools/extract-creature-fx.mjs INPUT.glb OUTPUT.glb
 * The original remains in the user's Library; only the selected geometries
 * (and their PBR materials) ship with the game.
 */
import {readFileSync,writeFileSync} from 'node:fs';

const [, ,source,target]=process.argv;
if(!source||!target)throw Error('Usage: node tools/extract-creature-fx.mjs INPUT.glb OUTPUT.glb');
const input=readFileSync(source);
if(input.toString('ascii',0,4)!=='glTF'||input.readUInt32LE(4)!==2)throw Error('GLB 2.0 required');
const jsonLength=input.readUInt32LE(12),jsonType=input.readUInt32LE(16);
if(jsonType!==0x4e4f534a)throw Error('Missing GLB JSON chunk');
const original=JSON.parse(input.toString('utf8',20,20+jsonLength));
const binHeader=20+jsonLength;
if(input.readUInt32LE(binHeader+4)!==0x004e4942)throw Error('Missing GLB BIN chunk');
const bytes=input.subarray(binHeader+8,binHeader+8+input.readUInt32LE(binHeader));

const select=['003-dust-puff-dome/0','004-spark-fan/0',
  '009-water-splash-crown/0','010-sand-kick-fan/0','011-snow-puff/0'];
const cloned=value=>JSON.parse(JSON.stringify(value));
const document={asset:{version:'2.0',generator:'User Library creature footfall FX subset'},
  extensionsUsed:original.extensionsUsed,extensionsRequired:original.extensionsRequired,
  scene:0,scenes:[{nodes:[]}],nodes:[],meshes:[],accessors:[],bufferViews:[],
  buffers:[{byteLength:0}],materials:[]};
const accessorMap=new Map(),viewMap=new Map(),materialMap=new Map();
const chunks=[];let binarySize=0;
function addView(index){
  if(viewMap.has(index))return viewMap.get(index);
  const view=cloned(original.bufferViews[index]);
  if(view.buffer!==0)throw Error('Only one source BIN buffer supported');
  const content=bytes.subarray(view.byteOffset??0,(view.byteOffset??0)+view.byteLength);
  const pad=(4-(binarySize%4))%4;
  if(pad){chunks.push(Buffer.alloc(pad));binarySize+=pad;}
  view.byteOffset=binarySize;
  chunks.push(content);binarySize+=content.length;
  const mapped=document.bufferViews.push(view)-1;
  viewMap.set(index,mapped);
  return mapped;
}
function addAccessor(index){
  if(accessorMap.has(index))return accessorMap.get(index);
  const accessor=cloned(original.accessors[index]);
  if(accessor.sparse)throw Error('Sparse accessor is not supported');
  if(accessor.bufferView!==undefined)accessor.bufferView=addView(accessor.bufferView);
  const mapped=document.accessors.push(accessor)-1;
  accessorMap.set(index,mapped);
  return mapped;
}
function addMaterial(index){
  if(materialMap.has(index))return materialMap.get(index);
  const material=cloned(original.materials[index]);
  if(material.pbrMetallicRoughness?.baseColorTexture||material.normalTexture)throw Error('Unexpected texture dependency');
  const mapped=document.materials.push(material)-1;
  materialMap.set(index,mapped);return mapped;
}
for(const name of select){
  const originalNode=original.nodes.find(n=>n.name===name);
  if(!originalNode||originalNode.mesh===undefined)throw Error('Missing Library effect: '+name);
  const node=cloned(originalNode);
  const mesh=cloned(original.meshes[originalNode.mesh]);
  for(const primitive of mesh.primitives){
    if(primitive.indices!==undefined)primitive.indices=addAccessor(primitive.indices);
    for(const key of Object.keys(primitive.attributes))primitive.attributes[key]=addAccessor(primitive.attributes[key]);
    if(primitive.material!==undefined)primitive.material=addMaterial(primitive.material);
    if(primitive.targets)for(const morph of primitive.targets)for(const key of Object.keys(morph))morph[key]=addAccessor(morph[key]);
  }
  node.mesh=document.meshes.push(mesh)-1;
  delete node.children;
  document.scenes[0].nodes.push(document.nodes.push(node)-1);
}
const pad4=n=>(n+3)&~3;
document.buffers[0].byteLength=binarySize;
const jsonBytes=Buffer.from(JSON.stringify(document),'utf8');
const jsonChunk=Buffer.alloc(pad4(jsonBytes.length),0x20);jsonBytes.copy(jsonChunk);
const binaryChunk=Buffer.alloc(pad4(binarySize));Buffer.concat(chunks).copy(binaryChunk);
const header=Buffer.alloc(12),chunkHeaders=Buffer.alloc(16);
header.write('glTF');header.writeUInt32LE(2,4);
header.writeUInt32LE(12+8+jsonChunk.length+8+binaryChunk.length,8);
chunkHeaders.writeUInt32LE(jsonChunk.length,0);chunkHeaders.writeUInt32LE(0x4e4f534a,4);
chunkHeaders.writeUInt32LE(binaryChunk.length,8);chunkHeaders.writeUInt32LE(0x004e4942,12);
writeFileSync(target,Buffer.concat([header,chunkHeaders.subarray(0,8),jsonChunk,chunkHeaders.subarray(8),binaryChunk]));
console.log(JSON.stringify({sourceBytes:input.length,outputBytes:12+16+jsonChunk.length+binaryChunk.length,effects:select.length,vertices:document.accessors.length}));
