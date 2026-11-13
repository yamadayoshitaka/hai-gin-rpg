#!/usr/bin/env node
/**
 * Single-stage, no-additional-API-cost manga production batch.
 *
 * node scripts/run-story-stage.mjs --stage c01-s02
 *
 * One invocation reads the stage's canonical script, materializes every
 * gender/outcome storyboard with in-image text forbidden, and then:
 *  - if real high-resolution variant posters exist: crops actual WebP frames
 *    and exports side-by-side quality review packs, never auto-approves;
 *  - if posters are absent: emits an explicit MISSING_SOURCE_POSTER report.
 *
 * This is NOT an image generator. No art/approval/deployment is fabricated.
 */
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const stageAt=process.argv.indexOf('--stage');
const stageId=stageAt>=0?process.argv[stageAt+1]:null;
const prepareOnly=process.argv.includes('--prepare-only');
if(!/^c\d{2}-s\d{2}$/.test(stageId||'')){
 console.error('Usage: node scripts/run-story-stage.mjs --stage c01-s02 [--prepare-only]');
 process.exit(2);
}
const sourceContractPath='assets/story/stage-manifests/'+stageId+'.manifest.json';
const sourcePath=path.join(root,sourceContractPath);
if(!fs.existsSync(sourcePath))
 throw Error('Stage-specific contract missing: '+sourceContractPath+
  '. Never silently fall back to a generic, unlabelled plan.');
const contract=JSON.parse(fs.readFileSync(sourcePath,'utf8'));
if(contract.kind!=='STAGE_RENDER_CONTRACT_NOT_COMPLETED_ART'||
 contract.stageId!==stageId||contract.schemaVersion!==4)
 throw Error('Stage-specific render contract has an incompatible schema');
const runRel='qa-reports/story-stage-production/batches/'+stageId;
const manifestRel=runRel+'/stage-manifest.json';
const outputDir=path.join(root,runRel);
fs.mkdirSync(outputDir,{recursive:true});
function run(command,args){
 const proc=spawnSync(command,args,{cwd:root,encoding:'utf8',maxBuffer:10*1024*1024});
 if(proc.stdout)process.stdout.write(proc.stdout);
 if(proc.stderr)process.stderr.write(proc.stderr);
 if(proc.error||proc.status!==0)
  throw Error('Production command failed: '+command+' '+args.join(' ')+
   ' exit='+String(proc.status)+' error='+String(proc.error||''));
}
run(process.execPath,['scripts/prepare-story-stage-posters.mjs',
 '--start',stageId,'--count','1','--out',manifestRel]);
const compiled=JSON.parse(fs.readFileSync(path.join(root,manifestRel),'utf8'));
const stage=compiled.stages[0];
if(compiled.stages.length!==1||stage.stageId!==stageId)
 throw Error('A stage batch must contain exactly the requested stage');
const byVariant=new Map(stage.variants.map(v=>[v.edition+'|'+v.gender,v]));
if(contract.variants.length!==byVariant.size)
 throw Error('Canonical script changed: variant count differs from stage manifest');
const mobileMin=stageId==='c01-s02'?[768,320]:[1536,864];
if(JSON.stringify(contract.layout.minPerPanelNativePixels)!==JSON.stringify(mobileMin))
 throw Error('Selected stage minimum must match mobile native profile');
const imageRules=contract.renderConstraints;
const nativeSheet=contract.layout.nativeSheetPipeline;
const maxReviewCells=stageId==='c01-s02'?5:10;
if(!nativeSheet||nativeSheet.maximumFramesPerSheet!==maxReviewCells||
 contract.layout.maxRows!==(maxReviewCells===5?3:5)||
 contract.layout.maxPanelsPerPoster!==maxReviewCells||
 JSON.stringify(nativeSheet.preferredCellPixels)!==JSON.stringify([2048,1152])||
 JSON.stringify(maxReviewCells===5?nativeSheet.preferredFullFivePanelSheetPixels:
  nativeSheet.preferredFullTenPanelSheetPixels)!==JSON.stringify(maxReviewCells===5?[4096,3456]:[4096,5760])||
 (maxReviewCells===5?nativeSheet.originalGeneratorSupports4096x3456:
  nativeSheet.originalGeneratorSupports4096x5760)!=='UNVERIFIED_DO_NOT_ASSUME'||
 nativeSheet.mode!=='INDIVIDUAL_NATIVE_FRAMES_FIRST_THEN_LOSSLESS_REVIEW_SHEET')
 throw Error('P0 requires at most five native frames per review sheet');
