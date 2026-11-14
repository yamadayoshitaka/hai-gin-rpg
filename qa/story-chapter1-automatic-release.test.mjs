import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chapterOneReviewPages} from '../src/story-chapter1-review-core.js';
import {registeredStoryPanelAsset} from '../src/story-panel-registered-art.js';
import {CHAPTER1_PROVISIONAL_LIVE} from '../src/story-chapter1-provisional-live.js';
const read=p=>fs.readFileSync(p,'utf8');
const pages=chapterOneReviewPages(),shots=pages.flatMap(p=>p.shots);
assert.equal(pages.length,132);
assert.equal(shots.length,462);
assert.equal(new Set(shots.map(s=>s.key)).size,462);
const generation=read('scripts/generate-story-chapter1-free-batch.mjs');
const registration=read('scripts/publish-story-chapter1-provisional.mjs');
const generateWorkflow=read('.github/workflows/story-chapter1-free-complete-draft-production.yml');
const registrationWorkflow=read('.github/workflows/story-chapter1-provisional-game-register.yml');
const ui=read('src/story-chapter1-approval-ui.js');
const html=read('story-chapter1-approval.html');
for(const text of ['FREE_QUOTA_EXHAUSTED_RESUME_NEXT_SCHEDULE',
 'FREE_API_STOP_NO_RETRY_HTTP_429 4006:',"noPaidFallback:true",
 'git','CLOUDFLARE_FREE_PLAN_CONFIRMED']){
 assert(generation.includes(text),'Missing Free-only safe stop / provenance '+text);
}
assert(generation.includes('if(blockers.some(s=>status(s)!=='), 'Blocked safety scenes must not stop unrelated scenes');
assert(generateWorkflow.includes("cron: '15 3 * * *'"),'Daily resume schedule missing');
assert(generateWorkflow.includes("CLOUDFLARE_CHAPTER1_DAILY_ESTIMATE_CAP: '7500'"));
assert(!generation.includes("https://api.openai.com"),'Never use OpenAI paid API for batch');
assert(registrationWorkflow.includes('workflow_run:'),'Automatically register after generated output');
assert(registrationWorkflow.includes("github.event.workflow_run.conclusion == 'success'"));
assert(registrationWorkflow.includes('gh workflow run publish-pages.yml --ref main'),'Bot commits must deploy');
assert(registration.includes('PROVISIONAL_NOT_VISUALLY_APPROVED'),'No false P0 approval');
assert(registration.includes("if(ledger.returned[s.key]===verified.sha256)"),'Returned SHA must never be republished');
assert(registration.includes("mode==='--return-issue'"),'User must be able to roll back a single shot');
assert(ui.includes("['revise','↶ このコマを差し戻す']"));
assert(!ui.includes("'◎ 仮承認'"),'No user provisional approval step');
assert(!html.includes('id="visualConfirm"'));
assert(html.includes('html,body{height:100%;height:100dvh;overflow:hidden}'));
const registeredShots=shots.filter(s=>s.legacyPath);
const provisional=Object.keys(CHAPTER1_PROVISIONAL_LIVE);
assert(provisional.length<=462&&registeredShots.length<=462);
const existing=new Set(shots.map(s=>s.key));
for(const key of provisional){
 assert(existing.has(key),'Only canonical chapter1 shots are published');
 const image=CHAPTER1_PROVISIONAL_LIVE[key];
 assert.equal(image.status,'PROVISIONAL_NOT_VISUALLY_APPROVED');
 assert.equal(typeof image.sha256,'string');
 assert.match(image.sha256,/^[0-9a-f]{64}$/);
 assert.equal(image.asset,'./assets/story/chapter1-provisional-live/'+key.replaceAll('|','__')+'.webp');
}
console.log(JSON.stringify({test:'PASS',chapter:1,scenes:462,reviewPages:132,
 registeredShots:registeredShots.length,
 reversibleLiveImages:provisional.length,
 futureMissingAssetsAllowed:true,
 freeOnly:true,approvalButtonRequired:false,
 gamePublishAfterSuccessfulBatch:true,
 rollbackInsteadOfFalseP0Approval:true}));
