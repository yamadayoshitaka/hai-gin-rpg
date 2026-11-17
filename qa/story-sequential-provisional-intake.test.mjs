#!/usr/bin/env node
// Verifies exact clean draft intake paths and no accidental archive promotion.
// Does not create an image or mark a still-absent stage as completed.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {originalDraftPath,chapterOneReviewPages} from '../src/story-chapter1-review-core.js';
const a=originalDraftPath('c01-s02','pre','male','c01-s02-m1',1);
const b=originalDraftPath('c01-s05','pre','female','c01-s05-m1',1);
assert(a.includes('/cloudflare-chapter1-free/'));
assert(!a.includes('new-originals'));
assert(b.includes('/cloudflare-chapter1-new-originals/'));
assert(!b.includes('/cloudflare-chapter1-free/'));
assert(b.endsWith('/c01-s05-m01-pre-female.webp'));
const pages=chapterOneReviewPages();
assert.equal(pages.length,132);
const stage5=pages.flatMap(p=>p.shots).filter(s=>s.stageId==='c01-s05');
assert(stage5.length>0&&stage5.every(s=>s.draftPath.includes('new-originals/')));
const publisher=fs.readFileSync('scripts/publish-story-chapter1-provisional.mjs','utf8');
for(const target of ['compactOnly(s)','NEW_STORY_ORIGINAL_ART','newOriginal','assets/story/new-originals/',
 'provenanceVerified:true','nativeQAComplete:true','visualP0Approved:false']){
 assert(publisher.includes(target),'Publisher missing safe compact new-original guard '+target);
}
assert(!publisher.includes("if(s.stageId<'c01-s04'"),'Stage 1-3 must not be skipped');
const workflow=fs.readFileSync('.github/workflows/story-chapter1-provisional-game-register.yml','utf8');
assert(workflow.includes('src/story-new-original-art.js'));
assert(workflow.includes('assets/story/new-originals'));
console.log('PASS: compact Chapter1 stages1-10 review art sourced and registered without legacy reuse after stage4');
