// Screen-space LOD. The battle simulation, collision and full-size models are
// unaffected: only distant characters below a few dozen display pixels use a
// texture captured from the actual dressed, animated seven-head human.
// A 192px portrait captured directly from the fully dressed live character
// is visually stable up to ~52 display pixels. Keep an eight+ pixel hysteresis
// so camera movement cannot flicker between the full geometry and atlas.
export const CROWD_IMPOSTOR_ENTER_PX = 52;
export const CROWD_IMPOSTOR_EXIT_PX = 64;

export function crowdProjectedHeight(heightMeters,viewportCssHeight,fovDegrees,distanceMeters){
  if(!(heightMeters>0&&viewportCssHeight>0&&fovDegrees>0&&distanceMeters>0))return Infinity;
  return heightMeters*viewportCssHeight/(2*distanceMeters*Math.tan(fovDegrees*Math.PI/360));
}

export function useCrowdImpostor(projectedHeightPixels,wasImpostor=false){
  return projectedHeightPixels<(wasImpostor?CROWD_IMPOSTOR_EXIT_PX:CROWD_IMPOSTOR_ENTER_PX);
}

// Frames are captured from +Z, +X, -Z, -X respectively. Relative heading,
// rather than world heading, keeps the baked face/hair/armour oriented correctly
// while a camera orbit or an individual soldier changes direction.
export function crowdCardinalView(facingX,facingZ,cameraDx,cameraDz){
  const facing=Math.atan2(facingX,facingZ);
  const cameraAngle=Math.atan2(cameraDx,cameraDz);
  return (Math.round((cameraAngle-facing)*2/Math.PI)%4+4)%4;
}
