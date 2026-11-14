/**
 * One chapter, one canonical sequence, one human decision per actual image.
 * Used by the smartphone manga approval screen and trusted GitHub issue worker.
 * No automatic image approval occurs in this module.
 */
import {CAMPAIGN_STAGES} from './campaign-stage-plan.js';
import {comicEditionsForStage,comicForStage} from './story-chapter-comic.js';
import {registeredStoryPanelAsset} from './story-panel-registered-art.js';
export const REVIEW_BRANCH='story/chapter1-free-actual-art';
export const REVIEW_REPO='yamadayoshitaka/hai-gin-rpg';
export function editionContext(edition,gender){
 const c={protagonistGender:gender};
 if(edition==='post-victory')c.battleOutcome={victory:true};
 else if(edition==='post-defeat')c.battleOutcome={victory:false};
 else if(edition==='post-gameover')c.battleOutcome={victory:false,playerCommanderDead:true};
 else if(!['pre','post-town'].includes(edition))throw Error('Unknown edition '+edition);
 return c;
}
export function originalDraftPath(stageId,edition,gender,shotId,pageWithinVariant){
 const normalized=shotId.replace(/-m(\d{1,2})$/,(_,n)=>'-m'+String(Number(n)).padStart(2,'0'));
 return 'assets/story/chapter-drafts/c01/cloudflare-chapter1-free/'+stageId+'-'+edition+'-'+gender+
  '/p'+String(pageWithinVariant).padStart(2,'0')+'/'+normalized+'-'+edition+'-'+gender+'.webp';
}
export function legacyReviewProofPath(shot){
 const name=shot.id.replace(/-m(\d{1,2})$/,(_,n)=>'-m'+String(Number(n)).padStart(2,'0'))+
  '-'+shot.comicEdition+'-'+shot.protagonistGender+'.review.json';
 return 'assets/story/chapters/c01/art-reviews/legacy/'+name;
}
export function chapterOneReviewPages(){
 const pages=[],seen=new Set();
 for(const stage of CAMPAIGN_STAGES.filter(s=>s.chapter===1))
 for(const ed of comicEditionsForStage(stage.id))
 for(const gender of ['male','female']){
  const comic=comicForStage(stage.id,ed.phase,editionContext(ed.edition,gender));
  if(comic.edition!==ed.edition)throw Error('Canonical comic changed');
  for(let offset=0;offset<comic.panels.length;offset+=5){
   const within=Math.floor(offset/5)+1;
   const shots=comic.panels.slice(offset,offset+5).map(shot=>{
    const key=[stage.id,ed.edition,gender,shot.id].join('|');
    if(seen.has(key))throw Error('Duplicate canonical key '+key);
    seen.add(key);
    return {key,shotId:shot.id,scriptText:shot.subtitleText||shot.text||'',
     displayText:shot.text||'',speaker:shot.speaker||'語り手',
     characterId:shot.characterId||null,secondaryId:shot.secondaryId||null,
     sceneKind:shot.kind||null,scenery:shot.scenery||null,
     draftPath:originalDraftPath(stage.id,ed.edition,gender,shot.id,within),
     legacyPath:registeredStoryPanelAsset(shot),
     stageId:stage.id,gender,edition:ed.edition};
   });
   pages.push({number:pages.length+1,stageId:stage.id,
    stageName:stage.name||stage.id,edition:ed.edition,gender,pageWithinVariant:within,shots});
  }
 }
 if(pages.length!==132||seen.size!==462)throw Error('First chapter must remain 132 page tasks / 462 unique cuts');
 return pages;
}
export const EDITION_LABELS={
 pre:'戦闘前', 'post-town':'町イベント後','post-victory':'勝利後',
 'post-defeat':'敗北後','post-gameover':'軍師戦死・ゲームオーバー'
};
