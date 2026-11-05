/** High-ground offensive rules shared by normal shots and job skills.
 * First floor: x1, second floor: x2, third floor: x4. A range of five or
 * more tiles defines a ranged attack; melee and healing never get the bonus.
 */
export function elevatedRangedStats(actor,{range=0,damage=0,radius=0,kind='damage'}={}){
 const floor=Number.isInteger(actor?.indoorFloor)&&actor.indoorFloor>1&&
  (!actor.floorTravel||actor.floorTravel.phase==='upstairs')?actor.indoorFloor:1;
 const eligible=kind==='damage'&&Number.isFinite(range)&&range>=5;
 const multiplier=eligible?2**Math.min(9,floor-1):1;
 return {
  floor,multiplier,
  range:range*multiplier,
  damage:damage*multiplier,
  radius:radius*multiplier,
  eligible
 };
}
