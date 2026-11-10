// Cheap camera-to-focus obstruction queries. The boxes describe scene objects,
// not their individual triangles: thousands of trees remain GPU-instanced.
export function cameraSegmentHitsBox(camera,focus,box,padding=0){
  let enter=0,exit=1;
  for(const axis of ['x','y','z']){
    const start=camera[axis],delta=focus[axis]-start;
    const min=box['min'+axis.toUpperCase()]-padding;
    const max=box['max'+axis.toUpperCase()]+padding;
    if(Math.abs(delta)<1e-7){
      if(start<min||start>max)return null;
      continue;
    }
    const a=(min-start)/delta,b=(max-start)/delta;
    enter=Math.max(enter,Math.min(a,b));
    exit=Math.min(exit,Math.max(a,b));
    if(enter>exit)return null;
  }
  // Ignore objects beyond the focus and geometry that is entirely behind the eye.
  return exit>=0&&enter<.97?enter:null;
}

export function selectCameraOccluders(camera,focus,candidates,{limit=6,padding=.35}={}){
  const matches=[];
  for(const candidate of candidates){
    const at=cameraSegmentHitsBox(camera,focus,candidate.bounds,padding);
    if(at!==null)matches.push({candidate,at});
  }
  matches.sort((a,b)=>a.at-b.at);
  return matches.slice(0,limit).map(({candidate})=>candidate);
}

/** Tree cutaway around the EYE, even when no trunk intersects the focus ray.
 * Only camera-adjacent crowns are returned; unrelated garden objects stay.
 */
export function selectCanopiesAroundCamera(camera,candidates,{padding=2.5}={}){
 return (candidates||[]).filter(({bounds:b,tree})=>tree&&
  camera.x>=b.minX-padding&&camera.x<=b.maxX+padding&&
  camera.z>=b.minZ-padding&&camera.z<=b.maxZ+padding&&
  camera.y>=b.minY-1&&camera.y<=b.maxY+padding+.5);
}

// Exterior shells are opaque at strategic zoom. Even if the focus sits
// inside a house or soldiers are traversing its stairs, only a close camera
// may reveal interior floors. Hysteresis avoids flicker around the cutoff.
export function shouldRevealBuildingInterior({cameraDistance,near=false,occupied=false,
 selectedInside=false,occluded=false,wasCutaway=false}, {enterAt=34,exitAt=40}={}){
  return Number.isFinite(cameraDistance)&&cameraDistance<(wasCutaway?exitAt:enterAt)&&
    (near||occupied||selectedInside||occluded);
}

// The camera may focus on a squad or a waypoint with NO individually selected
// actor. Selection-less close-ups must never dereference selected.indoorFloor.
export function safeSelectedInteriorFloor({selectedInside=false,selected=null,cameraFloor=1}={}){
  if(!selectedInside||!selected||selected.defeated)return cameraFloor;
  return Number.isInteger(selected.indoorFloor)&&selected.indoorFloor>0
    ?selected.indoorFloor:cameraFloor;
}

/**
 * Choose an eye position that actually looks at the specified combatant.
 * Penalize trees touching the eye or intersecting the sightline. Call this
 * only on cinematic transitions, never once per render frame.
 */
export function chooseClearBattleCameraOffset(focus,trees,{terrainHeight=()=>-Infinity}={}){
 const options=[
  {x:4.8,y:7.6,z:11.5},{x:-4.8,y:7.6,z:11.5},
  {x:11.5,y:7.6,z:4.8},{x:-11.5,y:7.6,z:-4.8},
  {x:4.8,y:8.6,z:-11.5},{x:-4.8,y:8.6,z:-11.5},
  {x:11.5,y:8.6,z:-4.8},{x:-11.5,y:8.6,z:4.8},
  {x:0.1,y:12,z:12},{x:12,y:12,z:0.1},
  {x:0.1,y:12,z:-12},{x:-12,y:12,z:0.1}
 ];
 let best=options[0],bestScore=Infinity;
 for(const offset of options){
  const eye={x:focus.x+offset.x,y:focus.y+offset.y,z:focus.z+offset.z};
  let penalty=0;
  const ground=terrainHeight(eye.x,eye.z);
  if(Number.isFinite(ground)&&eye.y<ground+3)penalty+=500;
  for(const tree of trees||[]){
   if(!tree?.bounds)continue;
   const box=tree.bounds;
   const inside=eye.x>=box.minX-1&&eye.x<=box.maxX+1&&
     eye.z>=box.minZ-1&&eye.z<=box.maxZ+1&&
     eye.y>=box.minY-1&&eye.y<=box.maxY+2;
   if(inside)penalty+=150;
   if(cameraSegmentHitsBox(eye,focus,box,.3)!==null)penalty+=30;
  }
  // Slight preference for the shorter, lower cinematic angle if equally clear.
  penalty+=Math.abs(offset.y-7.6)*.08;
  if(penalty<bestScore){bestScore=penalty;best=offset;}
 }
 return {...best};
}
