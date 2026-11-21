/** Real prebattle availability for tactics unlocked by an active formation.
 * A tactic is offered only if at least one physical platoon can execute it.
 */
import {STRATEGY_METHODS} from './three-step-strategy-catalog.js';
import {unlockedFormationTactics} from './formation-strategy-unlocks.js';

export const BASIC_OPENING_TACTICS=Object.freeze({
 assault:'相手殲滅・攻撃重視',
 defense:'守備・陣形維持',
 balanced:'バランス・攻防連携',
 explore:'探索・目的遂行'
});
export function availableFormationOpeningTactics({
 formation='balanced',active=true,divisions=[],enemyCount=0,
 structureCount=0,buildingCount=0,supportAvailable=false
}={}){
 if(!active)return [];
 const enemy=Number(enemyCount)||0,structures=Number(structureCount)||0;
 return unlockedFormationTactics(formation,true).filter(id=>{
  const tactic=STRATEGY_METHODS[id];
  if(!tactic)return false;
  if((tactic.type==='enemy'&&enemy<1)||
     (['melee_split','ranged_split'].includes(id)&&enemy<2)||
     (id==='destroy_path'&&structures<1)||
     (id==='scout_summon'&&buildingCount<1)||
     (id==='boost_speed'&&!supportAvailable))return false;
  return divisions.some(division=>{
   const jobs=new Set(division.jobs||[]),orders=new Set(division.orders||[]);
   return orders.has(tactic.mode)&&
    (!tactic.jobs.length||tactic.jobs.some(job=>jobs.has(job)))&&
    (!tactic.requiresSummon||division.hasSummon===true);
  });
 });
}
