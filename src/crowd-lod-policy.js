// Screen-space LOD. The battle simulation, collision and full-size models are
// unaffected: only distant characters below a few dozen display pixels use a
// texture captured from the actual dressed, animated seven-head human.
// Use full geometry as soon as a soldier is large enough to inspect the
// face/armour. The atlas is reserved for genuinely distant tiny silhouettes.
// Keep a ten-pixel hysteresis so camera movement cannot flicker between
// full geometry and the real-rig atlas. The 1000v1000 pressure budget may
// extend the photographic tier to ~100 screen pixels while retaining 3D
// for close soldiers and using a 224px sampled source silhouette.
export const CROWD_IMPOSTOR_ENTER_PX = 36;
export const CROWD_IMPOSTOR_EXIT_PX = 46;

export function crowdProjectedHeight(heightMeters,viewportCssHeight,fovDegrees,distanceMeters){
  if(!(heightMeters>0&&viewportCssHeight>0&&fovDegrees>0&&distanceMeters>0))return Infinity;
  return heightMeters*viewportCssHeight/(2*distanceMeters*Math.tan(fovDegrees*Math.PI/360));
}

export function useCrowdImpostor(projectedHeightPixels,wasImpostor=false,enterPixels=CROWD_IMPOSTOR_ENTER_PX){
  // Under sustained GPU pressure the game may keep complete real-rig photo
  // atlases on slightly larger *distant* characters. A close-up always uses
  // the actual skin, hair and wardrobe geometry; never a primitive proxy.
  const enter=Math.max(CROWD_IMPOSTOR_ENTER_PX,Math.min(100,enterPixels));
  // At 100px the source photograph is still supersampled (224px tile).
  // Hysteresis never turns a zoomed-in, inspectable soldier into a card.
  return projectedHeightPixels<Math.min(110,wasImpostor?enter+10:enter);
}

// A photographed character has no depth: even a camera-facing card looks
// printed on the grass when the observer is almost directly overhead. At an
// inspectable size choose the real skinned body regardless of FPS adaptation.
// Truly tiny distant soldiers may keep the card to protect 1000v1000 FPS.
export function crowdRequires3DFromOverhead(projectedHeightPixels,verticalViewRatio,minimum3dPixels=28){
  // Only high-density 1000v1000 increases this cutoff. A normal 50v50
  // overhead inspection keeps the original geometry threshold.
  return verticalViewRatio>.6&&projectedHeightPixels>=minimum3dPixels;
}

// Frames are captured from +Z, +X, -Z, -X respectively. Relative heading,
// rather than world heading, keeps the baked face/hair/armour oriented correctly
// while a camera orbit or an individual soldier changes direction.
export function crowdCardinalView(facingX,facingZ,cameraDx,cameraDz){
  const facing=Math.atan2(facingX,facingZ);
  const cameraAngle=Math.atan2(cameraDx,cameraDz);
  return (Math.round((cameraAngle-facing)*2/Math.PI)%4+4)%4;
}
