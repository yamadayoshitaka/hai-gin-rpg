/**
 * Mobile command ribbons: mirror allied and enemy squads at the screen edges.
 * Urgent squads float to the top. A newly commanded squad moves to the bottom
 * until the operator has had time to review the other squads.
 */
export const RECENT_ORDER_COOLDOWN_MS=12000;
export function squadCommandPriority({
 alive=0,total=1,hpFraction=1,order='balanced',commanderAlive=true,
 changedAt=-Infinity,now=0
}={}){
 if(total<=0||alive<=0||!commanderAlive)return -1000;
 const survival=alive/Math.max(1,total);
 let urgency=survival<=.25?110:survival<=.5?75:survival<=.75?40:8;
 if(hpFraction<.25)urgency+=55;
 else if(hpFraction<.5)urgency+=30;
 else if(hpFraction<.75)urgency+=12;
 if(order==='balanced'||order==='auto'||order==='clear')urgency+=15;
 if(order==='charge'&&survival<=.6)urgency+=24;
 if(order==='defend'&&hpFraction>=.9)urgency+=8;
 if(now-changedAt>=0&&now-changedAt<RECENT_ORDER_COOLDOWN_MS)urgency-=250;
 return urgency;
}
export function sortSquadRibbon(entries,now=0){
 return [...entries].sort((a,b)=>{
  const left=squadCommandPriority({...a,now});
  const right=squadCommandPriority({...b,now});
  return right-left||(Number(a.index)||0)-(Number(b.index)||0);
 });
}
export function squadRibbonStatus({
 team=0,alive=0,total=1,commanderAlive=true,order='balanced',hpFraction=1
}={}){
 if(total<=0||alive<=0)return {enabled:false,marker:'☠',reason:'全滅'};
 if(!commanderAlive)return {enabled:false,marker:'☠',reason:'軍師戦死・指揮不可'};
 const priority=squadCommandPriority({alive,total,hpFraction,order,commanderAlive});
 if(team===1)return {enabled:true,marker:priority>=85?'⚠':'◈',reason:'敵軍（号令閲覧のみ）'};
 if(priority>=85)return {enabled:true,marker:'⚠',reason:'号令見直し推奨'};
 return {enabled:true,marker:'♟',reason:'指揮可能'};
}
