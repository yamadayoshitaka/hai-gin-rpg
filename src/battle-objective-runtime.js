import {evaluateBattleObjective} from './battle-stage-objective.js';
/**
 * Browser adapter for campaign objectives. Physics stays in existing simulation;
 * only the live, authoritative unit positions and simulation clock are sampled.
 */
export function createStageObjectiveMonitor(spec,{cellSize=1,onComplete,onZone}={}){
 if(!spec)return null;
 const hud=document.createElement('div');
 hud.id='battleObjectiveHud';
 hud.setAttribute('role','status');
 hud.setAttribute('aria-live','off');
 hud.style.cssText='position:fixed;z-index:11;top:65px;left:50%;transform:translateX(-50%);max-width:calc(100vw - 20px);min-width:min(310px,85vw);padding:7px 12px;border-radius:9px;border:1px solid #b9c780;background:#102a3ce8;color:#fff4b6;font:700 12px/1.4 system-ui;text-align:center;pointer-events:none;white-space:pre-line';
 hud.textContent='⚑ '+spec.title+'\n味方：'+spec.allyGoal+'\n敵：'+spec.enemyGoal;
 document.body.append(hud);
 let zone=null,lastElapsed=0,captureSeconds=0,breachSeconds=0,done=false,lastResult=null;
 function update(elapsed,units,{mass=false,sideSize=50}={}){
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
   onZone?.({center:(spec.defenderTeam===0?zone.ally:zone.enemy),
    radius:zone.radius,mass,type:spec.type});
  }
  const target=spec.defenderTeam===0?zone.ally:zone.enemy;
  const radiusSquared=zone.radius**2;
  let allyInZone=false,enemyInZone=false,allyAlive=0,enemyAlive=0,mainEnemyCommander=null,mainAllyCommander=null;
  for(const u of units){
   if(u.isStrategist){
    if(u.team===1&&(mainEnemyCommander===null||Number(u.id)<Number(mainEnemyCommander.id)))mainEnemyCommander=u;
    if(u.team===0&&(mainAllyCommander===null||Number(u.id)<Number(mainAllyCommander.id)))mainAllyCommander=u;
   }
   if(u.hp<=0||u.alive===false||u.defeated||u.isStrategist)continue;
   if(u.team===0)allyAlive++;
   if(u.team===1)enemyAlive++;
   const p=pos(u);
   if((p.x-target.x)**2+(p.z-target.z)**2>radiusSquared)continue;
   if(u.team===0)allyInZone=true;
   if(u.team===1)enemyInZone=true;
  }
  const mainEnemyCommanderDefeated=mainEnemyCommander!=null&&
   (mainEnemyCommander.hp<=0||mainEnemyCommander.alive===false||mainEnemyCommander.defeated);
  const mainAllyCommanderDefeated=mainAllyCommander!=null&&
   (mainAllyCommander.hp<=0||mainAllyCommander.alive===false||mainAllyCommander.defeated);
  const result=evaluateBattleObjective(spec,{
   elapsedSeconds:elapsed,deltaSeconds:Math.max(0,Math.min(1,elapsed-lastElapsed)),
   allyAlive,enemyAlive,allyInZone,enemyInZone,captureSeconds,breachSeconds,
   enemyCommanderDefeated:mainEnemyCommanderDefeated,
   allyCommanderDefeated:mainAllyCommanderDefeated
  });
  captureSeconds=result.captureSeconds;
  breachSeconds=result.breachSeconds;
  lastElapsed=elapsed;
  lastResult=result;
  hud.textContent='⚑ '+spec.title+'\n味方：'+spec.allyGoal+'\n敵：'+spec.enemyGoal+'\n'+result.reason;
  if(!result.outcome)return false;
  done=true;
  onComplete?.(result.outcome==='victory',result.reason,result);
  return true;
 }
 return {update,getState:()=>({captureSeconds,breachSeconds,lastElapsed,done,zone,lastResult}),element:hud};
}
