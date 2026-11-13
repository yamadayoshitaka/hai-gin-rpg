#!/usr/bin/env node
/**
 * Chapter 1 Stage 1: audit the EXISTING 30 registered WebPs and export
 * one-image-only screenplay prompts in SIX groups of up to FIVE.
 *
 * Never overwrites artwork, modifies game registration, calls a renderer,
 * labels images human-approved, or treats the 6 review sheets as game frames.
 *
 * Usage:
 * node scripts/process-c01-s01-stage-batch.mjs
 * node scripts/process-c01-s01-stage-batch.mjs --sheet 1
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {comicForStage} from '../src/story-chapter-comic.js';
import {registeredStoryPanelAsset} from '../src/story-panel-registered-art.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const contract=JSON.parse(fs.readFileSync(path.join(root,
 'assets/story/stage-manifests/c01-s01.manifest.json'),'utf8'));
const bible=JSON.parse(fs.readFileSync(path.join(root,contract.referenceMasterBible),'utf8'));
const args=process.argv.slice(2);
const sheetIndex=args.indexOf('--sheet');
if(args.some((a,i)=>a.startsWith('--')&&(a!=='--sheet'||i!==sheetIndex))||
 (sheetIndex>=0&&(args.length!==2||!Number.isInteger(Number(args[sheetIndex+1]))||
 Number(args[sheetIndex+1])<1||Number(args[sheetIndex+1])>6)))
 throw Error('Usage: node scripts/process-c01-s01-stage-batch.mjs [--sheet 1..6]');
const selectedSheet=sheetIndex<0?null:Number(args[sheetIndex+1]);
if(contract.stageId!=='c01-s01'||contract.priority!=='P0_ABSOLUTE_MUST_FOLLOW'||
 contract.protectedExistingRegisteredWebps!==30||contract.unregisteredExpected!==0||
 contract.maximumFramesPerImageGenerationCall!==1||
 contract.maximumFramesPerReviewSheet!==5||
 contract.maximumReviewSheetsPerBatch!==10||
 JSON.stringify(contract.nativeMinimumPixels)!=='[768,320]'||
 contract.variants.length!==4||
 !contract.noTextOrNumbersOrUiInsideImages)
 throw Error('P0 Stage 1 native 30-shot contract incomplete');
const outRel='qa-reports/story-stage-production/batches/c01-s01';
const dir=path.join(root,outRel,'one-frame-requests');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function imageDimensions(b){
 if(b.length<30||b.toString('ascii',0,4)!=='RIFF'||
  b.toString('ascii',8,12)!=='WEBP')throw Error('WEBP_RIFF_REQUIRED');
 const type=b.toString('ascii',12,16);
 if(type==='VP8 '){
  if(b[23]!==0x9d||b[24]!==0x01||b[25]!==0x2a)throw Error('WEBP_VP8_HEADER_INVALID');
  return [b.readUInt16LE(26)&0x3fff,b.readUInt16LE(28)&0x3fff];
 }
 if(type==='VP8L'){
  if(b[20]!==0x2f)throw Error('WEBP_LOSSLESS_HEADER_INVALID');
  const value=b.readUInt32LE(21);
  return [(value&0x3fff)+1,((value>>>14)&0x3fff)+1];
 }
 if(type==='VP8X')return [b.readUIntLE(24,3)+1,b.readUIntLE(27,3)+1];
 throw Error('WEBP_UNSUPPORTED_CHUNK_'+type);
}
const byId=new Map(bible.actors.map(x=>[x.id,x]));
function referenceFor(actorId){
 const actor=byId.get(actorId);
 const rel=actor?.path||'assets/story-cinema/cast/'+actorId+'.webp';
 const abs=path.join(root,rel);
 if(!fs.existsSync(abs))return {actorId,path:rel,exists:false,
  sha256:null,attachedToImageGenerator:false};
 const bytes=fs.readFileSync(abs);
 const valid=bytes.length>30&&bytes.toString('ascii',0,4)==='RIFF'&&
  bytes.toString('ascii',8,12)==='WEBP';
 return {actorId,path:rel,exists:valid,sha256:valid?hash(bytes):null,
  sourceBytes:bytes.length,attachedToImageGenerator:false};
}
const seen=new Set(),shaToAsset=new Map(),all=[];
const sheets=[];
let sheetOrdinal=0,unsafeCount=0,allArtRegistered=0,nativePass=0;
fs.mkdirSync(dir,{recursive:true});
for(const variant of contract.variants){
 const context={protagonistGender:variant.gender};
 const phase=variant.edition==='pre'?'pre':'post';
 const comic=comicForStage('c01-s01',phase,context);
 if(comic.edition!==variant.edition||
  JSON.stringify(comic.panels.map(p=>p.id))!==JSON.stringify(variant.panelIds)||
  comic.panels.length!==variant.requiredPanels||
  variant.reviewSheets.reduce((n,s)=>n+s.panelIds.length,0)!==comic.panels.length)
  throw Error('Stage1 screenplay/edition mismatch '+variant.edition+'/'+variant.gender);
 const grouped=variant.reviewSheets;
 for(const group of grouped){
  sheetOrdinal++;
  if(group.panelIds.length<1||group.panelIds.length>5)
   throw Error('More than 5 frames in a review group');
  const included=selectedSheet===null||sheetOrdinal===selectedSheet;
  const sheet={sheetOrdinal,edition:variant.edition,gender:variant.gender,
   shotKeys:[],shotCount:group.panelIds.length,selected:included,
   requestFiles:[],note:'REVIEW-ONLY BUNDLE; no sprite sheets submitted to generator'};
  for(const panelId of group.panelIds){
   const shot=comic.panels.find(x=>x.id===panelId);
   if(!shot)throw Error('Missing canonical frame '+panelId);
   const key=['c01-s01',variant.edition,variant.gender,panelId].join('|');
   if(seen.has(key))throw Error('Duplicate canonical shot '+key);
   seen.add(key);sheet.shotKeys.push(key);
   const registered=registeredStoryPanelAsset(shot);
   if(!registered||!registered.startsWith('./assets/story/chapters/c01/panels/'))
    throw Error('Missing exact existing game registration for '+key);
   const rel=registered.slice(2);
   if(rel.includes('..'))throw Error('Unsafe WebP path');
   const fp=path.join(root,rel);
   if(!fs.existsSync(fp))throw Error('Game references missing real WebP '+rel);
   const binary=fs.readFileSync(fp);
   const size=imageDimensions(binary),sha256=hash(binary);
   const nativeEnough=size[0]>=768&&size[1]>=320;
   const duplicated=shaToAsset.has(sha256);
   shaToAsset.set(sha256,rel);
   allArtRegistered++;
   if(nativeEnough)nativePass++;
   if(!nativeEnough||duplicated)unsafeCount++;
   const visible=[shot.characterId,shot.secondaryId].filter(Boolean);
   const visibleIds=[...new Set(visible)];
   const references=visibleIds.map(referenceFor);
   const missingMasters=references.filter(x=>!x.exists).map(x=>x.actorId);
   const heroId='commander_'+variant.gender;
   const heroContinuityReference=referenceFor(heroId);
   const scriptText=shot.subtitleText||shot.text;
   const speaker=shot.speaker||'語り手';
   const sceneGoal=shot.kind==='opening'?'Opening scene and location of the capital':
    shot.kind==='closing'?'Transition to the next playable stage':
    shot.kind==='confrontation'?'Show the conflict through expressions and body language':
    'Show the exact CURRENT character dialogue as a cinematic moment';
   // Per-invocation one-scene instructions ONLY, never a chapter-wide collage.
   const prompt=[
    'P0_ABSOLUTE_MUST_FOLLOW. GENERATE ONE IMAGE FOR EXACTLY ONE STORY PANEL.',
    'ONE OUTPUT ONLY: no grid, contact sheet, storyboards, montages, split screen, panel numbering or 5x5.',
    'Chapter 1 Stage 1, branch '+variant.edition+', '+variant.gender+' protagonist, scene '+panelId+'.',
    'CURRENT SCENE DIALOGUE FOR ACTING ONLY (INVISIBLE IN IMAGE): '+scriptText,
    'SPEAKER: '+speaker,
    'CAST IDS TO DEPICT (no invented extras): '+(visibleIds.join(', ')||'Narrator-only / environmental scene'),
    'FOREGROUND ACTOR: '+(shot.characterId||'NO EXPLICIT SPEAKER IN SCENE'),
    'SECONDARY ACTOR: '+(shot.secondaryId||'NONE'),
    'CHARACTER REFERENCE ACTUAL INPUTS REQUIRED: '+references.map(x=>x.actorId+' '+x.path).join('; '),
    'PROTAGONIST CONTINUITY REFERENCE, ONLY VISIBLE IF SCRIPT SHOWS THEM: '+heroId+
     ' '+heroContinuityReference.path,
    'CHARACTER MOTION/EXPRESSION: '+(shot.expression||'consistent with current dialogue'),
    'SETTING: '+(shot.scenery||'royal capital and surroundings'),
    'SHOT PURPOSE: '+sceneGoal,
    'NO in-image letters, digits, kanji, kana, speech bubbles, subtitles, scene names, maps with text, overlays, UI, signatures or watermarks.',
    'No gender swaps, no narration text drawn, no unrelated cast, no invented events.',
    'True original image >=768px wide and >=320px tall; prefer highest genuine supported native detail; no enlargement as a workaround.',
    'This metadata is NEVER a title or caption in the picture.',
    'Do not claim original image master attachment or visual-identity approval without verifying the generator actually received those bytes.'
   ].join('\n');
   const output={schemaVersion:1,kind:'STAGE1_ONE_PANEL_RENDER_REQUEST_NOT_GENERATED',
    shotKey:key,panelId,edition:variant.edition,gender:variant.gender,
    scene:{scriptText,speaker,kind:shot.kind||null,visibleActorIds:visibleIds,
     foregroundActorId:shot.characterId||null,secondaryActorId:shot.secondaryId||null,
     expression:shot.expression||null,scenery:shot.scenery||null},
    minimumNativePixels:[768,320],outputLimitImages:1,prompt,
    imageInputs:references,heroContinuityReference,
    missingMasterImageIds:missingMasters,
    allReferenceBytesAttachedToRenderer:false,newImageGenerated:false,
    existingArt:{path:rel,sha256,pixelSize:size,nativeEnough,
     duplicatedAcrossDifferentShot:duplicated,registeredInGame:true,
     visualQualityApproved:false},
    review:{textlessVisualApproval:false,castIdentityApproved:false,
     scriptSceneApproved:false,artCanBeUsedAsAcceptedMaster:false}};
   all.push(output);
   if(included){
    const fileName=key.replace(/[^a-zA-Z0-9_-]/g,'_')+'.json';
    const dirPart='sheet-'+String(sheetOrdinal).padStart(2,'0');
    const relative=path.join(outRel,'one-frame-requests',dirPart,fileName);
    const abs=path.join(root,relative);
    fs.mkdirSync(path.dirname(abs),{recursive:true});
    fs.writeFileSync(abs,JSON.stringify(output,null,2)+'\n');
    fs.writeFileSync(abs.replace(/\.json$/,'.prompt.txt'),prompt+'\n');
    sheet.requestFiles.push(relative);
   }
  }
  sheets.push(sheet);
 }
}
if(all.length!==30||seen.size!==30||sheets.length!==6||sheetOrdinal!==6||
 allArtRegistered!==30||sheets.reduce((n,s)=>n+s.shotCount,0)!==30)
 throw Error('P0 Stage1 lost or duplicated a protected registered scene');
const report={kind:'STAGE1_EXISTING_30_WEBPS_AUDITED_NOT_HUMAN_APPROVED',
 stageId:'c01-s01',source:'canonical comicForStage + actual registered WebP bytes',
 stageCompleteAndApproved:false,newGeneratedWebps:0,newGithubRegistrations:0,
 existingRegisteredWebps:allArtRegistered,phoneNativePass:nativePass,
 phoneNativeFail:allArtRegistered-nativePass,needsNativeOrDuplicationReview:unsafeCount,
 reviewSheets:6,maxFramesPerSheet:5,oneImageOnlyPerRenderCall:true,
 completeExistingAssetAudit:true,
 oneFramePromptsWritten:sheets.reduce((n,s)=>n+s.requestFiles.length,0),
 sheets,shots:all.map(x=>({shotKey:x.shotKey,source:x.existingArt,
  visibleActorIds:x.scene.visibleActorIds,missingMasterImageIds:x.missingMasterImageIds,
  dialogue:x.scene.scriptText}))};
fs.mkdirSync(path.join(root,outRel),{recursive:true});
const reportRel=outRel+'/stage1-audit-and-render-queue.json';
fs.writeFileSync(path.join(root,reportRel),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({stageId:'c01-s01',originalWebps:30,
 sheets:6,nativePass:nativePass,nativeFail:30-nativePass,needsReview:unsafeCount,
 promptFiles:report.oneFramePromptsWritten,
 noArtOverwrite:true,newRegistered:0,reviewReport:reportRel}));
