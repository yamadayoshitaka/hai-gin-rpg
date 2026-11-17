import {recommendBattleTactics} from './battle-quick-recommendation.js';
const ORDERS=Object.freeze([['charge','突撃'],['defend','守備'],['hold','待機'],['retreat','退却']]);
const el=(tag,text='',cls='')=>{
 const node=document.createElement(tag);node.textContent=text;
 if(cls)node.className=cls;return node;
};
/**
 * One real-time 30-second tactical interrupt. Simulation is frozen through
 * the game's authoritative pause/Worker path; deadline uses wall clock only.
 * Never changes an individual subdivision's order.
 */
export function installBattleSituationPause({
 getMembers,getSquadName,canInterrupt,getUnavailableReason,
 pauseBattle,issueGroupOrder,getWasPaused
}){
 const panel=el('section','','battleSituationPause');
 panel.id='battleSituationPause';panel.hidden=true;
 panel.setAttribute('role','dialog');panel.setAttribute('aria-label','戦況変化に伴う推奨作戦');
 const heading=el('div','','battleSituationHeading');
 const title=el('strong');const timer=el('span','','battleSituationTimer');
 heading.append(title,timer);
 const reason=el('small','','battleSituationReason');
 const actions=el('div','','battleSituationActions');
 const dismiss=el('button','▶ 作戦を変更せず再開','battleSituationDismiss');
 dismiss.type='button';
 panel.append(heading,reason,actions,dismiss);
 document.body.append(panel);
 let active=null,lastTriggeredAt=-Infinity;
 function stop(){
  if(!active)return;
  const wasPaused=active.wasPaused;active=null;panel.hidden=true;
  if(!wasPaused)pauseBattle(false);
 }
 dismiss.addEventListener('click',stop);
 function trigger(id,warning){
  if(active||!canInterrupt()||getUnavailableReason(id))return false;
  const stamp=performance.now();
  if(stamp-lastTriggeredAt<12000)return false;
  const members=getMembers(id),recommendation=recommendBattleTactics(members);
  if(!members.some(u=>u&&u.alive!==false&&u.hp>0&&!u.isStrategist))return false;
  lastTriggeredAt=stamp;
  active={id:String(id),remaining:30,wasPaused:getWasPaused(),recommendation};
  title.textContent='⚠ '+getSquadName(id)+'：'+warning.title;
  reason.textContent='戦闘を停止。推奨：'+(ORDERS.find(p=>p[0]===recommendation.order)?.[1]||'守備')+' — '+recommendation.orderReason;
  actions.replaceChildren();
  const order=ORDERS.slice().sort((a,b)=>Number(b[0]===recommendation.order)-Number(a[0]===recommendation.order));
  for(const [mode,label] of order){
   const button=el('button',(mode===recommendation.order?'★ 推奨 ':'')+label,mode===recommendation.order?'recommended':'');
   button.type='button';
   button.addEventListener('click',()=>{
    if(!active)return;
    if(issueGroupOrder(active.id,mode))stop();
   });
   actions.append(button);
  }
  panel.hidden=false;pauseBattle(true);update(0);return true;
 }
 function update(dt){
  if(!active)return;
  active.remaining=Math.max(0,active.remaining-Math.max(0,Number(dt)||0));
  timer.textContent='残り '+Math.ceil(active.remaining)+'秒';
  if(active.remaining<=0)stop();
 }
 return {trigger,update,stop,get active(){return active!=null},
  get squadId(){return active?.id??null},get remaining(){return active?.remaining??0},
  get recommended(){return active?.recommendation.order??null}};
}
