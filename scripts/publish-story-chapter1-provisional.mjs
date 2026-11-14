#!/usr/bin/env node
/**
 * Real first chapter draft candidates may be shown as PROVISIONAL in the game.
 * Never claims human visual P0 or marks canonical scenes "finished".
 * Every image is a physically verified uniquely generated WebP from review branch.
 * Originals in old game and in review branch remain untouched.
 *
 * --plan: check available native real assets (read-only)
 * --apply: import actual image bytes and update a separate reversible binding map
 * --return-issue: remove precisely selected live provisional images, lock old SHA
 *
 * Reverted SHA cannot be re-imported; a newly generated source SHA may be
 * proposed by the next batch. All changes are git tracked and reversible.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {chapterOneReviewPages} from '../src/story-chapter1-review-core.js';
import {chapterReviewedPanelAsset} from '../src/story-chapter-reviewed-art.js';
import {stage2ReviewedPanelAsset} from '../src/story-stage2-reviewed-art.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2);
const action=['--plan','--apply','--return-issue'].filter(x=>args.includes(x));
if(action.length!==1||args.length!==1)throw Error('Usage --plan|--apply|--return-issue');
const mode=action[0],toAbs=p=>path.join(root,p);
const readJson=p=>JSON.parse(fs.readFileSync(toAbs(p),'utf8'));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const sourceBranch='origin/story/chapter1-free-actual-art';
const reviewedFile='src/story-chapter1-provisional-live.js';
const ledgerPath='assets/story/chapter1-provisional-revisions.json';
const ledger=readJson(ledgerPath);
if(ledger.schemaVersion!==1||ledger.chapter!==1)throw Error('Revision ledger schema changed');
const source=fs.readFileSync(toAbs(reviewedFile),'utf8');
const capture=/CHAPTER1_PROVISIONAL_LIVE=Object\.freeze\((\{[\s\S]*?\})\);/;
const found=capture.exec(source);
if(!found)throw Error('Provisional map marker changed; refusing write');
const active=JSON.parse(found[1]);
const pages=chapterOneReviewPages(),shots=pages.flatMap(x=>x.shots);
if(shots.length!==462||pages.length!==132)throw Error('Canonical chapter cardinality drift');
const validKeys=new Set(shots.map(s=>s.key));
const existing=new Set(Object.keys(active));
if([...existing].some(k=>!validKeys.has(k)))throw Error('Provisional registry has unknown key');

function git(...argv){return execFileSync('git',argv,{cwd:root,maxBuffer:100*1024*1024});}
function sourceBytes(file){return git('show',sourceBranch+':'+file);}
function sourceManifest(){
 return new Set(git('ls-tree','-r','--name-only',sourceBranch).toString('utf8').trim().split('\n'));
}
function expectedPixels(b){
 if(b.length<30||b.toString('ascii',0,4)!=='RIFF'||b.toString('ascii',8,12)!=='WEBP')
  throw Error('not WebP');
 const type=b.toString('ascii',12,16);
 if(type==='VP8 ')return [b.readUInt16LE(26)&0x3fff,b.readUInt16LE(28)&0x3fff];
 if(type==='VP8L'){
  if(b[20]!==0x2f)throw Error('bad lossless WebP signature');
  const n=b.readUInt32LE(21);
  return [(n&0x3fff)+1,((n>>>14)&0x3fff)+1];
 }
 if(type==='VP8X')return [b.readUIntLE(24,3)+1,b.readUIntLE(27,3)+1];
 throw Error('unknown WebP encoding '+type);
}
function sourceReviewable(s,available){
 const proof=s.draftPath+'.generation.json';
 if(!available.has(s.draftPath)||!available.has(proof))return null;
 const meta=JSON.parse(sourceBytes(proof).toString('utf8'));
 const original=sourceBytes(s.draftPath);
 const sum=sha(original),[w,h]=expectedPixels(original);
 const min=s.stageId==='c01-s02'?[768,320]:[1536,864];
 if(w<min[0]||h<min[1]||w*9!==h*16)throw Error('Low native geometry '+s.key);
 if(meta.shotKey!==s.key||meta.imageSha256!==sum||
  meta.screenplayText!==s.scriptText||meta.visuallyApproved!==false||
  meta.formallyRegistered!==false||meta.model!=='@cf/black-forest-labs/flux-2-klein-4b'||
  meta.imageBytes!==original.length||
  !Array.isArray(meta.nativePixels)||meta.nativePixels[0]!==w||meta.nativePixels[1]!==h)
  throw Error('Draft metadata mismatch '+s.key);
 if(!Array.isArray(meta.actualReferenceImagesAttached)||meta.actualReferenceImagesAttached.length>4)
  throw Error('Missing real character references '+s.key);
 for(const ref of meta.actualReferenceImagesAttached){
  if(typeof ref.source!=='string'||!fs.existsSync(toAbs(ref.source))||
   sha(fs.readFileSync(toAbs(ref.source)))!==ref.originalSha256)
   throw Error('Source actor reference modified '+s.key);
 }
 return {bytes:original,sha256:sum,meta,pixels:[w,h],proof,original:s.draftPath};
}
const slug=key=>key.replaceAll('|','__');
const canActOn=(s)=>!chapterReviewedPanelAsset({
 stageId:s.stageId,comicEdition:s.edition,protagonistGender:s.gender,id:s.shotId
})&&!stage2ReviewedPanelAsset({
 stageId:s.stageId,comicEdition:s.edition,protagonistGender:s.gender,id:s.shotId
});
function writeMapAndLedger(){
 const newBody=source.replace(capture,
  'CHAPTER1_PROVISIONAL_LIVE=Object.freeze('+JSON.stringify(active,null,2)+');');
 fs.writeFileSync(toAbs(reviewedFile),newBody);
 fs.writeFileSync(toAbs(ledgerPath),JSON.stringify(ledger,null,2)+'\n');
}
let imported=0,removed=0,unchanged=0,missing=0,providerBlocked=0,failures=[];
if(mode==='--return-issue'){
 const raw=process.env.STORY_REVIEW_ISSUE_BODY||'';
 if(raw.length>30000)throw Error('Issue body too long');
 const a='HAI_GIN_CHAPTER1_REVIEW_JSON_START',b='HAI_GIN_CHAPTER1_REVIEW_JSON_END';
 const i=raw.indexOf(a),j=raw.indexOf(b,i+a.length);
 if(i<0||j<0)throw Error('Not a manga review issue');
 const review=JSON.parse(raw.slice(i+a.length,j).trim());
 if(review.type!=='HAI_GIN_CHAPTER1_MANGA_REVIEW_V1'||review.chapter!==1||
  !Number.isInteger(review.pageTask)||review.pageTask<1||review.pageTask>132||
  !Array.isArray(review.votes)||review.votes.length>5)
  throw Error('Invalid manga review payload');
 const pg=pages[review.pageTask-1],allowed=new Set(pg.shots.map(s=>s.key));
 const changed=[];
 for(const vote of review.votes){
  if(vote.decision!=='revise')continue;
  if(!allowed.has(vote.key)||!(/^[a-f0-9]{64}$/i.test(vote.imageSha256))||
   typeof vote.feedback!=='string'||!vote.feedback.trim()||vote.feedback.length>500)
   throw Error('Untrusted return vote');
  if(active[vote.key]?.sha256!==vote.imageSha256)continue;
  delete active[vote.key];
  ledger.returned[vote.key]=vote.imageSha256;
  ledger.history.push({kind:'RETURN_FOR_REVISION',key:vote.key,sha256:vote.imageSha256,
   reason:vote.feedback.trim(),issue:process.env.STORY_REVIEW_ISSUE_URL||'',
   actionAt:new Date().toISOString()});
  removed++;changed.push(vote.key);
 }
 if(changed.length)writeMapAndLedger();
 console.log(JSON.stringify({mode,removed,keys:changed,originalGameArtPreserved:true,
  previousArtRestoredByBindingFallback:true,noNewP0Approvals:true}));
 process.exit(0);
}
const available=sourceManifest();
const already=new Set();
for(const s of shots){
 if(!canActOn(s))continue;
 // Output rejected by provider safety filters must NEVER be published.
 if(available.has(s.draftPath+'.provider-blocked.json')){providerBlocked++;continue;}
 if(!available.has(s.draftPath)||!available.has(s.draftPath+'.generation.json')){
  missing++;continue;
 }
 try{
  const verified=sourceReviewable(s,available);
  if(!verified){missing++;continue;}
  if(already.has(verified.sha256))throw Error('Identical image bytes in multiple distinct canonical scenes');
  already.add(verified.sha256);
  if(ledger.returned[s.key]===verified.sha256){unchanged++;continue;}
  if(active[s.key]?.sha256===verified.sha256){unchanged++;continue;}
  const rel='assets/story/chapter1-provisional-live/'+slug(s.key)+'.webp';
  const binding={asset:'./'+rel,sha256:verified.sha256,provenance:verified.proof,
   sourceDraft:s.draftPath,status:'PROVISIONAL_NOT_VISUALLY_APPROVED',
   originalLivePath:s.legacyPath||null,stageId:s.stageId,edition:s.edition,gender:s.gender};
  if(mode==='--apply'){
   fs.mkdirSync(path.dirname(toAbs(rel)),{recursive:true});
   fs.writeFileSync(toAbs(rel),verified.bytes);
   active[s.key]=binding;
  }
  imported++;
 }catch(e){failures.push({key:s.key,message:String(e.message)});}
}
if(failures.length){
 // Fail closed; no map updates if ANY visible draft failed source-hash audit.
 // Previously imported images remain only as unstaged worktree files.
 console.error(JSON.stringify({invalidRealCandidates:failures.slice(0,12)}));
 process.exitCode=2;
}else if(mode==='--apply'&&imported)writeMapAndLedger();
console.log(JSON.stringify({mode,registeredCandidates:imported,previousUnchangedOrReturned:unchanged,
 missingPhysicalImages:missing,providerSafetyBlocked:providerBlocked,
 invalidProof:failures.length,existingLiveProvisional:Object.keys(active).length,
 p0VisuallyApprovedByThisScript:0,automaticFinalRelease:false,
 reversibleViaLedgerAndGit:true}));
