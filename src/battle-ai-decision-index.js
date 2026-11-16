/**
 * Snapshot each army once per enemy AI decision interval (6s tactical / 7s
 * finite-items). Preserves exact order and complete defeated-member roster,
 * but avoids re-filtering every 50/1000 soldiers for every enemy squad.
 * Does not cache across AI decisions: position, HP and orders stay live.
 */
export function indexBattleDecisionUnits(units){
 const aliveByTeam=[[],[]],aliveBySquad=[new Map(),new Map()],
  allFightersBySquad=[new Map(),new Map()],livingStrategists=[new Set(),new Set()],
  aliveById=new Map();
 for(const unit of units||[]){
  const team=Number(unit.team);
  if(team!==0&&team!==1)continue;
  const id=String(unit.squadId);
  const alive=unit.hp>0&&unit.alive!==false;
  if(unit.isStrategist){
   if(alive)livingStrategists[team].add(id);
   continue;
  }
  let roster=allFightersBySquad[team].get(id);
  if(!roster){roster=[];allFightersBySquad[team].set(id,roster);}
  roster.push(unit);
  if(!alive)continue;
  aliveByTeam[team].push(unit);aliveById.set(String(unit.id),unit);
  let members=aliveBySquad[team].get(id);
  if(!members){members=[];aliveBySquad[team].set(id,members);}
  members.push(unit);
 }
 return {
  allies:aliveByTeam[0],enemies:aliveByTeam[1],aliveById,
  livingStrategists,
  living:(team,id)=>aliveBySquad[team]?.get(String(id))||[],
  roster:(team,id)=>allFightersBySquad[team]?.get(String(id))||[]
 };
}
