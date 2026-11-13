import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {REGISTERED_CHAPTER_REVIEWED} from '../src/story-chapter-reviewed-art.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const file='qa-reports/story-stage-production/chapter-page-loop/c01-regression-execution-checkpoint.json';
const script=spawnSync(process.execPath,['scripts/start-chapter-one-regression.mjs'],
 {cwd:root,encoding:'utf8',maxBuffer:20*1024*1024});
assert.equal(script.status,0,script.stderr+'\n'+script.stdout);
assert(script.stdout.includes('CHAPTER_REGRESSION_STARTED_AND_SAFELY_STOPPED'));
const report=JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
assert.equal(report.kind,'CHAPTER1_REGRESSION_EXECUTION_CHECKPOINT');
assert.equal(report.chapter,1);
assert.equal(report.requiredStages,10);
assert.equal(report.requiredPages,132);
assert.equal(report.requiredScenes,462);
assert.equal(report.completedChapter,false);
assert.equal(report.newImagesGenerated,0);
assert.equal(report.newImagesFormallyRegistered,0);
assert.equal(report.newPageCommits,0);
assert.equal(report.imageGeneratorConnected,false);
assert.equal(report.originalStage2Pending,25);
assert.equal(report.stage2NewReviewedRegistered,0);
assert.equal(report.existingProtectedStage2,23);
assert.equal(report.firstBlockedStage,'c01-s02');
assert.equal(report.firstBlockedEdition,'post-victory');
assert.equal(report.firstBlockedGender,'female');
assert.equal(report.firstBlockedPageWithinVariant,1);
assert.equal(report.firstBlockedTask,13);
assert.equal(report.pagesBeforeFirstBlock,12);
assert.equal(report.blockedSceneCount,5);
assert.equal(report.shotDetails.length,5);
assert.deepEqual(report.shotDetails.map(x=>x.panelId),[
 'c01-s02-m6','c01-s02-m7','c01-s02-m8','c01-s02-m9','c01-s02-m16']);
assert(report.shotDetails.every(x=>x.registrationEligible===false &&
 x.passedHumanVisualQA===false && x.scriptText.length>0));
assert.equal(Object.keys(REGISTERED_CHAPTER_REVIEWED).length,0);
console.log('PASS: actually executed chapter1 through 12 existing-registry page tasks; task13 c01-s02 female victory 5 shots correctly blocked, no false human approvals or commits');
