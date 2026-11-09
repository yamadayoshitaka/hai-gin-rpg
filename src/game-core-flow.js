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
const freshInventory=()=>({potion:3,ether:1,antidote:2,iron_sword:1,leather_armor:1});
// Equipment is purchased per squad; one owned weapon/armor may serve one squad.
// Passive bonuses apply from battle start and never consume MP or command time.
export const TOWN_SHOP=Object.freeze([
 Object.freeze({id:'potion',name:'回復薬',price:30,category:'道具',description:'HPの回復に使う基本の薬'}),
 Object.freeze({id:'ether',name:'魔力水',price:65,category:'道具',description:'MPを補充する魔力水'}),
 Object.freeze({id:'antidote',name:'解毒薬',price:20,category:'道具',description:'毒を取り除く'}),
 Object.freeze({id:'iron_sword',name:'鉄の剣',price:120,category:'武器',description:'隊列の攻撃力+14%（常時）',attack:.14,jobs:['騎士','盾騎士']}),
 Object.freeze({id:'short_blade',name:'忍びの短刀',price:150,category:'武器',description:'隊列の攻撃力+12%（常時）',attack:.12,jobs:['忍者','シーフ']}),
 Object.freeze({id:'combat_wraps',name:'武闘拳帯',price:125,category:'武器',description:'隊列の攻撃力+10%（常時）',attack:.10,jobs:['格闘家']}),
 Object.freeze({id:'oak_staff',name:'樫の杖',price:95,category:'武器',description:'隊列の攻撃力+12%（常時）',attack:.12,jobs:['僧侶','魔法使い','召喚士']}),
 Object.freeze({id:'leather_armor',name:'革の鎧',price:90,category:'防具',description:'隊列の最大HP+10%（常時）',defense:.10}),
 Object.freeze({id:'chain_mail',name:'鎖かたびら',price:220,category:'防具',description:'隊列の最大HP+20%（常時）',defense:.20})
]);
export const TOWN_EVENTS=Object.freeze([
 Object.freeze({id:'revna-patrol',title:'城下の街道警備',stageId:'c01-s02',rewardGold:110,description:'街道の脅威を退け、商人の通行を守る'}),
 Object.freeze({id:'revna-recon',title:'森の探索依頼',stageId:'c01-s03',rewardGold:160,description:'森に現れた魔物と異変を調査する'}),
 Object.freeze({id:'revna-escort',title:'交易路の護衛',stageId:'c01-s04',rewardGold:220,description:'交易路を確保し、補給隊を助ける'})
]);
export const validGame=game=>Boolean(game?.coreVersion===CORE_VERSION&&
 validateSavedCampaign(game.campaign)&&
 Array.isArray(game.completedStages)&&game.completedStages.every(id=>!!CAMPAIGN_STAGE_BY_ID[id])&&
 typeof game.playerName==='string'&&game.inventory&&typeof game.inventory==='object');
export function createNewGame(name,appearance={}){
 const playerName=String(name||'').trim().slice(0,24);
 const campaign=createCampaign(playerName,appearance);
 // New games start with one equipped squad so its passive effect is visible immediately.
 if(campaign.squads[0])campaign.squads[0].equipment={weapon:'iron_sword',armor:'leather_armor'};
 return {coreVersion:CORE_VERSION,playerName,campaign,location:'town',townStage:'c01-s01',
  stage:'c01-s01',completedStages:['c01-s01'],wallet:300,inventory:freshInventory(),
  equipment:{weapon:null,armor:null},acceptedEvents:[],claimedEvents:[],storyFlags:{openingSeen:true},narrativeEnding:null,
  lastTown:'c01-s01',savedAt:null,settings:{bgm:true,voice:true,quality:'auto'},
  history:['第1章・レヴナの町で軍師としての旅が始まった。']};
}
export function migrateLegacy(old){
 if(!validateSavedCampaign(old))return null;
 return {coreVersion:CORE_VERSION,playerName:old.commander.name,campaign:plain(old),
 location:'town',townStage:'c01-s01',stage:'c01-s01',lastTown:'c01-s01',
 completedStages:['c01-s01'],wallet:300,inventory:freshInventory(),
 equipment:{weapon:null,armor:null},acceptedEvents:[],claimedEvents:[],storyFlags:{openingSeen:true,legacyMigrated:true},
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
 if(stage.kind==='town'){stageAtTown(game,id);return stage;}
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
// Purchased gear is a permanent, squad-wide passive, unlike time-limited strategist orders.
export function squadEquipmentBonus(squad){
 const gear=squad?.equipment||{};
 const weapon=TOWN_SHOP.find(item=>item.id===gear.weapon&&item.category==='武器');
 const armor=TOWN_SHOP.find(item=>item.id===gear.armor&&item.category==='防具');
 return {attack:weapon?.jobs&&squad?.job&&!weapon.jobs.includes(squad.job)?0:weapon?.attack||0,
  defense:armor?.defense||0,weapon:weapon?.id||null,armor:armor?.id||null};
}
export function equipSquadItem(game,squadId,itemId,category){
 if(!validGame(game)||game.location!=='town')throw Error('装備変更は町で行ってください。');
 const squad=game.campaign.squads.find(s=>s.id===Number(squadId)&&s.count>0);
 if(!squad)throw Error('隊列が見つかりません。');
 if(!['武器','防具'].includes(category))throw Error('装備の種類を確認してください。');
 const slot=category==='武器'?'weapon':'armor';
 const item=itemId?TOWN_SHOP.find(p=>p.id===itemId&&p.category===category):null;
 if(itemId&&!item)throw Error('存在しない装備です。');
 if(item?.jobs&&!item.jobs.includes(squad.job))throw Error(squad.job+'は'+item.name+'を装備できません。');
 if(item){
  const owned=Math.max(0,Number(game.inventory[item.id])||0);
  const inUse=game.campaign.squads.filter(s=>s!==squad&&s.count>0&&s.equipment?.[slot]===item.id).length;
  if(inUse>=owned)throw Error('この装備はほかの隊列で使用中です。もう1個購入してください。');
 }
 squad.equipment={...(squad.equipment||{}),[slot]:item?.id||null};
 return {squad,item,bonus:squadEquipmentBonus(squad)};
}
export function acceptTownEvent(game,eventId){
 if(!validGame(game)||game.location!=='town')throw Error('依頼は酒場で受けてください。');
 const event=TOWN_EVENTS.find(e=>e.id===eventId);
 if(!event)throw Error('依頼が見つかりません。');
 game.acceptedEvents??=[];
 if(game.acceptedEvents.includes(event.id))throw Error('その依頼は受注済みです。');
 game.acceptedEvents.push(event.id);
 game.history.unshift('酒場で「'+event.title+'」を受注した。');
 game.history=game.history.slice(0,50);
 return event;
}
export function claimTownEvent(game,eventId){
 if(!validGame(game)||game.location!=='town')throw Error('報酬の受取は酒場で行ってください。');
 const event=TOWN_EVENTS.find(e=>e.id===eventId);
 if(!event||!game.acceptedEvents?.includes(eventId))throw Error('受注していない依頼です。');
 if(!game.completedStages.includes(event.stageId))throw Error('依頼の攻略条件が未達成です。');
 game.claimedEvents??=[];
 if(game.claimedEvents.includes(eventId))throw Error('報酬は受取済みです。');
 game.claimedEvents.push(eventId);game.wallet+=event.rewardGold;
 game.history.unshift('酒場の「'+event.title+'」を報告。報酬+'+event.rewardGold+'G。');
 game.history=game.history.slice(0,50);
 return event;
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
