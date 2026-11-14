#!/usr/bin/env node
/**
 * Import actual ChatGPT WebP only after exact scene/actor, source bytes and native geometry audit.
 * Owner-authorized PROVISIONAL art may remain missing P0 master image input;
 * this is expressly NOT final quality approval. No ChatGPT/OpenAI API is invoked.
 * Existing reviewed originals, gender/outcome separation and rollback remain.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {chapterOneReviewPages} from '../src/story-chapter1-review-core.js';
import {chapterReviewedPanelAsset} from '../src/story-chapter-reviewed-art.js';
import {stage2ReviewedPanelAsset} from '../src/story-stage2-reviewed-art.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const inbox='assets/story/chapter1-chatgpt-inbox';
const abs=p=>path.join(root,p), bytes=p=>fs.readFileSync(abs(p));
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const registryPath='src/story-chapter1-provisional-live.js';
const ledgerPath='assets/story/chapter1-provisional-revisions.json';
const text=fs.readFileSync(abs(registryPath),'utf8');
const capture=/CHAPTER1_PROVISIONAL_LIVE=Object\.freeze\((\{[\s\S]*?\})\);/;
const found=capture.exec(text);
if(!found)throw Error('Registry syntax changed');
const active=JSON.parse(found[1]),ledger=JSON.parse(bytes(ledgerPath));
const shots=chapterOneReviewPages().flatMap(p=>p.shots);
const keys=new Map(shots.map(s=>[s.key,s]));
const mode=process.argv[2];
if(process.argv.length!==3||!['--plan','--apply'].includes(mode))throw Error('Usage: --plan|--apply');
function webpSize(b){
 if(b.length<30||b.toString('ascii',0,4)!=='RIFF'||b.toString('ascii',8,12)!=='WEBP')throw Error('Not a WebP');
 const type=b.toString('ascii',12,16);
 if(type==='VP8 ')return [b.readUInt16LE(26)&16383,b.readUInt16LE(28)&16383];
 if(type==='VP8L'){if(b[20]!==47)throw Error('Bad VP8L');const n=b.readUInt32LE(21);return [(n&16383)+1,((n>>>14)&16383)+1];}
 if(type==='VP8X')return [b.readUIntLE(24,3)+1,b.readUIntLE(27,3)+1];
 throw Error('Invalid WebP encoding');
}
const visualRequired=['exactCanonicalScene','exactCast','genderAndOutcomeCorrect','noTextUI','original3DCinematicStyle','nativeDetail'];
// Owner expressly requested reversible game display of visually checked ChatGPT images
// before all P0/master-reference checks. Do NOT call this final/human QA.
const p0Required=[...visualRequired,'realReferenceBytesAttachedToImageGenerator'];
const proofs=fs.existsSync(abs(inbox))?fs.readdirSync(abs(inbox)).filter(f=>f.endsWith('.review.json')):[];
const changes=[],failures=[],skipped=[];
const seen=new Set(Object.values(active).map(v=>v.sha256));
for(const file of proofs){
 try{
  const reviewPath=inbox+'/'+file,review=JSON.parse(bytes(reviewPath));
  const isStrictP0=review.qaStatus==='PASS';
  const isOwnerProvisional=review.qaStatus==='OWNER_PROVISIONAL'&&
    review.ownerAuthorized===true&&review.humanVisualQAConfirmed===false&&
    review.finalP0Approved===false&&review.reviewedBy==='assistant-visual-inspection'&&
    review.generationReferencesAttached===false;
  if(!isStrictP0&&!isOwnerProvisional){skipped.push(file);continue;}
  const shot=keys.get(review.shotKey);
  if(!shot||!['c01-s01','c01-s02','c01-s03'].includes(shot.stageId))throw Error('Not canonical stage1-3 shot');
  if(chapterReviewedPanelAsset({stageId:shot.stageId,comicEdition:shot.edition,protagonistGender:shot.gender,id:shot.shotId})||
    stage2ReviewedPanelAsset({stageId:shot.stageId,comicEdition:shot.edition,protagonistGender:shot.gender,id:shot.shotId}))
    throw Error('Refusing to replace formally reviewed art');
  if(review.scriptText!==shot.scriptText)throw Error('Script text differs');
  if(review.sourceModel!=='ChatGPT Images'||!review.reviewedAt)
    throw Error('ChatGPT source or timestamp missing');
  if(isStrictP0&&(!review.humanVisualQAConfirmed||!review.reviewer))
    throw Error('Verified human QA provenance missing');
  if((isStrictP0?p0Required:visualRequired).some(k=>review.quality?.[k]!==true))
    throw Error('Required visual/canonical gate not passed');
  if(isOwnerProvisional&&review.quality?.realReferenceBytesAttachedToImageGenerator!==false)
    throw Error('Provisional reference gap must remain explicit');
  if(!Array.isArray(review.referenceImagesAttached)||review.referenceImagesAttached.length>5||
     (isStrictP0&&!review.referenceImagesAttached.length))
    throw Error('Reference proof missing/invalid');
  for(const ref of review.referenceImagesAttached){
   if(!/^assets\/[-a-zA-Z0-9_/.]+\.webp$/.test(ref.path)||ref.path.includes('..')||
     !fs.existsSync(abs(ref.path))||hash(bytes(ref.path))!==ref.sha256)
     throw Error('Actor reference image not physically verified');
  }
  const slug=shot.key.replaceAll('|','__');
  if(file!==slug+'.review.json')throw Error('Review filename differs from canonical key');
  const imagePath=inbox+'/'+slug+'.webp';
  if(!fs.existsSync(abs(imagePath)))throw Error('Real image bytes missing');
  const original=bytes(imagePath),sum=hash(original),[w,h]=webpSize(original);
  if(sum!==review.imageSha256||review.nativePixels?.[0]!==w||review.nativePixels?.[1]!==h)
    throw Error('Real WebP/hash/size mismatch');
  const min=shot.stageId==='c01-s02'?[768,320]:[1536,864];
  if(w<min[0]||h<min[1]||w*9!==h*16)throw Error('Invalid native aspect/dimensions');
  if(ledger.returned?.[shot.key]===sum)throw Error('Returned SHA cannot be imported again');
  if(active[shot.key]?.sha256===sum){skipped.push(file);continue;}
  if(seen.has(sum))throw Error('Duplicate bytes bound to multiple shots');
  seen.add(sum);
  changes.push({shot,imagePath,reviewPath,original,sum,qaStatus:review.qaStatus});
 }catch(e){failures.push({file,error:String(e.message)});}
}
if(failures.length){console.error(JSON.stringify({status:'REJECTED',failures}));process.exit(2);}
if(mode==='--apply'&&changes.length){
 for(const {shot,imagePath,reviewPath,original,sum,qaStatus} of changes){
  const dest='assets/story/chapter1-provisional-live/'+shot.key.replaceAll('|','__')+'.webp';
  fs.mkdirSync(path.dirname(abs(dest)),{recursive:true});
  fs.writeFileSync(abs(dest),original);
  active[shot.key]={asset:'./'+dest,sha256:sum,provenance:reviewPath,
   sourceDraft:imagePath,status:'PROVISIONAL_OWNER_AUTHORIZED_PENDING_P0',
   originalLivePath:shot.legacyPath||null,stageId:shot.stageId,edition:shot.edition,gender:shot.gender};
  ledger.history.push({kind:qaStatus==='OWNER_PROVISIONAL'?
    'CHATGPT_OWNER_PROVISIONAL_NOT_P0':'CHATGPT_QA_PASSED_PROVISIONAL',
    key:shot.key,sha256:sum,proof:reviewPath,actionAt:new Date().toISOString()});
 }
 fs.writeFileSync(abs(registryPath),text.replace(capture,
   'CHAPTER1_PROVISIONAL_LIVE=Object.freeze('+JSON.stringify(active,null,2)+');'));
 fs.writeFileSync(abs(ledgerPath),JSON.stringify(ledger,null,2)+'\n');
}
console.log(JSON.stringify({mode,eligible:changes.length,skipped:skipped.length,
 invalid:failures.length,applied:mode==='--apply'?changes.length:0,
 finalApprovalsGranted:0,realReferenceBytesCheckedForStrictP0Only:true}));
