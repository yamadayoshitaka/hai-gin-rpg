/**
 * One map pin per real squad. The actual living strategist is the primary
 * position anchor; an explicitly nominated leader is next, then a soldier.
 * This never creates per-soldier pins or changes combat/deployment geometry.
 */
export function buildBattleSquadLeaderPins(units,{team=0,ids=[]}={}){
 const allowed=new Set(ids.map(String)),chosen=new Map();
 for(const unit of units||[]){
  if(unit?.team!==team||unit.alive===false||!(unit.hp>0))continue;
  const id=String(unit.squadId);
  if(!allowed.has(id))continue;
  const x=Number.isFinite(unit.x)?unit.x:unit.cell?.x;
  const z=Number.isFinite(unit.z)?unit.z:unit.cell?.z;
  if(!Number.isFinite(x)||!Number.isFinite(z))continue;
  const priority=unit.isStrategist?4:unit.isSquadLeader?3:unit.isPlayerHero?2:1;
  const existing=chosen.get(id);
  if(!existing||priority>existing.priority){
   chosen.set(id,{id,team,x,z,leaderId:unit.id??null,
    isCommander:Boolean(unit.isStrategist),priority});
  }
 }
 return new Map(ids.map(String).filter(id=>chosen.has(id))
  .map(id=>[id,chosen.get(id)]));
}
/** Deployment shows ten friendly squad leaders, not all enemy positions. */
export function visibleBattleSquadPins(own=[],enemies=[],mode='deploy'){
 return mode==='deploy'?own:[...enemies,...own];
}
