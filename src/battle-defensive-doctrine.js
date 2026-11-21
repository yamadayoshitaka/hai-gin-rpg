/**
 * Defensive squad doctrine shared by Worker and non-Worker battles.
 *
 * Defend does not make a squad invulnerable: soldiers establish a shield
 * stance over six seconds, recover only to 80% HP without a healer, and
 * strengthen physical/elemental damage resistance. A real priest must heal
 * the remaining 20%; a fallen soldier never regenerates from this order.
 */
export const DEFENSE_BUILD_SECONDS=6;
export const DEFENSE_REGEN_CAP=.80;
export const MAX_PHYSICAL_REDUCTION=.24;
export const MAX_ELEMENTAL_REDUCTION=.32;
export const DEFENSE_REGEN_HP_PER_SECOND=1.6;

const clamp=(n,min,max)=>Math.min(max,Math.max(min,n));

export function updateDefensivePosture(unit,dt,defending){
 if(!unit||unit.alive===false||!(unit.hp>0)){
  if(unit){
   unit.defendSeconds=0;
   unit.defendPhysicalReduction=0;
   unit.defendElementalReduction=0;
  }
  return 0;
 }
 const delta=clamp(Number.isFinite(dt)?dt:0,0,.25);
 unit.defendSeconds=defending?clamp((unit.defendSeconds||0)+delta,0,DEFENSE_BUILD_SECONDS):0;
 const progress=defending?unit.defendSeconds/DEFENSE_BUILD_SECONDS:0;
 // Fortification begins immediately, then improves as the ranks settle.
 unit.defendPhysicalReduction=defending?(.09+(MAX_PHYSICAL_REDUCTION-.09)*progress):0;
 unit.defendElementalReduction=defending?(.12+(MAX_ELEMENTAL_REDUCTION-.12)*progress):0;
 if(!defending||!delta||!Number.isFinite(unit.maxHp))return 0;
 const cap=Math.min(unit.maxHp,Math.max(0,unit.maxHp*DEFENSE_REGEN_CAP));
 const prev=unit.hp;
 unit.hp=Math.max(prev,Math.min(cap,unit.hp+(0.45+DEFENSE_REGEN_HP_PER_SECOND*progress)*delta));
 return Math.max(0,unit.hp-prev);
}

/** Applied once in the existing damage pipeline, including burning/magic. */
export function defensiveDamageMultiplier(target,element='physical'){
 if(!target||target.alive===false||target.hp<=0)return 1;
 const physical=element==='physical'||element==='slash'||element==='heavy';
 const reduction=physical?target.defendPhysicalReduction:target.defendElementalReduction;
 return 1-clamp(Number.isFinite(reduction)?reduction:0,0,.4);
}


/**
 * Decide whether a defending skirmish soldier may pursue a target.
 * Distances are measured in grid cells so the policy is independent of
 * scene/world scale. Hysteresis prevents an enemy near the defensive edge
 * from pulling troops repeatedly away from and back to their own post.
 *
 * Defenders always attack enemies already within weapon range; pursuing
 * enemies beyond the guarded perimeter is not an implicit assault order.
 */
export function resolveDefensiveGuardIntent({
 distanceFromPost=0,enemyDistanceFromPost=Infinity,enemyDistance=Infinity,
 attackRange=0,returning=false,guardRadius=5,returnRadius=3.2
}={}){
 const distance=Number.isFinite(distanceFromPost)?Math.max(0,distanceFromPost):0;
 const mustReturn=returning?distance>returnRadius:distance>guardRadius+1;
 const canAttack=Number.isFinite(enemyDistance)&&enemyDistance<=attackRange;
 // Do not take a step outward at the edge of the guarded zone. The
 // opponent must enter this perimeter before defenders give chase.
 const canPursue=!mustReturn&&Number.isFinite(enemyDistanceFromPost)&&
   enemyDistanceFromPost<=guardRadius&&distance<guardRadius-.5;
 return {returnToPost:mustReturn,allowPursuit:canAttack||canPursue};
}
