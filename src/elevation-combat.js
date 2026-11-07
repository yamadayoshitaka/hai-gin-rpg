/** High-ground combat: one completed storey is one level of the bonus.
 * Archers gain ×10 shot range and ×4 damage per higher floor. On the
 * first floor they remain at base range and damage. An actual roof is
 * treated as a further storey, but ladder climbing itself is not.
 * Other ranged jobs retain their existing ×2/level profile.
 */
export function elevatedRangedStats(actor,{range=0,damage=0,radius=0,kind='damage'}={}){
 const floor=Number.isInteger(actor?.indoorFloor)&&actor.indoorFloor>1&&
   (!actor.floorTravel||['upstairs','roof'].includes(actor.floorTravel.phase))?actor.indoorFloor:1;
 const eligible=kind==='damage'&&Number.isFinite(range)&&range>=5;
 const archery=actor?.jobId==='archer'||actor?.job?.id==='archer'||
   actor?.job?.name==='弓使い'||actor?.jobName==='弓使い';
 const steps=Math.min(9,floor-1);
 const rangeMultiplier=eligible?(archery?10**steps:2**steps):1;
 const damageMultiplier=eligible?(archery?4**steps:2**steps):1;
 const radiusMultiplier=eligible&&!archery?2**steps:1;
 return {
  floor,multiplier:damageMultiplier,rangeMultiplier,damageMultiplier,
  range:range*rangeMultiplier,
  damage:damage*damageMultiplier,
  radius:radius*radiusMultiplier,
  eligible
 };
}
