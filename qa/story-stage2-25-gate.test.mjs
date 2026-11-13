import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {registeredStoryPanelAsset} from '../src/story-panel-registered-art.js';
import {comicForStage} from '../src/story-chapter-comic.js';
import {REGISTERED_C01_S02_REVIEWED} from '../src/story-stage2-reviewed-art.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const script='scripts/check-c01-s02-pending-art.mjs';
const check=spawnSync(process.execPath,[script],{cwd:root,encoding:'utf8'});
assert.equal(check.status,0,check.stdout+'\n'+check.stderr);
const report=JSON.parse(fs.readFileSync(path.join(root,
 'qa-reports/story-stage-production/c01-s02-25-real-art-readiness.json'),'utf8'));
assert.equal(report.kind,'C01_S02_REAL_ART_READINESS_CHECK_NOT_APPROVAL');
assert.equal(report.expectedPending,25);
assert.equal(report.rows.length,25);
assert.equal(report.existingProtected,23);
assert.equal(report.registeredNewImages,0);
assert.equal(report.allReady,false,'Must not pass until actual 25 approved WebPs exist');
assert.equal(Object.keys(REGISTERED_C01_S02_REVIEWED).length,0);
assert(report.rows.every(r=>r.minNativePixels[0]===768&&r.minNativePixels[1]===320));
assert.equal(new Set(report.rows.map(r=>r.shotKey)).size,25);
assert.equal(new Set(report.rows.map(r=>r.individualAsset)).size,25);
assert(report.rows.every(r=>r.gameRegistered===false));
const accepted=[
 ['pre','male',{protagonistGender:'male'},8],
 ['pre','female',{protagonistGender:'female'},8],
 ['post-victory','male',{protagonistGender:'male',battleOutcome:{victory:true}},7]];
let protectedCount=0;
for(const [edition,gender,ctx,count] of accepted){
 const c=comicForStage('c01-s02',edition==='pre'?'pre':'post',ctx);
 assert.equal(c.panels.length,count);
 for(const shot of c.panels) {
  assert.equal(shot.comicEdition,edition);
  assert.equal(shot.protagonistGender,gender);
  assert(registeredStoryPanelAsset(shot),'Existing registered shot was lost: '+shot.id);
  protectedCount++;
 }
}
assert.equal(protectedCount,23);
const old=fs.readFileSync(path.join(root,'src/story-stage2-reviewed-art.js'),'utf8');
const attempt=spawnSync(process.execPath,[script,'--register'],{cwd:root,encoding:'utf8'});
assert.notEqual(attempt.status,0,'Must not register 25 unapproved/missing files');
assert.equal(fs.readFileSync(path.join(root,'src/story-stage2-reviewed-art.js'),'utf8'),old);
console.log('PASS: 25 canonical stage2 IDs are gated on real 768x320+ WebP and human cast/script/branch review; preexisting 23 unaffected; unsafe registration blocked');