const priority=contract.criticalPriorityPolicy;
if(!priority||priority.priority!=='P0_ABSOLUTE_MUST_FOLLOW'||
 !priority.failClosed||!priority.mandatoryAtPromptStart||
 !priority.mandatoryAtVariantPosterStart)
 throw Error('P0 absolute image quality contract missing or weakened');
const priorityFile=path.join(root,priority.rulesPath);
if(!fs.existsSync(priorityFile))throw Error('P0 policy file is absent');
const policy=JSON.parse(fs.readFileSync(priorityFile,'utf8'));
if(policy.priority!=='P0_ABSOLUTE_MUST_FOLLOW'||!policy.failClosed||
 !policy.referenceRule.actualBytesMustBeAttached||
 policy.imageRule.textAllowed!==false)
 throw Error('P0 policy is missing required rules');
for(const variant of stage.variants)for(const page of variant.pages)for(const shot of page.panels){
 if(!shot.generationPrompt.startsWith('P0_ABSOLUTE_MUST_FOLLOW.')||
  shot.absolutePriority!=='P0_ABSOLUTE_MUST_FOLLOW'||
  shot.realCastImageBytesAttached!==false||shot.renderReady!==false||
  !shot.generationPrompt.includes('P0_NO_TEXT_UI_IN_ART')||
  !shot.generationPrompt.includes('P0_REFERENCE_IMAGE_BYTES')||
  !shot.generationPrompt.includes(shot.scriptText))
  throw Error('Unsafe/missing absolute P0 per-shot instructions '+shot.shotKey);
}

