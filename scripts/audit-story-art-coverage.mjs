#!/usr/bin/env node
/**
 * Audit LIVE game art lookup, not the storyboard/manifests.
 * Registered per-panel assets AND exact gender/branch sheet assets must exist
 * on disk before the shot is considered present. Renderers are not invoked.
 *
 * node scripts/audit-story-art-coverage.mjs
 * node scripts/audit-story-art-coverage.mjs --chapters 1,2
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {CAMPAIGN_STAGES} from '../src/campaign-stage-plan.js';
import {comicForStage,comicEditionsForStage,comicPageAsset} from '../src/story-chapter-comic.js';
import {registeredStoryPanelAsset} from '../src/story-panel-registered-art.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const marker=process.argv.indexOf('--chapters');
const chapterNums=marker<0?[1,2]:process.argv[marker+1].split(',').map(Number);
if(!chapterNums.length||chapterNums.some(n=>!Number.isInteger(n)||n<1||n>20)||
 new Set(chapterNums).size!==chapterNums.length)
 throw Error('Invalid chapter selection: --chapters 1,2');
const urlExists=source=>{
 if(!source||typeof source!=='string'||!source.startsWith('./'))return false;
 const bare=source.slice(2).split(/[?#]/,1)[0];
 if(bare.startsWith('/')||bare.includes('..')||bare.includes('\\'))return false;
 return fs.existsSync(path.join(root,bare));
};
const shotContext=(edition,gender)=>{
 const ctx={protagonistGender:gender};
 if(edition.includes('-choice-'))ctx.decision=edition.split('-choice-')[1].split('-route-')[0];
 if(edition.startsWith('post-victory'))ctx.battleOutcome={victory:true};
 else if(edition.startsWith('post-defeat'))ctx.battleOutcome={victory:false};
 else if(edition.startsWith('post-gameover'))ctx.battleOutcome={victory:false,playerCommanderDead:true};
 if(edition.includes('-route-'))ctx.route=edition.split('-route-')[1].split('-ending-')[0];
 if(edition.includes('-ending-'))ctx.storyEnding=edition.split('-ending-')[1];
 return ctx;
};
const report={kind:'LIVE_GAME_STORY_ART_COVERAGE_NOT_AN_ILLUSTRATION_GENERATOR',
 generatedAtCommitUnknown:true,chapters:chapterNums,
 p0TextlessArtRequired:true,artGeneratedByAudit:0,
 approvedSourcePanels:0,doNotLabelAllArtFinished:true,
 stages:[],totals:{expected:0,registeredIndividual:0,existingFullSheet:0,
  missing:0,invalidRegistration:0}};
for(const stage of CAMPAIGN_STAGES.filter(s=>chapterNums.includes(s.chapter))){
 const stageRecord={stageId:stage.id,chapter:stage.chapter,
  expected:0,registeredIndividual:0,existingFullSheet:0,missing:0,
  variants:[],status:'PENDING'};
 const editionNames=comicEditionsForStage(stage.id);
 for(const edition of editionNames)for(const gender of ['male','female']){
  const ctx=shotContext(edition.edition,gender);
  const frames=comicForStage(stage.id,edition.phase,ctx);
  if(frames.edition!==edition.edition)throw Error('Edition mismatch '+stage.id+' '+edition.edition);
  const current={edition:edition.edition,gender,expected:frames.panels.length,
   registeredIndividual:0,existingFullSheet:0,missing:0,missingShots:[]};
  for(const shot of frames.panels){
   const direct=registeredStoryPanelAsset(shot);
   const directExists=urlExists(direct);
   if(direct&&!directExists){
    report.totals.invalidRegistration++;
    throw Error('REGISTERED_BUT_FILE_MISSING: '+direct);
   }
   const sheet=comicPageAsset(stage.id,edition.phase,ctx,shot.comicPage,gender);
   const sheetExists=urlExists(sheet);
   if(directExists)current.registeredIndividual++;
   else if(sheetExists)current.existingFullSheet++;
   else{
    current.missing++;
    current.missingShots.push({id:shot.id,edition:shot.comicEdition,gender,
     expectedSheet:sheet,reason:'ACTUAL_ART_FILE_NOT_REGISTERED',
     neverBorrowDifferentGenderOrOutcome:true});
   }
  }
  for(const k of ['expected','registeredIndividual','existingFullSheet','missing']){
   stageRecord[k]+=current[k];report.totals[k]+=current[k];
  }
  stageRecord.variants.push(current);
 }
 stageRecord.status=stageRecord.missing===0?'FILES_PRESENT_NOT_QUALITY_APPROVED':'BLOCKED_MISSING_ART';
 report.stages.push(stageRecord);
}
if(report.totals.expected!==report.totals.registeredIndividual+
 report.totals.existingFullSheet+report.totals.missing)
 throw Error('Incomplete or duplicated game artwork accounting');
const out=path.join(root,'qa-reports/story-stage-production/live-art-coverage');
fs.mkdirSync(out,{recursive:true});
const filename=path.join(out,'chapters-'+chapterNums.join('-')+'.json');
fs.writeFileSync(filename,JSON.stringify(report,null,2)+'\n','utf8');
console.log(JSON.stringify({kind:report.kind,chapters:chapterNums,
 ...report.totals,complete:report.totals.missing===0,
 sourceFile:path.relative(root,filename)}));
