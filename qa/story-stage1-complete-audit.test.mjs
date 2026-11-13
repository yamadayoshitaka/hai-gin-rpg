import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const index='qa-reports/story-stage-production/batches/c01-s01/stage1-audit-and-render-queue.json';
const load=()=>JSON.parse(fs.readFileSync(path.join(root,index),'utf8'));
function run(args){
 const p=spawnSync(process.execPath,['scripts/process-c01-s01-stage-batch.mjs',...args],
  {cwd:root,encoding:'utf8',maxBuffer:25*1024*1024});
 assert.equal(p.status,0,p.stdout+'\n'+p.stderr);
 return load();
}
const first=run(['--sheet','1']);
assert.equal(first.existingRegisteredWebps,30);
assert.equal(first.reviewSheets,6);
assert.equal(first.oneFramePromptsWritten,5);
assert.equal(first.sheets[0].requestFiles.length,5);
assert.equal(first.sheets.slice(1).every(s=>s.requestFiles.length===0),true);
const all=run([]);
assert.equal(all.kind,'STAGE1_EXISTING_30_WEBPS_AUDITED_NOT_HUMAN_APPROVED');
assert.equal(all.existingRegisteredWebps,30);
assert.equal(all.completeExistingAssetAudit,true);
assert.equal(all.reviewSheets,6);
assert.equal(all.maxFramesPerSheet,5);
assert.equal(all.oneImageOnlyPerRenderCall,true);
assert.equal(all.oneFramePromptsWritten,30);
assert.equal(all.newGeneratedWebps,0);
assert.equal(all.newGithubRegistrations,0);
assert.equal(all.stageCompleteAndApproved,false);
assert.equal(all.phoneNativePass+all.phoneNativeFail,30);
assert.equal(all.sheets.reduce((n,s)=>n+s.shotCount,0),30);
assert.equal(all.sheets.reduce((n,s)=>n+s.requestFiles.length,0),30);
assert.equal(all.sheets.every(s=>s.shotCount<=5&&s.requestFiles.length<=5),true);
const keys=new Set();
const assets=new Set();
for(const sheet of all.sheets){
 for(const p of sheet.requestFiles){
  const r=JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
  assert.equal(r.kind,'STAGE1_ONE_PANEL_RENDER_REQUEST_NOT_GENERATED');
  assert.equal(r.outputLimitImages,1);
  assert.deepEqual(r.minimumNativePixels,[768,320]);
  assert.equal(r.allReferenceBytesAttachedToRenderer,false);
  assert.equal(r.newImageGenerated,false);
  assert.equal(r.existingArt.registeredInGame,true);
  assert.equal(r.existingArt.visualQualityApproved,false);
  assert.equal(r.review.scriptSceneApproved,false);
  assert.equal(r.review.textlessVisualApproval,false);
  assert(r.prompt.includes('GENERATE ONE IMAGE FOR EXACTLY ONE STORY PANEL'));
  assert(r.prompt.includes('CURRENT SCENE DIALOGUE FOR ACTING ONLY (INVISIBLE IN IMAGE): '+r.scene.scriptText));
  assert(r.prompt.includes('ONE OUTPUT ONLY: no grid'));
  assert(!r.prompt.includes('Frame 2 scene')&&!r.prompt.includes('Frame 3 scene'));
  assert.equal(keys.has(r.shotKey),false);
  assert.equal(assets.has(r.existingArt.path),false);
  keys.add(r.shotKey);
  assets.add(r.existingArt.path);
  assert(fs.existsSync(path.join(root,r.existingArt.path)));
 }
}
assert.equal(keys.size,30);
assert.equal(assets.size,30);
const bad=spawnSync(process.execPath,
 ['scripts/process-c01-s01-stage-batch.mjs','--sheet','7'],{cwd:root,encoding:'utf8'});
assert.notEqual(bad.status,0,'Must reject a seventh review sheet');
console.log('PASS: chapter1 stage1 physical 30 native WebPs audited, protected, and sliced into exactly 6 five-max groups and 30 separate one-image-only prompts; no fabricated visual approval');
