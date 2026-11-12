/**
 * One commandable formation per strategist. Job/rarity contingents remain as
 * inventory records, but share their commander's deployment cell in battle.
 */
import {trainCommander,recruit,autoFormArmy,armyTroops,reserveTroops,maxSquads,squadCommanderId,AUTO_FORMATIONS} from './story-campaign.js';
import {DEPLOYMENT_CAPACITY,isDeploymentSlot} from './inn-deployment.js';

const SLOTS_BY_PRIORITY=Object.freeze([10,1,4,7,0,2,3,5,6,8,9,11]);
const JOB_BY_PRIORITY=Object.freeze({'均衡':'騎士','攻撃重視':'騎士','防御重視':'盾騎士','機動重視':'忍者','支援重視':'僧侶'});
export const commanderList=state=>[{id:'player',...state.commander},...(state.commanders||[])];
export const commanderGroup= (state,id)=>state.squads.filter(s=>s.count>0&&String(squadCommanderId(s))===String(id));
export function resolvedCommanderDeployment(state){
 const leaders=commanderList(state),slots=new Map(),occupied=new Set();
 for(const leader of leaders){
  const id=String(leader.id),saved=isDeploymentSlot(leader.deploymentSlot)?leader.deploymentSlot:
   commanderGroup(state,id).find(s=>isDeploymentSlot(s.deploymentSlot))?.deploymentSlot;
  if(isDeploymentSlot(saved)&&!occupied.has(saved)){slots.set(id,saved);occupied.add(saved);}
 }
 for(const leader of leaders){
  const id=String(leader.id);if(slots.has(id))continue;
  const slot=SLOTS_BY_PRIORITY.find(x=>!occupied.has(x));
  if(slot===undefined)break;
  slots.set(id,slot);occupied.add(slot);
 }
 return slots;
}
export function placeCommander(state,id,targetSlot){
 if(!isDeploymentSlot(targetSlot))return false;
 const leader=commanderList(state).find(c=>String(c.id)===String(id));
 if(!leader)return false;
 const slots=resolvedCommanderDeployment(state),current=slots.get(String(id));
 if(current===undefined||current===targetSlot)return false;
 const occupied=commanderList(state).find(c=>String(c.id)!==String(id)&&slots.get(String(c.id))===targetSlot);
 const original=String(id)==='player'?state.commander:state.commanders.find(c=>String(c.id)===String(id));
 original.deploymentSlot=targetSlot;
 if(occupied){
  const other=String(occupied.id)==='player'?state.commander:state.commanders.find(c=>String(c.id)===String(occupied.id));
  other.deploymentSlot=current;
 }
 syncCommanderSquadSlots(state);
 return true;
}
export function syncCommanderSquadSlots(state){
 const positions=resolvedCommanderDeployment(state);
 for(const squad of state.squads){
  const slot=positions.get(String(squadCommanderId(squad)));
  if(slot!==undefined)squad.deploymentSlot=slot;
 }
 return positions;
}
/** Autohire only affordable and currently unlocked commander slots; no free
 * commanders or soldiers, no over-spending and no infinite empty hiring. */
export function autoDeployCommanders(state,{priority='均衡',fillOpenSlots=true,maxNewHires=10,preferredSlot=null}={}){
 if(state.gameOver)throw Error('ゲームオーバー後は編成できません。');
 if(!AUTO_FORMATIONS.includes(priority))throw Error('自動配置の方針を選んでください。');
 const max=Math.min(10,DEPLOYMENT_CAPACITY,maxSquads(state));
 let hired=0,assigned=0;const hiredIds=[];
 if(fillOpenSlots){
  while(commanderList(state).length<max&&hired<maxNewHires){
   const hasReserve=reserveTroops(state)>0;
   // Hire + at least ten N soldiers when there are no reserves. No empty
   // command-only units are silently paid for.
   const needsRecruit=!hasReserve,price=600+(needsRecruit?100:0);
   if(state.treasury<price||(!hasReserve&&state.squads.reduce((n,s)=>n+s.count,0)+10>1000))break;
   const seq=state.commanders.length+1;
   trainCommander(state,'軍師'+String(seq).padStart(2,'0'),{gender:seq%2===0?'female':'male',faceId:seq%8});
   const leader=state.commanders.at(-1);
   if(preferredSlot!=null&&isDeploymentSlot(preferredSlot))leader.deploymentSlot=preferredSlot;
   hiredIds.push(String(leader.id));
   if(needsRecruit)recruit(state,{job:JOB_BY_PRIORITY[priority],rarity:'N',count:10,purpose:'前線',commanderId:String(leader.id),faceId:0});
   else autoFormArmy(state,String(leader.id),priority);
   hired++;
  }
 }
 // Existing commanders may have empty companies; assign reserves where possible.
 for(const leader of commanderList(state)){
  if(!commanderGroup(state,leader.id).length&&reserveTroops(state)>0){
   autoFormArmy(state,String(leader.id),priority);assigned++;
  }
 }
 const positions=syncCommanderSquadSlots(state);
 return {hired,hiredIds,assigned,positions,leaders:commanderList(state).length,capacity:max,
  unfilled:Math.max(0,DEPLOYMENT_CAPACITY-positions.size),treasury:state.treasury};
}
/** One battle command squad ID shared by all job subgroups of a strategist. */
export function commandSquadIds(squads=[]){
 const ids=new Map();
 for(const squad of squads){
  const commander=String(squadCommanderId(squad));
  if(!ids.has(commander))ids.set(commander,squad.id);
 }
 return ids;
}
