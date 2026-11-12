#!/usr/bin/env node
/**
 * One chapter = 150 coherent illustrations on ONE high-resolution atlas.
 * Creates the deterministic storyboard mapping, not fake generated images.
 *
 * node scripts/compile-story-chapter-atlas.mjs --chapter 1 --gender male
 * node scripts/compile-story-chapter-atlas.mjs --all
 */
import fs from 'node:fs/promises';
import {comicForStage,comicPageAsset} from '../src/story-chapter-comic.js';
import {STORY_CHAPTERS} from '../src/story-chapters.js';
import {STORY_STAGE_BEATS} from '../src/story-stage-beats-v2.js';
import {stagesInChapter} from '../src/campaign-stage-plan.js';
import {STORY_VOICE_PROFILES,STORY_NARRATOR_PROFILE} from '../src/story-voice-director.js';

const args=process.argv.slice(2);
const all=args.includes('--all');
const param=(key,fallback)=>args.includes(key)?args[args.indexOf(key)+1]:fallback;
if(all&&(args.includes('--chapter')||args.includes('--gender')))throw Error('Use --all or --chapter / --gender');
const requestedChapter=Number(param('--chapter','1'));
const requestedGender=param('--gender','male');
if(!all&&(!Number.isInteger(requestedChapter)||requestedChapter<1||requestedChapter>5||
 !['male','female'].includes(requestedGender)))throw Error('Only chapter 1..5, gender male/female');
const requests=all
 ?Array.from({length:5},(_,i)=>i+1).flatMap(ch=>['male','female'].map(g=>({ch,g})))
 :[{ch:requestedChapter,g:requestedGender}];
const pad=n=>String(n).padStart(2,'0');
for(const {ch,g} of requests){
 const frames=[],chap=STORY_CHAPTERS[ch-1],stages=stagesInChapter(ch);
 if(stages.length!==10)throw Error('Cannot make a 150-frame chapter without ten stages');
 const sourceSynopsis=chap.synopsis;
 for(const stage of stages){
  const beat=STORY_STAGE_BEATS[ch-1][stage.slot-1];
  const phaseEntries=[
   ['pre',comicForStage(stage.id,'pre',{protagonistGender:g})],
   ['post',comicForStage(stage.id,'post',{
    protagonistGender:g,...(stage.kind==='town'?{}:{battleOutcome:{victory:true}})
   })]
  ];
  const expected=stage.slot===1?[10,5]:[8,7];
  if(phaseEntries[0][1].panels.length!==expected[0]||
   phaseEntries[1][1].panels.length!==expected[1])
   throw Error('Unexpected chapter pacing: '+stage.id+' '+phaseEntries.map(x=>x[1].panels.length));
  for(const [phase,comic] of phaseEntries){
   if(comic.pages.length!==1)throw Error('Expected one sheet per edition: '+stage.id);
   for(const panel of comic.panels){
    const position=frames.length;
    const voice=STORY_VOICE_PROFILES[panel.characterId]||STORY_NARRATOR_PROFILE;
    const pagePath=comicPageAsset(stage.id,phase,{...(stage.kind==='town'?{}:
     {battleOutcome:{victory:true}})},1,g).replace(/^\.\//,'');
    const framePath='assets/story/chapters/c'+pad(ch)+'/panels/'+panel.id+'-'+g+'.webp';
    if(!/^assets\/story\/chapters\/c0[1-5]\//.test(pagePath)||
       !/^assets\/story\/chapters\/c0[1-5]\//.test(framePath))
     throw Error('Unsafe target path');
    frames.push({
     atlasIndex:position,atlasColumn:position%10,atlasRow:Math.floor(position/10),
     stageId:stage.id,stageNumber:stage.slot,stageName:stage.name,
     stageKind:stage.kind,winCondition:stage.winCondition,
     sceneSetup:beat[0],verifiedOutcome:phase==='post'?beat[1]:null,
     phase,edition:comic.edition,gender:g,
     comicPanelIndex:panel.comicCell,comicPanelId:panel.id,
     pagePath,framePath,
     pictureDescription:panel.text,subtitleExternal:panel.subtitleText,
     voiceTextExternal:panel.voiceText,voicevoxSpeaker:voice.voicevoxSpeaker,
     voiceCacheKey:'story::panel::'+panel.id+'::'+panel.voiceText.slice(0,380)+'::'+voice.voicevoxSpeaker,
     textInsideArt:false,
     imageStatus:'AWAITING_ORIGINAL_ART'
    });
   }
  }
 }
 if(frames.length!==150)throw Error('Expected 150 total story-beats, got '+frames.length);
 const unique=new Set(frames.map(x=>x.framePath));
 if(unique.size!==150)throw Error('Duplicate story panel IDs in 150-atlas');
 const allPagePaths=new Set(frames.map(x=>x.pagePath));
 if(allPagePaths.size!==20)throw Error('Expected 20 pre/post pages per chapter');
 const plan={
  schemaVersion:1,kind:'original-art-atlas-registration-plan',
  chapter:ch,chapterTitle:chap.title,chapterSynopsis:sourceSynopsis,
  chapterObjective:chap.objective,gender:g,
  outcomePolicy:'town or confirmed victory only; defeat/commander death require separately authored artwork',
  atlas:{path:'assets/story/atlases/c'+pad(ch)+'-'+g+'-mainline-150.webp',
   width:7680,height:6480,columns:10,rows:15,
   cellWidth:768,cellHeight:432,realPixelsPerFrame:331776,frames:150},
  targetPages:20,
  expectedGameImages:150,
  approval:'NOT_APPROVED_MISSING_ATLAS',
  sourceImagePolicy:[
   'Use the complete chapter synopsis and the stage-by-stage sequence for each frame',
   'Exactly 150 visually distinct hand-authored/AI illustrated scenes: no repeated image or poster cells',
   'Atlas must have NO text, numbers, furigana, letterforms, speech bubbles or legends',
   'Keep identifiable faces, hair, age, dress and weapons consistent between all scenes',
   'Do not depict the battle result before battle; post-victory must match the verified objective',
   'The protagonist gender changes ONLY the protagonist, never Lucia, Garan, Iris or other NPCs',
   'Use separate 150-frame source for female, and separate post-gameover/defeat illustrations',
   'A reference FILE PATH does not supply an AI model with a reference IMAGE; attach actual pixels'
  ],
  frames
 };
 await fs.mkdir('qa-reports/story-chapters',{recursive:true});
 const output='qa-reports/story-chapters/c'+pad(ch)+'-'+g+'-mainline-150.json';
 await fs.writeFile(output,JSON.stringify(plan,null,2)+'\n');
 console.log(JSON.stringify({chapter:ch,gender:g,frames:frames.length,
  pageTargets:allPagePaths.size,atlas:plan.atlas.path,plan:output,
  status:plan.approval}));
}
