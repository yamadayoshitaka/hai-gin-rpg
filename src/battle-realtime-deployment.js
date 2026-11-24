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
 return slots.length===members.length?rearCommanderSlots(slots,team):null;
}

/**
 * Deploy an entire command team without changing its job/division formation.
 * Plan against a shadow occupancy map; a failed cell never leaves half a team
 * relocated. The original actor objects are not mutated by this function.
 */
export function planSkirmishGroupDeployment(actors,{
 squadIds=[],formationCells={},team=0,x,z,width=232,height=232,
 passable=()=>true,homeRiverX=()=>width/2
}={}){
 const ids=[...new Set(squadIds.map(String))].filter(id=>actors.some(
  u=>u.team===team&&String(u.squadId)===id&&u.hp>0&&u.alive!==false&&!u.defeated));
 if(!ids.length||!Number.isInteger(x)||!Number.isInteger(z))return null;
 const cells=ids.map((id,i)=>{
  const value=Number(formationCells[id]);
  return Number.isInteger(value)&&value>=0&&value<16?value:4+i;
 });
 const cols=cells.map(c=>c%4),rows=cells.map(c=>Math.floor(c/4));
 const centerCol=(Math.min(...cols)+Math.max(...cols))/2;
 const centerRow=(Math.min(...rows)+Math.max(...rows))/2;
 // All participating divisions are moving in the same atomic operation.
 // Their former cells must not block another division's target position.
 const movingIds=new Set(ids);
 const shadow=actors.map(actor=>({...actor,cell:
  actor.team===team&&movingIds.has(String(actor.squadId))?null:
   actor.cell?{...actor.cell}:null}));
 const original=new Map(shadow.map((actor,i)=>[actor,actors[i]]));
 const planned=[],duplicateCells=new Map();
 for(let i=0;i<ids.length;i++){
  const cell=cells[i],n=duplicateCells.get(cell)||0;
  duplicateCells.set(cell,n+1);
  // Partitions of a single job stay adjacent to their formation cell.
  const offsetX=(cols[i]-centerCol)*7+(n%2===0?0:3);
  const offsetZ=(rows[i]-centerRow)*7+Math.floor(n/2)*3;
  const candidates=[[offsetX,offsetZ],[offsetX-4,offsetZ],[offsetX+4,offsetZ],
   [offsetX,offsetZ-4],[offsetX,offsetZ+4],[0,0]];
  let cellsForSquad=null;
  for(const [dx,dz] of candidates){
   cellsForSquad=planSkirmishDeployment(shadow,{
    squadId:ids[i],team,x:Math.round(x+dx),z:Math.round(z+dz),
    width,height,passable,homeRiverX
   });
   if(cellsForSquad)break;
  }
  if(!cellsForSquad)return null;
  for(const slot of cellsForSquad){
   slot.actor.cell={x:slot.x,z:slot.z};
   planned.push({actor:original.get(slot.actor),x:slot.x,z:slot.z});
  }
 }
 return rearCommanderSlots(planned,team);
}

// Reassign already legal reserved cells atomically: no overlap or wall clipping.
export function rearCommanderSlots(slots,team=0){
 const sign=team===0?1:-1;
 const commanders=slots.filter(s=>s.actor.isStrategist||s.actor.isPlayerHero);
 for(const commander of commanders){
  const rear=slots.filter(s=>!s.actor.isStrategist&&!s.actor.isPlayerHero&&
   (commander.x-s.x)*sign>0).sort((a,b)=>(a.x-b.x)*sign||Math.abs(a.z-commander.z)-Math.abs(b.z-commander.z))[0];
  if(rear){const actor=commander.actor;commander.actor=rear.actor;rear.actor=actor;}
 }
 return slots;
}
