/**
 * Read-only adapter from live battle squad summaries to the mobile RPG HUD.
 * All effects are sourced from combat state; no invented ailments or buffs.
 */
import {displayBattleJobName} from './battle-job-squads.js';
import {strengthFromHp} from './battle-command-doctrine.js';
import {battleMonsterIdentity} from './battle-portrait-identity.js';
export function makeBattleRpgStatusRows({
 sums,units=[],allyIds=[],enemyIds=[],getJob=()=>'',getMode=()=>null,
 mass=false,now=0,simTime=now,itemTypes={},auras=new Map(),getMonster=()=>null,
 skirmishBuffs=new Map(),massDebuffs=new Map(),skirmishDebuffs=new Map(),commanderRallies=new Map()
}={}){
 const safeIds=[allyIds,enemyIds];
 const maxHpBySquad=new Map(),mpBySquad=new Map(),maxMpBySquad=new Map(),monsterBySquad=new Map();
 for(const unit of units){
  const key=String(unit.team)+':'+String(unit.squadId);
  if(Number(unit.team)===1&&!monsterBySquad.has(key)){
   const species=battleMonsterIdentity(unit);if(species)monsterBySquad.set(key,species);
  }
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
  const species=team===1?(monsterBySquad.get(key)||getMonster(id,team,index)):null;
  const job=species?.name||displayBattleJobName(getJob(id,team)||'部隊');
  rows.push({team,id:String(id),name:'第'+(index+1)+'隊 '+job,job,monster:species||null,
   alive,total:Number(stat?.total)||0,hp:Number(stat?.hp)||0,
   maxHp:maxHpBySquad.get(key)||Number(stat?.maxHp)||0,
   mp:mpBySquad.get(key)||0,maxMp:maxMpBySquad.get(key)||0,
   attackPercent:Math.round(strengthFromHp(Number(stat?.hp)||0,
    maxHpBySquad.get(key)||Number(stat?.maxHp)||1)*100),
   mode:getMode(id,team),effects:effectsFor(team,id),
   center:alive>0?{x:stat.x/alive,z:stat.z/alive}:null});
 }
 // A squad's centroid is NOT its front line: a wide formation can have
 // melee fighters in contact while the two centroids are far apart.
 // Use living soldiers and their actual grid coordinates on both sides.
 // Spatial buckets keep the HUD refresh linear even at 1000 vs 1000.
 const bySquad=new Map(rows.map(row=>[row.team+':'+row.id,row]));
 const buckets=new Map(),active=[];
 const bucketSize=5,contactSquared=4.5*4.5;
 for(const unit of units){
  const team=Number(unit.team),key=team+':'+String(unit.squadId);
  if(!bySquad.has(key)||unit.alive===false||!(Number(unit.hp)>0)||
   !Number.isFinite(mass?unit.x:(unit.cell?.x??unit.x))||
   !Number.isFinite(mass?unit.z:(unit.cell?.z??unit.z)))continue;
  // A skirmish actor's cell is authoritative; optional x/z may be stale.
  const x=Number(mass?unit.x:(unit.cell?.x??unit.x));
  const z=Number(mass?unit.z:(unit.cell?.z??unit.z));
  const entry={unit,team,key,x,z};
  active.push(entry);
  const bucket=team+':'+Math.floor(x/bucketSize)+':'+Math.floor(z/bucketSize);
  if(!buckets.has(bucket))buckets.set(bucket,[]);
  buckets.get(bucket).push(entry);
 }
 for(const row of rows)row.inContact=false;
 for(const entry of active){
  const {unit,team,key,x,z}=entry;
  // Ranged skills also count as engagement when the worker has acquired a
  // living enemy squad, even if that squad is outside melee proximity.
  const target=Number(unit.currentTargetSquadId);
  if((unit.action==='attack'||unit.action==='skill')&&
   unit.currentTargetSquadId!=null&&Number.isFinite(target)&&target>=0){
   const enemyRow=bySquad.get((1-team)+':'+String(target));
   if(enemyRow&&enemyRow.alive>0){
    const friendly=bySquad.get(key);
    friendly.inContact=true;enemyRow.inContact=true;
    friendly.engagementPoint??={x,z};
    // Ranged contact must mark BOTH radar teams. The defender's ring
    // belongs at the living defender's own position, not on the shooter.
    enemyRow.engagementPoint??=enemyRow.center?
     {x:enemyRow.center.x,z:enemyRow.center.z}:{x,z};
   }
  }
  const bx=Math.floor(x/bucketSize),bz=Math.floor(z/bucketSize);
  for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++){
   const near=buckets.get((1-team)+':'+(bx+dx)+':'+(bz+dz));
   if(!near)continue;
   for(const other of near){
    // An upstairs soldier cannot engage a ground-floor enemy through a slab.
    const floorA=unit.highGroundFloor??unit.indoorFloor??1;
    const floorB=other.unit.highGroundFloor??other.unit.indoorFloor??1;
    if(floorA!==floorB)continue;
    if((x-other.x)**2+(z-other.z)**2<=contactSquared){
     const first=bySquad.get(key),second=bySquad.get(other.key);
     const point={x:(x+other.x)/2,z:(z+other.z)/2};
     first.inContact=true;second.inContact=true;
     first.engagementPoint??=point;
     second.engagementPoint??=point;
    }
   }
  }
 }
 // Legacy test/stage summaries may not supply individual coordinates.
 // Preserve their centroid fallback only when neither army has any positions.
 if(!active.length)for(const row of rows){
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
export function aggregateBattleRpgTeams(rows,groupBySquad={},enemyGroupBySquad=null,captainsByGroup={}){
 const all=Array.isArray(rows)?rows:[];
 const sum=(members,key)=>members.reduce((total,row)=>total+(Number(row[key])||0),0);
 const aggregate=(side,mapping)=>{
  const groups=new Map();
  for(const row of all){
   if(Number(row.team)!==side)continue;
   const requested=Number(mapping[String(row.id)]);
   const groupId=Number.isInteger(requested)&&requested>=1&&requested<=3?requested:1;
   if(!groups.has(groupId))groups.set(groupId,[]);
   groups.get(groupId).push(row);
  }
  return [...groups].sort((a,b)=>a[0]-b[0]).map(([groupId,members])=>{
   const jobs=[...new Set(members.map(row=>String(row.job||'兵士')))];
   const monster=side===1?(members.find(row=>row.monster)?.monster||null):null;
   const captain=side===0?captainsByGroup[String(groupId)]||null:null;
   const totalMaxHp=sum(members,'maxHp');
   const effects=[...new Map(members.flatMap(row=>row.effects||[])
    .map(effect=>[effect.kind+':'+effect.label,effect])).values()];
   return {
    team:side,id:(side===0?'team:':'enemy-team:')+groupId,groupId,
    name:'第'+groupId+'隊',job:monster?.name||jobs.length+'ジョブ',jobs,members,monster,captain,
    alive:sum(members,'alive'),total:sum(members,'total'),
    hp:sum(members,'hp'),maxHp:totalMaxHp,
    mp:sum(members,'mp'),maxMp:sum(members,'maxMp'),
    attackPercent:totalMaxHp>0?Math.round(members.reduce((n,row)=>
     n+(Number(row.attackPercent)||0)*(Number(row.maxHp)||0),0)/totalMaxHp):0,
    mode:members.every(row=>row.mode===members[0]?.mode)?members[0]?.mode:'mixed',
    inContact:members.some(row=>row.inContact),
    engagementPoint:members.find(row=>row.inContact&&row.engagementPoint)?.engagementPoint??null,
    effects
   };
  });
 };
 const allies=aggregate(0,groupBySquad);
 // Keep old callers compatible: group the enemy only when the battle supplied
 // an authoritative three-team enemy mapping.
 const enemies=enemyGroupBySquad&&Object.keys(enemyGroupBySquad).length?
  aggregate(1,enemyGroupBySquad):all.filter(row=>Number(row.team)===1);
 return [...allies,...enemies];
}
/**
 * Resolve the 3 command teams for every playable 50-person battle entry.
 * Modern inn battles keep their authoritative formation mapping. Legacy story
 * and quick CPU battles group identical jobs together without deleting real
 * physical squads, so each team can command up to 3 distinct jobs.
 */
export function resolveBattleThreeTeamGroups(squadIds,getJob=()=>'',provided={},authoritative=false){
 const ids=[...new Set((squadIds||[]).map(String))];
 const valid=id=>{
  const n=Number(provided[String(id)]);
  return Number.isInteger(n)&&n>=1&&n<=3;
 };
 if(authoritative&&ids.every(valid))
  return Object.fromEntries(ids.map(id=>[id,Number(provided[id])]));
 const byJob=new Map();
 for(const id of ids){
  const job=String(getJob(id)||'兵士');
  if(!byJob.has(job))byJob.set(job,[]);
  byJob.get(job).push(id);
 }
 const teams=[{id:1,people:0,jobs:0},{id:2,people:0,jobs:0},{id:3,people:0,jobs:0}];
 const groups={};
 for(const members of byJob.values()){
  // Prefer fewer physically assigned squads and preserve the 3-job limit.
  const available=teams.filter(t=>t.jobs<3);
  const pool=(available.length?available:teams).sort((a,b)=>
   a.people-b.people||a.jobs-b.jobs||a.id-b.id);
  const chosen=pool[0];
  chosen.people+=members.length;chosen.jobs++;
  for(const id of members)groups[id]=chosen.id;
 }
 return groups;
}
