/**
 * Shared building BOM -> bounded 3D high-ground routes for large battles.
 * Worker receives only serializable world-space waypoints. It never reads
 * Three.js meshes, raycasts per soldier, or reconstructs staircase geometry.
 */
import {
  buildFloorTravelRoute,buildRoofTravelRoute,buildingWindowFiringPositions,
  floorTravelEntryPoint,stairGroundEntryPoint,roofAccessPlan,targetVisibleFromWindow
} from './building-floor-navigation.js';
import {MASS_GRID_DIRECTIONS,massDiagonalClear} from './mass-battle-directional-nav.js';

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
  // One shared ground route to the actual first tread. An exterior door,
  // wall, tree or furnishing cannot be crossed by a straight-line teleport.
  const groundPath=(from,to)=>{
    if(!to||!clear(to.x,to.z))return null;
    const start=from.z*size+from.x,goal=to.z*size+to.x;
    const previous=new Int32Array(size*size).fill(-1),queue=new Int32Array(size*size);
    let front=0,back=1;
    queue[0]=start;previous[start]=start;
    while(front<back&&back<6000){
      const i=queue[front++];if(i===goal)break;
      const x=i%size,z=Math.floor(i/size);
      for(const [dx,dz] of MASS_GRID_DIRECTIONS){
        const nx=x+dx,nz=z+dz;
        if(!clear(nx,nz)||!massDiagonalClear(x,z,dx,dz,size,passable))continue;
        const ni=nz*size+nx;
        if(previous[ni]!==-1)continue;
        previous[ni]=i;queue[back++]=ni;
      }
    }
    if(previous[goal]===-1)return null;
    const path=[];
    for(let i=goal;i!==start;i=previous[i])path.push({x:i%size,z:Math.floor(i/size)});
    path.push(from);return path.reverse();
  };
  // First-floor objectives are not stair/roof waypoints. They are ordinary
  // walkable GRID CELLS inside the building, reached through its real door,
  // with no overlapping soldiers or synthetic wall/prop traversal.
  const roomPath=(from,building)=>{
    const {x:cx,z:cz,w,d}=building.data??{};
    if(![cx,cz,w,d].every(Number.isFinite))return null;
    const minX=Math.ceil(cx-w/2+1),maxX=Math.floor(cx+w/2-1);
    const minZ=Math.ceil(cz-d/2+1),maxZ=Math.floor(cz+d/2-1);
    if(minX>maxX||minZ>maxZ)return null;
    const start=from.z*size+from.x,prev=new Int32Array(size*size).fill(-1);
    const queue=new Int32Array(size*size);let front=0,back=1;
    queue[0]=start;prev[start]=start;
    let best=-1,bestScore=Infinity;
    while(front<back&&back<7000){
      const index=queue[front++],x=index%size,z=Math.floor(index/size);
      if(x>=minX&&x<=maxX&&z>=minZ&&z<=maxZ){
        const score=Math.hypot(x-cx,z-cz)+.08*Math.hypot(x-from.x,z-from.z);
        if(score<bestScore){best=index;bestScore=score;}
        if(score<1)break;
      }
      for(const [dx,dz] of MASS_GRID_DIRECTIONS){
        const nx=x+dx,nz=z+dz;
        if(!clear(nx,nz)||!massDiagonalClear(x,z,dx,dz,size,passable))continue;
        const next=nz*size+nx;
        if(prev[next]!==-1)continue;
        prev[next]=index;queue[back++]=next;
      }
    }
    if(best<0)return null;
    const path=[];
    for(let i=best;i!==start;i=prev[i])path.push({x:i%size,z:Math.floor(i/size)});
    path.push(from);
    return path.reverse();
  };
  let scanned=0;
  for(const [index,b] of buildings.entries()){
    if(scanned>=maxBuildings)break;
    if(!b?.data||!b.model?.position)continue;
    scanned++;
    const entry=accessCell(floorTravelEntryPoint(b));
    if(!entry)continue;
    const pos=b.model.position;
    const team=entry.x<size/2?0:1;
    const indoorCells=roomPath(entry,b);
    if(indoorCells?.length>1){
      const goal=indoorCells.at(-1);
      routes.push({id:'battle-indoor-'+index,buildingIndex:index,
        structureId:'world-building-'+index,team,
        kind:'interior',level:1,access:goal,
        doorPosition:floorTravelEntryPoint(b),roomCell:goal,
        points:indoorCells.map(cell=>{
          const x=(cell.x-offset)*cellSize,z=(cell.z-offset)*cellSize;
          return {x,y:terrainY?.(x,z)??pos.y,z};
        })});
    }
    if(!b.structure?.stair||b.structure.floors?.length<2)continue;
    let steps;
    try{steps=buildFloorTravelRoute(b.structure,pos,1,2);}
    catch{continue;}
    const windows=buildingWindowFiringPositions(b.structure,pos,2,{cellSize});
    if(!windows.length)continue;
    // Choose the outer wall facing the opposing army; the real aperture is
    // the authoritative source for future shots, not an invisible wall hack.
    const preferredX=team===0?1:-1;
    windows.sort((a,b)=>
      (b.normal.x*preferredX-a.normal.x*preferredX)*100+
      Math.hypot(steps.at(-1).x-a.x,steps.at(-1).z-a.z)-
      Math.hypot(steps.at(-1).x-b.x,steps.at(-1).z-b.z));
    const bay=windows[0];
    const access={x:entry.x,z:entry.z};
    const ground={x:(entry.x-offset)*cellSize,z:(entry.z-offset)*cellSize};
    ground.y=terrainY?.(ground.x,ground.z)??pos.y;
    const stage=stairGroundEntryPoint(b.structure,pos,steps,{cellSize});
    const staged=stage?toCell(stage):null;
    const entryRoute=groundPath(access,staged);
    if(!entryRoute)continue; // no valid door-to-tread corridor
    const basePoints=[...entryRoute.map(cell=>{
      const x=(cell.x-offset)*cellSize,z=(cell.z-offset)*cellSize;
      return {x,y:terrainY?.(x,z)??pos.y,z};
    }),...steps];
    const windowPoint={x:bay.x,y:bay.y,z:bay.z};
    const toGridWindow=(w)=>({
      aperture:{x:w.aperture.x/cellSize+offset,z:w.aperture.z/cellSize+offset},
      normal:w.normal,inset:w.inset/cellSize,halfWidth:w.halfWidth/cellSize
    });
    const base={id:'battle-highground-'+index,buildingIndex:index,structureId:'world-building-'+index,
      team,access,doorPosition:floorTravelEntryPoint(b),kind:'window',level:2,
      points:[...basePoints,windowPoint],window:toGridWindow(bay)};
    routes.push(base);
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
