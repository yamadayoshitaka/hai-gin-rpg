/**
 * Ten-group battle hierarchy. The 4x4 inn formation remains a fixed
 * pre-battle blueprint; midbattle support transfers only surviving soldiers
 * between divisions of the SAME army group and never duplicates inventory.
 */
export const squadAlive=u=>u?.team===0&&u.hp>0&&u.alive!==false&&!u.defeated;
const same=(a,b)=>String(a)===String(b);
export function threeGroupOverview(units,groupBySquad,initialUnits=[]){
 const output=Array.from({length:10},(_,i)=>i+1).map(id=>({id,alive:0,initial:0,hp:0,maxHp:0,initialMaxHp:0,divisions:[],danger:false}));
 const initialSource=initialUnits.length?initialUnits:units.filter(u=>u.team===0&&!u.isStrategist);
 const visited=new Map();
 for(const u of initialSource){
  if(u.team!==undefined&&u.team!==0)continue; // Campaign request units omit team; all are allies.
  const group=Number((u.armyGroupId??groupBySquad[String(u.squadId)]??1));
  if(group>=1&&group<=10){output[group-1].initial++;output[group-1].initialMaxHp+=Number(u.maxHp)||Number(u.hp)||0;}
 }
 for(const u of units){
  if(!squadAlive(u))continue;
  const group=Number((u.armyGroupId??groupBySquad[String(u.squadId)]??1));
  if(group<1||group>10)continue;
  const item=output[group-1];item.alive++;item.hp+=u.hp;item.maxHp+=u.maxHp||u.hp;
  const key=group+':'+String(u.squadId);
  let div=visited.get(key);
  if(!div){div={id:String(u.squadId),group,alive:0,hp:0,maxHp:0,jobCounts:{}};visited.set(key,div);item.divisions.push(div);}
  div.alive++;div.hp+=u.hp;div.maxHp+=u.maxHp||u.hp;
  const job=u.job?.name||u.jobId||'兵士';div.jobCounts[job]=(div.jobCounts[job]||0)+1;
 }
 for(const group of output){
  group.divisions.sort((a,b)=>Number(a.id)-Number(b.id)||a.id.localeCompare(b.id,'ja'));
  group.danger=Boolean(group.initial&&group.alive/group.initial<.5||
   (group.initialMaxHp||group.maxHp)&&group.hp/(group.initialMaxHp||group.maxHp)<.45);
 }
 return output;
}
export function reinforceDivision(units,groupBySquad,toId,{fromId=null,amount=null}={}){
 const target=units.filter(u=>squadAlive(u)&&same(u.squadId,toId));
 if(!target.length)return {ok:false,reason:'援軍先の分隊が戦闘不能です。'};
 const group=Number(target[0].armyGroupId??groupBySquad[String(toId)]);
 const donors=new Map();
 for(const u of units){
  if(!squadAlive(u)||same(u.squadId,toId)||u.isPlayerHero||u.isStrategist)continue;
  if(Number(u.armyGroupId??groupBySquad[String(u.squadId)])!==group)continue;
  const id=String(u.squadId);
  if(fromId!==null&&!same(id,fromId))continue;
  if(!donors.has(id))donors.set(id,[]);
  donors.get(id).push(u);
 }
 const best=[...donors].filter(([,list])=>list.length>1).sort((a,b)=>
  Number(b[1].some(u=>target.some(t=>same(t.sourceSquadId,u.sourceSquadId))))-
  Number(a[1].some(u=>target.some(t=>same(t.sourceSquadId,u.sourceSquadId))))||
  b[1].length-a[1].length)[0];
 if(!best)return {ok:false,reason:'同じ班に援軍を出せる分隊がありません。'};
 const [donorId,list]=best;
 const requested=Math.max(1,Math.trunc(Number(amount)||Math.ceil(list.length/3)));
 const soldiers=list.slice(0,Math.min(list.length-1,requested));
 for(const u of soldiers)u.squadId=String(toId);
 return {ok:true,fromId:donorId,toId:String(toId),group,count:soldiers.length,soldiers};
}
export function mergeDivision(units,groupBySquad,fromId,{intoId=null}={}){
 const members=units.filter(u=>squadAlive(u)&&same(u.squadId,fromId));
 if(members.some(u=>u.isPlayerHero||u.isStrategist))return {ok:false,reason:'軍師・主人公がいる本隊は統合先として維持してください。'};
 if(!members.length)return {ok:false,reason:'再統合できる生存兵がいません。'};
 const group=Number(members[0].armyGroupId??groupBySquad[String(fromId)]);
 const alternatives=new Map();
 for(const u of units){
  if(!squadAlive(u)||same(u.squadId,fromId))continue;
  if(Number(u.armyGroupId??groupBySquad[String(u.squadId)])!==group)continue;
  const id=String(u.squadId);
  if(intoId!==null&&!same(id,intoId))continue;
  if(!alternatives.has(id))alternatives.set(id,[]);
  alternatives.get(id).push(u);
 }
 const best=[...alternatives].sort((a,b)=>
  Number(b[1].some(u=>members.some(m=>same(m.sourceSquadId,u.sourceSquadId))))-
  Number(a[1].some(u=>members.some(m=>same(m.sourceSquadId,u.sourceSquadId))))||
  b[1].length-a[1].length)[0];
 if(!best)return {ok:false,reason:'同じ班に合流できる分隊がありません。'};
 const destinationId=best[0];
 for(const u of members)u.squadId=destinationId;
 return {ok:true,fromId:String(fromId),toId:destinationId,group,count:members.length,soldiers:members};
}
