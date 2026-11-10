/** Keep army-wide labels for overhead command only, not close character inspection. */
export const OVERHEAD_CALLOUT_DISTANCE=105;
export function shouldShowOverheadSquadCallouts(cameraDistance,{
 selectingTarget=false,selectingDestination=false,selectingMission=false
}={}){
 return !Number.isFinite(cameraDistance)||cameraDistance>=OVERHEAD_CALLOUT_DISTANCE||
  selectingTarget||selectingDestination||selectingMission;
}
/** Prefer a real living human close to an effect/order over an empty tile. */
export function closestAliveBattleFocus(units,x,z,{
 team=null,cellSize=1,gridOffset=0,maxDistance=32
}={}){
 if(!Number.isFinite(x)||!Number.isFinite(z))return null;
 let nearest=null,bestDistance=maxDistance;
 for(const unit of units||[]){
  if(!unit||unit.alive===false||!(Number(unit.hp)>0)||unit.isStrategist)continue;
  if(team!=null&&unit.team!==team)continue;
  const ux=unit.root?.position?.x??((unit.x-gridOffset)*cellSize);
  const uz=unit.root?.position?.z??((unit.z-gridOffset)*cellSize);
  if(!Number.isFinite(ux)||!Number.isFinite(uz))continue;
  const distance=Math.hypot(ux-x,uz-z);
  if(distance<bestDistance){nearest={x:ux,z:uz,unit};bestDistance=distance}
 }
 return nearest;
}
