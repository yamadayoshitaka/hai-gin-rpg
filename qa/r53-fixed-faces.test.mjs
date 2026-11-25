// Run: node --test qa/r53-fixed-faces.test.mjs
// Fail closed: structural validation is necessary, never sufficient for visual release.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {validateCatalog, R53_NAMES, fixedRecord, loadFixedFace} from '../src/r53-fixed-face-catalog.mjs';
const digest=b=>createHash('sha256').update(b).digest('hex');
const root=new URL('../assets/face-r53/',import.meta.url);
const read=p=>readFileSync(new URL(p,root));
const mock=()=>({revision:'R53',faces:R53_NAMES.map((id,i)=>({id,sex:id.split('_')[0],sourceSex:id.split('_')[0],glb:id+'.glb',thumbnail:id+'.png',sha256:i.toString(16).padStart(64,'0')}))});
test('catalog rejects incomplete, duplicate and cross-sex records',()=>{
  assert.equal(validateCatalog(mock()).length,20);
  let m=mock();m.faces.pop();assert.throws(()=>validateCatalog(m));
  m=mock();m.faces[1].sha256=m.faces[0].sha256;assert.throws(()=>validateCatalog(m));
  m=mock();m.faces[10].sourceSex='female';assert.throws(()=>validateCatalog(m));
  m=mock();m.faces[1].identityKey='female:1';assert.throws(()=>validateCatalog(m));
});
test('custom record collision never overwrites existing user data',()=>{
  const f=mock().faces[0],b=new ArrayBuffer(20);
  assert.throws(()=>fixedRecord(f,b,{id:'標準ベース 女性01',glb:new Blob()}));
  const old={id:'標準ベース 女性01',baseId:'__r45_base_r47_female',identityRevision:52};
  const rec=fixedRecord(f,b,old);
  assert.equal(rec.identityKey,null);assert.equal(rec.glb.size,20);assert.equal(rec.fixedFaceRevision,'R53');
});
test('network failure must not silently select a donor',async()=>{
  await assert.rejects(loadFixedFace(mock().faces[0],'https://example.invalid/',async()=>({ok:false,status:404})),/404/);
});
function geometryHash(b) {
  assert.equal(b.readUInt32LE(0),0x46546c67);assert.equal(b.readUInt32LE(4),2);
  assert.equal(b.readUInt32LE(8),b.length);assert.equal(b.readUInt32LE(16),0x4e4f534a);
  const n=b.readUInt32LE(12),j=JSON.parse(b.subarray(20,20+n).toString()),offset=28+n;
  assert.equal(b.readUInt32LE(24+n),0x004e4942);
  const h=createHash('sha256');let vertices=0;
  for(const m of j.meshes)for(const p of m.primitives){
    const a=j.accessors[p.attributes.POSITION],v=j.bufferViews[a.bufferView];
    assert.equal(a.type,'VEC3');assert.equal(a.componentType,5126);
    assert.equal(v.buffer,0);assert.ok(!a.sparse);
    const start=offset+(v.byteOffset||0)+(a.byteOffset||0),stride=v.byteStride||12;
    assert.ok(start+(a.count-1)*stride+12<=Math.min(offset+(v.byteOffset||0)+v.byteLength,b.length));
    for(let i=0;i<a.count;i++){const k=start+i*stride;for(let c=0;c<3;c++)assert.ok(Number.isFinite(b.readFloatLE(k+c*4)));h.update(b.subarray(k,k+12));}
    vertices+=a.count;
  }
  assert.ok(vertices>0);assert.ok(j.meshes.some(m=>m.primitives.some(p=>(p.targets||[]).length>=11)),'expression morph targets required');
  return h.digest('hex');
}
test('release assets: independent GLBs and rendered evidence must exist',()=>{
  const faces=validateCatalog(JSON.parse(read('catalog.json'))),seen=new Set();
  for(const f of faces){
    const b=read(f.glb);assert.equal(digest(b),f.sha256,f.id);
    const gh=geometryHash(b);assert.ok(!seen.has(gh),'identical baked geometry '+f.id);seen.add(gh);
    assert.equal(read(f.thumbnail).subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  }
  const qa=JSON.parse(read('quality-review.json'));
  assert.equal(qa.revision,'R53');assert.deepEqual(qa.assets, Object.fromEntries(faces.map(f=>[f.id,f.sha256])));
  for(const name of ['female-front','female-side','male-front','male-side','all-45','all-hair','neck-closeup']){
    const b=read(name+'.png');assert.equal(b.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
    assert.equal(qa.renderHashes?.[name],digest(b));
  }
  // Explicit visual sign-off is not created by this test.
  assert.equal(qa.visualApproved,true);
  for(const f of faces)for(const k of ['identity','neck','hair','expression','allAges','allBuilds','fullBody','walkRun','roundTrip','saveRestore','actionSync'])
    assert.equal(qa.faces?.[f.id]?.[k],true,f.id+': '+k);
});
