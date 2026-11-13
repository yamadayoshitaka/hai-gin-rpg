#!/usr/bin/env node
/**
 * Per-shot, screenplay-following free preflight. This outputs an actionable
 * sequential shot brief with exact image dimensions, canonical outcome,
 * preceding and following story beats, character references, and reading text.
 * It NEVER renders, approves, or deploys images.
 *
 * node scripts/prepare-story-stage-posters.mjs --start c01-s02 --count 2
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {CAMPAIGN_STAGES,CAMPAIGN_STAGE_BY_ID} from '../src/campaign-stage-plan.js';
import {comicEditionsForStage,comicForStage} from '../src/story-chapter-comic.js';
import {storyDecisionForStage,ROUTES,ENDING_GUIDE} from '../src/story-narrative-flow.js';
import {STORY_STAGE_BEATS} from '../src/story-stage-beats-v2.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const ABSOLUTE_P0=JSON.parse(fs.readFileSync(path.join(root,
 'assets/story/quality/artwork-p0-rules.json'),'utf8'));
if(ABSOLUTE_P0.priority!=='P0_ABSOLUTE_MUST_FOLLOW'||!ABSOLUTE_P0.failClosed)
 throw Error('Critical story artwork P0 quality contract is missing or weakened');
function p0PromptLines(stageId){
 return [
  'P0_ABSOLUTE_MUST_FOLLOW. HARD REQUIREMENTS. Any violation = REJECTED, NOT READY, NO PUBLICATION.',
  'P0_REFERENCE_IMAGE_BYTES: supply actual bytes of the exact named protagonist and all depicted cast references as image inputs BEFORE rendering. Filenames/paths or text descriptions DO NOT count as attachments.',
  'P0_NO_TEXT_UI_IN_ART: generate PURE SCENE ART ONLY. ABSOLUTELY NO kanji, hiragana, katakana, letters, digits, scene/frame numbers, speech balloons, text captions, dialogue, rubies, readable marks, interface/HUD/buttons, mock game screens, titles, logos, signatures or watermarks.',
  'P0_EXACT_CANONICAL_SCENE: depict only the currently specified screenplay beat. Previous/next beats are reference context ONLY. Do not depict future success, fake a scene, add characters, or invent a new objective.',
  'P0_CAST_AND_BRANCH: lock every face, hair, eyes, armor and outfit to uploaded master images. Female commander is long blonde-haired, blue-eyed, silver-armored, distinct from silver-haired Lucia. Male commander has dark hair. Do NOT blend cast or swap editions and outcomes.',
  stageId==='c01-s02'?
   'P0_NATIVE_AND_QA: mobile-native minimum 768x320 actual source pixels (width >=768, height >=320), PRESERVE original aspect ratio in viewer, never upscale. Prefer largest genuinely available source (2048x1152 only a preference, NOT a minimum). At most FIVE scenes per sheet. Keep critical details 5% inside edges.':
   'P0_NATIVE_AND_QA: legacy non-stage2 native minimum 1536x864 with 16:9 aspect, prefer 2048x1152; no upscaling.' ,
  'P0_FAIL_CLOSED: if any required image bytes are missing or any constraint cannot be verified, mark BLOCKED/REJECTED. NEVER treat the result as approved, registered or deployed.',
  'All scene IDs, Japanese screenplay text, spoken dialogue, VOICEVOX readings and production metadata supplied below are INVISIBLE INSTRUCTIONS ONLY, never pixels.'
 ];
}
const args=process.argv.slice(2);
function argValue(name,fallback){
 const pos=args.indexOf(name);
 return pos<0?fallback:args[pos+1];
}
const start=argValue('--start','c01-s02');
const count=Number(argValue('--count','2'));
if(!CAMPAIGN_STAGE_BY_ID[start]||!Number.isInteger(count)||count<1||count>10)
 throw Error('Usage: --start c01-s02 --count 1..10 (registered stage ID)');
const index=CAMPAIGN_STAGES.findIndex(s=>s.id===start);
const stages=CAMPAIGN_STAGES.slice(index,index+count);
if(stages.length!==count)throw Error('Requested stages exceed campaign');

const genders=['male','female'];
const existingMaleS02=Object.freeze({
 pre:['m01','m02','m03','m04','m05','m11','m13','m15'],
 'post-victory':['m06','m07','m08','m09','m16','m19','m10']
});
const imageSpec=Object.freeze({
 intendedUse:'one fully illustrated gameplay comic shot',
 aspectRatio:'16:9',pixelWidth:1536,pixelHeight:864,
 minimumNativePixels:[1536,864],preferredNativePixels:[2048,1152],
 safeCompositionMarginPercent:5,
 maxCellsPerReviewSheet:10,stage2MaxCellsPerReviewSheet:5,preferredReviewSheetColumns:2,
 nativeSheetPolicy:'INDIVIDUAL_FIRST_2048x1152_NATIVE_WEBP_THEN_LOSSLESS_ASSEMBLY',
 fullTenCellPreferredPixels:[4096,5760],
 fullTenCellGeneratorCapability:'UNVERIFIED_DO_NOT_ASSUME',
 fullFiveCellPreferredPixels:[4096,3456],
 fullFiveCellGeneratorCapability:'UNVERIFIED_DO_NOT_ASSUME',
 format:'webp',textInsideArt:false,numberInsideArt:false,
 noFakeUpscale:true,
 visualReviewRequired:true
});
const mobileProfile=ABSOLUTE_P0.technicalRule.mobileDeliveryProfile;
if(JSON.stringify(mobileProfile.minimumNativePixels)!==JSON.stringify([768,320]))
 throw Error('Mobile 768x320 native delivery profile missing');
const mobileImageSpec=Object.freeze({...imageSpec,
 aspectRatio:'PRESERVE_SOURCE_ASPECT',aspectRatioPolicy:mobileProfile.ratioPolicy,
 pixelWidth:768,pixelHeight:320,minimumNativePixels:[768,320],
 preferredNativePixels:[2048,1152],mobileNativeProfile:mobileProfile.profileId,
 maxCellsPerReviewSheet:5,acceptSourcePixelsWithoutUpscale:true});
const qualityReference=Object.freeze({
 male:{path:'assets/story/chapters/c01/panels/c01-s01-m02-male.webp',
  status:'PROVISIONAL_STAGE1_REFERENCE_NOT_HUMAN_APPROVED'},
 female:{path:'assets/story/chapters/c01/panels/c01-s01-m02-female.webp',
  status:'PROVISIONAL_STAGE1_REFERENCE_NOT_HUMAN_APPROVED'}
});
function present(p){return fs.existsSync(path.join(root,p));}
function normalizePanelId(id,stageId){
 const suffix=id.slice(stageId.length+1);
 const match=/^m([0-9]{1,2})$/.exec(suffix);
 return match?stageId+'-m'+String(Number(match[1])).padStart(2,'0'):id;
}
function artPath(stageId,edition,gender,panelId){
 const normalized=normalizePanelId(panelId,stageId);
 const suffix=normalized.slice(stageId.length+1);
 const legacy=stageId==='c01-s02'&&gender==='male'&&existingMaleS02[edition]?.includes(suffix);
 const name=legacy?normalized+'-'+gender+'.webp':normalized+'-'+edition+'-'+gender+'.webp';
 return 'assets/story/chapters/'+stageId.slice(0,3)+'/panels/'+name;
}
function posterPath(stageId,edition,gender,page){
 return 'assets/story/chapters/'+stageId.slice(0,3)+'/'+stageId+'-'+edition+'-'+gender+
  '-p'+String(page).padStart(2,'0')+'.webp';
}
function editionContext(stage,edition,gender){
 const result={protagonistGender:gender};
 if(edition.edition.startsWith('post-victory'))
  result.battleOutcome={victory:true};
 else if(edition.edition.startsWith('post-defeat'))
  result.battleOutcome={victory:false};
 else if(edition.edition.startsWith('post-gameover'))
  result.battleOutcome={victory:false,playerCommanderDead:true};
 const choice=storyDecisionForStage(stage.id)?.choices.find(([id])=>
  edition.edition.includes('-choice-'+id));
 if(choice)result.decision=choice[0];
 const route=ROUTES.find(r=>edition.edition.includes('-route-'+r.id));
 if(route)result.route=route.id;
 const ending=ENDING_GUIDE.find(e=>edition.edition.includes('-ending-'+e.id));
 if(ending)result.storyEnding=ending.id;
 return result;
}
function getCastBible(stageId){
 const p=path.join(root,'assets/story/characters',stageId+'-reference-bible.json');
 if(!fs.existsSync(p))return null;
 const bible=JSON.parse(fs.readFileSync(p,'utf8'));
 if(bible.stageId!==stageId)throw Error('Character-reference stage mismatch '+stageId);
 return bible;
}
function actorReference(stageId,actorId,bible){
 if(!actorId)return null;
 const found=bible?.actors?.find(actor=>actor.id===actorId);
 const candidate=found?.path||('assets/story-cinema/cast/'+actorId+'.webp');
 return {actorId,sourceImage: candidate,
  sourceExists:present(candidate),sourceGrade:found?.masterQuality||'CROPPED_CAST_REFERENCE_PROVISIONAL',
  requiresActualImageBytes:true,attachmentStatus:'NOT_ATTACHED_BY_PREFLIGHT',
  sourceRule:found?.visualRule||null};
}
function outcomePolicy(edition,verifiedVictoryBeat){
 if(edition==='pre'||edition.startsWith('pre-'))
  return 'PRE_BATTLE_NO_RESULT: do not show victory, defeat, casualty totals or an unlocked next stage';
 if(edition.startsWith('post-victory'))
  return 'VERIFIED_VICTORY: the objective is achieved; '+verifiedVictoryBeat;
 if(edition.startsWith('post-defeat'))
  return 'VERIFIED_DEFEAT: objective NOT achieved; show retreat, never a victorious aftermath';
 if(edition.startsWith('post-gameover'))
  return 'COMMANDER_DEATH: protagonist dies, no return, survival or triumphant ending';
 if(edition.startsWith('post-town'))
  return 'TOWN_POST: prepare for the next stage, do not invent a battle';
 return 'STRICT_EDITION_OUTCOME: only use facts actually in this edition';
}
function sceneInfo(panel,stageId,edition,gender){
 if(!panel)return null;
 return {panelId:panel.id,shotKey:[stageId,edition,gender,panel.id].join('|'),
  scriptText:panel.subtitleText||panel.text,
  speaker:panel.speaker||'語り手',
  kind:panel.kind||null,
  characterId:panel.characterId||null,secondaryId:panel.secondaryId||null,
  expression:panel.expression||null,scenery:panel.scenery||null};
}
function shotGenerationPrompt(context){
 const before=context.previousScene?.scriptText||'No preceding shot in this edition';
 const after=context.nextScene?.scriptText||'No following shot in this edition';
 const hero=context.gender==='female'?
  'female strategist: LONG BLONDE HAIR, BLUE EYES, SILVER ARMOR; she is distinct from Lucia':
  'male strategist: DARK HAIR, distinguished from Garan';
 return [
  ...p0PromptLines(context.stageId),
  'Produce exactly ONE independent original fantasy RPG cinematic story illustration.',
  context.stageId==='c01-s02'?
   'CANVAS: smartphone native source >=768px wide and >=320px high; preserve the original source aspect ratio in the 740px manga viewer; prefer the highest supported original image dimensions; no upscale; save WebP.':
   'CANVAS: landscape 16:9; native detail at 1536x864 pixels minimum, prefer 2048x1152; save WebP.',
  'SAFE COMPOSITION: preserve critical faces/hands/objects at least 5% inside every edge.',
  'SHOOT: '+context.shotKey+'. Chapter/stage: '+context.stageName+'.',
  'CANONICAL STAGE SETUP: '+context.stageSetup,
  'GAMEPLAY OBJECTIVE: '+context.victoryCondition,
  'OUTCOME STATE (MUST NOT CONTRADICT): '+context.outcomeRule,
  'CURRENT EXACT SCREENPLAY BEAT: '+context.currentScene.scriptText,
  'SPEAKER (may be off-screen): '+context.currentScene.speaker,
  'CURRENT CHARACTER IDS (do not assume extras): '+[context.currentScene.characterId,context.currentScene.secondaryId].filter(Boolean).join(', '),
  'PREVIOUS SCENE for continuity ONLY (never substitute it for current action): '+before,
  'NEXT SCENE for continuity ONLY (do not spoil or depict it yet): '+after,
  'CURRENT ACTION AND PROPS: visually express the CURRENT screenplay beat; choose camera angle, posture, setting, light, evidence, and emotional expression appropriate to THIS beat, not a generic heroic pose.',
  'CHARACTER LOCK: '+hero+'. Lucia is the SILVER-HAIRED regent, Garan an aged knight, Iris a healer; keep cast faces/clothing consistent.',
  'REAL IMAGE REFERENCES: attach the original bytes of the required cast masters and latest accepted predecessor image. A written file path alone is NOT an image input.',
  'MATCH OR EXCEED the first-stage approved-looking style while treating stage-1 samples as provisional until a reviewer approves them.',
  'NO text, Japanese letters, numbers, frame number, captions, dialogue, ruby, title, speech bubble, infographic, poster headline, UI, logos, signature or watermark INSIDE THE IMAGE.',
  'DO NOT swap genders, blend characters, combine multiple beats into a montage or reuse victory/defeat/death imagery.',
  'If the actual reference image bytes cannot be attached, mark the shot NOT READY; do not claim a cast match.',
  'P0_FINAL_DOUBLE_CHECK: NO TEXT / NO UI / MATCH ACTUAL MASTER IMAGES / CURRENT SCRIPT BEAT ONLY / REJECT IF UNSURE.'
 ].join('\n');
}
const results=[];
for(const stage of stages){
 const [setup,victoryBeat]=STORY_STAGE_BEATS[stage.chapter-1][stage.slot-1];
 const bible=getCastBible(stage.id);
 const maxReviewCells=stage.id==='c01-s02'?5:10;
 const stageImageSpec=stage.id==='c01-s02'?mobileImageSpec:imageSpec;
 const variants=[];
 for(const edition of comicEditionsForStage(stage.id)){
  for(const gender of genders){
   const context=editionContext(stage,edition,gender);
   const genderEdition=comicForStage(stage.id,edition.phase,context);
   if(genderEdition.edition!==edition.edition)
    throw Error('Gender-specific edition mismatch: '+stage.id+' '+edition.edition+' '+genderEdition.edition);
   const canonical=genderEdition.panels;
   const outcomeRule=outcomePolicy(edition.edition,victoryBeat);
   const pages=Array.from({length:Math.ceil(canonical.length/maxReviewCells)},(_,pageIndex)=>{
    const page={number:pageIndex+1};
    const panelData=canonical.slice(pageIndex*maxReviewCells,(pageIndex+1)*maxReviewCells);
    const reference=qualityReference[gender];
    const panels=panelData.map((shot,position)=>{
     const order=canonical.indexOf(shot);
     const previous=sceneInfo(canonical[order-1],stage.id,edition.edition,gender);
     const next=sceneInfo(canonical[order+1],stage.id,edition.edition,gender);
     const current=sceneInfo(shot,stage.id,edition.edition,gender);
     const individualAsset=artPath(stage.id,edition.edition,gender,shot.id);
     const alreadyPresent=present(individualAsset);
     const maleSource=gender==='female'&&stage.id==='c01-s02'?
      artPath(stage.id,edition.edition,'male',shot.id):null;
     const protagonistId=gender==='female'?'commander_female':'commander_male';
     // The protagonist is a continuity reference, not a mandatory visible extra.
     const castIds=[protagonistId,shot.characterId,shot.secondaryId].filter(Boolean);
     const castReferences=[...new Set(castIds)].map(id=>actorReference(stage.id,id,bible));
     const previousAsset=previous?artPath(stage.id,edition.edition,gender,previous.panelId):null;
     const shotContext={
      shotKey:current.shotKey,gender,stageId:stage.id,stageName:stage.name,stageSetup:setup,
      victoryCondition:stage.winCondition,outcomeRule,currentScene:current,
      previousScene:previous,nextScene:next
     };
     const canConsiderReuse=Boolean(maleSource&&present(maleSource));
     return {
      panelId:shot.id,shotKey:current.shotKey,
      order:position+1,globalOrder:order+1,
      cell:[position%2,Math.floor(position/2)],
      scriptText:current.scriptText,voiceText:shot.voiceText||'',
      speaker:current.speaker,rubyTokens:shot.rubyTokens||[],
      characterId:current.characterId,secondaryId:current.secondaryId,
      role:shot.role||null,kind:current.kind,expression:current.expression,
      setting:current.scenery||stage.name,
      narrative:{stageSetup:setup,winCondition:stage.winCondition,
       verifiedOutcome:outcomeRule,currentScene:current,previousScene:previous,nextScene:next,
       precedingApprovedImage:previousAsset,
       precedingApprovedImageExists:previousAsset?present(previousAsset):false},
      imageSpec:{...stageImageSpec},
      generationPrompt:shotGenerationPrompt(shotContext),
      absolutePriority:'P0_ABSOLUTE_MUST_FOLLOW',
      absolutePriorityPolicy:'assets/story/quality/artwork-p0-rules.json',
      requiredCharacterReferences:castReferences,
      realCastImageBytesAttached:false,
      renderReady:false,
      renderBlockedReason:'REAL_REFERENCE_IMAGE_BYTES_NOT_ATTACHED_BY_PREFLIGHT',
      attachmentGate:'ATTACH_REAL_IMAGE_BYTES_BEFORE_GENERATION',
      individualAsset,sourcePoster:posterPath(stage.id,edition.edition,gender,page.number),
      individualMinPixels:[stageImageSpec.pixelWidth,stageImageSpec.pixelHeight],
      qualityReferenceImage:reference.path,qualityReferenceStatus:reference.status,
      status:alreadyPresent?'AI_DRAFT_UNAPPROVED':'MISSING',
      manualReviewRequired:true,
      reuseCandidate:canConsiderReuse?{
       sourceAsset:maleSource,decision:'VISUAL_REVIEW_REQUIRED_NOT_AUTOMATIC',
       acceptanceCondition:'Only if the hero is NOT visible and same cast, stage, beat, time and outcome; record the source SHA256'
      }:null,
      requiredChecks:['p0PolicyPresent','failClosedOnMissingActualImageBytes',
       'rejectAnyInImageTextOrUI','rejectAnyUnmatchedCastIdentity',
       'sceneMatchesExactScript','previousAndNextContinuity','fixedCastIdentity',
       'realCastImagesAttached','genderCorrect','outcomeCorrect','noTextNumbersLogosOrUI',
       'sameStyleAsStage1','realNativeDetail','sharpFacesAndHands','safeArea5Percent',
       stage.id==='c01-s02'?'preserveSourceAspectNoUpscale':'full16by9',
       'verifiedWebP','manualQualityReview','outputSha256Recorded'],
      approval:{approved:false,reviewer:null,referenceSha256:null,artSha256:null}
     };
    });
    const rows=Math.ceil(panels.length/2);
    return {
     page:page.number,posterAsset:posterPath(stage.id,edition.edition,gender,page.number),
     posterStatus:present(posterPath(stage.id,edition.edition,gender,page.number))?
      'AI_DRAFT_UNAPPROVED':'MISSING',
     posterSpec:{columns:2,rows,cellCount:panels.length,
      maxCellCount:maxReviewCells,blankCells:rows*2-panels.length,
      minNativePixels:[2*stageImageSpec.pixelWidth,rows*stageImageSpec.pixelHeight],
      preferredNativePixels:[2*stageImageSpec.preferredNativePixels[0],rows*stageImageSpec.preferredNativePixels[1]],
      assemblyMode:'INDIVIDUAL_NATIVE_FRAMES_FIRST_THEN_LOSSLESS_REVIEW_SHEET',
      nativeDetailProof:'SOURCE_WEBP_NATIVE_PIXELS_REQUIRED_NOT_UPSCALED',
      assemblyScript:'scripts/assemble-story-panel-sheet.py',
      textlessArtOnly:true,
      reviewOnlyNotGameArtwork:true,
      previewMayBeLowResolution:true,
      previewCannotBeRegisteredAsFinalArt:true,
      finalPosterAssembly:'Assemble ONLY from independently rendered native-detail shots, no resizing: at most '+maxReviewCells+' frames, 2048x1152 each, 2 columns; direct generator sheet max unverified',
      displayRule:stage.id==='c01-s02'?'Make each scene as a genuine original >=768x320 mobile-native WebP; preserve original aspect, no enlarging; review sheet at most 5 scenes':
       'First show a labelled storyboard OUTSIDE the art; then render EACH exact screenplay shot individually at >=1536x864; finally assemble 2-column review poster'},
     panelIds:panels.map(p=>p.panelId),
     textFreePrompt:'CONTINUITY PREVIEW ONLY, not final artwork. Stage '+stage.id+', edition '+
       edition.edition+', protagonist '+gender+'. Layout '+panels.length+
       ' screenplay beats in 2 columns left-right top-bottom. No in-image letters, captions, numbers, UI or poster headings. Stage setup: '+
       setup+'. Result rule: '+outcomeRule+'. Draw these beats in order: '+
       panels.map(p=>p.globalOrder+') '+p.scriptText).join(' / '),
     panels};
   });
   variants.push({stageId:stage.id,edition:edition.edition,phase:edition.phase,gender,
    storyline:stage.storyBeat,stageName:stage.name,winCondition:stage.winCondition,
    setup,victoryBeat:edition.edition.startsWith('post-victory')?victoryBeat:null,
    pageCount:pages.length,panels:canonical.length,pages});
  }
 }
 const n=variants.reduce((a,v)=>a+v.pages.reduce((b,p)=>b+p.panels.length,0),0);
 const existing=variants.reduce((a,v)=>a+v.pages.reduce((b,p)=>
  b+p.panels.filter(x=>x.status!=='MISSING').length,0),0);
 results.push({stageId:stage.id,stageName:stage.name,maxReviewCells,
  nativeImageProfile:stageImageSpec,requiredGenderOutcomePosters:variants.reduce((a,v)=>a+v.pageCount,0),
  requiredIndividualImages:n,alreadyRegisteredDraftImages:existing,
  missingIndividualImages:n-existing,qualityApprovedImages:0,
  stageCompletion:'NOT_APPROVED',variants});
}
const totals={
 stageCount:results.length,
 requiredPosters:results.reduce((n,s)=>n+s.requiredGenderOutcomePosters,0),
 requiredPanels:results.reduce((n,s)=>n+s.requiredIndividualImages,0),
 registeredDraftPanels:results.reduce((n,s)=>n+s.alreadyRegisteredDraftImages,0),
 missingPanels:results.reduce((n,s)=>n+s.missingIndividualImages,0),
 approvedPanels:0
};
const report={schemaVersion:3,kind:'production-manifest-not-generated-art',
 generatedAt:new Date().toISOString(),qualityPolicy:'docs/story-stage-poster-production-manifest-v2.md',
 shotWorkflow:'SCREENPLAY_CONTEXT_PREVIOUS_CURRENT_NEXT_REAL_CAST_REFERENCES_PER_SHOT',
 imageSpec,mobileImageSpec,reviewSheetPolicy:{columns:2,maxPanels:10,stageOverrides:{'c01-s02':5},rowsForFive:3,rowsForTen:5,
  preferredNativeCellPixels:[2048,1152],preferredFivePanelSheetPixels:[4096,3456],preferredTenPanelSheetPixels:[4096,5760],
  preferredBatchProcess:'RENDER_EACH_REAL_FRAME_THEN_LOSSLESS_COMPOSITE',
  directGiantSheetGenerationCapability:'NOT_VERIFIED',
  manualQualityInspectionMandatory:true},
 absolutePriority:'P0_ABSOLUTE_MUST_FOLLOW',
 absolutePriorityPolicy:'assets/story/quality/artwork-p0-rules.json',
 failClosedOnMissingReferenceBytes:true,
 outputIsOnlyInstructions:true,noPaidAPICalls:true,artGeneratorAttached:false,
 approvalPolicy:'NO_ARTWORK_MAY_BE_APPROVED_BY_THIS SCRIPT',
 nextStagePolicy:'Only advance when each edition/gender has manually reviewed and byte-verified art and live game verification',
 qualityReferenceImages:qualityReference,totals,stages:results};
const output=argValue('--out',path.join('qa-reports','story-stage-production',
 start+'-through-'+stages.at(-1).id+'.json'));
if(!output||path.isAbsolute(output)||output.includes('..'))
 throw Error('Output must be a safe repository-relative path');
const dest=path.join(root,output);
fs.mkdirSync(path.dirname(dest),{recursive:true});
fs.writeFileSync(dest,JSON.stringify(report,null,2)+'\n','utf8');
console.log(JSON.stringify({output,totals,stageIds:stages.map(s=>s.id),
 qualityApproved:false,perShotScenarioContexts:true,noPaidAPICalls:true}));
