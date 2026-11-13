#!/usr/bin/env node
/**
 * Run a contiguous, explicitly locked range of story stages and its 100-slot
 * real-WebP review queues. No image generator is attached; this never claims
 * missing art was rendered or quality-approved.
 *
 * node scripts/run-story-stage-range.mjs --start c01-s02 --through c01-s05
 * node scripts/run-story-stage-range.mjs --start c01-s02 --through c01-s05 --prepare-only
 */
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {CAMPAIGN_STAGES} from '../src/campaign-stage-plan.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2);
function val(key){const idx=args.indexOf(key);return idx<0?null:args[idx+1];}
const start=val('--start'),through=val('--through');
const prepareOnly=args.includes('--prepare-only');
const from=CAMPAIGN_STAGES.findIndex(x=>x.id===start);
const to=CAMPAIGN_STAGES.findIndex(x=>x.id===through);
if(from<0||to<from||to-from>=10){
 throw Error('Usage: --start c01-s02 --through c01-s05 [--prepare-only]; 1..10 stages');
}
const stages=CAMPAIGN_STAGES.slice(from,to+1);
if(stages.some(s=>s.chapter!==stages[0].chapter)){
 throw Error('Production range must remain in the same chapter');
}
const destRel='qa-reports/story-stage-production/range-'+start+'-through-'+through;
const bulkManifestRel=destRel+'/canonical-shot-briefs.json';
const bulkRootRel=destRel+'/bulk-100';
function run(cmd,params){
 const result=spawnSync(cmd,params,{cwd:root,encoding:'utf8',maxBuffer:20*1024*1024});
 if(result.stdout)process.stdout.write(result.stdout);
 if(result.stderr)process.stderr.write(result.stderr);
 if(result.error||result.status!==0){
  throw Error('Stage range command failed: '+cmd+' '+params.join(' ')+
   '; status '+String(result.status)+' '+String(result.error||''));
 }
 return result;
}
const processed=[];
for(const s of stages){
 const manifest='assets/story/stage-manifests/'+s.id+'.manifest.json';
 if(!fs.existsSync(path.join(root,manifest)))
  throw Error('Missing locked stage-specific render contract '+manifest);
 const contract=JSON.parse(fs.readFileSync(path.join(root,manifest),'utf8'));
 if(contract.stageId!==s.id||contract.layout.requiredPanels!==48||
  contract.criticalPriorityPolicy.priority!=='P0_ABSOLUTE_MUST_FOLLOW'||
  contract.singleInvocation.artRendererConnected!==false){
  throw Error('Unsafe stage contract '+manifest);
 }
 run(process.execPath,['scripts/run-story-stage.mjs','--stage',s.id,
  ...(prepareOnly?['--prepare-only']:[])]);
 const outcome=JSON.parse(fs.readFileSync(path.join(root,
  'qa-reports/story-stage-production/batches/'+s.id+'/batch-summary.json'),'utf8'));
 if(outcome.requiredPanels!==48||outcome.requiredVariantPosters!==8||
  outcome.stageApproved!==false||outcome.gameDeployed!==false){
  throw Error('Stage result mismatch or false approval: '+s.id);
 }
 processed.push({stageId:s.id,canonicalFrames:outcome.requiredPanels,
  existingGithubDraftsUnapproved:outcome.alreadyRegisteredUnapproved,
  newArtGeneratedByScript:0,stageApproved:false,gameDeployed:false,
  stageBatchSummary:'qa-reports/story-stage-production/batches/'+s.id+'/batch-summary.json'});
}
run(process.execPath,['scripts/prepare-story-stage-posters.mjs',
 '--start',start,'--count',String(stages.length),'--out',bulkManifestRel]);
const canonical=JSON.parse(fs.readFileSync(path.join(root,bulkManifestRel),'utf8'));
const count=canonical.totals.requiredPanels;
if(count!==48*stages.length||canonical.totals.approvedPanels!==0){
 throw Error('Canonical range has wrong count or false approval');
}
const batchCount=Math.ceil(count/100);
const reports=[];
for(let i=0;i<batchCount;i++){
 run('python3',['scripts/assemble-story-bulk-100.py',
  '--manifest',bulkManifestRel,'--batch-index',String(i),
  '--out-root',bulkRootRel,prepareOnly?'--prepare-only':'--assemble']);
 const reportRel=bulkRootRel+'/batch-'+String(i).padStart(2,'0')+'.review.json';
 const report=JSON.parse(fs.readFileSync(path.join(root,reportRel),'utf8'));
 if(report.approved!==false||report.registeredAsNewGameArt!==false||
  report.deployed!==false||report.newArtActuallyGenerated!==0){
  throw Error('Bulk sheet improperly marked as generated/approved/published');
 }
 reports.push({index:i,count:report.selectedShots,
  sheetCount:report.sheetCount,assembled:report.assembledReviewSheets,
  blocked:report.blockedReviewSheets,statusReport:reportRel});
}
if(reports.reduce((a,x)=>a+x.count,0)!==count)
 throw Error('100-slot pagination lost or duplicated canonical frames');
const result={kind:'CHAPTER_STORY_RANGE_BATCH_NO_AI_RENDERER',
 start,through,stages:processed,canonicalSceneCount:count,
 maxReviewSheetFrames:10,maxReviewSheetsPerBulkBatch:10,
 bulkBatches:reports,actualNewArtGenerated:0,qualityApproved:false,
 gameAssetRegistration:false,deployedNewArt:false,
 textFreeP0Required:true,
 imageGeneratorAttached:false,
 note:'A successful run confirms only real story plans, native image presence/status and review assembly if eligible. It is not completed artwork.'};
fs.mkdirSync(path.join(root,destRel),{recursive:true});
fs.writeFileSync(path.join(root,destRel,'range-summary.json'),
 JSON.stringify(result,null,2)+'\n','utf8');
console.log(JSON.stringify(result));
