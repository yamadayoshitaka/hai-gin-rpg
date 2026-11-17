/**
 * Current-contact camera arbitration. Grid-local, O(units + nearby contacts)
 * and independent of THREE / DOM / worker implementation.
 * Camera changes are rate limited by the caller to avoid cutting every frame.
 */
const alive=u=>u&&u.alive!==false&&!u.defeated&&Number(u.hp)>0&&!u.isStrategist;
const coord=(u,axis,mass)=>{
 const v=mass?u?.[axis]:u?.cell?.[axis]??u?.root?.position?.[axis]??u?.[axis];
 return Number.isFinite(v)?v:null;
};
export function selectActiveBattleEngagement(units,{mass=false,range=mass?7:12,preferSquadId=null}={}){
 if(!Array.isArray(units)||!units.length)return null;
 const binSize=range,cell=(x,z)=>Math.floor(x/binSize)+':'+Math.floor(z/binSize);
 const hostiles=new Map(),candidates=[];
 for(const unit of units){
  if(!alive(unit))continue;
  const x=coord(unit,'x',mass),z=coord(unit,'z',mass);
  if(x==null||z==null)continue;
  if(unit.team===1){
   const key=cell(x,z);if(!hostiles.has(key))hostiles.set(key,[]);
   hostiles.get(key).push({unit,x,z});
  }else if(unit.team===0)candidates.push({unit,x,z});
 }
 const groups=new Map(),rangeSq=range*range;
 for(const person of candidates){
  const gx=Math.floor(person.x/binSize),gz=Math.floor(person.z/binSize);
  let nearestSq=rangeSq,nearest=null;
  for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){
   const others=hostiles.get((gx+dx)+':'+(gz+dz));
   if(!others)continue;
   for(const enemy of others){
    const d=(person.x-enemy.x)**2+(person.z-enemy.z)**2;
    if(d<nearestSq){nearestSq=d;nearest=enemy.unit;}
   }
  }
  if(!nearest)continue;
  const squadId=String(person.unit.squadId??'');
  const weight=1+(1-nearestSq/rangeSq);
  const row=groups.get(squadId)||{squadId,contacts:0,score:0,unitId:null,enemySquadId:null,bestDistance:Infinity};
  row.contacts++;row.score+=weight;
  if(nearestSq<row.bestDistance){
   row.bestDistance=nearestSq;row.unitId=person.unit.id;row.enemySquadId=String(nearest.squadId??'');
  }
  groups.set(squadId,row);
 }
 let selected=null;
 for(const row of groups.values()){
  const score=row.score*(preferSquadId!=null&&String(preferSquadId)===row.squadId?1.18:1);
  if(!selected||score>selected.weightedScore)
   selected={...row,weightedScore:score,distance:Math.sqrt(row.bestDistance)};
 }
 return selected;
}
