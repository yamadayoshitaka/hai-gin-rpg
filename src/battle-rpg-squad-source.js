/**
 * Read-only adapter from live battle squad summaries to the mobile RPG HUD.
 * All effects are sourced from combat state; no invented ailments or buffs.
 */
import {displayBattleJobName} from './battle-job-squads.js';
import {strengthFromHp} from './battle-command-doctrine.js';
export function makeBattleRpgStatusRows({
 sums,units=[],allyIds=[],enemyIds=[],getJob=()=>'',getMode=()=>null,
 mass=false,now=0,simTime=now,itemTypes={},auras=new Map(),
 skirmishBuffs=new Map(),massDebuffs=new Map(),skirmishDebuffs=new Map(),commanderRallies=new Map()
}={}){
 const safeIds=[allyIds,enemyIds];
 const maxHpBySquad=new Map(),mpBySquad=new Map(),maxMpBySquad=new Map();
 for(const unit of units){
  const key=String(unit.team)+':'+String(unit.squadId);
  maxHpBySquad.set(key,(maxHpBySquad.get(key)||0)+Math.max(0,Number(unit.maxHp)||0));
  maxMpBySquad.set(key,(maxMpBySquad.get(key)||0)+Math.max(0,Number(unit.maxMp)||0));
  if(unit.alive!==false&&Number(unit.hp)>0)
   mpBySquad.set(key,(mpBySquad.get(key)||0)+Math.max(0,Number(unit.mp)||0));
 }
 function effectsFor(team,id){
  const key=team+':'+id,effects=[];
  const put=(kind,label,value,seconds)=>{
   if(!(Number(value)>0)||!(seconds>0))return;
   effects.push({kind,label:label+Math.round(Number(value)*100)+'%',seconds});
  };
  const buffs=[];
  if(team===0){
   if(mass){
    for(const [auraId,fx] of auras){
     if(!auraId.startsWith(String(id)+':')||!(fx.until>now))continue;
     const item=itemTypes[auraId.slice(String(id).length+1)];
     if(item)buffs.push({...item,until:fx.until});
    }
   }else{
    for(const buff of skirmishBuffs.get(String(id))||[])
     if(buff.until>now)buffs.push(buff);
   }
   for(const buff of buffs){
    for(const [stat,label] of [['attack','攻↑'],['defense','防↑'],['speed','速↑']])
     put('buff',label,buff[stat],buff.until-now);
   }
  }
  for(const buff of commanderRallies.get(String(id))||[]){
   if(team!==0||buff.until<=now)continue;
   for(const [stat,label] of [['attack','攻↑'],['defense','防↑'],['speed','速↑']])
    put('buff',label,buff[stat],buff.until-now);
  }
  const debuff=mass?massDebuffs?.get(key):
   team===1?skirmishDebuffs?.get(String(id)):null;
  const clock=mass?simTime:now;
  if(debuff?.until>clock){
   for(const [stat,label] of [['attack','攻↓'],['defense','防↓'],['speed','速↓']])
    put('debuff',label,debuff[stat],debuff.until-clock);
   for(const [stat,label] of [['heal_block','回復阻害'],['buff_block','強化阻害']])
    if(Number(debuff[stat])>0)effects.push({kind:'debuff',label,seconds:debuff.until-clock});
  }
  return effects;
 }
 const rows=[];
 for(let team=0;team<2;team++)for(const [index,id] of safeIds[team].entries()){
  const key=team+':'+String(id),stat=sums?.get(key),alive=Number(stat?.n)||0;
  const job=displayBattleJobName(getJob(id,team)||'部隊');
  rows.push({team,id:String(id),name:'第'+(index+1)+'隊 '+job,job,
   alive,total:Number(stat?.total)||0,hp:Number(stat?.hp)||0,
   maxHp:maxHpBySquad.get(key)||Number(stat?.maxHp)||0,
   mp:mpBySquad.get(key)||0,maxMp:maxMpBySquad.get(key)||0,
   attackPercent:Math.round(strengthFromHp(Number(stat?.hp)||0,
    maxHpBySquad.get(key)||Number(stat?.maxHp)||1)*100),
   mode:getMode(id,team),effects:effectsFor(team,id),
   center:alive>0?{x:stat.x/alive,z:stat.z/alive}:null});
 }
 // Evaluate both armies before removing temporary centroids. Mutating centroids
 // in the same loop would mark the first side as engaged but not the second.
 for(const row of rows){
  row.inContact=Boolean(row.center&&rows.some(other=>other.team!==row.team&&other.center&&
   Math.hypot(row.center.x-other.center.x,row.center.z-other.center.z)<=10));
 }
 for(const row of rows)delete row.center;
 return rows;
}


/**
 * Campaign-only HUD adapter. The battle engine still controls the real job
 * squads independently; the visual roster groups them under the three actual
 * inn sortie teams. Never aggregate the enemy, or pass these synthetic IDs to
 * the realtime unit-command engine.
 */
export function aggregateBattleRpgTeams(rows,groupBySquad={}){
 const all=Array.isArray(rows)?rows:[];
 const teams=new Map();
 for(const row of all){
  if(Number(row.team)!==0)continue;
  const requested=Number(groupBySquad[String(row.id)]);
  const groupId=Number.isInteger(requested)&&requested>=1&&requested<=3?requested:1;
  if(!teams.has(groupId))teams.set(groupId,[]);
  teams.get(groupId).push(row);
 }
 const sum=(members,key)=>members.reduce((total,row)=>total+(Number(row[key])||0),0);
 const allies=[...teams].sort((a,b)=>a[0]-b[0]).map(([groupId,members])=>{
  const jobs=[...new Set(members.map(row=>String(row.job||'兵士')))];
  const totalMaxHp=sum(members,'maxHp');
  const effects=[...new Map(members.flatMap(row=>row.effects||[])
   .map(effect=>[effect.kind+':'+effect.label,effect])).values()];
  return {
   team:0,id:'team:'+groupId,groupId,
   name:'第'+groupId+'隊',job:jobs.length+'ジョブ',jobs,members,
   alive:sum(members,'alive'),total:sum(members,'total'),
   hp:sum(members,'hp'),maxHp:totalMaxHp,
   mp:sum(members,'mp'),maxMp:sum(members,'maxMp'),
   attackPercent:totalMaxHp>0?Math.round(members.reduce((n,row)=>
    n+(Number(row.attackPercent)||0)*(Number(row.maxHp)||0),0)/totalMaxHp):0,
   mode:members.every(row=>row.mode===members[0]?.mode)?members[0]?.mode:'mixed',
   inContact:members.some(row=>row.inContact),effects
  };
 });
 return [...allies,...all.filter(row=>Number(row.team)===1)];
}
