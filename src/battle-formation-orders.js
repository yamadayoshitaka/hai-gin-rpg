/** Battle-time validation and repositioning of inn-authored job cells. */
const tierRank={N:0,R:1,SR:2,SSR:3,UR:4};

export function battleFormationEligibility(option,units=[]){
 if(!option?.eligible||!Array.isArray(option.assignment)||!option.assignment.length)
  return {eligible:false,reason:option?.reason||'この隊の職業構成では使用できません'};
 const live=units.filter(u=>u&&u.hp>0&&u.alive!==false&&u.defeated!==true&&!u.isStrategist);
 const sources=new Map(),rare=[0,0,0,0,0];
 for(const unit of live){
  const id=String(unit.sourceSquadId),tier=tierRank[unit.rarity]??0;
  sources.set(id,(sources.get(id)||0)+1);
  rare[tier]++;
 }
 const r=option.requirements||{};
 if(live.length<(r.people||0))return {eligible:false,reason:'生存兵士が'+r.people+'人未満'};
 const atLeast=threshold=>rare.reduce((n,count,index)=>n+(index>=threshold?count:0),0);
 for(const [threshold,key,label] of [[1,'rPlus','R以上'],[2,'srPlus','SR以上'],
  [3,'ssrPlus','SSR以上'],[4,'ur','UR']]){
  if(atLeast(threshold)<(r[key]||0))
   return {eligible:false,reason:label+'の生存兵士が不足'};
 }
 for(const sid of option.assignment){
  if((sources.get(String(sid))||0)<(option.roleMinimums?.[String(sid)]||1))
   return {eligible:false,reason:'必要な役割の生存兵士が不足'};
 }
 return {eligible:true,reason:'陣形変更可能'};
}

/**
 * Map a complete team's division leaders to new 4x4 cells. Returns traversable
 * world targets; troops travel with their existing pathfinder, never teleport.
 */
export function battleFormationRegroupTargets(squads,center,passable=()=>true){
 if(!Array.isArray(squads)||!squads.length||!Number.isFinite(center?.x)||!Number.isFinite(center?.z))
  return [];
 const entries=squads.filter(s=>Number.isInteger(s.cell)&&s.cell>=0&&s.cell<16);
 if(!entries.length)return [];
 const centerRow=entries.reduce((n,s)=>n+Math.floor(s.cell/4),0)/entries.length;
 const centerCol=entries.reduce((n,s)=>n+s.cell%4,0)/entries.length;
 const occupied=new Set(),perCell=new Map();
 const results=[];
 for(const entry of entries){
  const repeat=perCell.get(entry.cell)||0;perCell.set(entry.cell,repeat+1);
  const x=Math.round(center.x+(centerRow-Math.floor(entry.cell/4))*5);
  const z=Math.round(center.z+(entry.cell%4-centerCol)*7+(repeat%2?3:0));
  let spot=null;
  for(const [dx,dz] of [[0,0],[0,1],[0,-1],[1,0],[-1,0],[0,2],[0,-2],[2,0],[-2,0]]){
   const nx=x+dx,nz=z+dz,key=nx+':'+nz;
   if(!occupied.has(key)&&passable(nx,nz)){spot={x:nx,z:nz};occupied.add(key);break;}
  }
  if(spot)results.push({squadId:String(entry.squadId),cell:entry.cell,...spot});
 }
 return results;
}
