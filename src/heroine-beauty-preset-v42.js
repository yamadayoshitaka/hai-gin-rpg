/**
 * v42 feminine hero art-direction preset; never mutate imported Library GLB.
 * Only applied as an initial fallback when the user has not saved a preset.
 */
export const HEROINE_BEAUTY_PART_SELECTION_V42=Object.freeze({
 face:8,eye:9,nose:6,mouth:1,makeup:1,hair:7
});
export function heroineBeautyControlsV42(base={}){
 return {
  ...base,
  // Restore soft lower cheek volume without moving the face silhouette.
  faceMorph:.30,jawSharpness:4.55,
  // Defined lids, high iris coverage and slight corneal recession.
  eyeWidth:1.21,eyeHeight:1.16,irisDiameter:1.24,eyeDepth:-.12,
  lashCurl:.98,lashLength:1.48,
  // Anatomical lips with a subtle vermilion area rather than a decal.
  lipstickX:0,lipstickY:0,lipstickWidth:1.02,
  lipstickHeight:.93,mouthSmile:.13
 };
}
