#!/usr/bin/env node
/**
 * One-command, FIVE-CHAPTER production register (50 stages, every edition).
 * Real artwork is never declared complete without the approved page WebP.
 * Voices are cached by the exact panel ID, spoken kana and assigned speaker.
 *
 * node scripts/prepare-story-five-chapters.mjs
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {STORY_VOICE_PROFILES,STORY_NARRATOR_PROFILE} from '../src/story-voice-director.js';

const root=process.cwd();
const manifest=JSON.parse(await fs.readFile('audio/voicevox/manifest.json','utf8'));
const chapters=[];
const clipTasks=new Map(),masters=new Map();
let variantCount=0,panelCount=0,requiredPages=0,existingPages=0,existingVoices=0;
for(let ch=1;ch<=5;ch++){
 const run=spawnSync(process.execPath,['scripts/prepare-story-chapter.mjs','--chapter',String(ch)],{
  cwd:root,encoding:'utf8',maxBuffer:4*1024*1024});
 if(run.status!==0)throw Error('Chapter '+ch+' preflight: '+run.stderr);
 const index=String(ch).padStart(2,'0');
 const plan=JSON.parse(await fs.readFile('qa-reports/story-chapters/c'+index+'-production.json','utf8'));
 if(plan.chapter!==ch||plan.stageCount!==10)throw Error('Broken chapter '+ch);
 const missingPages=[];
 let chapterVoiceCount=0,chapterExistingVoiceCount=0,chapterPanels=0;
 for(const edition of plan.variants){
  if(edition.pages.length!==1)
   throw Error('Dense page requirement: '+edition.stageId+' '+edition.edition+' needs '+edition.pages.length+' sheets');
  for(const page of edition.pages){
   if(page.panelCount>10||page.panelCount<1)throw Error('Invalid page size');
   for(const gender of ['male','female']){
    const target=page.files[gender];
    if(!target.startsWith('assets/story/chapters/c'+index+'/'))throw Error('Bad art destination '+target);
    try{await fs.access(target);existingPages++;}catch{missingPages.push(target);}
   }
  }
  for(const panel of edition.panels){
   if(!panel.text||!panel.voiceText)throw Error('Empty caption or voice '+panel.id);
   chapterPanels++;
   for(const reference of panel.references){
    if(reference.id&&!masters.has(reference.id))masters.set(reference.id,{
     id:reference.id,name:reference.name,master:reference.master,status:reference.status});
   }
   const profile=STORY_VOICE_PROFILES[panel.characterId]||STORY_NARRATOR_PROFILE;
   const key='story::panel::'+panel.id+'::'+panel.voiceText.slice(0,380)+'::'+profile.voicevoxSpeaker;
   if(!clipTasks.has(key)){
    const pathInManifest=manifest.clips[key]||null;
    const entry={key,chapter:ch,stageId:edition.stageId,panelId:panel.id,
     characterId:panel.characterId,speaker:panel.speaker,
     voicevoxSpeaker:profile.voicevoxSpeaker,voiceText:panel.voiceText,
     pronunciationNeedsReview:/[\u3400-\u9fff々]/.test(panel.voiceText),
     existingClip:pathInManifest};
    clipTasks.set(key,entry);
    chapterVoiceCount++;
    if(pathInManifest){chapterExistingVoiceCount++;existingVoices++;}
   }
  }
 }
 variantCount+=plan.editionCount;
 panelCount+=chapterPanels;
 requiredPages+=plan.requiredPages;
 chapters.push({
  chapter:ch,chapterTitle:plan.chapterTitle,stageCount:plan.stageCount,
  editions:plan.editionCount,panels:chapterPanels,requiredPages:plan.requiredPages,
  missingPages:missingPages.length,missingPagePaths:missingPages,
  voiceKeys:chapterVoiceCount,alreadyManifestedVoiceKeys:chapterExistingVoiceCount,
  status:missingPages.length?'art-not-complete':'awaiting-review-registration'
 });
}
const report={
 schemaVersion:1,scope:{fromChapter:1,toChapter:5,chapters:5,stages:50},
 pageLayout:{columns:2,maxCellsPerSheet:10,cellPixels:[768,432]},
 editionCount:variantCount,authoredPanelEntries:panelCount,
 requiredGenderSpecificPages:requiredPages,existingApprovedPageCandidates:existingPages,
 missingGenderSpecificPages:requiredPages-existingPages,
 voiceKeys:clipTasks.size,registeredVoiceKeys:existingVoices,
 missingVoiceKeys:clipTasks.size-existingVoices,
 characterMasters:[...masters.values()],
 status:'PRODUCTION_STARTED_NOT_APPROVED_ART_OR_VOICE',chapters,
 voiceWorkQueue:[...clipTasks.values()].filter(x=>!x.existingClip),
 voiceReuse:[...clipTasks.values()].filter(x=>x.existingClip)
  .map(x=>({key:x.key,existingClip:x.existingClip}))
};
await fs.mkdir('qa-reports/story-chapters',{recursive:true});
await fs.writeFile('qa-reports/story-chapters/c01-c05-production.json',
 JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({chapterRange:'1-5',stages:50,editions:variantCount,
 totalGenderSpecificPages:requiredPages,pagesStillMissing:report.missingGenderSpecificPages,
 uniqueVoiceLines:clipTasks.size,registeredVoiceLines:existingVoices,
 uniqueCharacters:masters.size,status:report.status},null,2));
