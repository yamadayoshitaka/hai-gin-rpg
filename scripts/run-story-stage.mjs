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
const imageRules=contract.renderConstraints;
const sourceOutcomes=[];
for(const v of contract.variants){
 const key=v.edition+'|'+v.gender;
 const planned=byVariant.get(key);
 if(!planned||planned.panels!==v.count||planned.pageCount!==1)
  throw Error('Canonical screenplay differs from locked stage variant '+key);
 const page=planned.pages[0];
 if(JSON.stringify(page.panelIds)!==JSON.stringify(v.scriptPanelIds))
  throw Error('Canonical screenplay changed; update stage manifest before production '+key);
 if(JSON.stringify(page.posterSpec.minNativePixels)!==JSON.stringify(v.posterMinNativePixels))
  throw Error('Poster size mismatch '+key);
 const picturedBeats=page.panels.map(p=>({
  panelId:p.panelId,
  scriptText:p.scriptText,
  previous:p.narrative.previousScene?.scriptText||null,
  next:p.narrative.nextScene?.scriptText||null,
  sceneOutcome:p.narrative.verifiedOutcome,
  visibleActorIds:[p.characterId,p.secondaryId].filter(Boolean),
  realReferencePaths:p.requiredCharacterReferences.map(r=>r.sourceImage)
 }));
 const source=v.posterInput;
 const sourceExists=fs.existsSync(path.join(root,source));
 sourceOutcomes.push({variant:key,sourcePoster:source,sourcePresent:sourceExists,
  cropOnlyIfNativePixelsAtLeast:v.posterMinNativePixels,
  status:sourceExists?'SOURCE_READY_NEEDS_VERIFICATION':'MISSING_SOURCE_POSTER'});
 const noTextContract=[
  'IMAGE-ONLY INSTRUCTIONS. Make an unlettered cinematic fantasy comic illustration grid.',
  'This is NOT a poster, advertisement, infographic, storyboard printout, dashboard, report, game interface or formatted mock-up.',
  'Exactly TWO COLUMNS and '+Math.ceil(v.count/2)+' ROWS, '+v.count+
    ' sequential illustrated cells, read left-to-right and top-to-bottom.',
  'No panel numbers, text, Japanese characters, Latin characters, symbols, inscriptions, labels, logos, subtitles, headings, slogans, captions, arrows, speech balloons, watermarks or legible writing anywhere. Even books, scrolls, maps, flags and wax seals must have NO LEGIBLE TEXT.',
  'No top or bottom title bar, no colored metadata strip, no cards, no black caption blocks, no decorative labels, no extra drawings and no picture-in-picture.',
  'Each cell is a cinematic illustration, one exact screenplay beat only. Keep the scene and action distinct; avoid repeating portrait poses.',
  'All eight variant gender/outcome state rules are exclusive. This image is ONLY edition '+v.edition+' with '+v.gender+' protagonist. Never import a victory scene into a defeat/death branch.',
  'Each visible person must match their REAL uploaded reference image. Female commander is blonde with blue eyes and silver armor, male commander is dark-haired; Lucia is a DIFFERENT silver-haired regent, Garan an elderly knight, Iris the healer.',
  'Images are 16:9 INSIDE EACH CELL, each native-detail cell at least 1536x864 pixels. Entire sheet must be at least '+v.posterMinNativePixels.join('x')+' pixels. If not possible, return NO ART; do not return a miniature or rescaled mock-up.',
  'All labels, dialogue, timings and shot identifiers belong OUTSIDE the image in the accompanying JSON. Do not visualize this text.',
  'The following screenplay actions are instructions for ILLUSTRATION only, NOT text to print in the image:',
  ...picturedBeats.map((b,i)=>'Grid cell '+(i+1)+': '+b.scriptText+
   ' [continuity context before: '+(b.previous||'none')+
   '; after: '+(b.next||'none')+'; outcome: '+b.sceneOutcome+']'),
  'For an odd number of cells, final unused grid cell must remain a plain empty neutral cell. Do not invent an extra story event.'
 ].join('\n');
 page.stageBatch={
  stageId,variant:key,sourcePoster:source,expectedNativeSheet:v.posterMinNativePixels,
  strictPictorialOnlyPrompt:noTextContract,scriptBeats:picturedBeats,
  requiresImageReferenceBytes:true,
  inImageTextAllowed:false,
  bytesPresent:sourceExists,
  textAndNumberScan:'VISUAL_REVIEW_REQUIRED_NOT_AUTOMATED',
  approval:'NOT_APPROVED',
  rendererAttached:false,
  note:'Manifest text is metadata, not to be drawn into the artwork'
 };
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
fs.writeFileSync(path.join(root,manifestRel),JSON.stringify(compiled,null,2)+'\n');
const brief={
 stageId,kind:'SINGLE_STAGE_ARTWORK_INPUT_BRIEFS_NOT_RENDERED',
 complete:false,imageGeneratorConnected:false,
 literalCanvasTextProhibited:true,
 originalSceneCount:stage.requiredIndividualImages,
 variants:stage.variants.map(v=>({
  edition:v.edition,gender:v.gender,
  posterInput:v.pages[0].stageBatch.sourcePoster,
  requiredPosterPixels:v.pages[0].stageBatch.expectedNativeSheet,
  prompt:v.pages[0].stageBatch.strictPictorialOnlyPrompt,
  characterReferenceInputs:v.pages[0].panels.flatMap(p=>p.requiredCharacterReferences)
   .filter((r,i,a)=>a.findIndex(t=>t.actorId===r.actorId)===i)
  .map(r=>({actorId:r.actorId,path:r.sourceImage,exists:r.sourceExists,
    bytesAttachedToGenerator:false})),
  frameKeys:v.pages[0].panels.map(p=>p.shotKey)
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
