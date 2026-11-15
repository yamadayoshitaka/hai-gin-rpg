import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import crypto from 'node:crypto';
import {validateSource,planLodBatch} from '../scripts/battle-lod-batch.mjs';
import {inspectGlb,verifyLodCandidate} from '../scripts/battle-lod-gate.mjs';

function fakeGlb(triangles,skins=1,animations=1,morphs=0){
 const json={asset:{version:'2.0'},meshes:[{primitives:[{indices:0,attributes:{POSITION:1},
  ...(morphs?{targets:Array.from({length:morphs},()=>({POSITION:1}))}:{})}]}],
  accessors:[{count:triangles*3},{count:triangles*3}],
  materials:[{name:'body'}],
  skins:Array.from({length:skins},()=>({joints:[0]})),
  animations:Array.from({length:animations},()=>({name:'run'}))};
 const raw=Buffer.from(JSON.stringify(json));
 const chunk=Buffer.alloc(Math.ceil(raw.length/4)*4,0x20);
 raw.copy(chunk);
 const bytes=Buffer.alloc(20+chunk.length);
 bytes.write('glTF',0);bytes.writeUInt32LE(2,4);bytes.writeUInt32LE(bytes.length,8);
 bytes.writeUInt32LE(chunk.length,12);bytes.write('JSON',16);chunk.copy(bytes,20);
 return bytes;
}
const builder=readFileSync(new URL('../scripts/build-battle-lods.py',import.meta.url),'utf8');
assert.match(builder,/bpy\.ops\.wm\.read_factory_settings\(use_empty=True\)/,
 'Each tier must reset all Blender datablocks including orphaned glTF animations');
assert.match(builder,/int\.from_bytes\(raw\[12:16\]/,
 'Triangle and mesh budgets are extracted from the serialized GLB, not Blender preexport counts');
const base='assets/battle-lod-candidates/knight-pilot/';
const files={'assets/characters/Knight.glb':fakeGlb(1000,1,1,2),
 [base+'near.glb']:fakeGlb(1000,1,1,2),
 [base+'mid.glb']:fakeGlb(400,1,1,2),
 [base+'far.glb']:fakeGlb(150,1,1,2)};
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const read=p=>{
 if(files[p])return files[p];
 if(p===base+'manifest.json')return Buffer.from(JSON.stringify(manifest));
 const error=Error('Not found');error.code='ENOENT';throw error;
};
const manifest={schema:'hai-gin/battle-lod-candidate/v1',id:'knight-pilot',
 source:'assets/characters/Knight.glb',
 sourceSha256:hash(files['assets/characters/Knight.glb']),
 generatedFor:'candidate-review',liveModelReplaced:false,
 mobileFpsApproved:false,pixelComparisonApproved:false,
 tiers:Object.fromEntries(['near','mid','far'].map(t=>[t,{
  path:base+t+'.glb',sha256:hash(files[base+t+'.glb']),
  triangles:inspectGlb(files[base+t+'.glb']).triangles,meshParts:1
 }]))};
assert.equal(inspectGlb(files['assets/characters/Knight.glb']).triangles,1000);
assert.equal(verifyLodCandidate(manifest,read).status,'GEOMETRY_PASS_VISUAL_PENDING');
const checkLostRig=(wrong,name)=>{
 const badFiles={...files,[base+'mid.glb']:wrong};
 const badManifest={...manifest,tiers:{...manifest.tiers,
   mid:{...manifest.tiers.mid,sha256:hash(wrong)}}};
 assert.throws(()=>verifyLodCandidate(badManifest,p=>badFiles[p]||read(p)),new RegExp(name));
};
checkLostRig(fakeGlb(400,0,1,2),'skin count changed');
checkLostRig(fakeGlb(400,1,0,2),'animation count changed');
assert.throws(()=>inspectGlb(Buffer.from('wrong GLB')),/Invalid GLB/);
assert.throws(()=>verifyLodCandidate({...manifest,tiers:{
 ...manifest.tiers,mid:{...manifest.tiers.mid,triangles:200}}},read),/scene stats/);
assert.throws(()=>verifyLodCandidate({...manifest,mobileFpsApproved:true},read),/Unsafe production/);
assert.throws(()=>verifyLodCandidate({...manifest,sourceSha256:'bad'},read),/SHA changed/);
assert.throws(()=>validateSource('assets/../secret.glb'),/Unsafe/);
assert.throws(()=>validateSource(base+'near.glb'),/Unsafe/);
const sources={schema:'hai-gin/battle-lod-sources/v1',targets:[
 {id:'knight-pilot',group:'human',source:'assets/characters/Knight.glb'}]};
const active={groups:{human:{enabled:true},monster:{enabled:false}}};
assert.deepEqual(planLodBatch(sources,active,read),[],'Same SHA and output files do not rebuild');
assert.deepEqual(planLodBatch(sources,{groups:{human:{enabled:false},monster:{enabled:false}}},read),[]);
assert.throws(()=>planLodBatch(sources,{groups:{}},read),/fail closed/);
assert.throws(()=>planLodBatch({...sources,targets:[sources.targets[0],sources.targets[0]]},active,read),/duplicate/);
console.log('near/mid/far GLB geometry gate, rig/animation/morph, hash, strict switch and deduplication PASS');