const sourceOutcomes=[];
for(const v of contract.variants){
 const key=v.edition+'|'+v.gender;
 const planned=byVariant.get(key);
 const sheets=v.reviewSheets||[{page:1,posterInput:v.posterInput,
  panelIds:v.scriptPanelIds,posterMinNativePixels:v.posterMinNativePixels,
  posterPreferredNativePixels:v.posterPreferredNativePixels}];
 if(!planned||planned.panels!==v.count||planned.pageCount!==sheets.length)
  throw Error('Canonical screenplay differs from stage review sheets '+key);
 for(let i=0;i<sheets.length;i++){
  const sheet=sheets[i],page=planned.pages[i];
  if(!page||page.panels.length>maxReviewCells||page.panels.length<1||
   JSON.stringify(page.panelIds)!==JSON.stringify(sheet.panelIds)||
   JSON.stringify(page.posterSpec.minNativePixels)!==JSON.stringify(sheet.posterMinNativePixels)||
   JSON.stringify(page.posterSpec.preferredNativePixels)!==JSON.stringify(sheet.posterPreferredNativePixels)||
   page.posterSpec.maxCellCount!==maxReviewCells||
   page.posterSpec.assemblyMode!==nativeSheet.mode||
   page.posterSpec.blankCells!==Math.ceil(page.panels.length/2)*2-page.panels.length)
   throw Error('P0 five-cell geometry or canonical shot sequence mismatch '+key+' p'+(i+1));
  if(page.panels.some(p=>p.realCastImageBytesAttached!==false||p.approval.approved!==false))
   throw Error('Stage preflight must never falsely approve artwork '+key);
  const source=sheet.posterInput;
  const sourceExists=fs.existsSync(path.join(root,source));
  const beats=page.panels.map(p=>({
   panelId:p.panelId,scriptText:p.scriptText,
   previous:p.narrative.previousScene?.scriptText||null,
   next:p.narrative.nextScene?.scriptText||null,
   sceneOutcome:p.narrative.verifiedOutcome,
   visibleActorIds:[p.characterId,p.secondaryId].filter(Boolean),
   realReferencePaths:p.requiredCharacterReferences.map(r=>r.sourceImage)
  }));
  const noTextContract=[
   'P0_ABSOLUTE_MUST_FOLLOW. No text, digits, Japanese characters, subtitles, speech balloons, logos, symbols, watermarks or UI in ANY IMAGE.',
   'P0_SHEET_SCENE_LIMIT: Exactly '+page.panels.length+' independently authored frames on this review sheet; never more than '+maxReviewCells+'.',
   stageId==='c01-s02'?
    'P0_MOBILE_NATIVE_MINIMUM: each true source cut is at least 768x320 (width/height minimum); preserve source aspect ratio, do not enlarge; higher original resolution is welcome but 1536x864 is NOT required.':
    'P0_HIGHEST_NATIVE_RESOLUTION: independently generate each 16:9 frame at highest genuine native resolution supported, prefer 2048x1152, never upscale; minimum 1536x864.',
   'P0_REFERENCE_IMAGE_BYTES: actual original cast master image bytes MUST be attached to image renderer; paths alone do not count.',
   'P0_CANONICAL_SCENE_AND_OUTCOME: each frame depicts its own exact screenplay beat, verified branch and gender only; no character swapping or reuse.',
   'P0_FAIL_CLOSED: missing true native detail, actual cast bytes, clean textless output or manual visual verification means REJECT, NO REGISTRATION, NO DEPLOY.',
   'STAGE '+stageId+'; EDITION '+v.edition+'; GENDER '+v.gender+'. Metadata below is NOT image text.',
   ...beats.map((b,j)=>'Frame '+(j+1)+' scene '+b.panelId+': '+b.scriptText+
    ' [preceding: '+(b.previous||'none')+'; following: '+(b.next||'none')+
    '; outcome: '+b.sceneOutcome+']')
  ].join('\n');
  page.textFreePrompt=noTextContract;
  page.stageBatch={
   stageId,variant:key,sourcePoster:source,
   expectedNativeSheet:sheet.posterMinNativePixels,
   preferredNativeSheet:sheet.posterPreferredNativePixels,
   strictPictorialOnlyPrompt:noTextContract,scriptBeats:beats,
   assemblyMode:nativeSheet.mode,
   reviewOnlyAssemblyCommand:'python scripts/assemble-story-panel-sheet.py --manifest '+manifestRel+
    ' --stage '+stageId+' --edition '+v.edition+' --gender '+v.gender,
   nativeSourcesMustExistBeforeAssembly:true,requiresImageReferenceBytes:true,
   absolutePriority:'P0_ABSOLUTE_MUST_FOLLOW',failClosedOnMissingRealCastBytes:true,
   visualQualityRequiresHumanApproval:true,inImageTextAllowed:false,
   bytesPresent:sourceExists,approval:'NOT_APPROVED',rendererAttached:false
  };
  sourceOutcomes.push({variant:key,page:i+1,sourcePoster:source,sourcePresent:sourceExists,
   cropOnlyIfNativePixelsAtLeast:sheet.posterMinNativePixels,
   status:sourceExists?'SOURCE_READY_NEEDS_VERIFICATION':'MISSING_SOURCE_POSTER'});
 }
}
compiled.stageContract=sourceContractPath;
compiled.singleStageBatch=true;
compiled.imageGeneratorConnected=false;
compiled.noPaidAPICalls=true;
compiled.stageManifestLocked=true;
compiled.qualityApproved=false;
compiled.deployed=false;
compiled.sourcePosters=sourceOutcomes;
compiled.renderConstraints=imageRules;
compiled.nativeReviewSheetContract=nativeSheet;
compiled.criticalPriorityPolicy=priority;
compiled.p0CompliantPromptsReady=true;
compiled.generationBlockedUntilReferenceImagesActuallyAttached=true;
fs.writeFileSync(path.join(root,manifestRel),JSON.stringify(compiled,null,2)+'\n');
const brief={
 stageId,kind:'SINGLE_STAGE_ARTWORK_INPUT_BRIEFS_NOT_RENDERED',
 absolutePriority:'P0_ABSOLUTE_MUST_FOLLOW',
 allGenerationBlockedUntilActualImageBytesAttached:true,
 complete:false,imageGeneratorConnected:false,literalCanvasTextProhibited:true,
 maxScenesPerSheet:maxReviewCells,originalSceneCount:stage.requiredIndividualImages,
 variants:stage.variants.map(v=>({
  edition:v.edition,gender:v.gender,
  reviewSheets:v.pages.map(page=>({
   page:page.page,posterInput:page.stageBatch.sourcePoster,
   requiredPosterPixels:page.stageBatch.expectedNativeSheet,
   preferredPosterPixels:page.stageBatch.preferredNativeSheet,
   prompt:page.stageBatch.strictPictorialOnlyPrompt,
   frameKeys:page.panels.map(p=>p.shotKey)
  })),
  characterReferenceInputs:v.pages.flatMap(p=>p.panels).flatMap(p=>p.requiredCharacterReferences)
   .filter((r,i,a)=>a.findIndex(t=>t.actorId===r.actorId)===i)
   .map(r=>({actorId:r.actorId,path:r.sourceImage,exists:r.sourceExists,
    bytesAttachedToGenerator:false}))
 }))
};
fs.writeFileSync(path.join(root,runRel+'/render-briefs.json'),JSON.stringify(brief,null,2)+'\n');
if(!prepareOnly){
 run('python3',['scripts/ingest-story-stage-posters.py',
  '--manifest-dir',runRel,
  '--out-root',runRel+'/review-packs']);
}
const reviewPath=path.join(outputDir,'ingestion-review-status.json');
const review=!prepareOnly&&fs.existsSync(reviewPath)?
 JSON.parse(fs.readFileSync(reviewPath,'utf8')):null;
