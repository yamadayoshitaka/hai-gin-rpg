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

/** The firing bays use the *same* masonry row/column rules as object-catalog.
 * A projectile starts at the real aperture, while the soldier stands safely
 * just inside the wall. Only the upper floors are eligible.
 */
export function buildingWindowFiringPositions(structure,buildingPosition,floor,{cellSize=2.2}={}){
 if(!structure?.floors?.[floor-1]||floor<2)return [];
 const last=structure.floors.length,castle=structure.id==='castle_001';
 const manor=structure.id.startsWith('manor_');
 const overall=structure.floors[0].height*last;
 const width=structure.floors[0].footprint.width,depth=structure.floors[0].footprint.depth;
 const inset=.57*cellSize,baseY=buildingPosition.y+structure.floors[floor-1].baseY+.08;
 const windows=[];
 const add=(side,offset,wallHalf,halfWidth,muzzleY)=>{
  const normal=side==='east'?{x:1,z:0}:side==='west'?{x:-1,z:0}:side==='south'?{x:0,z:1}:{x:0,z:-1};
  const wall=side==='east'||side==='west'?
   {x:normal.x*wallHalf,z:offset}:{x:offset,z:normal.z*wallHalf};
  windows.push({id:floor+'-'+side+'-'+windows.length,floor,side,normal,
   x:buildingPosition.x+wall.x-normal.x*inset,
   y:baseY,z:buildingPosition.z+wall.z-normal.z*inset,
   aperture:{x:buildingPosition.x+wall.x,y:buildingPosition.y+muzzleY,
    z:buildingPosition.z+wall.z},
   inset,halfWidth:Math.max(.35,halfWidth*.75)});
 };
 if(manor){
  if(floor!==2)return [];
  const estate=structure.id==='manor_garden_001';
  const bodyW=width-(estate?5:3)*cellSize,bodyD=depth-(estate?4:2)*cellSize;
  const pitch=1.10*cellSize,rows=Math.ceil(overall/pitch);
  const usableRows=Array.from({length:rows},(_,i)=>(i+.5)*overall/rows)
   .filter(y=>y>=overall*.59&&y<=overall*.84);
  const muzzleY=usableRows[Math.floor(usableRows.length/2)];
  if(!Number.isFinite(muzzleY))return [];
  const emit=(count,span,side,wallHalf)=>{
   for(let c=0;c<count;c++){
    const offset=-span/2+(c+.5)*span/count;
    const n=Math.round(Math.abs(offset)/(1.6*cellSize));
    if(n>0&&n<=3&&Math.abs(Math.abs(offset)-n*1.6*cellSize)<.57*cellSize&&
     Math.abs(offset)<span/2-.65*cellSize)
     add(side,offset,wallHalf,span/count*.45,muzzleY);
   }
  };
  for(const side of ['south','north'])emit(Math.ceil(bodyW/pitch),bodyW,side,bodyD/2);
  for(const side of ['east','west'])emit(Math.ceil(bodyD/pitch),bodyD,side,bodyW/2);
  return windows;
 }
 const tile=(castle?3:1.5)*cellSize,rows=Math.ceil(overall/tile);
 const row=Math.floor((floor-.5)*rows/last);
 const muzzleY=(row+.5)*overall/rows;
 const addRow=(count,span,side,wallHalf)=>{
  for(let c=1;c<count-1;c++){
   if(c%(castle?4:3)!==1)continue;
   const offset=-span/2+(c+.5)*span/count;
   add(side,offset,wallHalf,span/count*.44,muzzleY);
  }
 };
 for(const side of ['south','north'])addRow(Math.ceil(width/tile),width,side,depth/2);
 for(const side of ['east','west'])addRow(Math.ceil(depth/tile),depth,side,width/2);
 return windows;
}

/** Ray must cross the open part of the *chosen* bay, never adjacent stone.
 * Also stops shots at targets behind that facade. The target must be outside.
 */
export function targetVisibleFromWindow(window,target){
 if(!window||!target)return false;
 const dx=target.x-window.aperture.x,dz=target.z-window.aperture.z;
 const forward=dx*window.normal.x+dz*window.normal.z;
 if(forward<.3)return false;
 const sideways=Math.abs(dx*window.normal.z-dz*window.normal.x);
 const crossing=sideways*window.inset/(forward+window.inset);
 return crossing<window.halfWidth;
}

