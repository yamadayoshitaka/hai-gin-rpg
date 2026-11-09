/**
 * Shared tactical policy: a squad's visible role is a consequence of its
 * real job composition, never an editable label detached from the soldiers.
 */
export const COMMAND_DURATION_CHOICES=Object.freeze([60,120,180,300]);
export const TACTICAL_TIME_BANK_SECONDS=300;
export const COMMAND_REISSUE_SECONDS=120;
export function squadJobComposition(roster=[]){
 const active=roster.filter(u=>!u.isStrategist && (u.hp??1)>0 && u.alive!==false);
 let front=0,range=0,heal=0;
 for(const soldier of active){
  const job=String(soldier.jobId||soldier.job?.id||soldier.job?.name||'').toLowerCase();
  if(['priest','healer','僧侶'].includes(job))heal++;
  else if(['archer','mage','summoner','弓使い','魔法使い','召喚士'].includes(job))range++;
  else front++;
 }
 const total=active.length;
 const type=total===0?'balanced':heal/total>=.30?'support':front/total>=.55?'attack':'balanced';
 return {total,front,range,heal,type};
}
export function selectedSoldierCount(total,choice='all'){
 const value=Number(choice);
 if(choice==='all'||!Number.isFinite(value)||value<=0)return total;
 return Math.max(1,Math.min(total,Math.floor(value)));
}
export function chooseEnemyOrder(own=[],opponents=[],previous='charge'){
 const living=own.filter(u=>u.alive!==false&&(u.hp??0)>0&&!u.isStrategist);
 const hostile=opponents.filter(u=>u.alive!==false&&(u.hp??0)>0&&!u.isStrategist);
 if(!living.length)return {mode:'hold',reason:'部隊壊滅'};
 const hp=living.reduce((n,u)=>n+(u.hp||0)/Math.max(1,u.maxHp||1),0)/living.length;
 const casualties=(own.length-living.length)/Math.max(1,own.length);
 if(!hostile.length)return {mode:'hold',reason:'敵影なし'};
 if(hp<.30||casualties>.72)return {mode:'retreat',reason:'壊滅回避'};
 if(hp<.62||casualties>.45)return {mode:'defend',reason:'損耗を抑え回復'};
 let cx=0,cz=0;
 for(const u of living){cx+=u.x??u.cell?.x??0;cz+=u.z??u.cell?.z??0}
 cx/=living.length;cz/=living.length;
 const sample=hostile.length>120?hostile.filter((_,i)=>i%Math.ceil(hostile.length/120)===0):hostile;
 let minDist=Infinity;
 for(const u of sample){
  const dx=(u.x??u.cell?.x??0)-cx,dz=(u.z??u.cell?.z??0)-cz;
  minDist=Math.min(minDist,Math.hypot(dx,dz));
 }
 if(minDist<14)return {mode:'charge',reason:'敵と接敵'};
 if(minDist>75&&hp<.85)return {mode:'hold',reason:'陣形を整える'};
 return {mode:'charge',reason:'敵陣を攻める'};
}
