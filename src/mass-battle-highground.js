/**
 * Shared building BOM -> bounded 3D high-ground routes for large battles.
 * Worker receives only serializable world-space waypoints. It never reads
 * Three.js meshes, raycasts per soldier, or reconstructs staircase geometry.
 */
import {
  buildFloorTravelRoute,buildRoofTravelRoute,buildingWindowFiringPositions,
  floorTravelEntryPoint,roofAccessPlan,targetVisibleFromWindow
} from './building-floor-navigation.js';

export {targetVisibleFromWindow};

export function createMassHighGroundRoutes(buildings,{
  cellSize=2.2,offset=6,passable,terrainY,maxBuildings=26
}={}){
  if(!(passable instanceof Uint8Array)||!Number.isFinite(cellSize)||cellSize<=0)
    throw Error('High-ground routes need the battle collision grid');
  const size=Math.round(Math.sqrt(passable.length)),routes=[];
  if(size*size!==passable.length)throw Error('Invalid high-ground grid');
  const toCell=p=>({x:Math.round(p.x/cellSize+offset),z:Math.round(p.z/cellSize+offset)});
  const clear=(x,z)=>x>=0&&z>=0&&x<size&&z<size&&passable[z*size+x]===1;
  const accessCell=(entry)=>{
    let closest=null,dist=Infinity;
    for(let radius=0;radius<=6;radius++)for(let dz=-radius;dz<=radius;dz++)
      for(let dx=-radius;dx<=radius;dx++){
        const x=entry.x+dx,z=entry.z+dz;
        if(!clear(x,z))continue;
        const d=dx*dx+dz*dz;
        if(d<dist){closest={x,z};dist=d;}
      }
    return closest;
  };
  for(const [index,b] of buildings.entries()){
    if(routes.length>=maxBuildings*2)break;
    if(!b?.structure?.stair||b.structure.floors?.length<2)continue;
    const entry=accessCell(floorTravelEntryPoint(b));
    if(!entry)continue;
    const pos=b.model?.position;
    if(!pos)continue;
    let steps;
    try{steps=buildFloorTravelRoute(b.structure,pos,1,2);}
    catch{continue;}
    const windows=buildingWindowFiringPositions(b.structure,pos,2,{cellSize});
    if(!windows.length)continue;
    // Choose the outer wall facing the opposing army; the real aperture is
    // the authoritative source for future shots, not an invisible wall hack.
    const team=entry.x<size/2?0:1;
    const preferredX=team===0?1:-1;
    windows.sort((a,b)=>
      (b.normal.x*preferredX-a.normal.x*preferredX)*100+
      Math.hypot(steps.at(-1).x-a.x,steps.at(-1).z-a.z)-
      Math.hypot(steps.at(-1).x-b.x,steps.at(-1).z-b.z));
    const bay=windows[0];
    const access={x:entry.x,z:entry.z};
    const ground={x:(entry.x-offset)*cellSize,z:(entry.z-offset)*cellSize};
    ground.y=terrainY?.(ground.x,ground.z)??pos.y;
    const basePoints=[ground,...steps];
    const windowPoint={x:bay.x,y:bay.y,z:bay.z};
    const toGridWindow=(w)=>({
      aperture:{x:w.aperture.x/cellSize+offset,z:w.aperture.z/cellSize+offset},
      normal:w.normal,inset:w.inset/cellSize,halfWidth:w.halfWidth/cellSize
    });
    const base={id:'battle-highground-'+index,buildingIndex:index,
      team,access,doorPosition:floorTravelEntryPoint(b),kind:'window',level:2,
      points:[...basePoints,windowPoint],window:toGridWindow(bay)};
    routes.push(base);
    if(routes.length>=maxBuildings*2)break;
    const roof=roofAccessPlan(b.structure,{cellSize});
    if(!roof)continue;
    try{
      const roofPoints=basePoints.slice();
      for(let level=2;level<b.structure.floors.length;level++)
        roofPoints.push(...buildFloorTravelRoute(b.structure,pos,level,level+1));
      roofPoints.push(...buildRoofTravelRoute(b.structure,pos,b.structure.floors.length));
      const end=roofPoints.at(-1);
      routes.push({...base,id:base.id+'-roof',kind:'roof',
        level:b.structure.floors.length+1,points:roofPoints,
        window:{aperture:{x:end.x/cellSize+offset,z:end.z/cellSize+offset},
          normal:{x:preferredX,z:0},inset:.2,halfWidth:20}});
    }catch{/* no physically authored roof route: keep the second-floor window */}
    if(routes.filter(r=>r.kind==='window').length>=maxBuildings)break;
  }
  return routes;
}

export function massHighGroundWorldPoint(route,step=0,t=0){
  const points=route?.points;
  if(!points?.length)return null;
  const a=points[Math.max(0,Math.min(points.length-1,Math.floor(step)))];
  const b=points[Math.min(points.length-1,Math.floor(step)+1)];
  const alpha=Math.max(0,Math.min(1,t));
  return {x:a.x+(b.x-a.x)*alpha,y:a.y+(b.y-a.y)*alpha,z:a.z+(b.z-a.z)*alpha,
    yaw:Math.atan2(b.x-a.x,b.z-a.z)};
}

export function advanceMassHighGroundRoute(route,step=0,t=0,distance=0){
  const points=route?.points;
  if(!points?.length)return {step:0,t:0,done:true};
  const last=points.length-1;
  let remaining=Math.max(0,distance),i=Math.max(0,Math.min(last,Math.floor(step))),
    progress=Math.max(0,Math.min(1,t)),guard=0;
  while(i<last&&remaining>0&&guard++<points.length+1){
    const a=points[i],b=points[i+1];
    const length=Math.hypot(b.x-a.x,b.y-a.y,b.z-a.z);
    if(length<1e-5){i++;progress=0;continue;}
    const left=length*(1-progress);
    if(remaining<left){progress+=remaining/length;remaining=0;break;}
    remaining-=left;i++;progress=0;
  }
  return {step:i,t:progress,done:i>=last};
}
