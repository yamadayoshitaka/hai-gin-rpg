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

// Exterior shells are opaque at strategic zoom. Even if the focus sits
// inside a house or soldiers are traversing its stairs, only a close camera
// may reveal interior floors. Hysteresis avoids flicker around the cutoff.
export function shouldRevealBuildingInterior({cameraDistance,near=false,occupied=false,
 selectedInside=false,occluded=false,wasCutaway=false}, {enterAt=34,exitAt=40}={}){
  return Number.isFinite(cameraDistance)&&cameraDistance<(wasCutaway?exitAt:enterAt)&&
    (near||occupied||selectedInside||occluded);
}
