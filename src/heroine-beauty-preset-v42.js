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


/**
 * v43 heroine art-direction update. This only changes the female protagonist
 * studio, not neutral male presets or the archived v8 GLB source.
 * Larger patterned irises remain INSIDE the fitted eyelid opening.
 */
export const HEROINE_BEAUTY_PART_SELECTION_V43=Object.freeze({
 face:8,eye:9,nose:6,mouth:1,makeup:1,hair:7
});
export function heroineBeautyControlsV43(base={}){
 return {
  ...heroineBeautyControlsV42(base),
  faceMorph:.39,jawSharpness:4.22,
  eyeWidth:1.26,eyeHeight:1.22,irisDiameter:1.34,eyeDepth:-.18,
  lashCurl:1.15,lashLength:1.62,lashDensity:1.13,
  lipstickX:0,lipstickY:0,lipstickWidth:.97,lipstickHeight:.89,
  mouthSmile:.15
 };
}
/**
 * Auto-migrate ONLY the exact unedited v42 beauty preset. If a user has
 * changed their eye, cheek or makeup values, do not overwrite their work.
 */
export function upgradeUneditedHeroineV42ToV43(saved){
 if(!saved||typeof saved!=='object')return null;
 const old=heroineBeautyControlsV42();
 const fields=['faceMorph','jawSharpness','eyeWidth','eyeHeight','irisDiameter',
  'eyeDepth','lashCurl','lashLength','lipstickWidth','lipstickHeight'];
 if(!fields.every(key=>Math.abs(Number(saved[key])-old[key])<.0001))return null;
 return {...saved,...heroineBeautyControlsV43()};
}
