import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {canOfferChatGPTHandoff,makeChatGPTHandoff} from '../src/story-generation-fallback.js';

const root='qa-reports/story-sequential-missing/';
fs.mkdirSync(root,{recursive:true});
const canonical=spawnSync(process.execPath,['scripts/story-sequential-missing-batch.mjs','--max','20'],{encoding:'utf8'});
assert.equal(canonical.status,0,canonical.stderr);
const q=JSON.parse(fs.readFileSync(root+'next.json','utf8'));
const run=(...args)=>spawnSync(process.execPath,['scripts/story-chatgpt-fallback-handoff.mjs',...args],{encoding:'utf8'});

test('When daily Cloudflare Free allocation is spent, require ChatGPT Images for the exact missing scene',()=>{
 const output=root+'chatgpt-test-stage1.json';
 const p=run('--reason','FREE_DAILY_DISPATCH_ALREADY_USED','--output',output);
 assert.equal(p.status,0,p.stderr);
 const result=JSON.parse(fs.readFileSync(output,'utf8'));
 const first=q.selected[0];
 assert.equal(result.canonicalQueueKey,first.key);
 assert.equal(result.stageId,first.stageId);
 assert.equal(result.gender,first.gender);
 assert.equal(result.shotId,first.sceneId);
 assert.equal(result.providerTo,'ChatGPT Images (user-initiated; not OpenAI API)');
 assert.equal(result.reason,'FREE_DAILY_DISPATCH_ALREADY_USED');
 assert.equal(result.actualChatGPTImagesGenerated,0);
 assert.equal(result.gameArtworkRegistered,0);
 assert.equal(result.formallyApproved,false);
 assert.equal(result.additionalPaidApiCalls,0);
 assert.equal(result.requiresUserAction,true);
 assert(result.prompt.includes('16:9'));
 assert(result.prompt.includes('文字'));
 assert(result.prompt.includes(first.sceneId));
 assert(result.prompt.includes(first.gender==='male'?'男性':'女性'));
 assert(fs.readFileSync(output.replace(/\.json$/,'.md'),'utf8').includes(result.prompt));
});

test('Unsupported chapter also switches to exact gender and stage ChatGPT manual image generator',()=>{
 const target=q.entries.find(x=>x.stageId==='c20-s10'&&x.gender==='female');
 assert(target);
 const input=root+'chatgpt-test-20-stage-input.json';
 const output=root+'chatgpt-test-20-stage-output.json';
 fs.writeFileSync(input,JSON.stringify({...q,selected:[{...target,status:'MISSING_ART'}]}));
 const p=run('--reason','NO_VERIFIED_FREE_ADAPTER','--report',input,'--output',output);
 assert.equal(p.status,0,p.stderr);
 const h=JSON.parse(fs.readFileSync(output,'utf8'));
 assert.equal(h.stageId,'c20-s10');
 assert.equal(h.gender,'female');
 assert.equal(h.chatGPTReviewUrl,null,'Chapter1-only review page must not be mislinked for chapter20');
 assert(h.prompt.includes('第1章ステージ5以降は旧原画を流用せず'));
 assert.equal(h.actualChatGPTImagesGenerated,0);
});

test('Actual generator failure may address its own exact scene without relying on next.json',()=>{
 const p=run('--reason','FREE_QUOTA_EXHAUSTED','--shot-key','c01-s05|post-victory|male|c01-s05-m10',
  '--output',root+'chatgpt-test-provider-stopped.json');
 assert.equal(p.status,0,p.stderr);
 const r=JSON.parse(fs.readFileSync(root+'chatgpt-test-provider-stopped.json','utf8'));
 assert.equal(r.shotKey,'c01-s05|post-victory|male|c01-s05-m10');
 assert.equal(r.reason,'FREE_QUOTA_EXHAUSTED');
 assert.equal(r.actualChatGPTImagesGenerated,0);
});

test('No bypass for Cloudflare safety blocks, injection, or paid automatic fallback',()=>{
 assert.equal(canOfferChatGPTHandoff('SAFETY_REVIEW_REQUIRED'),false);
 assert.throws(()=>makeChatGPTHandoff({reason:'SAFETY_REVIEW_REQUIRED',shot:{}}));
 assert.notEqual(run('--reason','SAFETY_REVIEW_REQUIRED').status,0);
 assert.notEqual(run('--reason','FREE_QUOTA_EXHAUSTED','--shot-key','bad').status,0);
 assert.notEqual(run('--reason','FREE_DAILY_DISPATCH_ALREADY_USED','--report','../../etc/passwd').status,0);
});

test('Both daily UTC check and actual Cloudflare rejection publish deduplicated issue requests',()=>{
 const w=fs.readFileSync('.github/workflows/story-sequential-missing-batch.yml','utf8');
 assert(w.includes('chatgpt_handoff FREE_DAILY_DISPATCH_ALREADY_USED'));
 assert(w.includes('chatgpt_handoff NO_VERIFIED_FREE_ADAPTER'));
 assert(w.includes('chatgpt_handoff CLOUDFLARE_NOT_CONFIGURED'));
 assert(w.includes('gh issue create --title "$title"'));
 assert(w.includes('issues: write'));
 assert(w.includes('Today already used the single Cloudflare Free production dispatch'));
 const c=fs.readFileSync('.github/workflows/story-chapter1-free-complete-draft-production.yml','utf8');
 assert(c.includes('Route Cloudflare Free quota or outage to ChatGPT Images'));
 assert(c.includes('scripts/story-chatgpt-fallback-handoff.mjs'));
 assert(c.includes('gh issue create --title "$title"'));
 assert(c.includes('issues: write'));
});
