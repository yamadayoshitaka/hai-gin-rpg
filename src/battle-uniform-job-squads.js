/**
 * 1 squad = 1 profession. Soldiers keep their IDs, mesh/costume, stats and HP.
 * A whole-job group moves into the existing collision-safe formation slots.
 * Explicit class picks reserve a whole squad; the rest auto-fill from stocks.
 */
export function uniformJobSquadPlan(units,types={},team=0,chosenJobs={}){
 const groups=new Map(),pool=new Map();
 for(const soldier of units){
  if(soldier.team!==team||soldier.isStrategist)continue;
  const sid=String(soldier.squadId),job=String(soldier.jobId||soldier.job?.id||'');
  if(!groups.has(sid))groups.set(sid,[]);
  groups.get(sid).push(soldier);
  if(!pool.has(job))pool.set(job,[]);
  pool.get(job).push(soldier);
 }
 for(const list of pool.values())list.sort((a,b)=>Number(a.id)-Number(b.id));
 const squads=[...groups].map(([id,slots])=>({
  id,slots:slots.slice().sort((a,b)=>Number(a.id)-Number(b.id)),
  requested:chosenJobs[id]||null
 })).sort((a,b)=>Number(a.id)-Number(b.id)||a.id.localeCompare(b.id));
 if(squads.length>10)return null;
 // Refuse invalid explicit choices instead of creating mixed or duplicate soldiers.
 const chosen=new Map();
 for(const squad of squads.filter(s=>s.requested)){
  const available=pool.get(squad.requested);
  if(!available||available.length<squad.slots.length)return null;
  chosen.set(squad.id,squad.requested);
  pool.set(squad.requested,available.slice(squad.slots.length));
 }
 const role=job=>['priest','healer'].includes(job)?'heal':
  ['archer','mage','summoner'].includes(job)?'range':'front';
 for(const squad of squads.filter(s=>!s.requested)){
  const count=squad.slots.length;
  const own=new Map();
  for(const s of squad.slots){const job=String(s.jobId||s.job?.id||'');own.set(job,(own.get(job)||0)+1)}
  const pref=types[squad.id]??types.get?.(squad.id)??'balanced';
  const compatible=job=>pref==='support'?Number(job==='priest')*2+Number(role(job)==='range'):
   pref==='attack'?Number(role(job)==='front')*2:0;
  const options=[...pool].filter(([_,list])=>list.length>=count).sort((a,b)=>
   ((own.get(b[0])||0)*10+compatible(b[0]))-((own.get(a[0])||0)*10+compatible(a[0]))||
   a[0].localeCompare(b[0]));
  if(!options.length)return null;
  const job=options[0][0];chosen.set(squad.id,job);
  pool.set(job,pool.get(job).slice(count));
 }
 // Reserve first in the same order as selection. Rebuild working pools to
 // avoid losing the identity of explicit reservations before emitting slots.
 const full=new Map();
 for(const u of units)if(u.team===team&&!u.isStrategist){
  const job=String(u.jobId||u.job?.id||'');
  if(!full.has(job))full.set(job,[]);
  full.get(job).push(u);
 }
 for(const p of full.values())p.sort((a,b)=>Number(a.id)-Number(b.id));
 const assignments=[],summaries=[];
 for(const squad of squads){
  const jobId=chosen.get(squad.id),available=full.get(jobId);
  if(!available||available.length<squad.slots.length)return null;
  const selected=available.splice(0,squad.slots.length),type=types[squad.id]??types.get?.(squad.id)??'balanced';
  for(let i=0;i<selected.length;i++)assignments.push({
   id:selected[i].id,slotId:squad.slots[i].id,squadId:squad.id,type,role:role(jobId)
  });
  summaries.push({squadId:squad.id,type,jobId,total:selected.length,
   front:role(jobId)==='front'?selected.length:0,
   range:role(jobId)==='range'?selected.length:0,
   heal:role(jobId)==='heal'?selected.length:0
  });
 }
 return {assignments,summaries};
}
