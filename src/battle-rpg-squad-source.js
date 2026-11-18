/**
 * Read-only adapter from live battle squad summaries to the mobile RPG HUD.
 * All effects are sourced from combat state; no invented ailments or buffs.
 */
export function makeBattleRpgStatusRows({
 sums,units=[],allyIds=[],enemyIds=[],getJob=()=>'',getMode=()=>null,
 mass=false,now=0,simTime=now,itemTypes={},auras=new Map(),
 skirmishBuffs=new Map(),massDebuffs=new Map(),skirmishDebuffs=new Map()
}={}){
 const safeIds=[allyIds,enemyIds];
 const maxHpBySquad=new Map();
 for(const unit of units){
  const key=String(unit.team)+':'+String(unit.squadId);
  maxHpBySquad.set(key,(maxHpBySquad.get(key)||0)+Math.max(0,Number(unit.maxHp)||0));
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
  const job=String(getJob(id,team)||'部隊');
  rows.push({team,id:String(id),name:'第'+(index+1)+'隊 '+job,job,
   alive,total:Number(stat?.total)||0,hp:Number(stat?.hp)||0,
   maxHp:maxHpBySquad.get(key)||Number(stat?.maxHp)||0,
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
