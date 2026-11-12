/**
 * Deterministic shot-to-sheet plan for all 4,000 canonical story manga panels.
 *
 * One batch = one complete phase: ten opening OR ten post-event frames.
 * Each of 200 stages has TWO approved ten-panel art batches.
 * These 2x5 FULL-PAGE sheets are the game-facing art, not panel-sized gallery pictures.
 * This produces PRODUCTION BRIEFS, NOT generated image files.
 *
 * node scripts/prepare-story-art-batches.mjs [--batch 1]
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {CAMPAIGN_STAGES} from '../src/campaign-stage-plan.js';
import {STORY_CHAPTERS} from '../src/story-chapters.js';
import {STORY_KEY_PEOPLE} from '../src/story-cinematic.js';
import {mangaForStage} from '../src/story-stage-manga.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const target=path.join(root,'qa-reports','story-art-batch-plan.json');
const people=new Map(STORY_KEY_PEOPLE.map(c=>[c.id,c]));
// The first-stage visual contract is stricter than the general cast collage.
// Reading a pathname is not the same as attaching its actual image as input.
const firstStageContract=JSON.parse(await fs.readFile(path.join(root,
 'assets/story/characters/c01-s01-visual-contract.json'),'utf8'));
function visualReference(id,stageId){
 const base=firstStageContract.stageId===stageId?firstStageContract.visualReferences[id]:null;
 return {path:base?.path||'assets/story-cinema/cast/'+id+'.webp',
  kind:base?.kind||'cast-composite-crop-not-character-master',
  description:base?.description||'Visual identity must be validated before drawing this scene'};
}
const shotKinds=[
 'Wide environmental establishing shot: clarify the current location and the actions described',
 'Character-first medium shot: make the speaking character unmistakable',
 'Two-character cinematic dialogue shot: natural eyeline and contrast in expressions',
 'Close-up on a tangible story clue or event while preserving location and cast',
 'Strong perspective/action shot for the conflict at this precise stage',
 'Intimate emotional decision shot with a readable character gesture',
 'Aftermath establishing shot showing outcome and remaining people',
 'Clue discovered while examining the aftermath',
 'The survivors decide how to respond; distinct emotional poses',
 'Closing beat leading to the next stage or a retreat'
];
const all=CAMPAIGN_STAGES.flatMap(stage=>{
 const story=mangaForStage(stage.id,{protagonistGender:'male'});
 return story.panels.map(p=>{
  const actors=[p.characterId,p.secondaryId].filter(Boolean).map(id=>{
   const c=people.get(id);
   if(!c)throw Error('Unknown cast ID: '+id+' at '+p.id);
   const ref=visualReference(c.id,stage.id);
   return {id:c.id,name:c.name,faction:c.faction,role:c.role,
    master:ref.path,referenceType:ref.kind,identity:ref.description};
  });
  return {
   id:p.id,stageId:stage.id,chapter:p.chapter,chapterTitle:STORY_CHAPTERS[p.chapter-1].title,
   stageName:stage.name,stageKind:stage.kind,phase:p.phase,location:STORY_CHAPTERS[p.chapter-1].location,
   index:p.index,scenery:p.scenery,expression:p.expression,mood:p.mood,
   speaker:p.speaker,characters:actors,subtitleText:p.subtitleText,voiceText:p.voiceText,spokenText:p.text,
   shot:shotKinds[p.index%shotKinds.length],
   instruction:'An ORIGINAL, self-contained, full-bleed, 16:9 cinematic fantasy RPG scene; depicts ONLY this specific stage moment: '+p.text+
    '. Location: '+STORY_CHAPTERS[p.chapter-1].location+'. Camera: '+shotKinds[p.index%shotKinds.length]+
    '. Keep named character faces, clothing and faction heraldry consistent with the provided cast-master portraits. '+
    'If the player strategist appears, depict a MALE version in the base sheet. '+
    'Post-event artwork must be outcome-neutral, safe for victory and defeat; the verified outcome is shown in game text. Do not copy art from a different stage or panel. No words, lettering, subtitles, narration boxes, '+
    'speech bubbles, numbered panels, logos, watermarks, user interface, infographics or collage.'
  };
 });
});
if(all.length!==4000)throw Error('Expected 4,000 canonical frames, found '+all.length);
const seen=new Set();
for(const p of all){if(seen.has(p.id))throw Error('Duplicate panel ID '+p.id);seen.add(p.id);}
const batches=[];
for(let i=0;i<all.length;i+=10){
 const shots=all.slice(i,i+10);
 if(shots.length!==10||new Set(shots.map(p=>p.stageId)).size!==1||new Set(shots.map(p=>p.phase)).size!==1)throw Error('10 frames must belong to one stage AND one phase: '+i);
 const index=i/10+1,id='batch-'+String(index).padStart(4,'0'),phase=shots[0].phase;
 const steps=shots.map((p,n)=>({...p,frame:n+1,
  row:Math.floor(n/2)+1,column:n%2+1,
  maleOutput:'assets/story/panels/'+p.id.replace(/-m(\d{1,2})$/,(_,v)=>'-m'+v.padStart(2,'0'))+'.webp',
  femaleOutput:'assets/story/panels/'+p.id.replace(/-m(\d{1,2})$/,(_,v)=>'-m'+v.padStart(2,'0'))+'-female.webp'
 }));
 batches.push({id,index,phase,
  malePageOutput:'assets/story/pages/'+shots[0].stageId+'-'+phase+'-male.webp',
  femalePageOutput:'assets/story/pages/'+shots[0].stageId+'-'+phase+'-female.webp',
  chapters:[...new Set(shots.map(p=>p.chapter))],
   stages:[shots[0].stageId],
   layout:{columns:2,rows:5,order:'row-major',panels:10,aspect:'16:9',
     preferredSheetPixels:[1536,2160],minimumCellPixels:[768,432],
     noMargins:true,noGutters:true,noLabels:true},
   input:{
    base:'assets/story/sheets/'+id+'/base.png',
    femaleEdit:'assets/story/sheets/'+id+'/heroine-edit.png',
    heroMask:'assets/story/sheets/'+id+'/hero-mask.png',
    approval:'assets/story/sheets/'+id+'/review-approved.json'
   },
   masterReferences:{
    maleStrategist:shots[0].stageId==='c01-s01'
      ?firstStageContract.visualReferences.protagonistMale.path:'assets/story/panels/c01-s01-m01.webp',
    femaleStrategist:shots[0].stageId==='c01-s01'
      ?firstStageContract.visualReferences.protagonistFemale.path:'assets/story/characters/commander/female-master.webp',
    cast:[...new Set(shots.flatMap(s=>s.characters.map(c=>c.id)))]
      .map(id=>({id,name:people.get(id).name,...visualReference(id,shots[0].stageId)}))
   },
   referencePolicy:shots[0].stageId==='c01-s01'
    ?{canonicalSynopsis:firstStageContract.chapterSynopsis,
      storyline:firstStageContract.coreConflict,
      forbiddenPlot:firstStageContract.excludedPlot,
      appearanceRules:firstStageContract.appearancePolicy,
      storyboards:phase==='pre'?firstStageContract.prePanelStoryboard:[],
      actualImagesMustBeAttached:true,
      doNotInferRolesFromPortraits:true,
      maleHeroIsProvisionalSceneReference:true}
    :{actualImagesMustBeAttached:true,doNotInferRolesFromPortraits:true},
   sheetPrompt:'Produce ONE clean 2-column by 5-row sheet with EXACTLY TEN separate equal-size, edge-to-edge illustrations, no gutters, no page border. Each cell is a completely distinct 16:9 scene, in row-major order specified below. All ten scenes must share the same original fantasy RPG art direction and exact canonical character designs from reference portraits. Draw only the actual setting and people in each frame. NEVER add ANY lettering, manga balloons, UI, labels, headings, panel numbering, overlay diagrams, infographics, logos or decorative page furniture. Keep every scene independent and cinematic.'+
    (shots[0].stageId==='c01-s01'?
     ' IMPORTANT: FIRST CHAPTER SYNOPSIS: '+firstStageContract.chapterSynopsis+
     '. CAST-IDENTITY RULES: '+firstStageContract.appearancePolicy.join(' / ')+
     '. FORBIDDEN PLOT: '+firstStageContract.excludedPlot.join(' / ')+
     '. NEVER depict a living king, princess, a king giving the quest, an enemy invasion or a military deployment in the opening episode. The actual opening ends with an investigation in town.' :''),
   heroineEditPrompt:'Using the finished base sheet, REPLACE ONLY the player strategist when visible with the designated female strategist, in matching pose, angle, lighting and outfit style. Keep every other character, background, object, camera, color, and composition UNCHANGED. Supply a separately aligned HERO MASK sheet with white ONLY around the player strategist and black everywhere else; where no protagonist is visible, leave the entire mask cell black. DO NOT redraw whole scenes.',
   panels:steps
 });
}
const result={schemaVersion:3,totalChapters:20,totalStages:200,totalPanels:4000,totalBatches:400,
 status:'image-generation-briefs-only',note:'A brief is not a rendered image; only approved real cropped files count as complete.',batches};
await fs.mkdir(path.dirname(target),{recursive:true});
await fs.writeFile(target,JSON.stringify(result,null,2)+'\n');
const arg=process.argv.indexOf('--batch');
if(arg!==-1){
 const n=Number(process.argv[arg+1]);
 if(!Number.isInteger(n)||n<1||n>400)throw Error('Batch must be 1..400');
 const batch=batches[n-1];
 const outfile=path.join(root,'qa-reports','story-art-'+batch.id+'.json');
 await fs.writeFile(outfile,JSON.stringify(batch,null,2)+'\n');
 console.log(JSON.stringify({id:batch.id,stages:batch.stages,panels:batch.panels.map(p=>p.id),
  brief:outfile,approvalRequired:true},null,2));
}else{
 console.log('Prepared '+batches.length+' chronological ten-panel batches, covering '+all.length+' actual story panel IDs.');
 console.log('Batch 1: '+batches[0].panels.map(p=>p.id).join(', '));
}
