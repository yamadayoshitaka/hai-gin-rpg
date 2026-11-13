#!/usr/bin/env node
/**
 * Fail-closed request slicer for c01-s02.
 *
 * IMPORTANT:
 * - Produces 1 instruction file for 1 canonical panel (NEVER a 25-panel prompt).
 * - Groups those independent requests in sheets of <=5, batches of <=10 sheets.
 * - Does NOT call an image-generation API, approve art or register images.
 *
 * node scripts/export-c01-s02-render-slices.mjs
 * node scripts/export-c01-s02-render-slices.mjs --sheet 3
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2);
const sheetArg=args.indexOf('--sheet');
const onlySheet=sheetArg<0?null:Number(args[sheetArg+1]);
if(args.some((arg,i)=>arg.startsWith('--')&&(arg!=='--sheet'||i!==sheetArg))||
 (onlySheet!==null&&(!Number.isInteger(onlySheet)||onlySheet<1||onlySheet>10)))
 throw Error('Usage: node scripts/export-c01-s02-render-slices.mjs [--sheet 1..10]');

const stageId='c01-s02';
const manifestPath='assets/story/stage-manifests/c01-s02.manifest.json';
const assignmentsPath='assets/story/stage-manifests/c01-s02-shot-assignments.json';
const outRel='qa-reports/story-stage-production/batches/c01-s02/request-slices';
const outDir=path.join(root,outRel);
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const manifest=read(manifestPath);
const assignments=read(assignmentsPath);
if(manifest.continuation.existingSceneCount!==23||
 manifest.continuation.remainingSceneCount!==25||
 manifest.layout.maxPanelsPerPoster!==5||
 JSON.stringify(manifest.layout.minPerPanelNativePixels)!=='[768,320]'||
 assignments.requiredPendingCount!==25||
 assignments.maximumShotsPerReviewSheet!==5||
 Object.keys(assignments.entries).length!==25)
 throw Error('P0 stage2 canonical 25-panel contract changed');

const run=spawnSync(process.execPath,
 ['scripts/run-story-stage.mjs','--stage',stageId,'--prepare-only'],
 {cwd:root,encoding:'utf8',maxBuffer:25*1024*1024});
if(run.status!==0)
 throw Error('Stage screenplay preflight failed: '+run.stdout+'\n'+run.stderr);
const compiled=read('qa-reports/story-stage-production/batches/c01-s02/stage-manifest.json');
const variantMap=new Map(compiled.stages[0].variants.map(v=>[v.edition+'|'+v.gender,v]));
const sheetQueue=[];
const seen=new Set();
let ordinal=0;
for(const group of manifest.continuation.pendingGroups){
 const variantKey=group.edition+'|'+group.gender;
 const variant=variantMap.get(variantKey);
 if(!variant)throw Error('Missing canonical variant '+variantKey);
 const canonical=variant.pages.flatMap(p=>p.panels);
 if(JSON.stringify(canonical.map(s=>s.panelId))!==JSON.stringify(group.panels))
  throw Error('Wrong screenplay ordering for '+variantKey);
 for(const sheet of group.reviewSheets){
  if(sheet.panels.length===0||sheet.panels.length>5)throw Error('Cannot generate >5 frame group');
  const keys=sheet.panels.map(id=>group.edition+'|'+group.gender+'|'+id);
  const shots=sheet.panels.map(id=>canonical.find(s=>s.panelId===id));
  if(shots.some(s=>!s))throw Error('Shot absent from compiled screenplay');
  for(const k of keys){
   if(seen.has(k)||!assignments.entries[k])throw Error('Duplicate/unassigned scene '+k);
   seen.add(k);
  }
  sheetQueue.push({ordinal:++ordinal,variant:variantKey,edition:group.edition,
   gender:group.gender,page:sheet.page,keys,shots});
 }
}
if(seen.size!==25||sheetQueue.length!==8||sheetQueue.length>10)
 throw Error('Expected exactly 25 scenes over 8 sheets (<=10 sheets/batch)');
if(Object.keys(assignments.entries).some(k=>!seen.has(k)))
 throw Error('Unmatched assignment entry');

fs.mkdirSync(outDir,{recursive:true});
const index={schemaVersion:1,kind:'MANIFEST_SLICED_REQUESTS_NOT_RENDERED_IMAGES',
 stageId,minimumNativePixels:[768,320],
 maxScenesInOneGeneratorCall:1,maxScenesPerReviewSheet:5,maxSheetsPerBatch:10,
 completedRendering:false,registeredNewImages:0,existingProtected:23,
 sheetCount:8,shotCount:25,sheets:[]};
const digest=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const safe=s=>s.replace(/[^A-Za-z0-9_-]/g,'_');
for(const sheet of sheetQueue){
 const card={sheet:sheet.ordinal,variant:sheet.variant,page:sheet.page,
  shotCount:sheet.shots.length,shotIds:sheet.shots.map(x=>x.panelId),
  requests:[],status:'READY_FOR_MANUAL_ONE_SHOT_AT_A_TIME_DISPATCH'};
 if(onlySheet!==null&&onlySheet!==sheet.ordinal){
  card.status='NOT_EXPORTED_BY_SHEET_FILTER';
  index.sheets.push(card);
  continue;
 }
 for(const shot of sheet.shots){
  const key=sheet.edition+'|'+sheet.gender+'|'+shot.panelId;
  const assignment=assignments.entries[key];
  if(!assignment||shot.castAssignment?.scriptText!==assignment.scriptText||
   shot.scriptText!==assignment.scriptText||shot.speaker!==assignment.speaker||
   shot.castAssignment?.foregroundActorId!==assignment.foregroundActorId||
   JSON.stringify(shot.castAssignment.visibleActorIds)!==JSON.stringify(assignment.visibleActorIds))
   throw Error('P0 cast/script mismatch '+key);
  if(shot.individualMinPixels[0]!==768||shot.individualMinPixels[1]!==320||
   shot.realCastImageBytesAttached!==false||shot.approval.approved!==false)
   throw Error('P0 mobile dimensions or preflight approval mismatch '+key);
  const imageInputs=shot.requiredCharacterReferences.map(ref=>{
   const file=path.join(root,ref.sourceImage);
   if(!fs.existsSync(file))throw Error('Missing physical master '+ref.actorId);
   const bytes=fs.readFileSync(file);
   if(bytes.length<32||bytes.toString('ascii',0,4)!=='RIFF'||
    bytes.toString('ascii',8,12)!=='WEBP')
    throw Error('Corrupt master image '+ref.actorId);
   const sha=digest(bytes);
   if(sha!==ref.sourceSha256)throw Error('Reference master hash drift '+ref.actorId);
   return {actorId:ref.actorId,path:ref.sourceImage,sha256:sha,
    bytesVerified:true,attachedToImageGenerator:false};
  });
  if(JSON.stringify(imageInputs.map(x=>x.actorId))!==JSON.stringify(assignment.visibleActorIds))
   throw Error('Master ordering / visible actor IDs mismatch '+key);
  if(assignment.renderMode==='ENVIRONMENT_ONLY'&&imageInputs.length!==0)
   throw Error('Forbidden cast in death-only environment '+key);
  if(assignment.renderMode!=='ENVIRONMENT_ONLY'&&imageInputs.length===0)
   throw Error('Missing cast images for character scene '+key);
  const id=shot.shotKey;
  // The ONLY screenplay text in the generated prompt is this panel's text.
  // Never include previous/next dialogue or a list of 25 scenes.
  const prompt=[
   'P0_ABSOLUTE_MUST_FOLLOW: GENERATE EXACTLY ONE SINGLE IMAGE OF ONE SCENE.',
   'P0_ONE_FRAME_ONLY: This instruction is one call for one image. No collage, no contact sheet, no storyboard, no grid, no multiple panels, no numbered tiles.',
   'Stage: c01-s02. Variant: '+sheet.edition+'. Protagonist gender: '+sheet.gender+'. Scene ID (metadata only): '+shot.panelId+'.',
   'SCRIPT FOR THIS SCENE ONLY (semantic guidance, DO NOT draw words): '+assignment.scriptText,
   'SPEAKER (do not draw a bubble): '+assignment.speaker,
   'SCENE GOAL: '+assignment.sceneGoal,
   'COMPOSITION: '+assignment.compositionHint,
   'FOREGROUND ACTOR: '+(assignment.foregroundActorId||'NONE — intentionally empty environment'),
   'SUPPORT ACTORS: '+(assignment.supportActorIds.join(', ')||'NONE'),
   'VISIBLE ACTORS, EXACT SET: '+(assignment.visibleActorIds.join(', ')||'NONE'),
   'MUST NOT APPEAR: '+assignment.mustNotAppearActorIds.join(', '),
   'PROTAGONIST STATE: '+assignment.protagonistState,
   'RENDER MODE: '+assignment.renderMode,
   'REFERENCE INPUTS, ACTUAL IMAGE BYTES REQUIRED BEFORE DISPATCH: '+
     (imageInputs.map(x=>x.actorId+' '+x.path+' sha256='+x.sha256).join('; ')||'No actors: environment-only approved exception'),
   'Generate cinematic high-quality anime/realistic RPG art with exact character identities, no extra persons and no gender swaps.',
   'Do NOT depict any other scene, outcome or timeline. No text, kana, kanji, latin letters, digits, UI, speech balloons, captions, logos, watermarks or map labels inside the picture.',
   'Landscape still. Preserve original source aspect. Genuine native minimum 768x320; prefer the largest real generator output. Never upscale low resolution.',
   'If physical reference image inputs were not attached, or the result is multiple frames, mark this shot REJECTED; do not register or deploy.'
  ].join('\n');
  const filename=safe(id)+'.single-shot';
  const relative=path.join('sheet-'+String(sheet.ordinal).padStart(2,'0'),filename+'.json');
  const abs=path.join(outDir,relative);
  fs.mkdirSync(path.dirname(abs),{recursive:true});
  const request={schemaVersion:1,kind:'SINGLE_PANEL_IMAGE_INSTRUCTION_NOT_RENDERED',
   imageCount:1,maxPanelsInImage:1,stageId,shotKey:id,
   panel:{id:shot.panelId,edition:sheet.edition,gender:sheet.gender,
    scriptText:assignment.scriptText,speaker:assignment.speaker,
    sceneGoal:assignment.sceneGoal,compositionHint:assignment.compositionHint,
    foregroundActorId:assignment.foregroundActorId,
    supportActorIds:assignment.supportActorIds,
    visibleActorIds:assignment.visibleActorIds,
    mustNotAppearActorIds:assignment.mustNotAppearActorIds,
    protagonistState:assignment.protagonistState,
    renderMode:assignment.renderMode},
   nativeMinPixels:[768,320],imageInputs,renderPrompt:prompt,
   outputWebP:shot.individualAsset,
   referenceBytesAttachedToRenderer:false,imageGenerated:false,
   humanApproved:false,registered:false,renderBlockedReason:'NO_IMAGE_GENERATOR_CONNECTED'};
  fs.writeFileSync(abs,JSON.stringify(request,null,2)+'\n');
  fs.writeFileSync(abs.replace(/\.json$/,'.prompt.txt'),prompt+'\n');
  card.requests.push({shotKey:id,promptFile:path.relative(root,abs).replace(/\.json$/,'.prompt.txt'),
   requestFile:path.relative(root,abs),outputWebP:shot.individualAsset});
 }
 index.sheets.push(card);
}
if(index.sheets.reduce((n,s)=>n+s.shotCount,0)!==25)
 throw Error('Slicer lost canonical shots');
fs.writeFileSync(path.join(outDir,'index.json'),JSON.stringify(index,null,2)+'\n');
process.stdout.write(JSON.stringify({stageId,shots:25,sheets:8,
 exportedShots:index.sheets.reduce((n,s)=>n+s.requests.length,0),
 sheetLimit:5,generationCallLimit:1,rendered:false,
 index:path.join(outRel,'index.json')})+'\n');
