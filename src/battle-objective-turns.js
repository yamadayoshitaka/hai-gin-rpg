/**
 * Objective-first, simultaneous ten-group turn controller.
 * Existing formation/deployment is authoritative and intentionally untouched.
 * Orders persist between turns; idle groups never require repeated input.
 */
export const OBJECTIVE_TURN_GOALS=Object.freeze([
 Object.freeze({id:'attack',label:'敵主力を倒す',move:'enemy',after:'charge'}),
 Object.freeze({id:'defend',label:'拠点を守る',move:'hold',after:'defend'}),
 Object.freeze({id:'support',label:'味方を援護',move:'ally',after:'defend'}),
 Object.freeze({id:'explore',label:'目的地点を探索',move:'objective',after:'hold'}),
 Object.freeze({id:'retreat',label:'安全圏へ後退',move:'retreat',after:'retreat'})
]);
const GOAL_BY_ID=new Map(OBJECTIVE_TURN_GOALS.map(g=>[g.id,g]));
const bounded=n=>Number.isFinite(Number(n))?Math.max(0,Number(n)):0;
export function createObjectiveTurnEngine({
 groupIds=Array.from({length:10},(_,i)=>i+1),moveSeconds=12,actionSeconds=15,
 onPause=()=>{},onMove=()=>{},onAction=()=>{},onReport=()=>{},getGroups=()=>[]
}={}){
 const ids=[...new Set(groupIds.map(Number))].filter(x=>Number.isInteger(x)&&x>=1&&x<=10);
 const goals=new Map(ids.map(id=>[id,'attack']));
 let phase='idle',turn=1,remaining=0,previous=[],lastReport=[],lastError='';
 const active=()=>getGroups().filter(g=>ids.includes(Number(g.id))&&Number(g.alive)>0);
 const snapshot=()=>({
  phase,turn,remaining,goalByGroup:Object.fromEntries(goals),groups:getGroups(),
  report:lastReport,error:lastError
 });
 const transition=next=>{phase=next;return snapshot();};
 return {
  snapshot,
  begin(){
   if(phase!=='idle')return snapshot();
   onPause(true);return transition('planning');
  },
  setGoal(id,goal){
   const group=Number(id);
   if(!ids.includes(group)||!GOAL_BY_ID.has(goal))return false;
   if(phase!=='planning'&&phase!=='report')return false;
   goals.set(group,goal);return true;
  },
  start(){
   if(!['planning','report'].includes(phase))return false;
   if(phase==='report')turn++;
   previous=getGroups().map(x=>({...x}));
   lastError='';lastReport=[];
   transition('moving');
   remaining=bounded(moveSeconds);
   for(const group of active()){
    try{onMove(group.id,GOAL_BY_ID.get(goals.get(group.id)));}
    catch(error){lastError=String(error?.message||error);}
   }
   onPause(false);
   return true;
  },
  update(dt){
   if(phase!=='moving'&&phase!=='acting')return snapshot();
   remaining=Math.max(0,remaining-bounded(dt));
   if(remaining>0)return snapshot();
   if(phase==='moving'){
    transition('acting');remaining=bounded(actionSeconds);
    for(const group of active()){
     try{onAction(group.id,GOAL_BY_ID.get(goals.get(group.id)));}
     catch(error){lastError=String(error?.message||error);}
    }
    return snapshot();
   }
   const before=new Map(previous.map(g=>[Number(g.id),g]));
   lastReport=getGroups().map(g=>{
    const prior=before.get(Number(g.id))||{alive:0,hp:0};
    return {id:Number(g.id),goal:goals.get(Number(g.id)),
     alive:Number(g.alive)||0,losses:Math.max(0,(Number(prior.alive)||0)-(Number(g.alive)||0)),
     hp:Number(g.hp)||0,hpDelta:(Number(g.hp)||0)-(Number(prior.hp)||0),
     danger:Boolean(g.danger)};
   }).filter(g=>g.alive>0||g.losses>0);
   transition('report');onPause(true);onReport(lastReport,snapshot());
   return snapshot();
  },
  finish(){phase='done';onPause(false);return snapshot();}
 };
}
