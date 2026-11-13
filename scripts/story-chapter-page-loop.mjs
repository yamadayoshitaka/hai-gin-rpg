#!/usr/bin/env node
/**
 * A chapter is a resumable series of atomic page transactions, never a 25/50-
 * frame generator request. ONE TASK = up to five independently generated,
 * human-reviewed, registered canonical WebPs + ONE Git commit.
 *
 * node scripts/story-chapter-page-loop.mjs --chapter 1 --plan
 * node scripts/story-chapter-page-loop.mjs --chapter 1 --execute --commit --push
 * node scripts/story-chapter-page-loop.mjs --chapter 1 --page 9 --execute
 *
 * This script does NOT contain an image generator. If independent real images,
 * matching master-image proofs or human visual QA are absent, the task stops
 * without registration or commit. Never assert a chapter is complete on an
 * empty/non-rendering preflight.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {CAMPAIGN_STAGES} from '../src/campaign-stage-plan.js';
import {comicEditionsForStage,comicForStage} from '../src/story-chapter-comic.js';
import {registeredStoryPanelAsset} from '../src/story-panel-registered-art.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2);
const value=k=>{const i=args.indexOf(k);return i<0?null:args[i+1];};
const chapter=Number(value('--chapter'));
const requestedPage=value('--page')===null?null:Number(value('--page'));
const execute=args.includes('--execute'),commit=args.includes('--commit'),push=args.includes('--push');
if(!Number.isInteger(chapter)||chapter!==1|| // First chapter is the only production contract currently populated.
 (requestedPage!==null&&(!Number.isInteger(requestedPage)||requestedPage<1))||
 (!execute&&(commit||push))||(push&&!commit)||
 (args.includes('--plan')&&execute)||
 args.some(x=>x.startsWith('--')&&!['--chapter','--page','--plan','--execute','--commit','--push'].includes(x)))
 throw Error('Usage: --chapter 1 [--plan | --execute [--commit [--push]]] [--page 1..N]');
const stages=CAMPAIGN_STAGES.filter(x=>x.chapter===chapter);
if(stages.length!==10)throw Error('Chapter must include exactly ten stages');
const registriesPath='src/story-chapter-reviewed-art.js';
const initial=fs.readFileSync(path.join(root,registriesPath),'utf8');
const marker=/REGISTERED_CHAPTER_REVIEWED=Object.freeze\((\{[\s\S]*?\})\);/;
const match=marker.exec(initial);
if(!match)throw Error('Human-reviewed registry source has changed: fail closed');
const map=JSON.parse(match[1]);
const sha256=b=>crypto.createHash('sha256').update(b).digest('hex');
function webpDimensions(b){
 if(b.length<30||b.toString('ascii',0,4)!=='RIFF'||b.toString('ascii',8,12)!=='WEBP')
  throw Error('not a WebP');
 const type=b.toString('ascii',12,16);
 if(type==='VP8 '){
  if(b[23]!==0x9d||b[24]!==0x01||b[25]!==0x2a)throw Error('bad VP8');
  return [b.readUInt16LE(26)&0x3fff,b.readUInt16LE(28)&0x3fff];
 }
 if(type==='VP8L'){
  if(b[20]!==0x2f)throw Error('bad VP8L');
  const n=b.readUInt32LE(21);
  return [(n&0x3fff)+1,((n>>>14)&0x3fff)+1];
 }
 if(type==='VP8X')return [b.readUIntLE(24,3)+1,b.readUIntLE(27,3)+1];
 throw Error('Unsupported WebP subformat '+type);
}
const stage2Assignments=JSON.parse(fs.readFileSync(path.join(root,
 'assets/story/stage-manifests/c01-s02-shot-assignments.json'),'utf8')).entries;
const bible=JSON.parse(fs.readFileSync(path.join(root,
 'assets/story/characters/c01-s02-reference-bible.json'),'utf8'));
const actorPaths=new Map(bible.actors.map(x=>[x.id,x.path]));
function sceneContext(edition,gender){
 const c={protagonistGender:gender};
 if(edition==='post-victory')c.battleOutcome={victory:true};
 else if(edition==='post-defeat')c.battleOutcome={victory:false};
 else if(edition==='post-gameover')c.battleOutcome={victory:false,playerCommanderDead:true};
 else if(edition!=='pre'&&edition!=='post-town')throw Error('Unsupported branch '+edition);
 return c;
}
function pathsFor(shot){
 const norm=shot.id.replace(/-m(\d{1,2})$/,(_,n)=>'-m'+String(Number(n)).padStart(2,'0'));
 const base='assets/story/chapters/'+shot.stageId.slice(0,3)+'/';
 const tail=norm+'-'+shot.comicEdition+'-'+shot.protagonistGender;
 return {image:base+'panels/'+tail+'.webp',proof:base+'art-reviews/'+tail+'.review.json'};
}
function reviewShot(shot,existing,existingOverride){
 const key=[shot.stageId,shot.comicEdition,shot.protagonistGender,shot.id].join('|');
 const {image,proof}=pathsFor(shot);
 // Keep all existing registrations untouched. This is not equivalent to
 // certifying that existing artwork has passed the new P0 image-quality gate.
 if(existingOverride||existing)
  return {key,shot,source:existingOverride||existing,status:'EXISTING_REGISTERED_NOT_P0_CERTIFIED'};
 const imageFile=path.join(root,image);
 if(!fs.existsSync(imageFile))return {key,shot,image,proof,status:'BLOCKED_NEEDS_ONE_REAL_GENERATED_IMAGE'};
 let bytes,pixels,hash;
 try{
  bytes=fs.readFileSync(imageFile);
  pixels=webpDimensions(bytes);
  hash=sha256(bytes);
 }catch(e){return {key,shot,image,proof,status:'BLOCKED_BAD_WEBP',reason:String(e.message)};}
 const min=shot.stageId==='c01-s02'?[768,320]:[1536,864];
 if(pixels[0]<min[0]||pixels[1]<min[1])
  return {key,shot,image,proof,status:'BLOCKED_LOW_NATIVE_RESOLUTION',pixels,required:min};
 if(!fs.existsSync(path.join(root,proof)))
  return {key,shot,image,proof,status:'BLOCKED_NEEDS_MANUAL_SCENE_REVIEW',pixels};
 let review;
 try{review=JSON.parse(fs.readFileSync(path.join(root,proof),'utf8'));}
 catch(e){return {key,shot,image,proof,status:'BLOCKED_INVALID_REVIEW_PROOF'};}
 const required=['actualMasterImagesAttachedToGenerator','exactScreenplayHumanApproved',
  'identityGenderHumanApproved','correctOutcomeHumanApproved',
  'noTextDigitsUiHumanApproved','sourceNotUpscaled','renderedAsOneIndependentScene',
  'humanReviewer'];
 const scripted=shot.subtitleText||shot.text;
 const assignment=stage2Assignments[[shot.comicEdition,shot.protagonistGender,shot.id].join('|')];
 // Distinguish the explicit on-screen actors from narrator/offscreen actors;
 // the physical actor-master hashes must match the source bytes.
 const actors=assignment?assignment.visibleActorIds:
  [...new Set([shot.characterId,shot.secondaryId].filter(Boolean))];
 const verifiedMasters=actors.every(actor=>{
  const source=actorPaths.get(actor)||'assets/story-cinema/cast/'+actor+'.webp';
  const fp=path.join(root,source);
  if(!fs.existsSync(fp))return false;
  const data=fs.readFileSync(fp);
  return data.length>30&&data.toString('ascii',0,4)==='RIFF'&&
   data.toString('ascii',8,12)==='WEBP'&&
   review.attachedReferenceSha256ByActor?.[actor]===sha256(data);
 });
 const isHuman=typeof review.humanReviewer==='string'&&
  review.humanReviewer.trim().length>=3&&
  !['AI','AUTOMATIC','BOT','GITHUB_ACTIONS'].includes(review.humanReviewer.trim().toUpperCase());
 const valid=required.every(k=>Boolean(review[k]))&&
  review.shotKey===key&&review.sha256===hash&&
  review.scriptText===scripted&&
  review.oneImageOnly===true&&
  review.frameCount===1&&verifiedMasters&&isHuman&&
  (!assignment||(
   JSON.stringify(review.visibleActorIds)===JSON.stringify(assignment.visibleActorIds)&&
   review.protagonistState===assignment.protagonistState));
 if(!valid)return {key,shot,image,proof,status:'BLOCKED_REVIEW_PROOF_NOT_P0_COMPLIANT',
  pixels,mastersVerified:verifiedMasters,scriptAndCastVerified:false};
 return {key,shot,image,proof,status:'READY_FOR_FORMAL_REGISTRATION',pixels,sha256:hash,
  actorMasterIds:actors};
}
const pages=[],uniqueKeys=new Set();
for(const stage of stages){
 const locked='assets/story/stage-manifests/'+stage.id+'.manifest.json';
 if(!fs.existsSync(path.join(root,locked)))throw Error('Missing stage contract '+locked);
 const editions=comicEditionsForStage(stage.id);
 for(const draft of editions){
  for(const gender of ['male','female']){
   const scene=comicForStage(stage.id,draft.phase,sceneContext(draft.edition,gender));
   if(scene.edition!==draft.edition)throw Error('Edition changed '+stage.id+' '+draft.edition);
   for(let i=0;i<scene.panels.length;i+=5){
    const shots=scene.panels.slice(i,i+5);
    const cells=shots.map(shot=>{
     const key=[shot.stageId,shot.comicEdition,shot.protagonistGender,shot.id].join('|');
     if(uniqueKeys.has(key))throw Error('Duplicate '+key);
     uniqueKeys.add(key);
     return reviewShot(shot,registeredStoryPanelAsset(shot),map[key]);
    });
    pages.push({taskNumber:pages.length+1,stageId:stage.id,edition:draft.edition,
     gender,pageWithinVariant:Math.floor(i/5)+1,expectedShots:shots.length,cells});
   }
  }
 }
}
if(pages.some(p=>p.cells.length>5)||pages.length<=10)
 throw Error('Invalid chapter queue (one task must contain at most five scenes)');
const target=requestedPage===null?pages:pages.filter(p=>p.taskNumber===requestedPage);
if(target.length===0)throw Error('No such page '+requestedPage);
function reportPage(page){
 const already=page.cells.filter(x=>x.status==='EXISTING_REGISTERED_NOT_P0_CERTIFIED');
 const ready=page.cells.filter(x=>x.status==='READY_FOR_FORMAL_REGISTRATION');
 const blocked=page.cells.filter(x=>x.status.startsWith('BLOCKED_'));
 return {taskNumber:page.taskNumber,stageId:page.stageId,edition:page.edition,
  gender:page.gender,pageWithinVariant:page.pageWithinVariant,shotCount:page.cells.length,
  registeredAlready:already.length,readyToRegister:ready.length,
  blockedCount:blocked.length,
  status:blocked.length?'BLOCKED_UNTIL_RENDERED_AND_HUMAN_REVIEWED':
   ready.length?'READY_FOR_PER_PAGE_REGISTRATION_AND_COMMIT':'EXISTING_REGISTERED_NOT_P0_CERTIFIED',
  shotKeys:page.cells.map(x=>x.key),
  blockers:blocked.map(x=>({shotKey:x.key,reason:x.status}))};
}
const summary={kind:'CHAPTER_PAGE_TRANSACTION_QUEUE_NOT_RENDERED_ART',chapter,
 stageCount:10,totalPages:pages.length,totalCanonicalScenes:uniqueKeys.size,
 maxScenesPerPage:5,maxScenesInSingleGenerationCall:1,
 imageGeneratorConnected:false,
 existingRegistrationDoesNotImplyVisualApproval:true,
 perPageCommitAfterAllNewFramesReviewed:true,
 pageOrder:'stage > edition > gender > 1..5 shots',
 pages:pages.map(reportPage)};
const reportPath='qa-reports/story-stage-production/chapter-page-loop/c01-queue.json';
fs.mkdirSync(path.dirname(path.join(root,reportPath)),{recursive:true});
fs.writeFileSync(path.join(root,reportPath),JSON.stringify(summary,null,2)+'\n');
if(!execute){
 console.log(JSON.stringify({chapter,pages:summary.totalPages,scenes:summary.totalCanonicalScenes,
  blockedPages:summary.pages.filter(p=>p.blockedCount>0).length,
  firstBlocked:summary.pages.find(p=>p.blockedCount>0),
  registeredExisting:summary.pages.reduce((n,p)=>n+p.registeredAlready,0),
  renderedByThisScript:0,registeredByThisScript:0,queue:reportPath}));
 process.exit(0);
}
function git(...command){
 const r=spawnSync('git',command,{cwd:root,encoding:'utf8'});
 if(r.status!==0)throw Error('git '+command.join(' ')+' failed: '+r.stdout+' '+r.stderr);
 return r.stdout.trim();
}
let committed=0,registered=0;
for(const originalPage of target){
 // Recheck this task's actual bytes and registry immediately before writing:
 // no partial page if ANY of its new images/review proofs failed validation.
 const page={...originalPage,cells:originalPage.cells.map(c=>
  reviewShot(c.shot,registeredStoryPanelAsset(c.shot),map[c.key]))};
 const bad=page.cells.filter(c=>c.status.startsWith('BLOCKED_'));
 if(bad.length){
  console.error(JSON.stringify({chapter,taskNumber:page.taskNumber,result:'BLOCKED_NO_COMMIT',
   reasons:bad.map(c=>({key:c.key,status:c.status}))}));
  process.exitCode=2;
  break;
 }
 const newShots=page.cells.filter(c=>c.status==='READY_FOR_FORMAL_REGISTRATION');
 if(newShots.length===0){
  console.log(JSON.stringify({taskNumber:page.taskNumber,status:'ALREADY_REGISTERED_SKIP'}));
  continue;
 }
 const before=fs.readFileSync(path.join(root,registriesPath),'utf8');
 const oldMarker=marker.exec(before);
 if(!oldMarker)throw Error('Missing exact registry marker');
 const onDisk=JSON.parse(oldMarker[1]);
 for(const shot of newShots){
  if(onDisk[shot.key]||map[shot.key])throw Error('Attempt to overwrite '+shot.key);
  onDisk[shot.key]='./'+shot.image;
  map[shot.key]='./'+shot.image;
 }
 const revised=before.replace(marker,
  'REGISTERED_CHAPTER_REVIEWED=Object.freeze('+JSON.stringify(onDisk,null,2)+');');
 fs.writeFileSync(path.join(root,registriesPath),revised);
 if(commit){
  const artFiles=newShots.flatMap(s=>[s.image,s.proof]);
  git('add','--',registriesPath,...artFiles);
  git('commit','-m','art(story): '+page.stageId+' '+page.edition+'/'+page.gender+
   ' page '+page.pageWithinVariant+' — '+newShots.length+' approved real panels');
  if(push)git('push','origin','HEAD');
  committed++;
 }
 registered+=newShots.length;
 console.log(JSON.stringify({taskNumber:page.taskNumber,status:'P0_REGISTERED',
  registered:newShots.length,gitCommitted:commit,gitPushed:push}));
}
console.log(JSON.stringify({chapter,pagesProcessed:target.length,
 pagesCommitted:committed,newImagesFormallyRegistered:registered,
 chapterFullyCompleted:false,
 explanation:'Chapter completion needs fresh asset/reference validation, all pages registered, CI and a successful deployment. Existing registrations are NOT P0 quality approval.'}));
