import {evaluateBattleObjective} from './battle-stage-objective.js';
/**
 * Browser adapter for campaign objectives. Physics stays in existing simulation;
 * only the live, authoritative unit positions and simulation clock are sampled.
 */
export function createStageObjectiveMonitor(spec,{cellSize=1,onComplete}={}){
 if(!spec)return null;
 const hud=document.createElement('div');
 hud.id='battleObjectiveHud';
 hud.setAttribute('role','status');
 hud.setAttribute('aria-live','off');
 hud.style.cssText='position:fixed;z-index:11;top:65px;left:50%;transform:translateX(-50%);max-width:calc(100vw - 20px);min-width:min(310px,85vw);padding:7px 12px;border-radius:9px;border:1px solid #b9c780;background:#102a3ce8;color:#fff4b6;font:700 12px/1.4 system-ui;text-align:center;pointer-events:none;white-space:normal';
 hud.textContent='⚑ '+spec.title;
 document.body.append(hud);
 let zone=null,lastElapsed=0,captureSeconds=0,breachSeconds=0,done=false;
 function update(elapsed,units,{mass=false,sideSize=50,teamCounts}={}){
  if(done)return true;
  const pos=u=>mass?{x:u.x,z:u.z}:
   {x:u.root?.position.x??u.x??0,z:u.root?.position.z??u.z??0};
  if(!zone){
   const center=team=>{
    const points=units.filter(u=>u.team===team&&!u.isStrategist&&u.hp>0).map(pos);
    return {x:points.reduce((n,p)=>n+p.x,0)/Math.max(1,points.length),
     z:points.reduce((n,p)=>n+p.z,0)/Math.max(1,points.length)};
   };
   zone={ally:center(0),enemy:center(1),
    radius:mass?Math.max(7,Math.round(Math.sqrt(sideSize)*.7)):cellSize*5};
  }
  const target=spec.type==='defend_timer'?zone.ally:zone.enemy;
  const radiusSquared=zone.radius**2;
  let allyInZone=false,enemyInZone=false,enemyCommanderExists=false,enemyCommanderDefeated=false;
  for(const u of units){
   if(u.team===1&&u.isStrategist){
    enemyCommanderExists=true;
    if(u.hp<=0||u.alive===false||u.defeated)enemyCommanderDefeated=true;
   }
   if(u.hp<=0||u.alive===false||u.defeated||u.isStrategist)continue;
   const p=pos(u);
   if((p.x-target.x)**2+(p.z-target.z)**2>radiusSquared)continue;
   if(u.team===0)allyInZone=true;
   if(u.team===1)enemyInZone=true;
  }
  const [allyAlive,enemyAlive]=teamCounts;
  const result=evaluateBattleObjective(spec,{
   elapsedSeconds:elapsed,deltaSeconds:Math.max(0,Math.min(1,elapsed-lastElapsed)),
   allyAlive,enemyAlive,allyInZone,enemyInZone,captureSeconds,breachSeconds,
   enemyCommanderDefeated:enemyCommanderExists&&enemyCommanderDefeated
  });
  captureSeconds=result.captureSeconds;
  breachSeconds=result.breachSeconds;
  lastElapsed=elapsed;
  hud.textContent='⚑ '+spec.title+'｜'+result.reason;
  if(!result.outcome)return false;
  done=true;
  onComplete?.(result.outcome==='victory',result.reason);
  return true;
 }
 return {update,getState:()=>({captureSeconds,breachSeconds,lastElapsed,done,zone}),element:hud};
}
