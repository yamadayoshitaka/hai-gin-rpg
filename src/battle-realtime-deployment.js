/**
 * Prebattle-only formation planner for 50v50 (the non-Worker skirmish mode).
 * Returns a complete plan, never a partially relocated army.
 */
export function planSkirmishDeployment(actors,{
 squadId,team=0,x,z,width=232,height=232,
 passable=()=>true,homeRiverX=()=>width/2
}={}){
 if(!Array.isArray(actors)||!Number.isInteger(x)||!Number.isInteger(z)||
    x<0||z<0||x>=width||z>=height||![0,1].includes(team))return null;
 const side=team===0?-1:1;
 if((x-homeRiverX(z))*side<9)return null;
 const members=actors.filter(u=>u.team===team&&String(u.squadId)===String(squadId)&&
   u.hp>0&&u.alive!==false&&!u.defeated);
 if(!members.length)return null;
 const moving=new Set(members);
 const occupied=new Set(actors.filter(u=>u.cell&&!moving.has(u)&&u.hp>0&&
    u.alive!==false&&!u.defeated).map(u=>u.cell.z*width+u.cell.x));
 const slots=[];
 const maxRadius=Math.max(22,Math.ceil(Math.sqrt(members.length))*3);
 for(let radius=0;radius<=maxRadius&&slots.length<members.length;radius++){
  for(let dz=-radius;dz<=radius&&slots.length<members.length;dz++)
   for(let dx=-radius;dx<=radius&&slots.length<members.length;dx++){
    if(Math.max(Math.abs(dx),Math.abs(dz))!==radius)continue;
    const cx=x+dx,cz=z+dz;
    if(cx<0||cz<0||cx>=width||cz>=height||
      (cx-homeRiverX(cz))*side<9||occupied.has(cz*width+cx)||
      !passable(cx,cz))continue;
    occupied.add(cz*width+cx);
    slots.push({actor:members[slots.length],x:cx,z:cz});
   }
 }
 return slots.length===members.length?slots:null;
}
