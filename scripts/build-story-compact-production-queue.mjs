#!/usr/bin/env node
/**
 * Build the minimum-first CG production queue: 880 story identities, not
 * 1760 pre-committed image purchases. Each identity carries two independently
 * verifiable gender variants; never share an existing image just because its
 * story text omits the player or the filename looks neutral.
 *
 * This is a planning/audit tool. It cannot render or approve images.
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {COMPACT_TWENTY_CHAPTER_PLAN,compactComicForStage} from '../src/story-compact-comic.js';
import {registeredStoryPanelAsset} from '../src/story-panel-registered-art.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const byIdentity=new Map();
const genders=['male','female'];
let exactGenderReuse=0;
for(const plan of COMPACT_TWENTY_CHAPTER_PLAN){
 for(const id of plan.stageIds){
  for(const gender of genders){
   const ctx={protagonistGender:gender,chapterOpeningSeen:false};
   for(const [phase,outcome] of [['pre',null],['post','victory']]){
    const context=outcome?{...ctx,battleOutcome:{victory:true}}:ctx;
    const comic=compactComicForStage(id,phase,context);
    for(const shot of comic.panels){
     const identity=[id,shot.comicEdition,shot.id].join('|');
     let row=byIdentity.get(identity);
     if(!row){
      row={key:identity,stageId:id,chapter:plan.chapter,phase,
       shotId:shot.id,edition:shot.comicEdition,
       chapterOpening:shot.isChapterOpening,sceneTurnCount:shot.dialogueTurns.length,
       actualSceneText:shot.dialogueTurns.map(turn=>turn.text),
       productionPlan:'ONE_SCENE_FIRST_THEN_GENDER_REVIEW',
       shareAcrossGenders:'REQUIRES_HUMAN_VISUAL_PROOF_OF_NO_PROTAGONIST',
       sharedApprovedArt:null,formalP0Approved:false,genderVariants:{}};
      byIdentity.set(identity,row);
     }
     if(row.genderVariants[gender])throw Error('Duplicate gender scene '+identity+'/'+gender);
     if(row.phase!==phase||row.chapterOpening!==shot.isChapterOpening||
       row.sceneTurnCount!==shot.dialogueTurns.length)
      throw Error('Gender scene identities or dialogue diverged '+identity);
     const url=registeredStoryPanelAsset(shot);
     const relative=typeof url==='string'?url.replace(/^\.\//,''):null;
     const file=relative&&!relative.includes('..')?path.resolve(root,relative):null;
     const verified=!!(file&&file.startsWith(root+path.sep)&&fs.existsSync(file));
     if(verified)exactGenderReuse++;
     row.genderVariants[gender]={
      key:identity+'|'+gender,
      protagonistGender:gender,
      status:verified?'REUSE_EXACT_GENDER_PROVISIONAL_NOT_P0':'MISSING_EXACT_GENDER_ART',
      sourceArt:verified?url:null,
      requiresDistinctArtUnlessProvenNeutral:true,
      visibleProtagonistVisuallyAudited:false,
      reuseOtherGenderForbiddenUntilApproved:true,
      formalP0Approved:false
     };
    }
   }
  }
 }
}
const entries=[...byIdentity.values()];
if(entries.length!==880||entries.some(row=>!genders.every(g=>row.genderVariants[g])))
 throw Error('Minimum-first CG contract violated: exactly 880 identities x 2 gender reviews');
const stats={
 // Physical production decision count starts at 880; unresolved gender art
 // may bring the maximum back to 1760 after visual review.
 total:entries.length,
 reused:entries.filter(row=>genders.some(g=>row.genderVariants[g].sourceArt)).length,
 missing:entries.filter(row=>genders.every(g=>!row.genderVariants[g].sourceArt)).length,
 fullyExactGenderReused:entries.filter(row=>genders.every(g=>row.genderVariants[g].sourceArt)).length,
 genderVariantsObserved:entries.length*2,
 exactGenderReuse,
 missingExactGenderArt:entries.length*2-exactGenderReuse,
 provenNeutralShares:0,
 genderReviewPending:entries.filter(row=>!genders.every(g=>row.genderVariants[g].sourceArt)).length,
 formalP0Approved:0
};
const shared=[
 {id:'shared-defeat-1',kind:'defeat',status:'REAL_ORIGINAL_WEBP_REGISTERED_PENDING_P0',asset:'./assets/story/shared/shared-defeat-01.webp'},
 {id:'shared-defeat-2',kind:'defeat',status:'REAL_ORIGINAL_WEBP_REGISTERED_PENDING_P0',asset:'./assets/story/shared/shared-defeat-02.webp'},
 {id:'shared-gameover-1',kind:'gameover',status:'PENDING_NO_CROSS_OUTCOME_REUSE'},
 {id:'shared-gameover-2',kind:'gameover',status:'PENDING_NO_CROSS_OUTCOME_REUSE'}
];
const output={
 schemaVersion:2,kind:'COMPACT_20_CHAPTER_MINIMUM_FIRST_CG_QUEUE',chapters:20,stages:200,
 plannedPrimaryCGSlots:880,maximumGenderConservativeSlots:1760,
 countPolicy:'880 scene identities; second gender output only after independent appearance check',
 result:stats,shared,
 safety:[
  'Never treat a merely unmentioned protagonist as visually absent',
  'No automatic sharing of male and female art without verified absence of protagonist',
  'Existing registered WebPs may only be reused for exact stage, gender and outcome',
  'Unverified neutral candidates are REVIEW_PENDING, never game-ready',
  'Additional gender-specific images must still be made when a character is visible',
  'No paid provider, no generation in this planning tool and no P0 auto approval'
 ],entries
};
const out=process.argv[2]||'qa-reports/story-compact-production-queue.json';
const file=path.resolve(root,out);
if(!file.startsWith(root+path.sep))throw Error('Unsafe output path');
fs.mkdirSync(path.dirname(file),{recursive:true});
fs.writeFileSync(file,JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({output:out,stats,sharedPending:shared.length}));
