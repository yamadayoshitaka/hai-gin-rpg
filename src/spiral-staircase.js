/** Geometry-independent, reusable spiral-stair BOM in building-local units. */
const TAU=Math.PI*2;
const positiveAngle=angle=>((angle%TAU)+TAU)%TAU;

export function resolveSpiralStair(stair={}){
 const innerRadius=stair.innerRadius??.65;
 const outerRadius=stair.outerRadius??Math.max(2.35,innerRadius+(stair.width??2.3));
 const turns=stair.turns??.75;
 const steps=stair.steps??20;
 const rise=stair.rise??2.3;
 const startAngle=stair.startAngle??Math.PI/2;
 const clockwise=stair.clockwise!==false;
 if(!(innerRadius>.2&&outerRadius>innerRadius+.85&&turns>.25&&turns<=1&&Number.isInteger(steps)&&steps>=8&&rise>0))
  throw Error('Invalid spiral staircase dimensions');
 return {...stair,type:'spiral',x:stair.x??0,z:stair.z??0,innerRadius,outerRadius,
  width:outerRadius-innerRadius,run:(innerRadius+outerRadius)/2*turns*TAU,
  turns,steps,rise,startAngle,clockwise};
}

export function spiralStairLanding(stair,end='bottom'){
 const s=resolveSpiralStair(stair);
 const angle=s.startAngle+(end==='top'?(s.clockwise?-1:1)*s.turns*TAU:0);
 const r=(s.innerRadius+s.outerRadius)/2;
 return {x:s.x+Math.cos(angle)*r,z:s.z+Math.sin(angle)*r,angle};
}

/** One independent flight joins each consecutive pair of floors. */
export function createSpiralStairPlan(stair,{floors=2,floorY=0}={}){
 const s=resolveSpiralStair(stair);
 if(!Number.isInteger(floors)||floors<2||floors>20)throw Error('Invalid staircase floor count');
 const stepAngle=(s.clockwise?-1:1)*s.turns*TAU/s.steps;
 const flights=Array.from({length:floors-1},(_,index)=>({
  fromFloor:index+1,toFloor:index+2,
  steps:Array.from({length:s.steps},(_,i)=>({
   id:'flight-'+(index+1)+':step-'+(i+1),index:i,
   startAngle:s.startAngle+i*stepAngle,endAngle:s.startAngle+(i+1)*stepAngle,
   middleAngle:s.startAngle+(i+.5)*stepAngle,
   innerRadius:s.innerRadius,outerRadius:s.outerRadius,
   x:s.x,z:s.z,top:floorY+(i+1)*s.rise/s.steps,
   bottom:floorY+i*s.rise/s.steps,
   fromFloor:index+1,toFloor:index+2
  }))
 }));
 const diameter=s.outerRadius*2;
 return {type:'spiral',stair:s,floors,flights,
  opening:{x:s.x,z:s.z,width:diameter+.8,depth:diameter+.8},
  bottom:spiralStairLanding(s,'bottom'),top:spiralStairLanding(s,'top')};
}

/** Progress increases along the authored ascending arc, regardless of hand. */
export function spiralStairProgress(stair,point){
 const s=resolveSpiralStair(stair);
 const dx=point.x-s.x,dz=point.z-s.z,radius=Math.hypot(dx,dz);
 const angle=Math.atan2(dz,dx);
 const sweep=s.turns*TAU;
 const travelled=positiveAngle((s.clockwise?-1:1)*(angle-s.startAngle));
 const onTreads=radius>=s.innerRadius&&radius<=s.outerRadius&&travelled<=sweep+.015;
 return {onTreads,progress:Math.max(0,Math.min(1,travelled/sweep)),radius,angle};
}
