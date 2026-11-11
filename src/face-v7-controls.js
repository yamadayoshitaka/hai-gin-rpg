/**
 * Canonical face preset recovered from the user's Library export.
 * Library: female-saved-preset-contact-makeup-v8.glb (2026-11-12 JST)
 * Source of truth: GLB node FEMALE_FACE_MASTER_SOURCE_CLONE
 *   extras.faceMasterReport.femaleControls.
 * The GLB file is a reference, not a new donor head or outfit.
 * Do not infer the preset from an image or from earlier v8 defaults.
 */
export const LIBRARY_FACE_PRESET=Object.freeze({
 sourceFile:'female-saved-preset-contact-makeup-v8.glb',
 sha256:'aecac5a923a1f56a6c53eeaebbe5c987cb5685144058054391a92d479dc21060',
 contactColor:'#514139',
 femaleControls:Object.freeze({
  irisDiameter:1,
  jawSharpness:5,
  noseTipLift:0,
  nostrilCover:2,
  noseBridgeSharpness:2.5,
  browAngle:6,
  lashAngle:7,
  eyeAngle:0,
  eyeSize:1,
  lipstickX:0,
  lipstickY:0,
  lipstickWidth:1,
  lipstickHeight:1
 })
});
// Preserve the legacy export name so all game/QA consumers use this
// saved preset without a second incompatible settings API.
export const FEMALE_V7_DEFAULTS=LIBRARY_FACE_PRESET.femaleControls;
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
 lashes:0x292126,
 eyeliner:0x30252b,
 eyeAccent:0x765458,
 blush:0xcf8383,
 beard:0x56443a
});
const ranges=Object.freeze({
 irisDiameter:[1,2],jawSharpness:[.7,5],
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
// The male standard must be the SAVED FEMALE FACE without cosmetics.
// Facial sculpt/eye parameters remain identical at default; beard starts
// clean-shaven but remains adjustable from the existing male sliders.
export const MALE_REFERENCE_DEFAULT=Object.freeze({
 ...FEMALE_V7_DEFAULTS,
 beardDensity:0,beardLength:1,
 cosmetics:false,sharedHeadSource:'realistic-head-animation.glb'
});
/**
 * Male sliders share the saved face anatomy and neutral iris configuration,
 * while lip/cheek/eye cosmetics are disabled by the male mesh layer.
 */
export function normalizeMaleFaceControls(settings={}){
 const core=normalizeFemaleFaceControls({
  ...MALE_REFERENCE_DEFAULT,...settings
 });
 const beardValue=(key,range)=>{
  const raw=Number(settings[key]??MALE_REFERENCE_DEFAULT[key]);
  return Number.isFinite(raw)?Math.max(range[0],Math.min(range[1],raw)):
   MALE_REFERENCE_DEFAULT[key];
 };
 return {...core,beardDensity:beardValue('beardDensity',[0,1]),
  beardLength:beardValue('beardLength',[.3,2.5])};
}
