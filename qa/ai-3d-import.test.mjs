import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,existsSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {auditGLB} from '../tools/ai-3d-glb-audit.mjs';

function glb(){
 const b=Buffer.alloc(104);
 // POSITION xyz: triangle on XY plane
 [0,0,0,1,0,0,0,1,0].forEach((v,i)=>b.writeFloatLE(v,i*4));
 [0,0,1,0,0,1,0,0,1].forEach((v,i)=>b.writeFloatLE(v,36+i*4));
 [0,0,1,0,0,1].forEach((v,i)=>b.writeFloatLE(v,72+i*4));
 [0,1,2].forEach((v,i)=>b.writeUInt16LE(v,96+i*2));
 const gltf={
  asset:{version:'2.0'},scene:0,scenes:[{nodes:[0]}],nodes:[{mesh:0}],
  buffers:[{byteLength:104}],
  bufferViews:[
   {buffer:0,byteOffset:0,byteLength:36,target:34962},
   {buffer:0,byteOffset:36,byteLength:36,target:34962},
   {buffer:0,byteOffset:72,byteLength:24,target:34962},
   {buffer:0,byteOffset:96,byteLength:6,target:34963}
  ],
  accessors:[
   {bufferView:0,componentType:5126,count:3,type:'VEC3',min:[0,0,0],max:[1,1,0]},
   {bufferView:1,componentType:5126,count:3,type:'VEC3'},
   {bufferView:2,componentType:5126,count:3,type:'VEC2'},
   {bufferView:3,componentType:5123,count:3,type:'SCALAR'}
  ],
  materials:[{pbrMetallicRoughness:{baseColorFactor:[0.7,0.7,0.7,1]}}],
  meshes:[{primitives:[{attributes:{POSITION:0,NORMAL:1,TEXCOORD_0:2},indices:3,material:0}]}]
 };
 const j=Buffer.from(JSON.stringify(gltf),'utf8');
 const padded=Buffer.concat([j,Buffer.alloc((4-j.length%4)%4,32)]);
 const file=Buffer.alloc(12+8+padded.length+8+b.length);
 file.write('glTF',0,'ascii');file.writeUInt32LE(2,4);file.writeUInt32LE(file.length,8);
 file.writeUInt32LE(padded.length,12);file.writeUInt32LE(0x4e4f534a,16);
 padded.copy(file,20);
 const o=20+padded.length;file.writeUInt32LE(b.length,o);file.writeUInt32LE(0x004e4942,o+4);b.copy(file,o+8);
 return file;
}
function workspace(entries){
 const root=mkdtempSync(join(tmpdir(),'ai-3d-import-'));
 mkdirSync(join(root,'assets/ai-model-inbox'),{recursive:true});
 mkdirSync(join(root,'data'),{recursive:true});
 writeFileSync(join(root,'assets/ai-model-inbox/manifest.json'),JSON.stringify({schema:'hai-gin/ai-3d-inbox/v1',entries}));
 writeFileSync(join(root,'data/ai-model-registry.json'),JSON.stringify({schema:'hai-gin/ai-3d-registry/v1',generated:[]}));
 return root;
}
const script=resolve('tools/ai-3d-free-import.mjs');
const entry={id:'dragon_01',category:'monster',filename:'dragon_01.glb',
 provider:'Tripo Web',sourceUrl:'https://www.tripo3d.ai/',license:'unknown'};
const run=dir=>spawnSync(process.execPath,[script],{cwd:dir,encoding:'utf8',timeout:15000});

test('valid GLB receives structural summary without visual approval',()=>{
 const data=auditGLB(glb(),{category:'monster'});
 assert.equal(data.triangles,1);assert.equal(data.meshes,1);
 assert.equal(data.structurallyValid,true);
 assert.equal(data.visuallyApproved,false);
 assert.ok(data.warnings.some(s=>s.includes('detail')));
});
test('corrupt GLB header rejected',()=>{
 const data=glb();data.writeUInt32LE(44444,8);
 assert.throws(()=>auditGLB(data),/length mismatch/);
});
test('free GLB inbox safely imports and registers as pending candidate',()=>{
 const root=workspace([entry]);
 try{
  writeFileSync(join(root,'assets/ai-model-inbox/dragon_01.glb'),glb());
  const r=run(root);
  assert.equal(r.status,0,r.stderr);
  assert.ok(existsSync(join(root,'assets/ai-generated/monster/dragon_01/candidate.glb')));
  assert.ok(!existsSync(join(root,'assets/ai-model-inbox/dragon_01.glb')));
  const catalog=JSON.parse(readFileSync(join(root,'data/ai-model-registry.json')));
  assert.equal(catalog.generated.length,1);
  assert.equal(catalog.generated[0].status,'pending-visual-qa');
  const model=JSON.parse(readFileSync(join(root,'assets/ai-generated/monster/dragon_01/manifest.json')));
  assert.equal(model.approvedForGame,false);
  assert.equal(model.commercialRightsVerified,false);
  assert.equal(JSON.parse(readFileSync(join(root,'assets/ai-model-inbox/manifest.json'))).entries.length,0);
 }finally{rmSync(root,{recursive:true,force:true})}
});
test('invalid model name is rejected without losing uploaded original',()=>{
 const item={...entry,filename:'../evil.glb'};
 const root=workspace([item]);
 try{
  const r=run(root);assert.notEqual(r.status,0);
  assert.ok(!existsSync(join(root,'assets/ai-generated')));
  assert.equal(JSON.parse(readFileSync(join(root,'assets/ai-model-inbox/manifest.json'))).entries.length,1);
 }finally{rmSync(root,{recursive:true,force:true})}
});
test('no model input is a successful no-charge no-op',()=>{
 const root=workspace([]);
 try{
  const r=run(root);assert.equal(r.status,0,r.stderr);
  assert.equal(JSON.parse(readFileSync(join(root,'qa/ai-3d-inbox-report.json'))).imported,0);
 }finally{rmSync(root,{recursive:true,force:true})}
});
