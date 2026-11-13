import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const fromRoot=p=>path.join(ROOT,p);
const readJson=p=>JSON.parse(fs.readFileSync(fromRoot(p),'utf8'));
const manifest=readJson('assets/story/stage-manifests/c01-s02.manifest.json');
const group=manifest.continuation.pendingGroups.find(v=>v.edition==='post-victory'&&v.gender==='female');
assert(group);
assert.equal(manifest.continuation.existingSceneCount,23);
assert.equal(manifest.continuation.remainingSceneCount,25);
assert.equal(manifest.continuation.newActualRegisteredWebps,0);
assert.equal(group.reviewSheets.length,2);
const images=new Map();
const candidateRoot='assets/story/chapter-drafts/c01/unapproved-native-candidates';
function sizeOfWebp(bytes){
 assert.equal(bytes.toString('ascii',0,4),'RIFF');
 assert.equal(bytes.toString('ascii',8,12),'WEBP');
 const type=bytes.toString('ascii',12,16);
 if(type==='VP8 '){
  assert.equal(bytes[23],0x9d);assert.equal(bytes[24],0x01);assert.equal(bytes[25],0x2a);
  return [bytes.readUInt16LE(26)&0x3fff,bytes.readUInt16LE(28)&0x3fff];
 }
 if(type==='VP8L'){const n=bytes.readUInt32LE(21);return [(n&0x3fff)+1,((n>>>14)&0x3fff)+1]}
 if(type==='VP8X')return [1+bytes.readUIntLE(24,3),1+bytes.readUIntLE(27,3)];
 throw new Error('Unsupported WebP '+type);
}
for(const [index,sheet] of group.reviewSheets.entries()){
 assert(sheet.panels.length>=1&&sheet.panels.length<=5);
 const page=String(index+1).padStart(2,'0');
 const report=readJson(candidateRoot+'/c01-s02-post-victory-female-page'+page+'.review.json');
 assert.equal(report.reviewSheet,index+1);
 assert.equal(report.exactPanelCount,sheet.panels.length);
 assert.equal(report.gameRegistered,false);
 assert.equal(report.reviewStatus,'CANDIDATE_ONLY_NOT_QUALITY_APPROVED');
 assert.equal(report.textFreeQualityReview,'PENDING');
 assert.equal(report.characterAndDialogueReview,'PENDING');
 assert.deepEqual(report.shotOrder,sheet.panels);
 assert.equal(report.assets.length,sheet.panels.length);
 for(const [i,art] of report.assets.entries()){
  const shot=sheet.panels[i].replace('c01-s02-m','m').padStart(2,'0');
  assert(/^c01-s02-m\d{2}-post-victory-female\.webp$/.test(art.name));
  assert.equal(art.approval,'PENDING_MANUAL_VISUAL_QA');
  const bytes=fs.readFileSync(fromRoot(candidateRoot+'/'+art.name));
  const [w,h]=sizeOfWebp(bytes);
  assert(w>=768&&h>=320,art.name+' must meet native pixel floor');
  assert.deepEqual([w,h],art.sourceNativePixels);
  assert.deepEqual([w,h],report.originalNativePixels);
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),art.sha256);
  if(images.has(art.sha256))throw Error('Duplicate source image '+art.name);
  images.set(art.sha256,art.name);
 }
}
assert.equal(images.size,7);
assert.equal(fs.readdirSync(fromRoot(candidateRoot)).filter(x=>x.endsWith('.webp')).length,7);
console.log('PASS: c01-s02 5+2 distinct native WebP candidates in two separate review pages; existing 23 preserved; quality not approved and not registered');
