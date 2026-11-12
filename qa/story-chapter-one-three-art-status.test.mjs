import assert from "node:assert/strict";
import {existsSync,readFileSync} from "node:fs";
import {comicForStage,comicPageAsset} from "../src/story-chapter-comic.js";
import {CAMPAIGN_STAGE_BY_ID} from "../src/campaign-stage-plan.js";
const required=[],stageIds=["c01-s01","c01-s02","c01-s03"];
for(const stageId of stageIds){
 const stage=CAMPAIGN_STAGE_BY_ID[stageId];assert(stage,"Missing canonical stage "+stageId);
 for(const gender of ["male","female"]){
  const outcomes=stage.kind==="town"?["pre","town"]:["pre","victory","defeat","gameover"];
  for(const outcome of outcomes){
   const phase=outcome==="pre"?"pre":"post";
   const context={protagonistGender:gender,...(outcome==="victory"?{battleOutcome:{victory:true}}:outcome==="defeat"?{battleOutcome:{victory:false}}:outcome==="gameover"?{battleOutcome:{victory:false,playerCommanderDead:true}}:{})};
   const comic=comicForStage(stageId,phase,context);
   assert.equal(comic.panels.length,stage.kind==="town"?(phase==="pre"?10:5):(phase==="pre"?8:outcome==="gameover"?2:7),stageId+" "+outcome);
   assert(comic.panels.every(p=>p.protagonistGender===gender),"Wrong protagonist gender "+stageId);
   assert(comic.panels.every(p=>typeof p.voiceText==="string"&&p.voiceText.length>0),"Missing voice line "+stageId);
   const paths=comic.pages.map(p=>comicPageAsset(stageId,phase,context,p.number,gender));
   assert.equal(paths.length,1,"Unexpected multi-sheet for "+stageId+" "+outcome);
   assert(paths.every(p=>p.endsWith("-"+gender+"-p01.webp")),"Gender isolation failed");
   if(outcome==="gameover"){
    assert(comic.panels.some(p=>/戦死|ゲームオーバー/.test(p.text)),"Missing verified death aftermath");
    assert(!comic.panels.some(p=>/帰還し|勝利が確認/.test(p.text)),"Impossible death story");
   }
   if(outcome==="victory")assert(comic.panels.some(p=>/勝利/.test(p.text)),"Victory receipt missing");
   if(outcome==="defeat")assert(comic.panels.some(p=>/未達|撤退/.test(p.text)),"Defeat must not look like victory");
   required.push(...paths);
  }
 }
}
assert.equal(required.length,20,"Three stages require 20 gender/outcome art sheets");
assert.equal(new Set(required).size,required.length,"A male/female or outcome asset was reused");
const registered=required.filter(path=>existsSync(path.slice(2)));
console.log("第1章 第1〜3ステージ：原画",registered.length,"/",required.length,"登録あり。登録と人間の完成承認は別。");
const html=readFileSync(new URL("../story-first-three-art-status.html",import.meta.url),"utf8");
assert(html.includes('comicPageAsset(')&&html.includes('主人公戦死後')&&html.includes('未登録'));
