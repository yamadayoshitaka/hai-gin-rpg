/**
 * Same-squad military strategist's command presence. Distance is measured
 * on the shared simulation grid, not from the camera or an arbitrary HQ.
 * A full aura doubles outgoing attack and effective durability (halves damage
 * received); at the falloff edge and after the commander dies it is neutral.
 */
export const STRATEGIST_AURA_FULL_RADIUS=3;
export const STRATEGIST_AURA_OUTER_RADIUS=24;

export function strategistAuraStrength(distance,{
  fullRadius=STRATEGIST_AURA_FULL_RADIUS,
  outerRadius=STRATEGIST_AURA_OUTER_RADIUS
}={}){
  if(!Number.isFinite(distance)||distance<0||outerRadius<=fullRadius)return 0;
  return Math.max(0,Math.min(1,(outerRadius-Math.max(fullRadius,distance))/
    (outerRadius-fullRadius)));
}

export function strategistAuraMultipliers(soldier,commander,options){
  if(!soldier||!commander||!commander.alive||commander.hp<=0||
     soldier.isStrategist||soldier.team!==commander.team||
     String(soldier.squadId)!==String(commander.squadId)){
    return {attack:1,defense:1,strength:0};
  }
  const d=Math.hypot(soldier.x-commander.x,soldier.z-commander.z);
  const strength=strategistAuraStrength(d,options);
  return {attack:1+strength,defense:1/(1+strength),strength};
}
