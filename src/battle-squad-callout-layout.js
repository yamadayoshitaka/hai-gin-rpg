/**
 * Two-sided, Excel-style squad callout layout.
 * Allied bubbles are aligned on the left, enemy bubbles on the right;
 * each leader line continues to the troop centroid. Fallen squads occupy
 * the end of their own column. This file is pure logic (no DOM/Three.js).
 */
export function layoutSquadCallouts(points,bounds,previous=new Map()){
 const left=Number(bounds.left)||0,top=Number(bounds.top)||0;
 const right=Number(bounds.right)||0,bottom=Number(bounds.bottom)||0;
 const width=right-left,height=bottom-top;
 const empty={diameter:0,placements:new Map(),lanesPerTeam:0};
 if(!points?.length||width<80||height<40)return empty;
 const gap=5,outer=5,preferred=width<=480?64:76,idealMinimum=52;
 const groups=[points.filter(p=>p.team===0),points.filter(p=>p.team!==0)];
 const maxCount=Math.max(...groups.map(g=>g.length));
 const maxLanes=width<350?2:width<700?2:3;
 let best=null;
 for(let lanes=1;lanes<=maxLanes;lanes++){
  const rows=Math.ceil(maxCount/lanes);
  const diameter=Math.min(preferred,
   Math.floor((height-2*outer-gap*(rows-1))/Math.max(1,rows)),
   Math.floor((width/2-2*outer-gap*(lanes-1))/lanes));
  const candidate={lanes,rows,diameter};
  if(!best||diameter>best.diameter)best=candidate;
  if(diameter>=idealMinimum){best=candidate;break;}
 }
 const {lanes,diameter}=best;
 if(diameter<10)return empty;
 const placements=new Map();
 const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
 const compare=(a,b)=>Number(Boolean(a.defeated))-Number(Boolean(b.defeated))||
  Number(a.squadIndex??0)-Number(b.squadIndex??0)||
  String(a.key).localeCompare(String(b.key));
 for(let team=0;team<2;team++){
  const group=[...groups[team]].sort(compare);
  const rows=Math.ceil(group.length/lanes);
  const stepY=rows>1?(height-2*outer-diameter)/(rows-1):0;
  const slotStepX=diameter+gap;
  for(let i=0;i<group.length;i++){
   const p=group[i],row=Math.floor(i/lanes),lane=i%lanes;
   // Each squad belongs to its own army's screen edge, not the battlefield middle.
   const x=team===0?left+outer+diameter/2+lane*slotStepX:
    right-outer-diameter/2-lane*slotStepX;
   const y=top+outer+diameter/2+row*stepY;
   const anchorX=clamp(Number(p.x)||0,left,right),anchorY=clamp(Number(p.y)||0,top,bottom);
   placements.set(p.key,{x,y,anchorX,anchorY,team,defeated:Boolean(p.defeated),
    diameter,outside:p.x!==anchorX||p.y!==anchorY});
  }
 }
 return {diameter,placements,lanesPerTeam:lanes};
}

/** Route a bent line from the circle boundary to its squad's actual position. */
export function squadCalloutLeader({x,y,anchorX,anchorY,diameter}){
 const dx=anchorX-x,dy=anchorY-y,dist=Math.hypot(dx,dy);
 if(dist<diameter*.48)return '';
 const radius=diameter/2+1,fromX=x+dx/dist*radius,fromY=y+dy/dist*radius;
 const elbowX=Math.abs(dx)>Math.abs(dy)?anchorX:fromX;
 const elbowY=Math.abs(dx)>Math.abs(dy)?fromY:anchorY;
 const rounded=v=>Math.round(v*10)/10;
 return 'M '+rounded(fromX)+' '+rounded(fromY)+
  ' L '+rounded(elbowX)+' '+rounded(elbowY)+
  ' L '+rounded(anchorX)+' '+rounded(anchorY);
}
