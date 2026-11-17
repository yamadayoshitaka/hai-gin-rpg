#!/usr/bin/env node
/**
 * Restore exact, independently generated, once-used Chapter 1 archive art.
 * Reads ONLY the existing GitHub review branch checkout. No image generation,
 * no paid services, no gender/outcome borrowing, no formal quality approval.
 *
 * node scripts/restore-existing-story-art.mjs --mode scan --archive "$TEMP_ARCHIVE"
 * node scripts/restore-existing-story-art.mjs --mode promote --archive "$TEMP_ARCHIVE" --max 10
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {COMPACT_TWENTY_CHAPTER_PLAN,compactComicForStage} from '../src/story-compact-comic.js';
import {registeredStoryPanelAsset} from '../src/story-panel-registered-art.js';
import {RESTORED_STORY_ARCHIVE} from '../src/story-archive-restored-art.js';
import {oldStoryArtReuseAllowed} from '../src/story-art-sourcing-policy.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2);
function arg(name,otherwise){const i=args.indexOf(name);return i<0?otherwise:args[i+1];}
const mode=arg('--mode','scan');
const archive=path.resolve(arg('--archive',path.join(root,'.archive-story-art')));
const max=Number(arg('--max','10'));
if(!['scan','promote'].includes(mode)||!Number.isInteger(max)||max<1||max>30)
 throw Error('Unsafe archive import mode/max');
const originals=path.join(archive,'assets/story/chapter-drafts/c01/cloudflare-chapter1-free');
if(!fs.existsSync(originals)||!fs.statSync(originals).isDirectory())
 throw Error('Original review-branch worktree not checked out: '+originals);
const output='qa-reports/story-archive-reuse-scan.json';
const present=new Map();
const allScenes=new Map();
for(const plan of COMPACT_TWENTY_CHAPTER_PLAN)for(const stageId of plan.stageIds)
 for(const gender of ['male','female']){
  // User-defined archival reuse boundary: chapter 1 stages 1 through 4.
  if(!oldStoryArtReuseAllowed(stageId))continue;
  const common={protagonistGender:gender,chapterOpeningSeen:false};
  const phases=[
   ['pre',common],
   ['post',{...common,battleOutcome:{victory:true}}],
   ['post',{...common,battleOutcome:{victory:false,playerCommanderDead:true}}]
  ];
  for(const [phase,context] of phases){
   const comic=compactComicForStage(stageId,phase,context);
   for(const shot of comic.panels){
    if(shot.sharedArtAsset)continue; // Shared defeat/other outcome art has its own authorization.
    const key=[shot.stageId,shot.comicEdition,gender,shot.id].join('|');
    if(allScenes.has(key))continue; // Town aftermath is outcome-independent and maps to one edition.
    allScenes.set(key,shot);
    const url=registeredStoryPanelAsset(shot);
    if(url)present.set(key,url);
   }
  }
 }
const sha256=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const gitBlob=bytes=>crypto.createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
const imagePixels=bytes=>{
 if(bytes.length<32||bytes.toString('ascii',0,4)!=='RIFF'||bytes.toString('ascii',8,12)!=='WEBP')
  throw Error('Not actual WebP binary');
 const f=bytes.toString('ascii',12,16);
 if(f==='VP8 ')return [bytes.readUInt16LE(26)&0x3fff,bytes.readUInt16LE(28)&0x3fff];
 if(f==='VP8L'){const n=bytes.readUInt32LE(21);return [(n&0x3fff)+1,((n>>>14)&0x3fff)+1];}
 if(f==='VP8X')return [bytes.readUIntLE(24,3)+1,bytes.readUIntLE(27,3)+1];
 throw Error('Unsupported image codec');
};
function walk(directory){
 const out=[];
 for(const ent of fs.readdirSync(directory,{withFileTypes:true})){
  const filename=path.join(directory,ent.name);
  if(ent.isSymbolicLink())continue;
  if(ent.isDirectory())out.push(...walk(filename));
  else if(ent.isFile()&&filename.endsWith('.webp.generation.json'))out.push(filename);
 }
 return out;
}
const seen=new Set(),matching=[],rejected=[],duplicate=[];
for(const proofFile of walk(originals)){
 const file=proofFile.slice(0,-'.generation.json'.length);
 let proof;try{proof=JSON.parse(fs.readFileSync(proofFile,'utf8'));}
 catch{rejected.push({proof:proofFile,reason:'INVALID_SOURCE_METADATA'});continue;}
 const key=proof.shotKey;
 if(!allScenes.has(key))continue; // Never borrow a legacy/outcome/gender shot.
 if(seen.has(key)){duplicate.push(key);continue;}seen.add(key);
 if(present.has(key))continue;
 try{
  const [stageId,edition,gender,panelId]=key.split('|');
  const consistent=proof.kind==='CLOUDFLARE_REAL_WEBP_REVIEW_CANDIDATE_NOT_APPROVED'&&
    proof.stageId===stageId&&proof.edition===edition&&proof.gender===gender&&proof.panelId===panelId&&
    /^c\d{2}-s\d{2}$/.test(stageId)&&/^(male|female)$/.test(gender)&&
    Array.isArray(proof.visibleActorIds)&&Array.isArray(proof.actualReferenceImagesAttached)&&
    proof.visuallyApproved===false&&proof.formallyRegistered===false;
  if(!consistent)throw Error('CANONICAL_METADATA_NOT_EQUAL');
  const actors=new Set(proof.actualReferenceImagesAttached.map(a=>a.actorId));
  for(const a of proof.visibleActorIds)if(!actors.has(a))throw Error('VISIBLE_ACTOR_MISSING_REFERENCE');
  const bytes=fs.readFileSync(file),pixels=imagePixels(bytes);
  if(bytes.length!==proof.imageBytes||sha256(bytes)!==proof.imageSha256)
   throw Error('SOURCE_IMAGE_SHA_OR_LENGTH_MISMATCH');
  if(pixels[0]!==proof.nativePixels?.[0]||pixels[1]!==proof.nativePixels?.[1]||
    pixels[0]<800||pixels[1]<450||pixels[0]*9!==pixels[1]*16)
   throw Error('NATIVE_IMAGE_REQUIREMENTS_FAILED');
  const name=[stageId,edition,gender,panelId].join('__');
  matching.push({key,stageId,edition,gender,panelId,source:file,proof:proofFile,
   destination:'assets/story/chapter1-provisional-live/'+name+'.webp',
   pixels,sha256:proof.imageSha256,gitBlobSha:gitBlob(bytes),
   visibleActorIds:proof.visibleActorIds});
 }catch(error){rejected.push({key,source:file,reason:String(error.message)});}
}
if(duplicate.length)throw Error('Ambiguous archive sources: '+duplicate.join(','));
matching.sort((a,b)=>a.key.localeCompare(b.key));
const result={schemaVersion:2,kind:'EXACT_ARCHIVED_STORY_WEBP_REUSE',reuseScope:'c01-s01..c01-s04',
 mode,archivedOriginalCount:seen.size,existingRegistered:present.size,
 eligibleExactUnused:matching.length,refused:rejected.length,
 noExternalImageApiCalls:true,noCrossGenderOrOutcomeReuse:true,
 provisionalNotP0:true,selected:matching.slice(0,max).map(({source,proof,...entry})=>({
  ...entry,source:path.relative(archive,source),proof:path.relative(archive,proof)})),
 rejected};
if(mode==='promote'){
 const entries={...RESTORED_STORY_ARCHIVE};
 for(const row of matching.slice(0,max)){
  const dst=path.join(root,row.destination),proofDst=dst+'.generation.json';
  if(fs.existsSync(dst)||fs.existsSync(proofDst)||entries[row.key])
   throw Error('Refuse replacing preexisting artwork: '+row.key);
  fs.mkdirSync(path.dirname(dst),{recursive:true});
  fs.copyFileSync(row.source,dst);fs.copyFileSync(row.proof,proofDst);
  entries[row.key]={
   asset:'./'+row.destination,proof:'./'+row.destination+'.generation.json',
   sha256:row.sha256,gitBlobSha:row.gitBlobSha,
   sourceBranch:'story/chapter1-free-actual-art',nativePixels:row.pixels,
   visibleActorIds:row.visibleActorIds,
   reviewStatus:'PROVISIONAL_ARCHIVE_RESTORED_NOT_P0',
   visualIdentityApproved:false,stageId:row.stageId,
   edition:row.edition,gender:row.gender,panelId:row.panelId
  };
 }
 if(matching.length){
  const dest=path.join(root,'src/story-archive-restored-art.js');
  const source=fs.readFileSync(dest,'utf8');
  const lead='export const RESTORED_STORY_ARCHIVE=Object.freeze(';
  const start=source.indexOf(lead);
  const end=source.indexOf('\nexport const RESTORED_STORY_ARCHIVE_COUNT=',start);
  if(start<0||end<0)throw Error('Archive registry generator markers missing');
  const updated=source.slice(0,start)+lead+JSON.stringify(entries,null,2)+');'+source.slice(end);
  fs.writeFileSync(dest,updated);
 }
 result.recovered=matching.slice(0,max).length;
}
const dest=path.join(root,output);
fs.mkdirSync(path.dirname(dest),{recursive:true});
fs.writeFileSync(dest,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({mode,sourceTotal:seen.size,registered:present.size,
 eligible:matching.length,restored:result.recovered||0,
 rejected:rejected.length,output}));
