#!/usr/bin/env node
/**
 * Produce render-ready, HUMAN-REVIEWED, TEXTLESS manga-sheet briefs for the
 * first five chapters. This only writes specifications, never fake artwork.
 * Every page is one 2-column sheet with up to ten distinct authored panels.
 *
 * node scripts/compile-story-art-briefs.mjs
 * node scripts/compile-story-art-briefs.mjs --chapter 1
 */
import fs from 'node:fs/promises';
import {comicChapterPlan} from '../src/story-chapter-comic.js';
import {STORY_CHAPTERS} from '../src/story-chapters.js';
import {STORY_STAGE_BEATS} from '../src/story-stage-beats-v2.js';
import {CAMPAIGN_STAGE_BY_ID} from '../src/campaign-stage-plan.js';
import {STORY_KEY_PEOPLE} from '../src/story-cinematic.js';

const args=process.argv.slice(2);
if(args.length&&!(args.length===2&&args[0]==='--chapter'&&/^[1-5]$/.test(args[1])))
 throw Error('Usage: node scripts/compile-story-art-briefs.mjs [--chapter 1..5]');
const chosen=args.length?[Number(args[1])]:[1,2,3,4,5];
const byId=new Map(STORY_KEY_PEOPLE.map(p=>[p.id,p]));
const fmt=n=>String(n).padStart(2,'0');
const cameraShots=['wide establishing shot','two-character medium shot',
 'close-up on expression','dramatic insert of tangible evidence',
 'over-the-shoulder investigative shot','low-angle environmental reaction',
 'three-quarter conversation','high-angle landscape or route diagram in-world',
 'hands with physical clues','cinematic closing shot'];
