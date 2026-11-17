/**
 * Deterministic tactical-warning inbox. It records a warning once per
 * commander group and keeps it until the authoritative paused UI accepts it.
 * This prevents lost alerts during cut-ins, manual pause and simultaneous
 * squad losses. The queue never issues orders or changes combat state.
 */
const clamp01=n=>Math.max(0,Math.min(1,Number(n)||0));
export function situationLevel({n=0,total=0,hp=0,maxHp=0}={}){
 if(!(total>0)||!(n>0))return 0; // Elimination is handled by battle results.
 const life=clamp01(n/total);
 const health=maxHp>0?clamp01(hp/maxHp):1;
 if(life<=.25||health<=.25)return 3;
 if(life<=.5||health<=.45)return 2;
 if(life<=.75||health<=.65)return 1;
 return 0;
}
export function createBattleSituationMonitor({maxQueued=12}={}){
 const previous=new Map(),waiting=new Map(),delivered=new Map();
 let sequence=0;
 function observe(groups=[]){
  const seen=new Set();
  for(const group of groups){
   const id=String(group.id),row=group.row;
   if(!row||!(row.total>0))continue;
   seen.add(id);
   const level=situationLevel(row),old=previous.get(id)??0;
   previous.set(id,level);
   if(!level||!(row.n>0)){
    if(!(row.n>0)||waiting.get(id)?.kind!=='objective')waiting.delete(id);
    continue;
   }
   // Minor (75% casualty / 65% HP) is a notification, not a 30s stop.
   if(level>=2&&level>old){
    const health=row.maxHp>0?row.hp/row.maxHp:1;
    const loss=row.n/row.total;
    const reason=health<=loss?'HPが低下':'残存人数が減少';
    const event={
     id,level,severity:level===3?'critical':'warning',
     title:level===3?'部隊が壊滅寸前':'部隊の作戦再検討が必要',
     reason,ratio:Math.min(loss,health),sequence:++sequence
    };
    // A severe warning always replaces an unhandled moderate warning.
    if(!waiting.has(id)||waiting.get(id).level<=level)waiting.set(id,event);
   }
   if(waiting.has(id)&&waiting.get(id).level>level&&waiting.get(id).kind!=='objective')
    waiting.delete(id); // old damage was healed; objective failures still matter
  }
  for(const id of previous.keys())if(!seen.has(id)){previous.delete(id);waiting.delete(id);}
  if(waiting.size>maxQueued){
   const sorted=[...waiting.values()].sort((a,b)=>b.level-a.level||a.sequence-b.sequence);
   const retained=new Set(sorted.slice(0,maxQueued).map(e=>e.id));
   for(const id of waiting.keys())if(!retained.has(id))waiting.delete(id);
  }
 }
 function enqueue(id,{title='作戦目標の変更',reason='戦況変化',severity='warning',ratio=.5}={}){
  const key=String(id),level=severity==='critical'?3:2;
  const previousAlert=waiting.get(key);
  if(previousAlert&&previousAlert.level>level)return previousAlert;
  const alert={id:key,level,severity,title,reason,ratio,sequence:++sequence,kind:'objective'};
  waiting.set(key,alert);return alert;
 }
 function peek(){
  let best=null;
  for(const entry of waiting.values())if(!best||
    entry.level>best.level||(entry.level===best.level&&entry.sequence<best.sequence))
   best=entry;
  return best;
 }
 function acknowledge(id){
  const key=String(id),event=waiting.get(key);
  if(event){delivered.set(key,event.level);waiting.delete(key);}
  return event??null;
 }
 return {observe,enqueue,peek,acknowledge,hasPending:()=>waiting.size>0,
  snapshot:()=>({pending:[...waiting.values()].map(e=>({...e})),
   levels:Object.fromEntries(previous),delivered:Object.fromEntries(delivered)})};
}
