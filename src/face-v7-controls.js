/**
 * Female face v7 adjustable sculpt controls.
 *
 * Defaults represent the user-requested stronger chin, refined nose,
 * larger iris, raised nasal tip / less visible nostril rim.
 * The male master remains unchanged.
 */
export const FEMALE_V7_DEFAULTS=Object.freeze({
 irisDiameter:1,
 jawSharpness:2.5,
 noseTipLift:0,
 nostrilCover:1,
 noseBridgeSharpness:2.5,
 browAngle:6,
 lashAngle:7,
 eyeAngle:0,
 eyeSize:1,
 lipstickX:0,
 lipstickY:0,
 lipstickWidth:1,
 lipstickHeight:1
});
export const FACE_V7_PALETTE=Object.freeze({
 skin:0xebc5b7,
 eyelid:0xebc5b7,
 lips:0xc07c82,
 sclera:0xf3f0ea,
 iris:0x514139,
 pupil:0x17151a,
 underEye:0xb99085,
 lipstick:0xc07c82,
 brow:0x594638,
 lashes:0x292126
});
const ranges=Object.freeze({
 irisDiameter:[1,2],jawSharpness:[.7,2.5],
 noseTipLift:[0,2],nostrilCover:[0,2],
 noseBridgeSharpness:[0,2.5],
 browAngle:[-25,25],lashAngle:[-25,25],
 eyeAngle:[-20,20],eyeSize:[.75,1.4],
 lipstickX:[-.12,.12],lipstickY:[-.12,.12],
 lipstickWidth:[.5,1.8],lipstickHeight:[.5,1.8]
});
export function normalizeFemaleFaceControls(settings={}){
 const out={};
 for(const [k,v] of Object.entries(FEMALE_V7_DEFAULTS)){
  const raw=Number(settings?.[k]);
  out[k]=Number.isFinite(raw)?Math.max(ranges[k][0],Math.min(ranges[k][1],raw)):v;
 }
 return out;
}

/** A selectable cosmetic colored-contact palette. The default is natural brown. */
export const CONTACT_COLORS=Object.freeze({
 brown:'#514139',blue:'#467fa7',green:'#5c886b',
 hazel:'#927953',gray:'#7e858d',violet:'#8b74a8'
});
export function safeContactColor(value){
 const input=String(value??CONTACT_COLORS.brown).trim().toLowerCase();
 return /^#[0-9a-f]{6}$/.test(input)?input:CONTACT_COLORS.brown;
}
/** Persisted reference presets do not require browser storage. */
export const FEMALE_REFERENCE_DEFAULT=FEMALE_V7_DEFAULTS;
export const MALE_REFERENCE_DEFAULT=Object.freeze({
 eyeSize:.9,irisDiameter:1,eyeAngle:0,
 cosmetics:false,sharedHeadSource:'realistic-head-animation.glb'
});
