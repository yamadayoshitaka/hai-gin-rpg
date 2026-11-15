/**
 * Runtime formation integrity: each occupied job cell must have survivors.
 * Losing any required cell, or more than half the troops, irreversibly
 * breaks formation for this battle. No spatial proximity requirement:
 * tactical movement and legitimate pursuit alone do not remove the bonus.
 */
export function formationStillIntact(spec,liveUnits){
 if(!spec?.active||!Array.isArray(spec.requiredSources)||!spec.requiredSources.length)return false;
 const living=liveUnits.filter(u=>u.team===0&&u.hp>0&&u.alive!==false&&!u.defeated&&
  String(u.armyGroupId)===String(spec.groupId));
 const sources=new Map();
 for(const unit of living){
  const key=String(unit.sourceSquadId);
  sources.set(key,(sources.get(key)||0)+1);
 }
 return spec.requiredSources.every(id=>sources.has(String(id))&&
  sources.get(String(id))>=Math.max(1,Number(spec.minBySource?.[String(id)]||1)))&&
  living.length>=Math.max(1,Math.trunc(Number(spec.minSurvivors)||1));
}
export function brokenFormationGroups(integrity,liveUnits,alreadyBroken=new Set()){
 return Object.entries(integrity||{}).filter(([group,spec])=>
  spec?.active&&!alreadyBroken.has(String(group))&&
  !formationStillIntact({...spec,groupId:group},liveUnits)).map(([group])=>String(group));
}