/** Surface coordinates and visible climb geometry share one authored plan. */
export function roofAccessPlan(structure,{cellSize=2.2}={}){
 if(!structure?.floors?.length||!structure?.stair?.stair)return null;
 const id=structure.id,castle=id==='castle_001';
 const manor=id.startsWith('manor_');
 const width=structure.floors[0].footprint.width;
 const height=structure.floors.reduce((sum,f)=>sum+f.height,0);
 const roofRise=castle?0:manor?(id==='manor_noble_001'?4:id==='manor_merchant_001'?3.1:4.7)*cellSize:
  (id==='church_001'?3.4:2.5)*cellSize;
 const bodyWidth=manor?width-(id==='manor_garden_001'?5:3)*cellSize:width;
 const roofHalf=bodyWidth/2+.5*cellSize;
 const stair=structure.stair.stair;
 const ladderX=Math.max(-roofHalf+.75*cellSize,Math.min(roofHalf-.75*cellSize,stair.x+stair.outerRadius+.9*cellSize));
 const ladderZ=stair.z;
 const depth=structure.floors[0].footprint.depth;
 const bodyDepth=manor?depth-(id==='manor_garden_001'?4:2)*cellSize:depth;
 const roofHalfDepth=bodyDepth/2+.5*cellSize;
 // A rooftop lookout must remain within the visible roof surface. On the
 // south side the soldier is seen *on* the tiles, not behind the far gable.
 const lookoutX=castle?ladderX:Math.sign(ladderX)*Math.min(Math.abs(ladderX),roofHalf*.30);
 const lookoutZ=Math.min(bodyDepth*.20,roofHalfDepth-1.1*cellSize);
 const roofY=x=>height+roofRise*(1-Math.min(1,Math.abs(x)/roofHalf))+(castle?.23:.12)*cellSize;
 return {ladderX,ladderZ,startY:structure.floors.at(-1).baseY+.12,
  finishY:roofY(ladderX),lookoutX,lookoutZ,
  roofY,roofRise,roofHalf,roofHalfDepth,width,height,castle};
}

/** Physical ladder up from the last storey, then footsteps across the roof.
 * Roof level is one above the highest inhabited floor, not a fake extra room.
 */
export function buildRoofTravelRoute(structure,buildingPosition,fromFloor){
 if(fromFloor!==structure?.floors?.length)throw Error('Roof access starts on the top floor');
 const plan=roofAccessPlan(structure);
 if(!plan)throw Error('Building has no roof access plan');
 const world=(x,y,z)=>({x:buildingPosition.x+x,y:buildingPosition.y+y,z:buildingPosition.z+z});
 const route=[];
 // Follow the landing rim around the stairwell opening. A straight shortcut
 // from the previous flight's end would walk across empty air above the well.
 const stair=structure.stair.stair,feetY=plan.startY;
 const clockwise=stair.clockwise?-1:1;
 const lastAngle=stair.startAngle+clockwise*stair.turns*2*Math.PI;
 const rim=stair.outerRadius+.85;
 let delta=Math.atan2(plan.ladderZ-stair.z,plan.ladderX-stair.x)-lastAngle;
 while(delta>Math.PI)delta-=2*Math.PI;
 while(delta<-Math.PI)delta+=2*Math.PI;
 const turnSteps=Math.max(6,Math.ceil(Math.abs(delta)*rim/.50));
 for(let step=0;step<=turnSteps;step++){
  const angle=lastAngle+delta*step/turnSteps;
  route.push(world(stair.x+Math.cos(angle)*rim,feetY,
   stair.z+Math.sin(angle)*rim));
 }
 // Continue from the ACTUAL final stairwell rim angle. Previously this
 // corridor restarted at the positive-X radius regardless of the angle,
 // making soldiers cross the empty stairwell as if levitating to the ladder.
 const rimX=stair.x+Math.cos(lastAngle+delta)*rim;
 const rimZ=stair.z+Math.sin(lastAngle+delta)*rim;
 const toLadder=Math.hypot(plan.ladderX-rimX,plan.ladderZ-rimZ);
 const corridorSteps=Math.max(4,Math.ceil(toLadder/.45));
 for(let step=1;step<=corridorSteps;step++){
  const t=step/corridorSteps;
  route.push(world(rimX+(plan.ladderX-rimX)*t,feetY,
   rimZ+(plan.ladderZ-rimZ)*t));
 }
 const steps=Math.max(1,Math.ceil((plan.finishY-feetY)/.27));
 for(let step=1;step<=steps;step++){
  const t=step/steps;
  route.push(world(plan.ladderX,feetY+(plan.finishY-feetY)*t,plan.ladderZ));
 }
 const rooftopSteps=Math.max(6,Math.ceil(Math.abs(plan.lookoutX-plan.ladderX)/.48));
 for(let step=1;step<=rooftopSteps;step++){
  const t=step/rooftopSteps,x=plan.ladderX+(plan.lookoutX-plan.ladderX)*t;
  route.push(world(x,plan.roofY(x),plan.ladderZ));
 }
 // Traverse along the roof ridge toward the front-facing, supported slope.
 // Keeping the original negative stair z left the actor behind the roof in
 // the mobile camera, which looked like unaided flight.
 const frontSteps=Math.max(6,Math.ceil(Math.abs(plan.lookoutZ-plan.ladderZ)/.48));
 for(let step=1;step<=frontSteps;step++){
  const t=step/frontSteps,z=plan.ladderZ+(plan.lookoutZ-plan.ladderZ)*t;
  route.push(world(plan.lookoutX,plan.roofY(plan.lookoutX),z));
 }
 return route;
}

