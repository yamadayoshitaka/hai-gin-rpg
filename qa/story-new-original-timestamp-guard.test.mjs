import assert from 'node:assert/strict';
import fs from 'node:fs';
import {eligibleFreshReviewSource} from '../src/story-new-original-timestamp-guard.js';
import {originalDraftPath} from '../src/story-chapter1-review-core.js';
const stageId='c01-s05',edition='pre',gender='male';
const expected=originalDraftPath(stageId,edition,gender,'c01-s05-m1',1);
const source=expected.replace('/cloudflare-chapter1-new-originals/','/cloudflare-chapter1-free/');
const good='ebaf199b3540cd57080e50239ecdf74c7dbdc310\t2026-11-17T08:10:13Z\tart(review): c01-s05 pre male page 1 1 real unapproved frames';
const params={stageId,edition,gender,expected,source,gitIntroduction:good};
assert.equal(eligibleFreshReviewSource(params),true,'Nov 17 real original commit must be eligible');
for(const patch of [
 {gitIntroduction:good.replace('2026-11-17T08:10:13Z','2026-11-15T08:10:13Z')},
 {gitIntroduction:good.replace('pre male','pre female')},
 {gitIntroduction:good.replace('c01-s05','c01-s04')},
 {gitIntroduction:good.replace('ebaf199b3540cd57080e50239ecdf74c7dbdc310','no-commit')},
 {gitIntroduction:good.replace('art(review):','qa(story):')},
 {stageId:'c01-s04'},
 {stageId:'c02-s01'},
 {gender:'female'},
 {edition:'post-victory'},
 {source:source.replace('c01-s05','c01-s06')},
 {source:expected},
 {expected:source},
 ]){
 assert.equal(eligibleFreshReviewSource({...params,...patch}),false,
  'Old/reused/cross-scene candidate must not be reclassified new: '+JSON.stringify(patch));
}
const publisher=fs.readFileSync('scripts/publish-story-chapter1-provisional.mjs','utf8');
for(const guard of ["'--diff-filter=A'",'sourceCandidate(s,available)',
 'sourceReviewable(s,available,draftSource)','eligibleFreshReviewSource(',
 'sourceDraft:verified.original',"draftSource+'.provider-blocked.json'"]){
 assert(publisher.includes(guard),'Source-intake guard missing: '+guard);
}
console.log('PASS: post-cutover exact-commit original recovery without old-art borrowing or P0 claim');
