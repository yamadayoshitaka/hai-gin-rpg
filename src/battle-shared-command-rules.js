/**
 * One order contract for 50/100/200/500/1000 soldiers per side.
 * Strategy and UI are identical; only the simulation/rendering backend differs.
 * Keep the short-lived Worker as a replica of the authoritative mass simulation.
 */
export const BATTLE_DIRECT_ORDERS=Object.freeze(['charge','defend','hold','retreat']);
export const BATTLE_PLAN_ORDERS=Object.freeze([
 'charge','defend','hold','retreat','support','explore','destroy','weaken'
]);
export const BATTLE_CHARGE_SPEED_MULTIPLIER=1.25;
export const BATTLE_DEFEND_SPEED_MULTIPLIER=.65;
export function battleOrderSpeedMultiplier(mode){
 return mode==='charge'?BATTLE_CHARGE_SPEED_MULTIPLIER:
  mode==='defend'?BATTLE_DEFEND_SPEED_MULTIPLIER:1;
}
/** Story-authored job restrictions are authoritative; free battles share all modes. */
export function allowedBattlePlanOrders(storyOrders){
 return Array.isArray(storyOrders)?storyOrders:BATTLE_PLAN_ORDERS;
}
const cellPoint=point=>point&&Number.isInteger(point.x)&&Number.isInteger(point.z);

/**
 * Both battle sizes MUST issue orders through this command boundary.
 * The 50-person scene uses its local actor orders; the large army uses the
 * grid simulation with an optional Worker mirror.  Rendering/LOD is not here.
 */
export function createBattleSquadCommandBridge({
 getMassSimulation,getWorkerSimulation,isWalkable
}){
 if(typeof getMassSimulation!=='function'||typeof getWorkerSimulation!=='function'||
    typeof isWalkable!=='function')throw new TypeError('Battle command backend missing');
 function issue({squadId,mode,point=null,team=0}){
  const id=String(squadId),side=Number(team);
  if(!id||!Number.isInteger(side)||![0,1].includes(side))return false;
  const mass=getMassSimulation();
  const worker=getWorkerSimulation();
  // Move and mission targets must remain within their actual navigation grid.
  if((mode==='move'||mode==='mission'||mode==='explore')&&!cellPoint(point))return false;
  if(mode==='move'&&!isWalkable(point.x,point.z))return false;
  if(mode==='explore'&&point.buildingId==null)return false;
  if(!['move','mission','explore','clear',...BATTLE_DIRECT_ORDERS].includes(mode))return false;
  if(!mass){
   // The 50-person game consumes the same command registry in its actor loop.
   // Do not silently accept nonexistent destinations in any battle size.
   return true;
  }
  let accepted=false;
  if(mode==='move'&&side===0)accepted=mass.setSquadDestination(id,point.x,point.z);
  else if(mode==='clear'&&side===0){mass.clearSquadDestination(id);accepted=true;}
  else if(mode==='mission'&&side===0)
   accepted=mass.setSquadMission(id,point.type,point);
  else if(mode==='explore')
   accepted=mass.setSquadExploration(id,String(point.buildingId),point.x,point.z,side);
  else if(BATTLE_DIRECT_ORDERS.includes(mode))
   accepted=mass.setSquadCommand(id,mode,side);
  if(!accepted)return false;
  // Worker replication follows successful authoritative acceptance only.
  if(worker?.active){
   if(mode==='move')worker.setSquadDestination(id,point.x,point.z);
   else if(mode==='clear')worker.clearSquadDestination(id);
   else if(mode==='mission')worker.setSquadMission(id,point.type,point);
   else if(mode==='explore')worker.setSquadExploration(id,String(point.buildingId),point.x,point.z,side);
   else worker.setSquadCommand(id,mode,side);
  }
  return true;
 }
 return Object.freeze({issue});
}
