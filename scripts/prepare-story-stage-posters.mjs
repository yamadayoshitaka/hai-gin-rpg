#!/usr/bin/env node
/**
 * Free stage-by-stage story poster preflight. Produces prompts and an honest
 * artwork ledger; never calls image generators, approves art, or deploys.
 * node scripts/prepare-story-stage-posters.mjs --start c01-s02 --count 2
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {CAMPAIGN_STAGES,CAMPAIGN_STAGE_BY_ID} from '../src/campaign-stage-plan.js';
import {comicEditionsForStage} from '../src/story-chapter-comic.js';
import {STORY_STAGE_BEATS} from '../src/story-stage-beats-v2.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
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
const genderList=['male','female'];
const existingMaleS02=Object.freeze({
 pre:['m01','m02','m03','m04','m05','m11','m13','m15'],
 'post-victory':['m06','m07','m08','m09','m16','m19','m10']
});
function artPath(stageId,edition,gender,panelId){
 const suffix=panelId.slice(stageId.length+1);
 const numeric=/^m(\\d{1,2})$/.exec(suffix);
 const normalizedId=numeric?stageId+'-m'+String(Number(numeric[1])).padStart(2,'0'):panelId;
 const normalizedSuffix=normalizedId.slice(stageId.length+1);
 const legacy=stageId==='c01-s02'&&gender==='male'&&existingMaleS02[edition]?.includes(normalizedSuffix);
 const name=legacy?normalizedId+'-'+gender+'.webp':normalizedId+'-'+edition+'-'+gender+'.webp';
 return 'assets/story/chapters/'+stageId.slice(0,3)+'/panels/'+name;
}
function present(p){return fs.existsSync(path.join(root,p));}
function posterPath(stageId,edition,gender,page){
 return 'assets/story/chapters/'+stageId.slice(0,3)+'/'+stageId+'-'+edition+'-'+gender+'-p'+String(page).padStart(2,'0')+'.webp';
}
const qualityReference={
 male:{path:'assets/story/chapters/c01/panels/c01-s01-m02-male.webp',status:'PROVISIONAL_STAGE1_REFERENCE_NOT_HUMAN_APPROVED'},
 female:{path:'assets/story/chapters/c01/panels/c01-s01-m02-female.webp',status:'PROVISIONAL_STAGE1_REFERENCE_NOT_HUMAN_APPROVED'}
};
const results=[];
for(const stage of stages){
 const [setup,victoryBeat]=STORY_STAGE_BEATS[stage.chapter-1][stage.slot-1];
 const variants=[];
 for(const edition of comicEditionsForStage(stage.id)){
  for(const gender of genderList){
   const pages=edition.pages.map(page=>{
    const panelData=edition.panels.filter(p=>p.comicPage===page.number);
    const reference=qualityReference[gender];
    const panels=panelData.map((shot,position)=>{
     const individualAsset=artPath(stage.id,edition.edition,gender,shot.id);
     const alreadyPresent=present(individualAsset);
     const maleSource=gender==='female'&&stage.id==='c01-s02'
      ?artPath(stage.id,edition.edition,'male',shot.id):null;
     const canConsiderReuse=Boolean(maleSource&&present(maleSource));
     return {
      panelId:shot.id,shotKey:[stage.id,edition.edition,gender,shot.id].join('|'),
      order:position+1,cell:[position%2,Math.floor(position/2)],
      scriptText:shot.subtitleText||shot.text,voiceText:shot.voiceText||'',
      characterId:shot.characterId||null,secondaryId:shot.secondaryId||null,
      role:shot.role||null,setting:shot.scenery||stage.name,
      individualAsset,sourcePoster:posterPath(stage.id,edition.edition,gender,page.number),
      individualMinPixels:[1536,864],
      qualityReferenceImage:reference.path,
      qualityReferenceStatus:reference.status,
      status:alreadyPresent?'AI_DRAFT_UNAPPROVED':'MISSING',
      manualReviewRequired:true,
      reuseCandidate:canConsiderReuse?{
       sourceAsset:maleSource,decision:'VISUAL_REVIEW_REQUIRED_NOT_AUTOMATIC',
       acceptanceCondition:'Use only when scene has NO visible protagonist and identical cast, story beat, time and outcome; copy to a separate female filename with explicit provenance'
      }:null,
      requiredChecks:['sameScriptAndScene','fixedCastIdentity','genderCorrect','outcomeCorrect',
       'noTextNumbersLogosOrUI','sameStyleAsStage1','realNativeDetail','sharpFacesAndHands',
       'full16by9','verifiedWebP','manualQualityReview','sha256MatchesApprovedReference'],
      approval:{approved:false,reviewer:null,referenceSha256:null,artSha256:null}
     };
    });
    return {page:page.number,posterAsset:posterPath(stage.id,edition.edition,gender,page.number),
     posterStatus:present(posterPath(stage.id,edition.edition,gender,page.number))
      ?'AI_DRAFT_UNAPPROVED':'MISSING',
     posterSpec:{columns:2,rows:Math.ceil(panels.length/2),
      cellCount:panels.length,minNativePixels:[3072,Math.ceil(panels.length/2)*864],
      displayRule:'Continuity poster first; supply all independently reviewed >=1536x864 single images after it'},
     panelIds:panels.map(p=>p.panelId),
     textFreePrompt:'Story-specific cinematic fantasy RPG comic, stage '+stage.id+
       ', edition '+edition.edition+', protagonist '+gender+
       '. PRIORITY: match or exceed Chapter 1 Stage 1 detail and fidelity. '+
       'A coherent sequence of '+panels.length+' distinct scenes, two columns, left-to-right then top-to-bottom. '+
       'No title, caption, logo, watermark, frame number, punctuation, UI, poster text, screenshot, infographic or speech balloon. '+
       'Stage synopsis: '+setup+'. Verified victory context only when this is post-victory: '+
       (edition.edition==='post-victory'?victoryBeat:'do NOT imply victory')+
       '. Character continuity is mandatory; Lucia is the silver-haired regent, Garan is an aged knight, Iris is the healer. '+
       'Male protagonist is a dark-haired strategist; female protagonist is a distinct woman, NEVER Lucia. '+
       'Draw the following scenes in order: '+panels.map(p=>p.order+') '+p.scriptText).join(' / '),
     panels};
   });
   variants.push({stageId:stage.id,edition:edition.edition,phase:edition.phase,gender,
    storyline:stage.storyBeat,stageName:stage.name,winCondition:stage.winCondition,
    setup,victoryBeat:edition.edition==='post-victory'?victoryBeat:null,
    pageCount:pages.length,panels:edition.panels.length,pages});
  }
 }
 const n=variants.reduce((a,v)=>a+v.pages.reduce((b,p)=>b+p.panels.length,0),0);
 const existing=variants.reduce((a,v)=>a+v.pages.reduce((b,p)=>b+p.panels.filter(x=>x.status!=='MISSING').length,0),0);
 results.push({stageId:stage.id,stageName:stage.name,
  requiredGenderOutcomePosters:variants.reduce((a,v)=>a+v.pageCount,0),
  requiredIndividualImages:n,alreadyRegisteredDraftImages:existing,
  missingIndividualImages:n-existing,qualityApprovedImages:0,
  stageCompletion:'NOT_APPROVED',variants});
}
const totals={
 stageCount:results.length,requiredPosters:results.reduce((n,s)=>n+s.requiredGenderOutcomePosters,0),
 requiredPanels:results.reduce((n,s)=>n+s.requiredIndividualImages,0),
 registeredDraftPanels:results.reduce((n,s)=>n+s.alreadyRegisteredDraftImages,0),
 missingPanels:results.reduce((n,s)=>n+s.missingIndividualImages,0),approvedPanels:0
};
const report={schemaVersion:2,kind:'production-manifest-not-generated-art',
 generatedAt:new Date().toISOString(),qualityPolicy:'docs/story-stage-poster-production-manifest-v2.md',
 noPaidAPICalls:true,artGeneratorAttached:false,
 approvalPolicy:'NO_ARTWORK_MAY_BE_APPROVED_BY_THIS SCRIPT',
 nextStagePolicy:'Only advance to publishing the next stage when every gender and outcome has reviewed, byte-verified art and live game verification',
 qualityReferenceImages:qualityReference,totals,stages:results};
const output=argValue('--out',path.join('qa-reports','story-stage-production',start+'-through-'+stages.at(-1).id+'.json'));
if(!output||path.isAbsolute(output)||output.includes('..'))throw Error('Output must be a safe repository-relative path');
const dest=path.join(root,output);
fs.mkdirSync(path.dirname(dest),{recursive:true});
fs.writeFileSync(dest,JSON.stringify(report,null,2)+'\n','utf8');
console.log(JSON.stringify({output,totals,stageIds:stages.map(s=>s.stageId||s.id),qualityApproved:false,noPaidAPICalls:true}));
