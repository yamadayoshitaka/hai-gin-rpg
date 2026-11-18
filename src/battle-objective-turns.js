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
export const TURN_MOVE_OPTIONS=Object.freeze([
 {id:'hold',label:'現在地で待機'},{id:'point',label:'地図で指定した地点'},{id:'enemy',label:'敵の近くへ移動'},
 {id:'building',label:'建物へ移動'},{id:'bridge_front',label:'橋の手前へ移動'},
 {id:'rear',label:'前衛の後ろへ移動'},{id:'ally',label:'味方へ合流'},
 {id:'retreat',label:'後退する'}
]);
export const TURN_ACTION_OPTIONS=Object.freeze([
 {id:'charge',label:'近接攻撃'},{id:'ranged',label:'遠距離攻撃（弓・魔法）'},
 {id:'defend',label:'防御・足止め'},{id:'support',label:'支援・回復'},
 {id:'hold',label:'待機・警戒'},{id:'retreat',label:'撤退'},
 {id:'item',label:'道具を使う'}
]);
const GOAL_BY_ID=new Map(OBJECTIVE_TURN_GOALS.map(g=>[g.id,g]));
const MOVE_IDS=new Set(TURN_MOVE_OPTIONS.map(x=>x.id));
const ACTION_IDS=new Set(TURN_ACTION_OPTIONS.map(x=>x.id));
const bounded=n=>Number.isFinite(Number(n))?Math.max(0,Number(n)):0;
export function createObjectiveTurnEngine({
 groupIds=Array.from({length:10},(_,i)=>i+1),moveSeconds=20,actionSeconds=4,
 onPause=()=>{},onMove=()=>{},onAction=()=>{},onReport=()=>{},getGroups=()=>[],hasArrived=null
}={}){
 const ids=[...new Set(groupIds.map(Number))].filter(x=>Number.isInteger(x)&&x>=1&&x<=10);
 const goals=new Map(ids.map(id=>[id,'attack']));
 const orders=new Map(ids.map(id=>[id,{move:'enemy',action:'charge',targetId:null,itemId:null}]));
 const issuedActions=new Set();
 const orderFor=id=>({...GOAL_BY_ID.get(goals.get(id)),...orders.get(id),after:orders.get(id).action});
 let phase='idle',turn=1,remaining=0,previous=[],lastReport=[],lastError='',urgent=false,manualHold=false;
 const active=()=>getGroups().filter(g=>ids.includes(Number(g.id))&&Number(g.alive)>0);
 const status=()=>({phase,turn,remaining,urgent,manualHold});
 const snapshot=()=>({...status(),goalByGroup:Object.fromEntries(goals),ordersByGroup:Object.fromEntries(orders),groups:getGroups(),
  report:lastReport,error:lastError});
 const transition=next=>{phase=next;return status();};
 return {
  snapshot,status,
  begin(){
   if(phase!=='idle')return snapshot();
   onPause(true);return transition('planning');
  },
  setGoal(id,goal){
   const group=Number(id);
   if(!ids.includes(group)||!GOAL_BY_ID.has(goal))return false;
   if(phase!=='planning'&&phase!=='report')return false;
   goals.set(group,goal);
   const legacy=GOAL_BY_ID.get(goal);
   orders.set(group,{move:legacy.move==='objective'?'building':legacy.move==='retreat'?'retreat':
    MOVE_IDS.has(legacy.move)?legacy.move:'hold',action:legacy.after,targetId:null,itemId:null});
   if(phase==='report'){manualHold=true;remaining=Infinity;}return true;
  },
  setMove(id,move,targetId=null){
   const group=Number(id);
   if(!ids.includes(group)||!MOVE_IDS.has(move)||!['planning','report'].includes(phase))return false;
   orders.set(group,{...orders.get(group),move,targetId:targetId==null?null:String(targetId)});
   if(phase==='report'){manualHold=true;remaining=Infinity;}
   return true;
  },
  setAction(id,action){
   const group=Number(id);
   if(!ids.includes(group)||!ACTION_IDS.has(action)||!['planning','report'].includes(phase))return false;
   orders.set(group,{...orders.get(group),action});
   if(phase==='report'){manualHold=true;remaining=Infinity;}
   return true;
  },
  setItem(id,itemId){
   const group=Number(id);
   if(!ids.includes(group)||!['planning','report'].includes(phase))return false;
   orders.set(group,{...orders.get(group),action:'item',itemId:itemId==null?null:String(itemId)});
   if(phase==='report'){manualHold=true;remaining=Infinity;}return true;
  },
  start(){
   if(!['planning','report'].includes(phase))return false;
   if(phase==='report')turn++;
   const missing=active().filter(g=>orders.get(Number(g.id))?.action==='item'&&!orders.get(Number(g.id))?.itemId);
   if(missing.length){lastError=missing.map(g=>'第'+g.id+'班').join('、')+'の使用アイテムを選んでください';return false;}
   previous=getGroups().map(x=>({...x}));
   lastError='';lastReport=[];urgent=false;manualHold=false;issuedActions.clear();
   transition('moving');
   remaining=bounded(moveSeconds);
   for(const group of active()){
    try{onMove(group.id,orderFor(group.id));}
    catch(error){lastError=String(error?.message||error);}
   }
   onPause(false);
   return true;
  },
  update(dt,{wallDt=dt}={}){
   if(phase==='report'){
    if(!manualHold){remaining=Math.max(0,remaining-bounded(wallDt));
     if(remaining<=0){this.start();return status();}}
    return status();
   }
   if(phase!=='moving'&&phase!=='acting')return status();
   remaining=Math.max(0,remaining-bounded(dt));
   if(phase==='moving'){
    const groups=active();
    for(const group of groups){
     if(issuedActions.has(group.id))continue;
     let arrived=remaining<=0;
     if(typeof hasArrived==='function'){
      try{arrived=Boolean(hasArrived(group.id,orderFor(group.id)));}
      catch(error){lastError=String(error?.message||error);arrived=false;}
     }
     if(!arrived)continue;
     issuedActions.add(group.id);
     try{onAction(group.id,orderFor(group.id));}
     catch(error){lastError=String(error?.message||error);}
    }
    if(issuedActions.size<groups.length&&remaining>0)return status();
    const missed=groups.filter(g=>!issuedActions.has(g.id)).map(g=>'第'+g.id+'班');
    if(missed.length)lastError=missed.join('・')+'は未到着。移動命令を継続します';
    transition('acting');remaining=bounded(actionSeconds);
    return status();
   }
   if(remaining>0)return status();
   const before=new Map(previous.map(g=>[Number(g.id),g]));
   lastReport=getGroups().map(g=>{
    const prior=before.get(Number(g.id))||{alive:0,hp:0};
    return {id:Number(g.id),goal:goals.get(Number(g.id)),
     alive:Number(g.alive)||0,losses:Math.max(0,(Number(prior.alive)||0)-(Number(g.alive)||0)),
     hp:Number(g.hp)||0,hpDelta:(Number(g.hp)||0)-(Number(prior.hp)||0),
     danger:Boolean(g.danger)};
   }).filter(g=>g.alive>0||g.losses>0);
   urgent=lastReport.some(g=>g.danger&&g.losses>0||
    g.losses>=Math.max(2,Math.ceil((before.get(g.id)?.alive||0)*.25)));
   remaining=urgent?30:2;manualHold=false;
   transition('report');onPause(true);onReport(lastReport,snapshot());
   return status();
  },
  interrupt(){
   if(phase==='moving'||phase==='acting'){
    onPause(true);remaining=0;manualHold=true;transition('planning');return true;
   }
   if(phase==='report'){manualHold=true;remaining=Infinity;return true;}
   return phase==='planning';
  },
  finish(){phase='done';onPause(false);return status();}
 };
}
