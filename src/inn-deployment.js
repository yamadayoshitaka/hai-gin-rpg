/**
 * A compact 3-lane x 4-rank battle staging board.
 * Slots are persistent per squad, not per individual soldier. Ranks are
 * front -> rear; within each row, west/center/east map to river crossings.
 */
export const DEPLOYMENT_COLUMNS=3;
export const DEPLOYMENT_ROWS=4;
export const DEPLOYMENT_CAPACITY=DEPLOYMENT_COLUMNS*DEPLOYMENT_ROWS;
export const DEPLOYMENT_LANES=Object.freeze(['north','center','south']);
export const DEPLOYMENT_RANK_LABELS=Object.freeze(['前衛','中衛','後衛','本陣']);
export const isDeploymentSlot=value=>Number.isInteger(value)&&value>=0&&value<DEPLOYMENT_CAPACITY;
export const slotLane=slot=>DEPLOYMENT_LANES[isDeploymentSlot(slot)?slot%DEPLOYMENT_COLUMNS:1];
export const slotRank=slot=>isDeploymentSlot(slot)?Math.floor(slot/DEPLOYMENT_COLUMNS):1;
export function resolvedSquadDeployment(squads=[]){
 const occupied=new Set(),positions=new Map();
 for(const squad of squads){
  if(!squad||squad.count<=0||!isDeploymentSlot(squad.deploymentSlot)||occupied.has(squad.deploymentSlot))continue;
  const id=String(squad.id);if(positions.has(id))continue;
  positions.set(id,squad.deploymentSlot);occupied.add(squad.deploymentSlot);
 }
 for(const squad of squads){
  if(!squad||squad.count<=0||positions.has(String(squad.id)))continue;
  const open=Array.from({length:DEPLOYMENT_CAPACITY},(_,i)=>i).find(slot=>!occupied.has(slot));
  if(open===undefined)break;
  positions.set(String(squad.id),open);occupied.add(open);
 }
 return positions;
}
/**
 * Tap a squad, then tap a free/occupied cell; occupied cells swap.
 * Writes only the two squad slot numbers, preserving IDs/equipment/ranks.
 */
export function moveSquadDeployment(squads,selectedId,targetSlot){
 if(!Array.isArray(squads)||!isDeploymentSlot(targetSlot))return false;
 const selected=squads.find(s=>String(s.id)===String(selectedId)&&s.count>0);
 if(!selected)return false;
 const current=resolvedSquadDeployment(squads);
 const old=current.get(String(selected.id));
 if(old==null||old===targetSlot)return false;
 const occupied=squads.find(s=>s!==selected&&current.get(String(s.id))===targetSlot);
 selected.deploymentSlot=targetSlot;
 if(occupied)occupied.deploymentSlot=old;
 return true;
}
export function deploymentForSquad(squad,allotmentIndex,allSquads){
 const slots=resolvedSquadDeployment(allSquads||[]);
 const slot=slots.get(String(squad.id));
 return isDeploymentSlot(slot)?slot:allotmentIndex%DEPLOYMENT_CAPACITY;
}
