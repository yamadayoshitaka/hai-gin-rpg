#!/usr/bin/env node
/** Export next-generation 20-chapter image production queue.
 * Reuses only registered exact scene/gender/outcome originals; never calls an
 * image provider, never stamps P0 approval, and never assumes faces are neutral.
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {COMPACT_TWENTY_CHAPTER_PLAN,compactComicForStage} from '../src/story-compact-comic.js';
import {registeredStoryPanelAsset} from '../src/story-panel-registered-art.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const entries=[],stats={total:0,reused:0,missing:0,formalP0Approved:0};
for(const plan of COMPACT_TWENTY_CHAPTER_PLAN)for(const id of plan.stageIds)for(const gender of ['male','female']){
 const ctx={protagonistGender:gender,chapterOpeningSeen:false};
 for(const [phase,outcome] of [['pre',null],['post','victory']]){
  const context=outcome?{...ctx,battleOutcome:{victory:true}}:ctx;
  const comic=compactComicForStage(id,phase,context);
  for(const shot of comic.panels){
   const url=registeredStoryPanelAsset(shot);
   const relative=typeof url==='string'?url.replace(/^\.\//,''):null;
   const file=relative&&!relative.includes('..')?path.resolve(root,relative):null;
   const validFile=!!(file&&file.startsWith(root+path.sep)&&fs.existsSync(file));
   const key=[id,shot.comicEdition,gender,shot.id].join('|');
   entries.push({key,stageId:id,chapter:plan.chapter,gender,phase,
    shotId:shot.id,chapterOpening:shot.isChapterOpening,
    imageStatus:validFile?'REUSE_EXISTING_PROVISIONAL_NOT_P0':'NEEDS_ORIGINAL_CG',
    sourceArt:validFile?url:null,sceneTurnCount:shot.dialogueTurns.length,
    actualSceneText:shot.dialogueTurns.map(x=>x.text),
    exactProtagonistAppearanceRequired:gender,
    shareAcrossGendersOnlyAfterHumanNoProtagonistProof:true,
    formalP0Approved:false});
   stats.total++;if(validFile)stats.reused++;else stats.missing++;
  }
 }
}
if(stats.total!==1760)throw Error('20 chapters x two sexes must be 1760 conservative slots');
const shared=[
 {id:'shared-defeat-1',kind:'defeat',status:'PENDING_ORIGINAL_GENDER_NEUTRAL_ART'},
 {id:'shared-defeat-2',kind:'defeat',status:'PENDING_ORIGINAL_GENDER_NEUTRAL_ART'},
 {id:'shared-gameover-1',kind:'gameover',status:'PENDING_NO_CROSS_OUTCOME_REUSE'},
 {id:'shared-gameover-2',kind:'gameover',status:'PENDING_NO_CROSS_OUTCOME_REUSE'}
];
const output={schemaVersion:1,kind:'COMPACT_20_CHAPTER_REAL_ART_CANDIDATES',chapters:20,stages:200,
 plannedPrimaryCGSlots:880,maximumGenderConservativeSlots:1760,
 result:stats,shared,
 safety:['Only exact stage, gender and outcome registered WebP may be reused',
  'Protagonist neutral/background sharing requires explicit visual proof',
  'Missing CG means missing, not a generated placeholder',
  'No outside paid API, no actual generation, no automatic P0 approval'],
 entries};
const out=process.argv[2]||'qa-reports/story-compact-production-queue.json';
const file=path.resolve(root,out);
if(!file.startsWith(root+path.sep))throw Error('Unsafe output path');
fs.mkdirSync(path.dirname(file),{recursive:true});
fs.writeFileSync(file,JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({output:out,stats,sharedPending:shared.length}));
