import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const src='scripts/generate-story-cloudflare-free-page.mjs';
const run=(params,env={})=>spawnSync(process.execPath,[src,...params],{
 cwd:root,encoding:'utf8',
 env:{...process.env,...env,
  CLOUDFLARE_ACCOUNT_ID:'',CLOUDFLARE_WORKERS_AI_API_TOKEN:'',
  CLOUDFLARE_FREE_PLAN_CONFIRMED:'false'},
 maxBuffer:20*1024*1024
});
const plan=run(['--mode','plan','--page','1']);
assert.equal(plan.status,0,plan.stderr+'\n'+plan.stdout);
const summary=JSON.parse(plan.stdout.trim());
assert.equal(summary.scenes,5);
assert.equal(summary.apiRequests,0);
assert.equal(summary.rendered,0);
assert.equal(summary.oneImagePerCall,true);
const rel='qa-reports/story-stage-production/cloudflare-free-pilot/c01-s02-female-post-victory-page1.json';
const report=JSON.parse(fs.readFileSync(path.join(root,rel),'utf8'));
assert.equal(report.model,'@cf/black-forest-labs/flux-2-klein-4b');
assert.equal(report.mode,'plan');
assert.equal(report.stageId,'c01-s02');
assert.deepEqual(report.requestedNativePixels,[1024,576]);
assert.deepEqual(report.minimumNativePixels,[768,320]);
assert.equal(report.shotCount,5);
assert.equal(report.maxScenesPerImageRequest,1);
assert.equal(report.maxScenesPerReviewPage,5);
assert.equal(report.freePlanDailyNeurons,10000);
assert(report.estimatedNeurons>500&&report.estimatedNeurons<1000);
assert.deepEqual(report.shots.map(s=>s.shotKey.split('|')[3]),[
 'c01-s02-m6','c01-s02-m7','c01-s02-m8','c01-s02-m9','c01-s02-m16']);
assert.equal(report.shots.every(s=>s.rendered===false&&s.qualityApproved===false&&
 s.formallyRegistered===false),true);
assert.equal(report.shots.every(s=>s.referenceCount<=4),true);
assert.equal(report.shots[0].referenceCount,3);
assert(report.shots[0].referenceSourceSha256.every(x=>/^[0-9a-f]{64}$/.test(x.sha256)));
const negative=run(['--mode','generate','--page','1']);
assert.notEqual(negative.status,0,'No secret or free plan confirmation must prevent ANY live requests');
assert(negative.stderr.includes('FREE_PLAN_ONLY'));
const second=run(['--mode','plan','--page','2']);
assert.equal(second.status,0,second.stderr);
assert.equal(JSON.parse(second.stdout.trim()).scenes,2);
const invalid=run(['--mode','plan','--page','3']);
assert.notEqual(invalid.status,0);
console.log('PASS: Cloudflare five independent character-ref image requests planned at 1024x576; 0 API calls, cost cap, no missing token consumption, page2 has 2 frames, no formal approval/registration.');
