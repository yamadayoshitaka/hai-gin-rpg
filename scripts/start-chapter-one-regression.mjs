#!/usr/bin/env node
/**
 * Initiate the real Chapter 1 page-by-page regression now and save the exact
 * checkpoint where the existing real-art/QA gate blocks continuation.
 *
 * This is NOT an image generator. Chapter transactions must not claim that
 * creating a plan means images were generated, registered or deployed.
 *
 * node scripts/start-chapter-one-regression.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const rel='qa-reports/story-stage-production/chapter-page-loop';
const planRel=rel+'/c01-queue.json';
const manifestPath='assets/story/stage-manifests/c01-s02.manifest.json';
const assignmentsPath='assets/story/stage-manifests/c01-s02-shot-assignments.json';
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const sha256=x=>crypto.createHash('sha256').update(x).digest('hex');
const exec=extra=>spawnSync(process.execPath,
 ['scripts/story-chapter-page-loop.mjs','--chapter','1',...extra],
 {cwd:root,encoding:'utf8',maxBuffer:32*1024*1024});
const plan=exec(['--plan']);
if(plan.status!==0)throw Error('Chapter 1 plan failed: '+plan.stderr+'\n'+plan.stdout);
const queue=read(planRel);
if(queue.stageCount!==10||queue.totalPages!==132||queue.totalCanonicalScenes!==462||
 queue.maxScenesPerPage!==5||queue.maxScenesInSingleGenerationCall!==1)
 throw Error('Chapter queue does not match the locked 10-stage 132-page 462-shot contract');
const firstBlock=queue.pages.find(p=>p.blockedCount!==0);
if(!firstBlock)throw Error('Unexpectedly no blocked page; require independent formal QA before certifying chapter done');
const allPrevious=queue.pages.filter(p=>p.taskNumber<firstBlock.taskNumber);
if(allPrevious.some(p=>p.blockedCount))throw Error('Out-of-order first blocker');
const firstIndex=firstBlock.taskNumber;
const first=exec(['--execute']);
if(first.status!==2||!first.stderr.includes('BLOCKED_NO_COMMIT'))
 throw Error('Executing missing-art page did not fail closed: code='+first.status+
   '\n'+first.stdout+'\n'+first.stderr);
if(!first.stderr.includes('"taskNumber":'+firstIndex))
 throw Error('Executed regression did not stop at canonical first incomplete page '+firstIndex);
const stage2=read(manifestPath),cast=read(assignmentsPath);
const reviewsBase='assets/story/chapter-drafts/c01/pending-art-review/c01-s02-post-victory-female';
const reviews=new Map();
for(let p=1;p<=2;p++){
 const file=reviewsBase+'/p'+String(p).padStart(2,'0')+'/page-'+String(p).padStart(2,'0')+'-review.json';
 if(!fs.existsSync(path.join(root,file)))continue;
 const document=read(file);
 const pics=document.actualSources||document.sources||[];
 for(const v of pics)reviews.set(v.panelId,v);
}
const shots=firstBlock.shotKeys.map(key=>{
 const [stage,edition,gender,panelId]=key.split('|');
 const row={shotKey:key,panelId,outcome:edition,gender,
  blockReason:firstBlock.blockers.find(b=>b.shotKey===key)?.reason||null,
  registrationEligible:false,sourceMasterImagesActuallyAttached:false,
  passedHumanVisualQA:false};
 if(stage==='c01-s02'){
  const assignment=cast.entries[edition+'|'+gender+'|'+panelId];
  if(!assignment)throw Error('Missing actor and screenplay assignment '+key);
  row.scriptText=assignment.scriptText;
  row.foregroundActorId=assignment.foregroundActorId;
  row.visibleActorIds=assignment.visibleActorIds;
  row.compositionHint=assignment.compositionHint;
  row.protagonistState=assignment.protagonistState;
 }
 const existingCandidate=reviews.get(panelId);
 if(stage==='c01-s02'&&edition==='post-victory'&&gender==='female'&&existingCandidate){
  const disk=path.join(root,existingCandidate.path);
  row.existingUnapprovedCandidate={
   path:existingCandidate.path,physicallyExists:fs.existsSync(disk),
   sha256:fs.existsSync(disk)?sha256(fs.readFileSync(disk)):null,
   canonicalWebpRegistered:false,
   verifiedActualMasterBytesAttached:false,
   imageTextFreeHumanApproved:false,
   identityAndScreenplayHumanApproved:false
  };
 }
 return row;
});
const result={
 kind:'CHAPTER1_REGRESSION_EXECUTION_CHECKPOINT',
 chapter:1,requiredStages:10,requiredPages:132,requiredScenes:462,
 action:'EXECUTED_EXISTING_REGISTRATION_PAGES_THEN_STOPPED_AT_FIRST_UNAPPROVED_PAGE',
 completedChapter:false,newImagesGenerated:0,newImagesFormallyRegistered:0,
 newPageCommits:0,pagesBeforeFirstBlock:allPrevious.length,
 firstBlockedTask:firstBlock.taskNumber,firstBlockedStage:firstBlock.stageId,
 firstBlockedEdition:firstBlock.edition,firstBlockedGender:firstBlock.gender,
 firstBlockedPageWithinVariant:firstBlock.pageWithinVariant,
 blockedSceneCount:firstBlock.blockedCount,shotDetails:shots,
 originalStage2Pending:stage2.continuation.remainingSceneCount,
 stage2NewReviewedRegistered:stage2.continuation.newActualRegisteredWebps,
 existingProtectedStage2:stage2.continuation.existingSceneCount,
 imageGeneratorConnected:false,
 warning:'Execution genuinely ran but stopped at an ungenerated or unreviewed page. Draft candidates are not approved game assets. Do not mark the chapter complete.',
 nextAction:'Supply distinct independently generated WebPs at canonical game paths, actual person master image attachment evidence, and human visual QA; rerun --execute --commit --push once pages pass.'
};
fs.mkdirSync(path.join(root,rel),{recursive:true});
const dest=rel+'/c01-regression-execution-checkpoint.json';
fs.writeFileSync(path.join(root,dest),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({status:'CHAPTER_REGRESSION_STARTED_AND_SAFELY_STOPPED',
 pagesScanned:allPrevious.length+1,firstBlockedTask:firstIndex,
 firstBlockedStage:firstBlock.stageId,missingShots:firstBlock.blockedCount,
 committedNewPages:0,registeredNewImages:0,report:dest}));
