/**
 * Chapter-first comic production source. Legacy story IDs and game saves stay
 * untouched; an edition can contain ANY positive number of authored scenes.
 * Game screens and chapter production use exactly this resolver.
 */
import {CAMPAIGN_STAGE_BY_ID,CAMPAIGN_STAGES} from './campaign-stage-plan.js';
import {mangaForStage} from './story-stage-manga.js';
import {storyVoiceText} from './story-pronunciations.js';
import {storyDecisionForStage,ROUTES,ENDING_GUIDE} from './story-narrative-flow.js';

export const STORY_MAX_CELLS_PER_SHEET=10; // production sheet size, NOT a story-panel quota
const safeId=s=>/^[a-z][a-z0-9-]*$/.test(s);
const genderValid=g=>g==='male'||g==='female';
export function comicEditionKey(stageId,phase,context={}){
 const stage=CAMPAIGN_STAGE_BY_ID[stageId];
 if(!stage)throw Error('Unknown comic stage '+String(stageId));
 if(phase!=='pre'&&phase!=='post')throw Error('Unknown comic phase '+String(phase));
 const parts=[phase];
 if(phase==='post'){
  const status=stage.kind==='town'?'town':
   context?.battleOutcome?.victory===true?'victory':
   context?.battleOutcome?.victory===false?'defeat':'preview';
  parts.push(status);
 }
 const decision=storyDecisionForStage(stageId);
 if(context?.decision!=null){
  if(!decision?.choices.some(([id])=>id===context.decision))
   throw Error('Invalid chapter decision '+context.decision+' for '+stageId);
  parts.push('choice-'+context.decision);
 }
 if(stage.chapter>=13){
  const route=context?.route||'silver';
  if(!ROUTES.some(r=>r.id===route))throw Error('Invalid story cooperation '+route);
  parts.push('route-'+route);
 }
 if(stageId==='c20-s10'&&phase==='post'&&context?.battleOutcome?.victory===true&&context?.storyEnding){
  if(!ENDING_GUIDE.some(e=>e.id===context.storyEnding))throw Error('Invalid story ending');
  parts.push('ending-'+context.storyEnding);
 }
 const key=parts.join('-');
 if(!safeId(key))throw Error('Unsafe comic edition: '+key);
 return key;
}
function branchShot(base,stageId,phase,slug,text){
 const reference=base[base.length-1];
 if(!reference||!text.trim())throw Error('Cannot create empty branch scene');
 return Object.freeze({...reference,
  id:stageId+'-branch-'+phase+'-'+slug,kind:'story-choice',
  speaker:'語り手',characterId:null,secondaryId:null,role:'物語',
  text,subtitleText:text,voiceText:storyVoiceText(text),hasVoice:true});
}
export function comicForStage(stageId,phase,context={}){
 const stage=CAMPAIGN_STAGE_BY_ID[stageId];
 const edition=comicEditionKey(stageId,phase,context);
 const original=mangaForStage(stageId,context);
 const source=original.panels.filter(p=>p.phase===phase);
 if(!source.length)throw Error('Empty comic phase '+stageId+' '+phase);
 const scenes=[...source];
 const decision=storyDecisionForStage(stageId);
 if(context?.decision&&decision){
  const selected=decision.choices.find(([id])=>id===context.decision);
  const text=phase==='pre'
   ?'軍師が選んだ方針は「'+selected[1]+'」。仲間と手順を確かめ、結果はまだ決まっていない。'
   :'軍師は「'+selected[1]+'」という方針で行動した。実際の成果は戦闘記録に基づいて判断される。';
  scenes.splice(Math.max(0,scenes.length-1),0,branchShot(source,stageId,phase,'choice-'+selected[0],text));
 }
 if(stage.chapter>=13){
  const route=ROUTES.find(r=>r.id===(context.route||'silver'));
  const text=phase==='pre'
   ?'灰銀の軍師は「'+route.name+'」の協力方針で、この地の人々と向き合う。'
   :'「'+route.name+'」の仲間に戦況を伝える。勝敗だけで今後の協力関係は決まらない。';
  scenes.splice(Math.max(0,scenes.length-1),0,branchShot(source,stageId,phase,'route-'+route.id,text));
 }
 if(stageId==='c20-s10'&&phase==='post'&&context?.battleOutcome?.victory===true&&context?.storyEnding){
  const ending=ENDING_GUIDE.find(x=>x.id===context.storyEnding);
  scenes.push(branchShot(source,stageId,phase,'ending-'+ending.id,
   '軍師は星鐘の未来として「'+ending.name+'」を選んだ。'+ending.summary+'。'));
 }
 const panels=Object.freeze(scenes.map((p,i)=>Object.freeze({
  ...p,protagonistGender:genderValid(context.protagonistGender)?context.protagonistGender:'unspecified',
  comicPhase:phase,comicEdition:edition,comicPosition:i,
  comicPage:Math.floor(i/STORY_MAX_CELLS_PER_SHEET)+1,
  comicCell:i%STORY_MAX_CELLS_PER_SHEET
 })));
 if(new Set(panels.map(p=>p.id)).size!==panels.length)throw Error('Duplicate panel in edition: '+edition);
 const pages=Object.freeze(Array.from({length:Math.ceil(panels.length/STORY_MAX_CELLS_PER_SHEET)},(_,i)=>{
  const contents=panels.slice(i*STORY_MAX_CELLS_PER_SHEET,(i+1)*STORY_MAX_CELLS_PER_SHEET);
  return Object.freeze({number:i+1,columns:2,rows:Math.ceil(contents.length/2),
   cellCount:contents.length,panelIds:contents.map(p=>p.id)});
 }));
 return Object.freeze({...original,phase,edition,panels,pages,
  chapter:stage.chapter,stageId:stage.id});
}
/** Every meaningful route/outcome/decision is enumerated for a whole-chapter job. */
export function comicEditionsForStage(stageId){
 const stage=CAMPAIGN_STAGE_BY_ID[stageId];
 if(!stage)throw Error('Unknown comic stage '+stageId);
 const choices=storyDecisionForStage(stageId)?.choices.map(([id])=>id)||[];
 const decisions=[null,...choices];
 const routes=stage.chapter>=13?ROUTES.map(r=>r.id):[null];
 const outputs=stage.kind==='town'?[null]:[true,false];
 const editions=new Map();
 for(const decision of decisions)for(const route of routes){
  const shared={decision,route,protagonistGender:'male'};
  const pre=comicForStage(stageId,'pre',shared);
  editions.set(pre.edition,pre);
  for(const victory of outputs){
   const context=victory===null?shared:{...shared,battleOutcome:{victory}};
   const post=comicForStage(stageId,'post',context);
   editions.set(post.edition,post);
   if(stageId==='c20-s10'&&victory===true)for(const ending of ENDING_GUIDE){
    const special=comicForStage(stageId,'post',{...context,storyEnding:ending.id});
    editions.set(special.edition,special);
   }
  }
 }
 return Object.freeze([...editions.values()]);
}
export function comicChapterPlan(chapter){
 const id=Number(chapter);
 if(!Number.isInteger(id)||id<1||id>20)throw Error('Chapter must be 1..20');
 const stages=CAMPAIGN_STAGES.filter(s=>s.chapter===id);
 if(stages.length!==10)throw Error('Chapter does not have ten stages: '+id);
 const editions=stages.flatMap(s=>comicEditionsForStage(s.id));
 return Object.freeze({chapter:id,stageCount:stages.length,
  stageIds:stages.map(s=>s.id),editions});
}
export function comicPageAsset(stageId,phase,context,pageNumber,gender){
 const edition=comicEditionKey(stageId,phase,context);
 if(!genderValid(gender))return null;
 const page=Number(pageNumber);
 if(!Number.isInteger(page)||page<1||page>99)throw Error('Invalid comic page');
 const ch=stageId.slice(0,3);
 return './assets/story/chapters/'+ch+'/'+stageId+'-'+edition+'-'+gender+'-p'+String(page).padStart(2,'0')+'.webp';
}
