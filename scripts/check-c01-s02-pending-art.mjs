#!/usr/bin/env node
/**
 * Stage c01-s02 canonical 25-shot real-art preflight and opt-in registration.
 * Run: node scripts/check-c01-s02-pending-art.mjs
 * This MUST NOT fabricate story art or approve quality automatically.
 *
 * Registration is allowed only with 25 distinct native WebPs + per-shot
 * provenance and human review attestations. Existing 23 images are immutable.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {comicForStage} from '../src/story-chapter-comic.js';
import {registeredStoryPanelAsset} from '../src/story-panel-registered-art.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>fs.readFileSync(path.join(root,p));
const args=process.argv.slice(2);
const registering=args.includes('--register');
const stage='c01-s02';
const contract=JSON.parse(read('assets/story/stage-manifests/c01-s02.manifest.json'));
const groups=contract.continuation.pendingGroups;
if(contract.layout.maxPanelsPerPoster!==5 ||
 JSON.stringify(contract.layout.minPerPanelNativePixels)!=='[768,320]' ||
 contract.continuation.existingSceneCount!==23 ||
 contract.continuation.remainingSceneCount!==25)
 throw Error('P0 stage2 scope or minimum changed; refuse registration');
const realProofRoot='assets/story/chapters/c01/art-reviews/';
const rows=[],seenKeys=new Set(),seenFiles=new Set(),seenHashes=new Set();
function hash(b){return crypto.createHash('sha256').update(b).digest('hex')}
function dimensions(b){
 if(b.length<30||b.toString('ascii',0,4)!=='RIFF'||
  b.toString('ascii',8,12)!=='WEBP')throw Error('NOT_WEBP');
 const fourcc=b.toString('ascii',12,16);
 if(fourcc==='VP8 '){
  if(b.length<30||b[23]!==0x9d||b[24]!==0x01||b[25]!==0x2a)throw Error('VP8_HEADER');
  return [b.readUInt16LE(26)&0x3fff,b.readUInt16LE(28)&0x3fff];
 }
 if(fourcc==='VP8L'){
  if(b[20]!==0x2f)throw Error('VP8L_HEADER');
  let p=b.readUInt32LE(21);
  return [(p&0x3fff)+1,((p>>>14)&0x3fff)+1];
 }
 if(fourcc==='VP8X'){
  return [1+b.readUIntLE(24,3),1+b.readUIntLE(27,3)];
 }
 throw Error('WEBP_CHUNK_UNSUPPORTED:'+fourcc);
}
for(const group of groups){
 if(group.edition==='pre')throw Error('Already registered edition in pending group');
 const context={protagonistGender:group.gender,battleOutcome:
  group.edition==='post-victory'?{victory:true}:
  group.edition==='post-defeat'?{victory:false}:
  group.edition==='post-gameover'?{victory:false,playerCommanderDead:true}:null};
 if(!context.battleOutcome)throw Error('Unrecognized outcome');
 const comic=comicForStage(stage,'post',context);
 if(comic.edition!==group.edition||
  JSON.stringify(comic.panels.map(s=>s.id))!==JSON.stringify(group.panels)||
  group.reviewSheets.some(s=>s.panels.length>5))
  throw Error('Canonical screenplay/group mismatch '+group.edition+' '+group.gender);
 for(const shot of comic.panels){
  const key=[stage,group.edition,group.gender,shot.id].join('|');
  const normalized=shot.id.replace(/-m([0-9]{1,2})$/,(_,s)=>'-m'+String(Number(s)).padStart(2,'0'));
  const rel='assets/story/chapters/c01/panels/'+normalized+'-'+group.edition+'-'+group.gender+'.webp';
  if(seenKeys.has(key)||seenFiles.has(rel))throw Error('Duplicate pending key/path '+key);
  seenKeys.add(key);seenFiles.add(rel);
  if(registeredStoryPanelAsset(shot))throw Error('Attempt to overwrite registered shot '+key);
  const proofRel=realProofRoot+normalized+'-'+group.edition+'-'+group.gender+'.review.json';
  const row={shotKey:key,panelId:shot.id,gender:group.gender,outcome:group.edition,
   scriptText:shot.subtitleText||shot.text,individualAsset:rel,reviewProof:proofRel,
   minNativePixels:[768,320],status:'MISSING_REAL_IMAGE',dimensions:null,sha256:null,
   sourceVerified:false,personAndTextApproved:false,gameRegistered:false};
  const file=path.join(root,rel);
  if(fs.existsSync(file)){
   const bytes=fs.readFileSync(file),sha=hash(bytes);
   row.sha256=sha;
   try {
    const [w,h]=dimensions(bytes);
    row.dimensions=[w,h];
    if(w<768||h<320)row.status='REJECTED_UNDER_768x320';
    else if(seenHashes.has(sha))row.status='REJECTED_DUPLICATED_IMAGE_ACROSS_BRANCHES';
    else {
     seenHashes.add(sha);
     row.status='AWAITING_REAL_REFERENCES_AND_HUMAN_REVIEW';
     if(fs.existsSync(path.join(root,proofRel))){
      const review=JSON.parse(read(proofRel));
      const requires=['actualMasterImagesAttachedToGenerator','exactScreenplayHumanApproved',
       'identityGenderHumanApproved','correctOutcomeHumanApproved',
       'noTextDigitsUiHumanApproved','sourceNotUpscaled','humanReviewer'];
      const all=requires.every(k=>Boolean(review[k]));
      const matches=review.shotKey===key&&review.sha256===sha &&
       review.humanReviewer!=='AUTOMATIC' &&
       review.humanReviewer!=='AI';
      row.sourceVerified=Boolean(review.actualMasterImagesAttachedToGenerator&&matches);
      row.personAndTextApproved=Boolean(all&&matches);
      if(all&&matches)row.status='REVIEWED_REAL_ART_READY_FOR_REGISTRATION';
     }
    }
   }catch(e){row.status='REJECTED_WEBP:'+String(e.message)}
  }
  rows.push(row);
 }
}
if(rows.length!==25||seenKeys.size!==25||seenFiles.size!==25)throw Error('Pending 25 panel count failure');
// Existing 23 registration bindings are intentionally never touched here.
const allReady=rows.every(r=>r.status==='REVIEWED_REAL_ART_READY_FOR_REGISTRATION');
const report={kind:'C01_S02_REAL_ART_READINESS_CHECK_NOT_APPROVAL',stageId:stage,
 generatedAt:new Date().toISOString(),expectedPending:25,existingProtected:23,
 registeredNewImages:0,readyForRegistration:rows.filter(r=>r.status==='REVIEWED_REAL_ART_READY_FOR_REGISTRATION').length,
 sourceImagesFound:rows.filter(r=>r.sha256).length,allReady,
 noArtificialUpscale:true,manualArtworkReviewRequired:true,rows};
const reportPath='qa-reports/story-stage-production/c01-s02-25-real-art-readiness.json';
fs.mkdirSync(path.dirname(path.join(root,reportPath)),{recursive:true});
fs.writeFileSync(path.join(root,reportPath),JSON.stringify(report,null,2)+'\n');
if(registering){
 if(!allReady)throw Error('BLOCKED: missing or unapproved canonical art; no game bindings written');
 // Validate all keys first, then atomically replace only the previously empty mapping.
 const map=Object.fromEntries(rows.map(r=>[r.shotKey,'./'+r.individualAsset]));
 const target=path.join(root,'src/story-stage2-reviewed-art.js');
 const current=fs.readFileSync(target,'utf8');
 if(!current.includes('REGISTERED_C01_S02_REVIEWED=Object.freeze({});'))
  throw Error('Existing stage2 reviewed map is nonempty; refuse overwrite');
 const content=current.replace('REGISTERED_C01_S02_REVIEWED=Object.freeze({});',
  'REGISTERED_C01_S02_REVIEWED=Object.freeze('+JSON.stringify(map,null,2)+');');
 fs.writeFileSync(target+'.tmp',content);
 fs.renameSync(target+'.tmp',target);
 report.registeredNewImages=25;report.allReady=true;
 fs.writeFileSync(path.join(root,reportPath),JSON.stringify(report,null,2)+'\n');
}
console.log(JSON.stringify({pending:rows.length,ready:report.readyForRegistration,
  actualFiles:report.sourceImagesFound,registeredNewImages:report.registeredNewImages,
  status:allReady?'REVIEWED_ALL_25':'BLOCKED_NEEDS_REAL_ART_AND_HUMAN_QA',
  report:reportPath}));