const summary={
 stageId,oneInvocationOneStage:true,requiredVariantPosters:contract.variants.length,
 reviewSheetPreferredPixels:maxReviewCells===5?nativeSheet.preferredFullFivePanelSheetPixels:
  nativeSheet.preferredFullTenPanelSheetPixels,
 reviewSheetCompositionMode:nativeSheet.mode,
 maxScenesPerReviewSheet:maxReviewCells,
 generatorSupportsDirectFullResolution:'UNVERIFIED',
 p0Priority:'P0_ABSOLUTE_MUST_FOLLOW',
 p0NotRenderedWithoutActualCastBytes:true,
 requiredPanels:stage.requiredIndividualImages,
 alreadyRegisteredUnapproved:stage.alreadyRegisteredDraftImages,
 missingCanonicalArtwork:stage.missingIndividualImages,
 sourcePosterPresent:sourceOutcomes.filter(x=>x.sourcePresent).length,
 sourcePosterMissing:sourceOutcomes.filter(x=>!x.sourcePresent).length,
 postersProcessedIntoUnapprovedReviewPacks:review?.postersProcessed||0,
 renderStatus:prepareOnly?'PREPARED_ONLY':
  !review?.postersProcessed?'WAITING_FOR_REAL_IMAGE_INPUTS':'REVIEW_REQUIRED',
 stageApproved:false,gameDeployed:false,imageGeneratorConnected:false,
 noAdditionalPaidImageAPICalls:true,
 manifest:manifestRel,renderBriefs:runRel+'/render-briefs.json',
 reviewStatus:review?'ingestion-review-status.json':null
};
fs.writeFileSync(path.join(outputDir,'batch-summary.json'),JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify(summary));
