/** World-space walking path over an authored spiral stair flight.
 *
 * One ordinary step of the spiral is one waypoint. Heights come from the BOM;
 * a character's vertical position is never guessed from the ground terrain.
 * The path is reversible so the same stair moves soldiers both directions.
 */
export function buildFloorTravelRoute(structure,buildingPosition,fromFloor,toFloor){
 const plan=structure?.stair;
 if(plan?.type!=='spiral')throw Error('Building has no spiral stair BOM');
 if(!Number.isInteger(fromFloor)||!Number.isInteger(toFloor)||Math.abs(toFloor-fromFloor)!==1||
  fromFloor<1||toFloor<1||Math.max(fromFloor,toFloor)>structure.floors.length)
  throw Error('Stair travel must connect adjacent existing floors');
 const lower=Math.min(fromFloor,toFloor);
 const flight=plan.flights.find(item=>item.fromFloor===lower&&item.toFloor===lower+1);
 if(!flight)throw Error('Missing stair flight '+lower);
 const stair=plan.stair,clockwise=stair.clockwise?-1:1;
 const radius=(stair.innerRadius+stair.outerRadius)/2;
 const base=(lower-1)*stair.rise;
 const at=(angle,height,r=radius)=>({
  x:buildingPosition.x+stair.x+Math.cos(angle)*r,
  y:buildingPosition.y+height,
  z:buildingPosition.z+stair.z+Math.sin(angle)*r
 });
 const result=[];
 if(lower>1){
  // On upper storeys, walk around the stairwell opening on the slab before
  // the next flight. Cutting straight across the opening would float in air.
  const rim=stair.outerRadius+.85;
  const previousTop=stair.startAngle+clockwise*stair.turns*Math.PI*2;
  for(let index=0;index<=8;index++){
   const angle=previousTop+clockwise*(1-stair.turns)*Math.PI*2*index/8;
   result.push(at(angle,base,rim));
  }
  for(let index=1;index<=4;index++)
   result.push(at(stair.startAngle,base,rim+(radius-rim)*index/4));
 }
 for(let index=0;index<=stair.steps;index++){
  const amount=index/stair.steps;
  const angle=stair.startAngle+clockwise*stair.turns*Math.PI*2*amount;
  result.push(at(angle,base+stair.rise*amount));
 }
 // On the upper storey the final point is beyond the stairwell opening,
 // where the floor slab can actually carry the character's feet.
 const lastAngle=stair.startAngle+clockwise*stair.turns*Math.PI*2;
 for(let index=1;index<=4;index++)
  result.push(at(lastAngle,base+stair.rise,radius+(stair.outerRadius+.85-radius)*index/4));
 return fromFloor<toFloor?result:result.reverse();
}

export function floorTravelEntryPoint(building){
 const b=building.data;
 return {x:b.x,z:b.z+b.d/2+2};
}
