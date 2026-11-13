/**
 * Offline integration test of ACTUAL candidate-file pipeline against a mocked
 * Workers AI response (zero billable calls). Fake frames never enter game art.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'cloudflare-flux-test-'));
const artRel='qa-reports/story-stage-production/cloudflare-free-pilot/mock-art';
const artDir=path.join(root,artRel);
const reportPath=path.join(root,'qa-reports/story-stage-production/cloudflare-free-pilot/c01-s02-female-post-victory-page1.json');
const logPath=path.join(temp,'calls.jsonl');
const fakeFixtures=path.join(temp,'images');
fs.mkdirSync(fakeFixtures,{recursive:true});
assert(!fs.existsSync(artDir),
 'Test never deletes previously generated candidate art; mock output dir must be empty');
try{
 const code=[
  'from PIL import Image',
  'from pathlib import Path',
  'import sys',
  'p=Path(sys.argv[1]);p.mkdir(parents=True,exist_ok=True)',
  'for i in range(1,6):',
  '  base=Image.effect_noise((1024,576),30).convert("RGB")',
  '  tint=Image.new("RGB",(1024,576),((i*32)%256,(i*47)%256,(i*65)%256))',
  '  img=Image.blend(base,tint,0.55)',
  '  img.save(p/("mock-"+str(i)+".png"),"PNG")',
 ].join('\n');
 const prep=spawnSync('python3',['-c',code,fakeFixtures],{cwd:root,encoding:'utf8'});
 assert.equal(prep.status,0,prep.stderr);
 const env={...process.env,
  CLOUDFLARE_ACCOUNT_ID:'0123456789abcdef0123456789abcdef',
  CLOUDFLARE_WORKERS_AI_API_TOKEN:'dummy-token-for-offline-regression-only',
  CLOUDFLARE_FREE_PLAN_CONFIRMED:'true',
  CLOUDFLARE_MAX_NEURONS:'1000',
  STORY_CLOUDFLARE_TEST_ISOLATION:'confirmed-local-fake',
  MOCK_CLOUDFLARE_IMAGE_DIR:fakeFixtures,
  MOCK_CLOUDFLARE_REQUEST_LOG:logPath
 };
 const args=['--import','./qa/story-cloudflare-mock-fetch.mjs',
  'scripts/generate-story-cloudflare-free-page.mjs','--mode','generate','--page','1'];
 const actual=spawnSync(process.execPath,args,
  {cwd:root,env,encoding:'utf8',timeout:90000,maxBuffer:20*1024*1024});
 assert.equal(actual.status,0,actual.stdout+'\n'+actual.stderr);
 const report=JSON.parse(fs.readFileSync(reportPath,'utf8'));
 assert.equal(report.mode,'generate');
 assert.equal(report.isolatedMock,true);
 assert.equal(report.imagesActuallyGenerated,5);
 assert.equal(report.requestsActuallySent,5);
 assert.equal(report.existingCandidatesResumed,0);
 assert.equal(report.validCandidateCount,5);
 assert.equal(report.formalArtRegistered,0);
 assert.equal(report.qualityApproved,false);
 const calls=fs.readFileSync(logPath,'utf8').trim().split('\n').map(JSON.parse);
 assert.equal(calls.length,5);
 const hashes=new Set();
 for(let i=0;i<report.shots.length;i++){
  const s=report.shots[i],c=calls[i];
  assert.equal(c.call,i+1);
  assert.equal(c.referenceFields.length,s.referenceCount);
  assert.deepEqual(c.referenceFields,s.referenceFields||
   Array.from({length:s.referenceCount},(_,j)=>'input_image_'+j));
  assert(c.referenceBytes.every(b=>b>100));
  assert.equal(s.rendered,true);
  assert.equal(s.referenceImageBytesActuallyAttachedToRequest,true);
  assert.equal(s.qualityApproved,false);
  assert.equal(s.formallyRegistered,false);
  assert(s.outputPath.startsWith(artRel));
  const proof=JSON.parse(fs.readFileSync(path.join(root,s.outputPath+'.generation.json'),'utf8'));
  assert.equal(proof.approvedForFormalGameRegistration,false);
  assert.equal(proof.physicalReferencesActuallyAttached,true);
  assert.deepEqual(proof.nativePixels,[1024,576]);
  assert(!hashes.has(proof.imageSha256),'Individual scene bytes must be distinct');
  hashes.add(proof.imageSha256);
 }
 assert.equal(hashes.size,5);
 console.log('PASS: offline mocked real multipart Cloudflare transport sent exactly 5 one-scene requests with physical PNG reference bytes, 5 native 1024x576 WebPs and SHA proofs; zero billable calls and zero game registration');
}finally{
 fs.rmSync(artDir,{recursive:true,force:true});
 fs.rmSync(temp,{recursive:true,force:true});
}
