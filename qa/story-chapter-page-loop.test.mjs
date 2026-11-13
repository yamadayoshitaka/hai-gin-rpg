import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {registeredStoryPanelAsset} from '../src/story-panel-registered-art.js';
import {comicForStage} from '../src/story-chapter-comic.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const runner='scripts/story-chapter-page-loop.mjs';
const registry='src/story-chapter-reviewed-art.js';
const before=fs.readFileSync(path.join(root,registry),'utf8');
const run=(more=[])=>spawnSync(process.execPath,[runner,'--chapter','1',...more],
 {cwd:root,encoding:'utf8',maxBuffer:30*1024*1024});
const plan=run(['--plan']);
assert.equal(plan.status,0,plan.stdout+'\n'+plan.stderr);
const result=JSON.parse(plan.stdout.trim());
const queuePath='qa-reports/story-stage-production/chapter-page-loop/c01-queue.json';
const queue=JSON.parse(fs.readFileSync(path.join(root,queuePath),'utf8'));
assert.equal(result.chapter,1);
assert.equal(result.pages,queue.totalPages);
assert.equal(queue.stageCount,10);
assert.equal(queue.kind,'CHAPTER_PAGE_TRANSACTION_QUEUE_NOT_RENDERED_ART');
assert.equal(queue.imageGeneratorConnected,false);
assert.equal(queue.maxScenesPerPage,5);
assert.equal(queue.maxScenesInSingleGenerationCall,1);
assert.equal(queue.perPageCommitAfterAllNewFramesReviewed,true);
assert.equal(queue.totalPages,132);
assert.equal(queue.totalCanonicalScenes,462);
assert.equal(queue.pages.filter(p=>p.stageId==='c01-s01').length,6);
assert.equal(queue.pages.filter(p=>p.stageId==='c01-s02').length,14);
assert.equal(queue.pages.filter(p=>p.stageId==='c01-s10').length,14);
assert(queue.pages.every(p=>p.shotCount>=1&&p.shotCount<=5));
assert.equal(queue.pages.reduce((n,p)=>n+p.shotCount,0),462);
assert.equal(new Set(queue.pages.flatMap(p=>p.shotKeys)).size,462);
assert.equal(queue.pages.filter(p=>p.blockedCount>0).length>0,true);
assert(queue.pages.every(p=>p.status!=='APPROVED'&&p.status!=='DEPLOYED'));
assert(queue.pages.some(p=>p.status==='EXISTING_REGISTERED_NOT_P0_CERTIFIED'));
const blocked=queue.pages.find(p=>p.blockedCount>0);
const fail=run(['--page',String(blocked.taskNumber),'--execute']);
assert.equal(fail.status,2,'Missing real art must STOP page without registrations/commit: '+fail.stdout+'\n'+fail.stderr);
assert(fail.stderr.includes('BLOCKED_NO_COMMIT'));
assert.equal(fs.readFileSync(path.join(root,registry),'utf8'),before,
 'Image generation/review failure must NOT write a registration map');
const oldShots=[
 {gender:'male',phase:'pre',count:10},
 {gender:'female',phase:'pre',count:10},
 {gender:'male',phase:'post',count:5},
 {gender:'female',phase:'post',count:5}
];
let preserved=0;
for(const {gender,phase,count} of oldShots){
 const comic=comicForStage('c01-s01',phase,{protagonistGender:gender});
 assert.equal(comic.panels.length,count);
 for(const shot of comic.panels){
  assert(registeredStoryPanelAsset(shot),'Original chapter 1 stage 1 image lost');
  preserved++;
 }
}
assert.equal(preserved,30);
console.log('PASS: chapter1 is exactly 132 <=5-shot page tasks across all 10 stages (462 story shots); each missing-art page stops without false formal registration; original 30 stage1 frames protected.');
