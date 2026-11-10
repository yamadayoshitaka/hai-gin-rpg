/**
 * In-game-money-only troop lottery. Draws enter the reserve roster and use
 * the registered Quaternius full-body character family; no external payment.
 */
import {JOBS, RARITIES, troopCount, JOB_FACE_VARIANTS} from './story-campaign.js';
import {CHARACTER_MODEL_REGISTRY} from './character-model-registry.js';
export const RECRUIT_GACHA=Object.freeze({
 cost:150,rarities:Object.freeze({N:.78,R:.20,UR:.02}),
 guaranteedURAfter:40,guaranteedRAfter:10
});
function randomUnit(random){
 const x=Number(random());
 if(!Number.isFinite(x)||x<0||x>=1)throw Error('無効な抽選乱数です。');
 return x;
}
export function drawRecruitGacha(game,random=Math.random){
 const army=game?.campaign;
 if(!army||!Array.isArray(army.squads))throw Error('軍団データを確認できません。');
 if(army.gameOver)throw Error('ゲーム終了後は召喚できません。');
 if(army.treasury<RECRUIT_GACHA.cost)throw Error('軍資金が不足しています（150G必要）。');
 if(troopCount(army)>=1000)throw Error('全軍1000人の上限に達しています。');
 const prior=game.recruitGacha||{total:0,sinceUR:0,sinceR:0,history:[]};
 const rolled=randomUnit(random());
 const rarity=prior.sinceUR+1>=RECRUIT_GACHA.guaranteedURAfter?'UR':
  prior.sinceR+1>=RECRUIT_GACHA.guaranteedRAfter?'R':
  rolled<.02?'UR':rolled<.22?'R':'N';
 const job=JOBS[Math.floor(randomUnit(random)*JOBS.length)];
 const sex=randomUnit(random)<.42?'female':'male';
 const faceId=Math.floor(randomUnit(random)*JOB_FACE_VARIANTS);
 const modelId=CHARACTER_MODEL_REGISTRY[sex].id;
 const squad={
  id:army.nextSquadId++,job,rarity,count:1,purpose:'前線',
  commanderId:'reserve',faceId,modelId,source:'inn-gacha'
 };
 // Atomic in-memory mutation after all preconditions and RNG checks succeed.
 army.treasury-=RECRUIT_GACHA.cost;
 army.squads.push(squad);
 const entry={id:squad.id,job,rarity,modelId,faceId,cost:RECRUIT_GACHA.cost};
 game.recruitGacha={
  total:(prior.total||0)+1,
  sinceUR:rarity==='UR'?0:(prior.sinceUR||0)+1,
  sinceR:rarity!=='N'?0:(prior.sinceR||0)+1,
  last:entry,
  history:[entry,...(prior.history||[])].slice(0,20)
 };
 army.log??=[];
 army.log.unshift('宿屋の召喚で'+job+'（'+RARITIES[rarity].label+'）が仲間になりました。');
 army.log=army.log.slice(0,40);
 return entry;
}
