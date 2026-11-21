/**
 * Tavern's in-game-currency companion lottery.
 * All rolls are planned and validated before mutating wallet or army.
 * Recruits go to reserve, where the training-ground formation planner can assign them.
 * No real-money payments or external APIs.
 */
import {JOBS,RARITIES,JOB_FACE_VARIANTS,troopCount} from './story-campaign.js';
import {CHARACTER_MODEL_REGISTRY} from './character-model-registry.js';

export const TAVERN_GACHA=Object.freeze({
 normal:Object.freeze({id:'normal',title:'ノーマルガチャ',cost:100,count:1,ur:.02,r:.20,description:'基本の仲間募集。騎士・忍者・僧侶などが加わります。'}),
 rare:Object.freeze({id:'rare',title:'レアガチャ',cost:300,count:1,ur:.07,r:.48,description:'R以上の仲間が出やすい特別募集。'}),
 ten:Object.freeze({id:'ten',title:'10連ガチャ',cost:2700,count:10,ur:.07,r:.48,description:'レア募集10回分が10%お得。R以上1人確定。'})
});
const escapeHtml=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','"':'&quot;',"'":'&#39;'}[c]));
const rarityRank={N:0,R:1,UR:2};
function unit(random){
 const n=Number(random());
 if(!Number.isFinite(n)||n<0||n>=1)throw Error('抽選乱数が正しくありません。');
 return n;
}
function priorHistory(game){
 const history=game.recruitGacha||{};
 return {
  total:Number.isInteger(history.total)?history.total:0,
  sinceUR:Number.isInteger(history.sinceUR)?history.sinceUR:0,
  sinceR:Number.isInteger(history.sinceR)?history.sinceR:0,
  history:Array.isArray(history.history)?history.history:[]
 };
}
export function drawTavernGacha(game,modeId='normal',random=Math.random){
 const mode=TAVERN_GACHA[modeId];
 if(!mode)throw Error('ガチャの種類を確認してください。');
 const army=game?.campaign;
 if(game?.location!=='town'||!army||!Array.isArray(army.squads))throw Error('酒場で仲間を募集してください。');
 if(army.gameOver)throw Error('ゲーム終了後は仲間を募集できません。');
 if(!Number.isFinite(game.wallet)||game.wallet<mode.cost)throw Error('所持金が不足しています（'+mode.cost+'G必要）。');
 if(troopCount(army)+mode.count>1000)throw Error('兵士の上限1000人を超えます。');
 if(!Number.isInteger(army.nextSquadId))throw Error('軍団の登録情報が正しくありません。');
 const old=priorHistory(game),entries=[];
 let sinceUR=old.sinceUR,sinceR=old.sinceR;
 let hasRare=false;
 for(let i=0;i<mode.count;i++){
  const n=unit(random);
  let rarity=sinceUR+1>=40?'UR':sinceR+1>=10?'R':
   n<mode.ur?'UR':n<mode.ur+mode.r?'R':'N';
  // The ten-draw offer always includes at least one R or UR.
  if(modeId==='ten'&&i===mode.count-1&&!hasRare&&rarity==='N')rarity='R';
  hasRare ||=rarity!=='N';
  const job=JOBS[Math.floor(unit(random)*JOBS.length)];
  const sex=unit(random)<.42?'female':'male';
  const faceId=Math.floor(unit(random)*JOB_FACE_VARIANTS);
  const modelId=CHARACTER_MODEL_REGISTRY[sex]?.id;
  if(!modelId)throw Error('仲間モデルを確認できません。');
  const entry={id:army.nextSquadId+i,job,rarity,modelId,faceId,sex,source:'tavern-gacha',mode:modeId,cost:mode.cost/mode.count};
  entries.push(entry);
  sinceUR=rarity==='UR'?0:sinceUR+1;
  sinceR=rarity==='N'?sinceR+1:0;
 }
 // Single commit point; RNG failure, shortage and bad model leave no changes.
 game.wallet-=mode.cost;
 army.nextSquadId+=entries.length;
 army.squads.push(...entries.map(e=>({
  id:e.id,job:e.job,rarity:e.rarity,count:1,purpose:'前線',
  commanderId:'reserve',faceId:e.faceId,modelId:e.modelId,source:e.source
 })));
 game.recruitGacha={
  ...game.recruitGacha,total:old.total+entries.length,sinceUR,sinceR,last:entries.at(-1),
  history:[...entries.slice().reverse(),...old.history].slice(0,20)
 };
 army.log??=[];
 army.log.unshift('酒場ガチャで仲間'+entries.length+'人を募集しました（'+mode.cost+'G）。');
 army.log=army.log.slice(0,40);
 return {mode:modeId,cost:mode.cost,balance:game.wallet,entries,
  highestRarity:entries.reduce((highest,e)=>rarityRank[e.rarity]>rarityRank[highest]?e.rarity:highest,'N')};
}

