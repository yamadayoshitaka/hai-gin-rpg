#!/usr/bin/env node
/**
 * Complete chapter1 release side of generate -> QA -> approval -> formal
 * register -> per-page Git commit -> later main CI / Pages deployment.
 *
 * This script NEVER invents visual approval. Real people must sign explicit
 * source-hash-locked review records beside each draft. A failed/missing review
 * blocks that page, but ready pages can be registered independently.
 *
 * node scripts/promote-story-chapter1-reviewed-drafts.mjs --plan
 * node scripts/promote-story-chapter1-reviewed-drafts.mjs --plan --page 13
 * node scripts/promote-story-chapter1-reviewed-drafts.mjs --apply --page 13 --commit
 * node scripts/promote-story-chapter1-reviewed-drafts.mjs --apply --all-ready --commit
 *
 * Run on a dedicated release branch created FROM main, with the unapproved
 * candidate files + signed approvals restored into the worktree but NOT staged.
 * Do not merge the unreviewed drafts PR to main.
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
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const exists=p=>fs.existsSync(path.join(root,p));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const args=process.argv.slice(2),apply=args.includes('--apply'),plan=args.includes('--plan');
const commit=args.includes('--commit'),all=args.includes('--all-ready');
const get=k=>{const i=args.indexOf(k);return i<0?null:args[i+1];};
const selected=get('--page')==null?null:Number(get('--page'));
if((!apply&&!plan)||(apply&&plan)||(commit&&!apply)||
 (selected!==null&&(!Number.isInteger(selected)||selected<1||selected>132))||
 (selected!==null&&all)||
 args.some(x=>x.startsWith('--')&&!['--plan','--apply','--page','--all-ready','--commit'].includes(x)))
 throw Error('Usage: --plan|--apply [--page 1..132|--all-ready] [--commit]');
const stage2=read('assets/story/stage-manifests/c01-s02-shot-assignments.json').entries;
const bible=read('assets/story/characters/c01-s02-reference-bible.json');
const masterPaths=new Map(bible.actors.map(x=>[x.id,x.path]));
const pages=[];
function ctx(edition,gender){
 const c={protagonistGender:gender};
 if(edition==='post-victory')c.battleOutcome={victory:true};
 else if(edition==='post-defeat')c.battleOutcome={victory:false};
 else if(edition==='post-gameover')c.battleOutcome={victory:false,playerCommanderDead:true};
 else if(edition!=='pre'&&edition!=='post-town')throw Error('Unrecognized edition '+edition);
 return c;
}
for(const stage of CAMPAIGN_STAGES.filter(s=>s.chapter===1))for(const ed of comicEditionsForStage(stage.id))
 for(const gender of ['male','female']){
  const comic=comicForStage(stage.id,ed.phase,ctx(ed.edition,gender));
  for(let offset=0;offset<comic.panels.length;offset+=5){
   const shots=comic.panels.slice(offset,offset+5);
   const meta=shots.map(shot=>{
    const basename=shot.id.replace(/-m(\d{1,2})$/,(_,n)=>'-m'+String(Number(n)).padStart(2,'0'))+
     '-'+ed.edition+'-'+gender;
    const draft='assets/story/chapter-drafts/c01/cloudflare-chapter1-free/'+stage.id+'-'+ed.edition+'-'+gender+
     '/p'+String(Math.floor(offset/5)+1).padStart(2,'0')+'/'+basename+'.webp';
    const dest='assets/story/chapters/c01/panels/'+basename+'.webp';
    const proof='assets/story/chapters/c01/art-reviews/'+basename+'.review.json';
    const key=[stage.id,ed.edition,gender,shot.id].join('|');
    return {shot,stage,edition:ed.edition,gender,key,draft,sourceProof:draft+'.generation.json',
      approval:draft+'.approval.json',dest,proof,existing:!!registeredStoryPanelAsset(shot)};
   });
   pages.push({number:pages.length+1,stage:stage.id,edition:ed.edition,gender,
    pageWithinVariant:Math.floor(offset/5)+1,shots:meta});
  }
 }
if(pages.length!==132||pages.reduce((sum,x)=>sum+x.shots.length,0)!==462)
 throw Error('Canonical chapter cardinality drift');
const inspected=new Map();
function inspect(item){
 if(item.existing&&!exists(item.draft)&&!exists(item.sourceProof))
  return {kind:'EXISTING_REGISTERED_NOT_P0_CERTIFIED'};
 if(!exists(item.draft)||!exists(item.sourceProof))return {kind:'MISSING_REAL_DRAFT'};
 if(!exists(item.approval))return {kind:'AWAITING_HUMAN_IMAGE_APPROVAL'};
 try{
  const bytes=fs.readFileSync(path.join(root,item.draft)),imageHash=sha(bytes);
  const gen=read(item.sourceProof),approval=read(item.approval);
  if(gen.shotKey!==item.key||gen.imageSha256!==imageHash||
   gen.visuallyApproved!==false||gen.formallyRegistered!==false||
   gen.screenplayText!==(item.shot.subtitleText||item.shot.text))
   throw Error('Generation evidence altered or wrong scene');
  const required=['exactScreenplayHumanApproved','identityGenderHumanApproved',
   'correctOutcomeHumanApproved','noTextDigitsUiHumanApproved','sourceNotUpscaled',
   'renderedAsOneIndependentScene'];
  if(required.some(k=>approval[k]!==true))throw Error('Missing explicit positive human P0 review fields');
  if(approval.shotKey!==item.key||approval.imageSha256!==imageHash)
   throw Error('Human review must lock exact shot key + exact image bytes');
  if(typeof approval.humanReviewer!=='string'||approval.humanReviewer.trim().length<3||
   /^(AI|BOT|AUTOMATIC|GITHUB_ACTIONS|AGENT|LLM)$/i.test(approval.humanReviewer.trim()))
   throw Error('Human reviewer required, automated assertions are not approvals');
  if(typeof approval.reviewEvidence!=='string'||approval.reviewEvidence.trim().length<8)
   throw Error('Require audit evidence or review link');
  const requiredRefs=new Map();
  for(const ref of gen.actualReferenceImagesAttached||[]){
   const file=masterPaths.get(ref.actorId)||'assets/story-cinema/cast/'+ref.actorId+'.webp';
   if(!exists(file)||sha(fs.readFileSync(path.join(root,file)))!==ref.originalSha256)
    throw Error('Physical cast source changed '+ref.actorId);
   requiredRefs.set(ref.actorId,ref.originalSha256);
  }
  const assign=stage2[item.edition+'|'+item.gender+'|'+item.shot.id];
  const actors=assign?assign.visibleActorIds:
   [...new Set([item.shot.characterId,item.shot.secondaryId].filter(Boolean))];
  if(actors.some(actor=>!requiredRefs.has(actor)))
   throw Error('Missing actual image reference for required on-screen actor');
  if(assign&&JSON.stringify(gen.visibleActorIds)!==JSON.stringify(assign.visibleActorIds))
   throw Error('Stage2 cast conflict');
  const out={
   shotKey:item.key,sha256:imageHash,scriptText:item.shot.subtitleText||item.shot.text,
   humanReviewer:approval.humanReviewer.trim(),reviewEvidence:approval.reviewEvidence,
   actualMasterImagesAttachedToGenerator:true,
   exactScreenplayHumanApproved:true,identityGenderHumanApproved:true,
   correctOutcomeHumanApproved:true,noTextDigitsUiHumanApproved:true,
   sourceNotUpscaled:true,renderedAsOneIndependentScene:true,oneImageOnly:true,
   frameCount:1,attachedReferenceSha256ByActor:Object.fromEntries(requiredRefs),
   ...(assign?{visibleActorIds:assign.visibleActorIds,protagonistState:assign.protagonistState}:{}),
   sourceDraft:item.draft,sourceGenerationProof:item.sourceProof
  };
  return {kind:'READY_HUMAN_REVIEWED_FOR_FORMAL_REGISTRATION',proof:out};
 }catch(e){return {kind:'REJECTED_INVALID_APPROVAL',reason:String(e.message)};}
}
for(const page of pages)for(const item of page.shots)inspected.set(item.key,inspect(item));
const target=selected!==null?pages.filter(x=>x.number===selected):pages;
const ready=target.filter(pg=>pg.shots.every(item=>[
 'EXISTING_REGISTERED_NOT_P0_CERTIFIED',
 'READY_HUMAN_REVIEWED_FOR_FORMAL_REGISTRATION'
].includes(inspected.get(item.key).kind))&&pg.shots.some(item=>
 inspected.get(item.key).kind==='READY_HUMAN_REVIEWED_FOR_FORMAL_REGISTRATION'));
const report={kind:'C01_FORMAL_PROMOTION_READINESS_NOT_AN_AUTOMATIC_APPROVAL',
 chapter:1,pages:132,canonicalScenes:462,
 pageReady:ready.map(pg=>pg.number),readyPageCount:ready.length,
 humanApprovalRequired:true,
 pageStates:target.map(pg=>({
  number:pg.number,stage:pg.stage,edition:pg.edition,gender:pg.gender,
  shots:pg.shots.map(item=>({shotKey:item.key,approvalStatus:inspected.get(item.key).kind,
   ...(inspected.get(item.key).reason?{reason:inspected.get(item.key).reason}:{})}))
 }))};
const resultFile='qa-reports/story-stage-production/chapter1-free-render/c01-promotion-readiness.json';
fs.mkdirSync(path.dirname(path.join(root,resultFile)),{recursive:true});
fs.writeFileSync(path.join(root,resultFile),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({plan:!apply,readyPages:ready.map(x=>x.number),ready:ready.length,
  examinedPages:target.length,report:resultFile,automaticApprovals:0}));
if(!apply)process.exit(0);
if(selected!==null&&!ready.length)throw Error('Selected page is missing human approval proofs');
let promoted=0;
for(const page of ready){
 const jobs=page.shots.filter(s=>inspected.get(s.key).kind==='READY_HUMAN_REVIEWED_FOR_FORMAL_REGISTRATION');
 // All validations finish before any production file is copied.
 for(const item of jobs){
  const cert=inspected.get(item.key).proof;
  fs.mkdirSync(path.dirname(path.join(root,item.dest)),{recursive:true});
  fs.mkdirSync(path.dirname(path.join(root,item.proof)),{recursive:true});
  if(exists(item.dest)||exists(item.proof))throw Error('Refusing to overwrite registered production image');
  fs.copyFileSync(path.join(root,item.draft),path.join(root,item.dest));
  fs.writeFileSync(path.join(root,item.proof),JSON.stringify(cert,null,2)+'\n');
 }
 // Existing transactional registration runner handles exact SHA + per-shot
 // human review validation; commits at most five *approved* frames at a time.
 const flags=['scripts/story-chapter-page-loop.mjs','--chapter','1',
  '--page',String(page.number),'--execute','--upgrade-legacy',...(commit?['--commit']:[])];
 const executed=spawnSync(process.execPath,flags,{cwd:root,encoding:'utf8',maxBuffer:30000000});
 if(executed.status!==0)
  throw Error('Atomic formal registration stopped on page '+page.number+': '+
    executed.stderr.slice(0,1400));
 promoted+=jobs.length;
 console.log(JSON.stringify({page:page.number,approvedImagesPromoted:jobs.length,
  canonicalRegistration:true,committed:commit}));
}
console.log(JSON.stringify({formalImagesRegistered:promoted,pages:ready.length,
 releaseMerged:false,deployed:false}));
