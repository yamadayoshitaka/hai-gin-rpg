import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {comicForStage} from '../src/story-chapter-comic.js';
const out=execFileSync(process.execPath,['scripts/compile-story-chapter-atlas.mjs','--all'],{encoding:'utf8'});
const outputs=out.split('\n').filter(Boolean).map(JSON.parse);
assert.equal(outputs.length,10);
let total=0,registeredPreviewSheets=0;
for(let ch=1;ch<=5;ch++)for(const gender of ['male','female']){
 const p='qa-reports/story-chapters/c'+String(ch).padStart(2,'0')+'-'+gender+'-mainline-150.json';
 const plan=JSON.parse(fs.readFileSync(p,'utf8'));
 assert.equal(plan.chapter,ch);
 assert.equal(plan.gender,gender);
 assert.equal(plan.atlas.frames,150);
 assert.equal(plan.atlas.columns,10);
 assert.equal(plan.atlas.rows,15);
 assert.deepEqual([plan.atlas.width,plan.atlas.height],[7680,6480]);
 assert.equal(plan.frames.length,150);
 assert.equal(new Set(plan.frames.map(f=>f.framePath)).size,150);
 assert.equal(new Set(plan.frames.map(f=>f.pagePath)).size,20);
 assert.equal(plan.approval,'NOT_APPROVED_MISSING_ATLAS');
 for(let i=0;i<150;i++){
  const f=plan.frames[i];
  assert.equal(f.atlasIndex,i);
  assert.equal(f.atlasColumn,i%10);
  assert.equal(f.atlasRow,Math.floor(i/10));
  assert.equal(f.textInsideArt,false);
  assert.ok(f.pictureDescription&&f.voiceTextExternal);
  assert.match(f.voiceCacheKey,/^story::panel::c0[1-5]-s\d\d-/);
  assert.match(f.framePath,/\.webp$/);
  assert.match(f.pagePath,/\.webp$/);
  assert.equal(f.gender,gender);
  assert.ok(f.phase==='pre'||f.verifiedOutcome);
 }
 for(let slot=1;slot<=10;slot++){
  const stageId='c'+String(ch).padStart(2,'0')+'-s'+String(slot).padStart(2,'0');
  const shots=plan.frames.filter(f=>f.stageId===stageId);
  assert.equal(shots.length,15,'Exactly 15 high-quality frames per stage');
  assert.equal(shots.filter(x=>x.phase==='pre').length,slot===1?10:8);
  assert.equal(shots.filter(x=>x.phase==='post').length,slot===1?5:7);
  assert.equal(new Set(shots.map(f=>f.pagePath)).size,2);
  const baseComic=comicForStage(stageId,'pre',{protagonistGender:gender});
  assert.equal(baseComic.panels.length,slot===1?10:8);
 }
 total+=plan.frames.length;
}
assert.equal(total,1500);
const draft=JSON.parse(fs.readFileSync('assets/story/chapters/c01/draft-registry.json','utf8'));
assert.equal(draft.approved,false);
assert.equal(draft.status,'AI_DRAFT_UNAPPROVED');
assert.equal(draft.panels.length,10);
assert.equal(draft.stageId,'c01-s01');
const readWebp=path=>{
 const bytes=fs.readFileSync(path);
 assert.ok(bytes.length>=12000,'Not an illustration '+path);
 assert.equal(bytes.toString('ascii',0,4),'RIFF');
 assert.equal(bytes.toString('ascii',8,12),'WEBP');
};
readWebp(draft.sheet);
registeredPreviewSheets++;
for(const panel of draft.panels){
 assert.match(panel.id,/^c01-s01-m\d\d$/);
 readWebp(panel.image);
}
assert.equal(new Set(draft.panels.map(x=>x.gitBlobSha)).size,10);
console.log('PASS 5 chapters × 2 genders × 150 frames = '+total+
 ' assigned real-art slots; registered draft sheet '+registeredPreviewSheets+
 ' with ten physically cropped WebP frames, none falsely human-approved');