export function renderTavernGacha(game){
 const left=Math.max(0,1000-troopCount(game.campaign));
 const wallet=Number(game.wallet)||0;
 return '<div class="gachaIntro"><p>酒場で冒険者を募集します。獲得した仲間は<strong>予備隊</strong>に登録され、軍訓練所で編成できます。</p>'+
  '<div class="gachaBalance"><span>所持金 <b>'+wallet+'G</b></span><span>空き兵士枠 <b>'+left+'人</b></span></div></div>'+
  '<div class="gachaOptions">'+Object.values(TAVERN_GACHA).map(mode=>
   '<div class="gachaOption"><div><strong>'+mode.title+'</strong><small>'+mode.description+'</small>'+
    '<span class="gachaPrice">'+mode.cost+'G'+(mode.count===10?' / 10回':' / 1回')+'</span></div>'+
    '<button type="button" data-tavern-gacha="'+mode.id+'" '+(wallet<mode.cost||left<mode.count?'disabled':'')+'>引く</button></div>'
  ).join('')+'</div>'+
  '<p class="gachaOdds">排出率 N/R/UR：通常78/20/2%、レア・10連45/48/7%。累計40回目までにUR、10回目までにR以上確定。すべてゲーム内Gのみ。</p>'+
  '<div class="controls gachaActions"><button type="button" class="primary" data-tavern-gacha="ten" '+(wallet<2700||left<10?'disabled':'')+'>✦ 10連を引く</button><button type="button" id="keepWalking">町へ戻る</button></div>';
}

const JOB_SYMBOLS={'騎士':'⚔','盾騎士':'🛡','忍者':'✦','シーフ':'◆','僧侶':'✚','魔法使い':'✧','召喚士':'♜','格闘家':'♛'};
export function renderTavernGachaResult(result){
 const highest=result.highestRarity;
 return '<div class="gachaRevealOverlay" role="group" aria-label="ガチャ抽選結果" tabindex="-1">'+
  '<div class="gachaPortal" aria-hidden="true"><span class="gachaPortalRing"></span><span class="gachaPortalCore">✦</span></div>'+
  '<div class="gachaRevealHeading"><span>召喚成功</span><strong class="rarity-'+highest+'">'+
  (highest==='UR'?'✦ UR 煌めく邂逅 ✦':highest==='R'?'✦ R 新たな仲間 ✦':'新たな仲間')+'</strong></div>'+
  '<div class="gachaResults '+(result.entries.length===1?'single':'multi')+'">'+result.entries.map((entry,i)=>
   '<div class="gachaResultCard rarity-'+entry.rarity+'" style="--reveal-index:'+i+'"><div class="gachaResultGlow">✧</div>'+
   '<div class="gachaResultIcon" aria-hidden="true">'+(JOB_SYMBOLS[entry.job]||'✦')+'</div>'+
   '<div class="gachaResultRarity">'+escapeHtml(RARITIES[entry.rarity].label)+'</div>'+
   '<strong>'+escapeHtml(entry.job)+'</strong><small>予備隊へ加入</small></div>'
  ).join('')+'</div>'+
  '<p class="gachaSummary">'+result.entries.length+'人が仲間になりました。残高 '+result.balance+'G</p>'+
  '<div class="gachaResultButtons"><button type="button" data-gacha-skip>演出スキップ</button>'+
  '<button type="button" class="primary" data-gacha-close>結果を閉じる</button></div></div>';
}
