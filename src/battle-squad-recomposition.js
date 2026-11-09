/**
 * Reshuffle existing soldier identities into squad roles without changing their
 * jobs, 3D costumes, or unique occupied tiles.  This is a once-before-battle
 * operation; a Worker and the main thread run the same deterministic plan.
 */
export const FORMATION_TYPES=Object.freeze(['attack','balanced','support']);
export const FORMATION_NAMES=Object.freeze({
 attack:'攻撃',balanced:'バランス',support:'支援'
});
export const FORMATION_ICONS=Object.freeze({
 attack:'⚔',balanced:'♟',support:'✚'
});
const RATIOS=Object.freeze({
 attack:Object.freeze({front:.70,range:.25,heal:.05}),
 balanced:Object.freeze({front:.40,range:.40,heal:.20}),
 support:Object.freeze({front:.20,range:.30,heal:.50})
});
export function soldierRole(unit){
 const job=unit?.jobId||unit?.job?.id||unit?.job?.name||'';
 if(['priest','僧侶','healer'].includes(job))return 'heal';
 if(['archer','mage','summoner','弓使い','魔法使い','召喚士'].includes(job))return 'range';
 return 'front';
}
export const normalizeFormationType=type=>FORMATION_TYPES.includes(type)?type:
 type==='ranged'?'balanced':'balanced';
export function recomposeSquadAssignments(units,types={},team=0){
 if(!Array.isArray(units))throw Error('部隊一覧が不正です');
 const squads=new Map();
 for(const unit of units){
  if(unit.team!==team||unit.isStrategist)continue;
  const id=String(unit.squadId);
  if(!squads.has(id))squads.set(id,[]);
  squads.get(id).push(unit);
 }
 const indexes=[...squads.keys()].sort((a,b)=>Number(a)-Number(b)||a.localeCompare(b,'ja'));
 const sourceByRole={front:[],range:[],heal:[]};
 for(const unitsInSquad of squads.values())for(const soldier of unitsInSquad)
  sourceByRole[soldierRole(soldier)].push(soldier);
 for(const pool of Object.values(sourceByRole))pool.sort((a,b)=>a.id-b.id);
 const getType=id=>normalizeFormationType(types[id]??types.get?.(id)??squads.get(id)?.[0]?.formationType);
 const state=indexes.map(id=>({
  id,type:getType(id),slots:squads.get(id).slice().sort((a,b)=>a.id-b.id),
  chosen:[],counts:{front:0,range:0,heal:0}
 }));
 // Round-robin allocation stops a large/early squad from monopolizing priests.
 // In every round, support gets the first chance at scarce healers.
 const order=state.slice().sort((a,b)=>
  ({support:0,balanced:1,attack:2}[a.type]-{support:0,balanced:1,attack:2}[b.type])||
  Number(a.id)-Number(b.id));
 let pending=true;
 while(pending){
  pending=false;
  for(const squad of order){
   if(squad.chosen.length>=squad.slots.length)continue;
   pending=true;
   const ideal=RATIOS[squad.type],size=squad.slots.length;
   const roles=['front','range','heal'].filter(role=>sourceByRole[role].length>0)
    .sort((a,b)=>(ideal[b]*size-squad.counts[b])-(ideal[a]*size-squad.counts[a])||
      sourceByRole[b].length-sourceByRole[a].length);
   const role=roles[0];
   if(!role)throw Error('編成する兵士が不足しています');
   squad.chosen.push(sourceByRole[role].shift());
   squad.counts[role]++;
  }
 }
 const assignments=[];
 for(const squad of state){
  for(let index=0;index<squad.slots.length;index++){
   const soldier=squad.chosen[index],slot=squad.slots[index];
   assignments.push({
    id:soldier.id,slotId:slot.id,squadId:squad.id,type:squad.type,role:soldierRole(soldier)
   });
  }
 }
 return {assignments,summaries:state.map(s=>({
  squadId:s.id,type:s.type,total:s.chosen.length,...s.counts
 }))};
}
/**
 * Takes immutable slot snapshots BEFORE changing any unit, otherwise swapping
 * the first soldier would erase a later soldier's original destination.
 */
export function applySquadRecomposition(units,plan,{team=0}={}){
 const byId=new Map(units.filter(u=>u.team===team).map(u=>[u.id,u]));
 const original=new Map([...byId].map(([id,u])=>[id,{
  x:u.x,z:u.z,fromX:u.fromX,fromZ:u.fromZ,
  formationForward:u.formationForward,formationLateral:u.formationLateral,
  bridgeIndex:u.bridgeIndex,
  home:u.home?.clone?.()??null,cell:u.cell?{...u.cell}:null,
  position:u.root?.position?.clone?.()??null
 }]));
 if(!plan||!Array.isArray(plan.assignments))return false;
 const used=new Set(),slots=new Set();
 for(const task of plan.assignments){
  const soldier=byId.get(task.id),spot=original.get(task.slotId);
  if(!soldier||!spot||used.has(task.id)||slots.has(task.slotId))return false;
  used.add(task.id);slots.add(task.slotId);
 }
 for(const task of plan.assignments){
  const u=byId.get(task.id),slot=original.get(task.slotId);
  u.squadId=Number(task.squadId);u.formationType=task.type;
  if(Number.isFinite(slot.x)&&Number.isFinite(slot.z)){
   u.x=slot.x;u.z=slot.z;u.fromX=slot.x;u.fromZ=slot.z;
   u.moveElapsed=0;u.moveDuration=0;
  }
  if(slot.bridgeIndex!=null)u.bridgeIndex=slot.bridgeIndex;
  if(slot.formationForward!=null)u.formationForward=slot.formationForward;
  if(slot.formationLateral!=null)u.formationLateral=slot.formationLateral;
  if(slot.cell)u.cell={...slot.cell};
  if(slot.position&&u.root?.position?.copy)u.root.position.copy(slot.position);
  if(slot.home&&u.home?.copy)u.home.copy(slot.home);
 }
 return true;
}