const consequenceFor=(edition,stage)=>{
 if(edition.phase==='pre')return 'BEFORE battle, no result is known';
 if(stage.kind==='town')return 'town exploration conclusion, never invent a battle';
 if(edition.edition.includes('gameover'))return 'commander dead; no retreat or victory, no survivors falsely presented as protagonist';
 if(edition.edition.includes('defeat'))return 'objective NOT attained; retreat or regroup; do not portray success';
 if(edition.edition.includes('victory'))return 'objective completed; do not add unverified civilian or route outcomes';
 return 'outcome not yet confirmed; do not imply success';
};
function characterReference(id){
 if(!id)return null;
 const p=byId.get(id);
 if(!p)throw Error('Unregistered cast identity '+id);
 return {id,lockedName:p.name,reference:id==='lucia'
  ?'assets/story/characters/lucia/master.webp'
  :'assets/story-cinema/cast/'+id+'.webp',
  referenceStatus:id==='lucia'?'dedicated-master':'ensemble-crop-requires-visual-review'};
}
function protagonistReference(gender){
 return gender==='female'
  ?{gender,path:'assets/story/characters/commander/female-master.webp',
    status:'dedicated-female-master',identity:'female commander, NOT Lucia'}
  :{gender,path:'assets/story/panels/c01-s01-m01.webp',
    status:'male-provisional-scene-not-face-master',identity:'black-haired male commander, NOT Garan or a crowned king'};
}
const sheetPlans=[];
for(const chapter of chosen){
 const chapterData=STORY_CHAPTERS[chapter-1],plan=comicChapterPlan(chapter);
 for(const edition of plan.editions){
  const stage=CAMPAIGN_STAGE_BY_ID[edition.stageId];
  const [setup,verifiedVictory]=STORY_STAGE_BEATS[chapter-1][stage.slot-1];
  for(const page of edition.pages){
   if(page.cellCount>10||page.cellCount<1||page.columns!==2||page.rows>5)
    throw Error('Expected a compact two-column ten-cell page: '+stage.id);
   const subset=edition.panels.slice((page.number-1)*10,page.number*10);
   if(subset.length!==page.cellCount)throw Error('Page/panel mismatch');
   for(const gender of ['male','female']){
    const name=stage.id+'-'+edition.edition+'-'+gender+'-p'+fmt(page.number)+'.webp';
    const location='assets/story/chapters/c'+fmt(chapter)+'/'+name;
    const appearances=new Set(subset.flatMap(p=>[p.characterId,p.secondaryId]).filter(Boolean));
    const cast=[...appearances].map(characterReference);
    const storyboard=subset.map((panel,index)=>{
     const x=(index%2)*768,y=Math.floor(index/2)*432;
     const scene=panel.text;
     return {
      position:index+1,grid:{column:index%2+1,row:Math.floor(index/2)+1,
       pixelRect:[x,y,768,432]},
      stablePanelId:panel.id,character:panel.characterId||null,
      secondary:panel.secondaryId||null,speaker:panel.speaker,
      setting:stage.name,context:stage.storyBeat,
      direction:cameraShots[(stage.slot+index)%cameraShots.length],
      sceneAction:scene,
      externalSubtitle:panel.subtitleText||scene,
      externalVoiceText:panel.voiceText,
      speechInsideImage:false
     };
    });
    sheetPlans.push({
     id:stage.id+'-'+edition.edition+'-'+gender+'-p'+fmt(page.number),
     chapter,chapterTitle:chapterData.title,chapterSynopsis:chapterData.synopsis,
     stageId:stage.id,stageName:stage.name,stageKind:stage.kind,stageWinCondition:stage.winCondition,
     setup,verifiedVictoryContext:edition.phase==='post'&&edition.edition.includes('victory')?verifiedVictory:null,
     phase:edition.phase,edition:edition.edition,gender,outputPath:location,
     sourceImageStatus:'NOT_GENERATED_NOT_APPROVED',
     canvas:{width:1536,height:432*page.rows,columns:2,rows:page.rows,cellCount:page.cellCount},
     protagonist:protagonistReference(gender),cast,
     mandatoryArtRules:[
      'ONE coherent original illustrated comic sheet, NOT a poster, infographic, dashboard or chapter list',
      'Render exactly '+page.cellCount+' bordered distinct scenes in reading order left-to-right then top-to-bottom',
      'Do not draw ANY text, title, dialogue, captions, speech bubbles, status, credits or completion badges inside the image',
      'Respect all named characters and reference appearances; never turn Garan into a king or Lucia into protagonist',
      'The same NPCs keep identical faces, clothing and age across panels, editions, genders and chapters',
      'Never reuse an identical full scene for victory, defeat, death or branch alternatives',
      'Do not depict a battle before it begins, a won battle on defeat, or a living commander after gameover',
      'Female edition replaces only the player commander, not Lucia or other cast'
     ],
     storyboard
    });
   }
  }
 }
}
const paths=new Set(),ids=new Set();
for(const p of sheetPlans){
 if(paths.has(p.outputPath)||ids.has(p.id))throw Error('Duplicate sheet brief '+p.id);
 paths.add(p.outputPath);ids.add(p.id);
 if(p.storyboard.some(s=>!s.sceneAction))throw Error('Empty story cell '+p.id);
}
const output={
 schemaVersion:1,contentType:'render-prompt-briefs-not-images',
 chapters:chosen,stageCount:chosen.length*10,genderSeparatedSheetCount:sheetPlans.length,
 maxCellsPerSheet:10,textRender:'outside-image-only',
 verifiedReferencePolicy:'Actual image bytes must be supplied to the renderer; filenames alone do not attach face references',
 status:'AWAITING_REAL_IMAGES_AND_APPROVAL',pages:sheetPlans
};
await fs.mkdir('qa-reports/story-chapters',{recursive:true});
const name=chosen.length===1?'c'+fmt(chosen[0])+'-art-briefs.json':'c01-c05-art-briefs.json';
await fs.writeFile('qa-reports/story-chapters/'+name,JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({
 chapters:chosen.length,sheets:sheetPlans.length,stages:chosen.length*10,
 layout:'2-column, at most 10 distinct scenes per page',
 promptsOutput:'qa-reports/story-chapters/'+name,
 status:output.status
}));
