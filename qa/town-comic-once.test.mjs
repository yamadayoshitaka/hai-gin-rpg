import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const map=fs.readFileSync('world-map.html','utf8'),town=fs.readFileSync('town-hub.html','utf8');
const stage={id:'c01-s01',kind:'town',chapter:1};
const handler=map.slice(map.indexOf('function beginSortie(stage){'),map.indexOf('function completeReturnedBattle()'));
assert.ok(handler.includes("$('sortie').onclick=()=>{"),'the stage sortie handler remains wired');
for(const legacy of [null,'chapter','opening']){
 const game={campaign:{},storyFlags:{}};let opened=0,launched=0,saved=null;
 if(legacy==='chapter')game.storyFlags.chapterOpenings={1:true};
 if(legacy==='opening')game.storyFlags.openingEventCompleted=true;
 const button={};const context={game,stageLaunching:false,selected:stage.id,CAMPAIGN_STAGE_BY_ID:{[stage.id]:stage},
  $:()=>button,stageUnlocked:()=>true,mapAudio:{unlock(){}},storyStageContext:()=>({}),
  message(){},showCampaignGameOver(){},currentStoryRoute:()=>true,
  saveSession(){saved=structuredClone(game);},launchSelectedStage(){launched++;},
  mangaViewer:{open(id,{onFinish}){opened++;onFinish();}}};
 vm.runInNewContext(handler,context);
 button.onclick();
 assert.equal(opened,legacy?0:1,'first visit or migrated completed opening');
 assert.equal(launched,1);
 context.stageLaunching=false;button.onclick();
 assert.equal(opened,legacy?0:1,'returning to the same town never reopens pre-comic');
 assert.equal(launched,2);
 if(!legacy)assert.equal(saved.storyFlags.stageMangaSeen[stage.id],true);
}
// A dismissed automatic pre-comic still has a receipt before completion.
let shown=0;const game={campaign:{},storyFlags:{}};const button={};
const cancelled={game,stageLaunching:false,selected:stage.id,CAMPAIGN_STAGE_BY_ID:{[stage.id]:stage},$:()=>button,
 stageUnlocked:()=>true,mapAudio:{unlock(){}},storyStageContext:()=>({}),saveSession(){},
 launchSelectedStage(){},mangaViewer:{open(){shown++;}},message(){}};
vm.runInNewContext(handler,cancelled);button.onclick();cancelled.stageLaunching=false;button.onclick();
assert.equal(shown,1,'skip/close before final panel does not cause another automatic replay');
const start=town.slice(town.indexOf("function startPaperStory(phase='pre')"),town.indexOf("$('skipPaper').onclick"));
const exit=town.slice(town.indexOf('let mapTransitionPending=false;'),town.indexOf("$('leaveTown').addEventListener"));
let views=0,maps=0,receipt=null;
function scene(flags={}){
 const nodes=new Map();const node=id=>{if(!nodes.has(id))nodes.set(id,{});return nodes.get(id);};
 const context={game:{townStage:stage.id,storyFlags:structuredClone(flags)},townReady:true,townChapter:1,paperPending:false,
  townManga:{stageName:'町'},STORY_CHAPTERS:[{title:'第1章'}],$:node,
  comicForStage:()=>({panels:[]}),storyStageContext:()=>({}),
  document:{querySelector:node},townAudio:{effect(){},setScene(){}},
  hideTownDialogue(){},resetTownMovement(){},closePanel(){},speakCurrentScene(){},
  persistSession(g){receipt=structuredClone(g.storyFlags);},sessionStorage:{},
  eventRender(){views++;assert.equal(receipt.stagePostMangaSeen[stage.id],true,'receipt exists before the first displayed post panel');},
  finishMapTransition(){maps++;}};
 vm.runInNewContext(start+'\n'+exit,context);return context;
}
let current=scene();current.goMap();assert.equal(views,1);assert.equal(maps,0);
current=scene(receipt);current.goMap();assert.equal(views,1);assert.equal(maps,1,'return and leave goes directly to map');
current.startPaperStory('post');assert.equal(views,2,'explicit replay still works');
assert.match(map,/stageNarration[\s\S]*mangaViewer\.open\(stage\.id,\{context:/);
assert.match(town,/showPaperStory'\)\.onclick=\(\)=>startPaperStory\(\)/);
console.log('PASS town comics once: entry, departure, skip/reload, old opening receipts and explicit replay');
