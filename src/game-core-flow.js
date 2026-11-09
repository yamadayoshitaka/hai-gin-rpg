/**
 * Single player session. Town is the only persistent save location.
 * On-map/battle changes live in sessionStorage until the player returns to town.
 */
import {createCampaign,validateSavedCampaign} from './story-campaign.js';
import {CAMPAIGN_STAGE_BY_ID,stageUnlocked,nextCampaignStage} from './campaign-stage-plan.js';
export const GAME_SAVE_KEY='hai-gin-core-slot-1';
export const GAME_SESSION_KEY='hai-gin-core-active-v1';
export const OLD_CAMPAIGN_KEY='hai-gin-story-campaign-v1';
export const CORE_VERSION=1;
const plain=x=>JSON.parse(JSON.stringify(x));
const read=(storage,key)=>{try{return JSON.parse(storage?.getItem(key)||'null')}catch{return null}};
const write=(storage,key,value)=>{storage?.setItem(key,JSON.stringify(value));return value};
const freshInventory=()=>({potion:3,ether:1,antidote:2});
export const TOWN_SHOP=Object.freeze([
 Object.freeze({id:'potion',name:'回復薬',price:30,category:'道具',description:'HPの回復に使う基本の薬'}),
 Object.freeze({id:'ether',name:'魔力水',price:65,category:'道具',description:'MPを補充する魔力水'}),
 Object.freeze({id:'antidote',name:'解毒薬',price:20,category:'道具',description:'毒を取り除く'}),
 Object.freeze({id:'iron_sword',name:'鉄の剣',price:120,category:'武器',description:'剣士・騎士向けの標準剣'}),
 Object.freeze({id:'oak_staff',name:'樫の杖',price:95,category:'武器',description:'僧侶と魔法使いの杖'}),
 Object.freeze({id:'leather_armor',name:'革の鎧',price:90,category:'防具',description:'身軽さを保つ防具'}),
 Object.freeze({id:'chain_mail',name:'鎖かたびら',price:220,category:'防具',description:'前衛用の防具'})
]);
export const validGame=game=>Boolean(game?.coreVersion===CORE_VERSION&&
 validateSavedCampaign(game.campaign)&&
 Array.isArray(game.completedStages)&&game.completedStages.every(id=>!!CAMPAIGN_STAGE_BY_ID[id])&&
 typeof game.playerName==='string'&&game.inventory&&typeof game.inventory==='object');