/**
 * Ninja grappling hook: the user is OUTSIDE a building on the first floor.
 * The rope rises against the physical outer wall, then the feet step over
 * the eaves onto a supported roof plane. There is no intermediate floor,
 * free-floating shortcut or discontinuous teleport.
 */
export function buildGrappleRoofRoute(structure,buildingPosition,fromWorld,{
 cellSize=2.2,groundY=fromWorld?.y??0
}={}){
 const plan=roofAccessPlan(structure,{cellSize});
 if(!plan||!fromWorld)throw Error('Roof grapple needs building, rooftop and launch location');
 const footprint=structure.floors[0].footprint;
 const halfW=footprint.width/2,halfD=footprint.depth/2;
 const lx=fromWorld.x-buildingPosition.x,lz=fromWorld.z-buildingPosition.z;
 // Approach the nearest outer wall from the ground; never run through a
 // room or through the sloping roof to reach the tether point.
 const sideX=Math.abs(lx/Math.max(1,halfW))>=Math.abs(lz/Math.max(1,halfD));
 const sign=Math.sign(sideX?lx:lz)||1;
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 let anchorX,anchorZ,roofX,roofZ;
 if(sideX){
  anchorX=sign*(halfW+cellSize*.68);
  anchorZ=clamp(lz,-halfD*.65,halfD*.65);
  roofX=sign*Math.min(plan.roofHalf-cellSize*.55,halfW+cellSize*.12);
  roofZ=anchorZ;
 }else{
  anchorZ=sign*(halfD+cellSize*.68);
  anchorX=clamp(lx,-halfW*.65,halfW*.65);
  roofZ=sign*Math.min(plan.roofHalfDepth-cellSize*.55,halfD+cellSize*.12);
  roofX=anchorX;
 }
 const world=(x,y,z)=>({x:buildingPosition.x+x,y:buildingPosition.y+y,z:buildingPosition.z+z});
 const entrance=world(anchorX,groundY-buildingPosition.y,anchorZ);
 const roofTop=plan.roofY(roofX);
 const exit=world(roofX,roofTop,roofZ);
 const route=[];
 const steps=Math.max(8,Math.ceil(Math.hypot(roofTop+buildingPosition.y-groundY,
  roofX-anchorX,roofZ-anchorZ)/.30));
 for(let step=0;step<=steps;step++){
  const t=step/steps;
  route.push({
   x:entrance.x+(exit.x-entrance.x)*t,
   y:entrance.y+(exit.y-entrance.y)*t,
   z:entrance.z+(exit.z-entrance.z)*t
  });
 }
 const rooftopSteps=Math.max(4,Math.ceil(Math.hypot(
  plan.lookoutX-roofX,plan.lookoutZ-roofZ)/.43));
 for(let step=1;step<=rooftopSteps;step++){
  const t=step/rooftopSteps,x=roofX+(plan.lookoutX-roofX)*t,
   z=roofZ+(plan.lookoutZ-roofZ)*t;
  route.push(world(x,plan.roofY(x),z));
 }
 return {entrance,exit,waypoints:route};
}

/** Foot contact is derived from the authored roof plane and footprint.
 * Corrects tiny pose drift and prevents a soldier standing beyond the eaves.
 */
export function rooftopStandingPosition(structure,buildingPosition,point,{cellSize=2.2}={}){
 const plan=roofAccessPlan(structure,{cellSize});
 if(!plan)return null;
 const margin=Math.min(cellSize*.85,plan.roofHalf*.20,plan.roofHalfDepth*.20);
 const x=Math.max(-plan.roofHalf+margin,Math.min(plan.roofHalf-margin,point.x-buildingPosition.x));
 const z=Math.max(-plan.roofHalfDepth+margin,Math.min(plan.roofHalfDepth-margin,point.z-buildingPosition.z));
 return {x:buildingPosition.x+x,y:buildingPosition.y+plan.roofY(x),z:buildingPosition.z+z};
}
