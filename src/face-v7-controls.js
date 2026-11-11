/**
 * Female face v7 adjustable sculpt controls.
 *
 * Defaults represent the user-requested stronger chin, refined nose,
 * larger iris, raised nasal tip / less visible nostril rim.
 * The male master remains unchanged.
 */
export const FEMALE_V7_DEFAULTS=Object.freeze({
 irisDiameter:2,
 jawSharpness:2,
 noseTipLift:1,
 nostrilCover:1,
 noseBridgeSharpness:1.4,
 browAngle:6,
 lashAngle:7
});
export const FACE_V7_PALETTE=Object.freeze({
 skin:0xebc5b7,
 eyelid:0xebc5b7,
 lips:0xc07c82,
 sclera:0xf3f0ea,
 iris:0x514139,
 pupil:0x17151a,
 brow:0x594638,
 lashes:0x292126
});
const ranges=Object.freeze({
 irisDiameter:[1,2],jawSharpness:[.7,2.5],
 noseTipLift:[0,2],nostrilCover:[0,2],
 noseBridgeSharpness:[0,2.5],
 browAngle:[-25,25],lashAngle:[-25,25]
});
export function normalizeFemaleFaceControls(settings={}){
 const out={};
 for(const [k,v] of Object.entries(FEMALE_V7_DEFAULTS)){
  const raw=Number(settings?.[k]);
  out[k]=Number.isFinite(raw)?Math.max(ranges[k][0],Math.min(ranges[k][1],raw)):v;
 }
 return out;
}
