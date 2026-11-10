/**
 * Screen-space Excel-style leader-line callouts for the strategic overhead view.
 * One stable slot per squad; no squad is hidden merely because two units share
 * the same map coordinate. The layout is independent of Three.js / DOM.
 */
export function layoutSquadCallouts(points, bounds, previous = new Map()) {
  const left=Number(bounds.left)||0,top=Number(bounds.top)||0;
  const right=Number(bounds.right)||0,bottom=Number(bounds.bottom)||0;
  const width=Math.max(0,right-left),height=Math.max(0,bottom-top);
  if(!points.length||width<38||height<38)return {diameter:0,placements:new Map()};
  const gap=5,minimum=width<=480?36:42,maximum=width<=480?64:width<=800?72:84;
  let diameter=Math.min(maximum,Math.max(minimum,Math.min(width,height)));
  const capacity=size=>Math.floor((width+gap)/(size+gap))*Math.floor((height+gap)/(size+gap));
  while(diameter>minimum&&capacity(diameter)<points.length)diameter-=2;
  diameter=Math.max(minimum,diameter);
  const cols=Math.max(1,Math.floor((width+gap)/(diameter+gap)));
  const rows=Math.max(1,Math.floor((height+gap)/(diameter+gap)));
  const slots=[];
  for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
    slots.push({x:left+diameter/2+col*(diameter+gap),
      y:top+diameter/2+row*(diameter+gap)});
  }
  const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
  const middle=left+width/2,free=new Set(slots.map((_,i)=>i));
  const placements=new Map();
  const ordered=[...points].sort((a,b)=>(b.priority||0)-(a.priority||0)||
    (a.team||0)-(b.team||0)||String(a.key).localeCompare(String(b.key)));
  for(const point of ordered){
    const anchorX=clamp(Number(point.x)||0,left,right);
    const anchorY=clamp(Number(point.y)||0,top,bottom);
    const earlier=previous.get(point.key);
    let best=-1,bestScore=Infinity;
    for(const index of free){
      const spot=slots[index],distance=Math.hypot(spot.x-anchorX,spot.y-anchorY);
      // A callout normally sits beside its target, not directly over the unit.
      const coverPenalty=Math.max(0,diameter*.83-distance)*1.2;
      // Blue labels prefer west, red east; a congested side can still spill.
      const sidePenalty=point.team===0?Math.max(0,spot.x-middle)*.6:
        Math.max(0,middle-spot.x)*.6;
      const stability=earlier?Math.hypot(spot.x-earlier.x,spot.y-earlier.y)*.40:0;
      const score=distance+coverPenalty+sidePenalty+stability;
      if(score<bestScore){best=index;bestScore=score}
    }
    if(best===-1)continue; // Impossible to fit physically at minimum diameter.
    free.delete(best);
    placements.set(point.key,{...slots[best],anchorX,anchorY,
      outside:Number(point.x)!==anchorX||Number(point.y)!==anchorY,
      diameter});
  }
  return {diameter,placements};
}

/** Attach a bent connector to the bubble edge rather than under its text. */
export function squadCalloutLeader({x,y,anchorX,anchorY,diameter}) {
  const dx=anchorX-x,dy=anchorY-y,dist=Math.hypot(dx,dy);
  if(dist<diameter*.48)return '';
  const radius=diameter/2+1,fromX=x+dx/dist*radius,fromY=y+dy/dist*radius;
  const elbowX=Math.abs(dx)>Math.abs(dy)?anchorX:fromX;
  const elbowY=Math.abs(dx)>Math.abs(dy)?fromY:anchorY;
  const rounded=value=>Math.round(value*10)/10;
  return 'M '+rounded(fromX)+' '+rounded(fromY)+
    ' L '+rounded(elbowX)+' '+rounded(elbowY)+
    ' L '+rounded(anchorX)+' '+rounded(anchorY);
}