export function createNewGame(name,appearance={}){
 const playerName=String(name||'').trim().slice(0,24);
 const campaign=createCampaign(playerName,appearance);
 return {coreVersion:CORE_VERSION,playerName,campaign,location:'town',townStage:'c01-s01',
  stage:'c01-s01',completedStages:['c01-s01'],wallet:300,inventory:freshInventory(),
  equipment:{weapon:null,armor:null},storyFlags:{openingSeen:true},narrativeEnding:null,
  lastTown:'c01-s01',savedAt:null,settings:{bgm:true,voice:true,quality:'auto'},
  history:['第1章・レヴナの町で軍師としての旅が始まった。']};
}
export function migrateLegacy(old){
 if(!validateSavedCampaign(old))return null;
 return {coreVersion:CORE_VERSION,playerName:old.commander.name,campaign:plain(old),
 location:'town',townStage:'c01-s01',stage:'c01-s01',lastTown:'c01-s01',
 completedStages:['c01-s01'],wallet:300,inventory:freshInventory(),
 equipment:{weapon:null,armor:null},storyFlags:{openingSeen:true,legacyMigrated:true},
 narrativeEnding:old.narrativeEnding||null,savedAt:null,
 settings:{bgm:true,voice:true,quality:'auto'},
 history:['旧ストーリーの軍師・軍団・領地を引き継いだ。町で保存してください。']};
}
export function getSavedGame(storage){
 const saved=read(storage,GAME_SAVE_KEY);
 if(validGame(saved))return saved;
 return migrateLegacy(read(storage,OLD_CAMPAIGN_KEY));
}
export function loadGame(storage,sessionStorage){
 const active=read(sessionStorage,GAME_SESSION_KEY);
 return validGame(active)?active:getSavedGame(storage);
}
export function stageAtTown(game,id=game.townStage){
 if(!validGame(game))throw Error('ゲームデータが正しくありません。');
 const stage=CAMPAIGN_STAGE_BY_ID[id];
 if(!stage||stage.kind!=='town')throw Error('町のステージを選んでください。');
 if(!stageUnlocked(stage,game.completedStages))throw Error('まだ行けない町です。');
 game.location='town';game.stage=id;game.townStage=id;game.lastTown=id;
 if(!game.completedStages.includes(id))game.completedStages.push(id);
 return game;
}
export function leaveTown(game){
 if(!validGame(game)||game.location!=='town')throw Error('町から出発してください。');
 game.location='map';return game;
}
export function selectCampaignStage(game,id){
 if(!validGame(game)||game.location!=='map')throw Error('ワールドマップから選んでください。');
 const stage=CAMPAIGN_STAGE_BY_ID[id];
 if(!stage||!stageUnlocked(stage,game.completedStages))throw Error('まだ挑戦できないステージです。');
 if(stage.kind==='town')return stageAtTown(game,id);
 game.stage=id;return stage;
}
export function markStageVictory(game,id,receipt){
 if(!validGame(game))throw Error('ゲームデータが正しくありません。');
 const stage=CAMPAIGN_STAGE_BY_ID[id];
 if(!stage||!stageUnlocked(stage,game.completedStages))throw Error('未解放のステージです。');
 if(stage.kind==='town')throw Error('町は討伐戦ではありません。');
 // A proper battle adapter must provide authoritative victory state.
 if(!receipt||receipt.verified!==true||receipt.victory!==true)throw Error('戦闘結果が確認できません。');
 if(stage.kind==='explore'&&receipt.monstersRemaining!==0)throw Error('まだモンスターが残っています。');
 if(['capture','defend','siege','boss'].includes(stage.kind)&&receipt.objectiveCompleted!==true)
  throw Error('ステージの勝利条件が未達成です。');
 if(!game.completedStages.includes(id)){
  game.completedStages.push(id);
  game.history.unshift('第'+stage.chapter+'章 '+stage.slot+'/10：'+stage.name+'を突破。');
  game.history=game.history.slice(0,50);
 }
 const next=nextCampaignStage(id);
 if(next?.kind==='town'&&!game.completedStages.includes(next.id))game.history.unshift('次の町「'+next.name+'」への道が開いた。');
 return next;
}
export function buyTownItem(game,itemId,quantity=1){
 if(!validGame(game)||game.location!=='town')throw Error('買い物は町で行ってください。');
 const item=TOWN_SHOP.find(p=>p.id===itemId);
 if(!item||!Number.isInteger(quantity)||quantity<1||quantity>20)throw Error('商品と個数を確認してください。');
 const price=item.price*quantity;
 if(game.wallet<price)throw Error('所持金が不足しています。');
 game.wallet-=price;game.inventory[itemId]=(Number(game.inventory[itemId])||0)+quantity;
 return {item,quantity,price,balance:game.wallet};
}
export function equipTownItem(game,itemId){
 if(game?.location!=='town')throw Error('装備変更は町で行ってください。');
 const item=TOWN_SHOP.find(p=>p.id===itemId);
 if(!item||!['武器','防具'].includes(item.category)||!(game.inventory[itemId]>0))throw Error('所持していない装備です。');
 game.equipment[item.category==='武器'?'weapon':'armor']=item.id;
}
export function saveAtTown(game,storage,sessionStorage){
 if(!validGame(game)||game.location!=='town')throw Error('セーブは町でのみ可能です。');
 game.savedAt=new Date().toISOString();
 write(storage,GAME_SAVE_KEY,plain(game));
 write(sessionStorage,GAME_SESSION_KEY,plain(game));
 return game;
}
export function persistSession(game,sessionStorage){
 if(!validGame(game))throw Error('ゲームデータが正しくありません。');
 return write(sessionStorage,GAME_SESSION_KEY,plain(game));
}
export function startNewSession(game,sessionStorage){
 if(!validGame(game))throw Error('ゲームデータが正しくありません。');
 return write(sessionStorage,GAME_SESSION_KEY,plain(game));
}
