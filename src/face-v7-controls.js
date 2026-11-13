/**
 * Canonical face preset recovered from the user's Library export.
 * Library: female-saved-preset-contact-makeup-v8.glb (2026-11-12 JST)
 * Source of truth: GLB node FEMALE_FACE_MASTER_SOURCE_CLONE
 *   extras.faceMasterReport.femaleControls.
 * The GLB file is a reference, not a new donor head or outfit.
 * Do not infer the preset from an image or from earlier v8 defaults.
 */
import {resolveAgeBand,resolveBodyType} from './character-demographics-v47.js?v=47';
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
// v21 adds a NEW control without falsifying the original saved GLB values.
export const FACE_EYE_SPACING_DEFAULT=1.10;
export const FACE_EYE_SPACING_RANGE=Object.freeze([.65,1.35]);
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
/**
 * v14 UI + sculpt contract. The Library's numeric GLB settings remain
 * IDENTICAL; the saved value is positioned at the exact 50% thumb position.
 * Higher strength is available on the right, notably chin / nostril / bridge.
 * This table is consumed by BOTH JavaScript normalization and HTML controls.
 */
export const FACE_SLIDER_RANGES=Object.freeze({
 irisDiameter:[0,2],jawSharpness:[0,10],
 noseTipLift:[-2,2],nostrilCover:[0,4],
 noseBridgeSharpness:[0,5],
 browAngle:[-19,31],lashAngle:[-18,32],
 eyeAngle:[-20,20],eyeDepth:[-.3,.85],
 eyeWidth:[.70,1.45],eyeHeight:[.65,1.45],
 browWidth:[.70,1.50],browThickness:[.45,1.85],
 lashDensity:[.5,2.2],lashLength:[.5,2.1],
 lashThickness:[.4,1.9],lashCurl:[-.5,1.5],
 lipstickX:[-.12,.12],lipstickY:[-.12,.12],
 lipstickWidth:[.2,2.8],lipstickHeight:[.2,1.8],
 faceMorph:[-.6,.6],mouthSmile:[-1,1],eyePositionY:[-2,2],
 nosePositionX:[-2,2],nosePositionY:[-2,2],nosePositionZ:[-2,2],
 noseAngle:[-12,12],mouthPositionX:[-2,2],mouthPositionY:[-2,2],
 mouthPositionZ:[-2,2],mouthAngle:[-12,12]
});
export function normalizeFemaleFaceControls(settings={}){
 const out={};
 for(const [k,v] of Object.entries(FEMALE_V7_DEFAULTS)){
  // v8's saved eyeSize is archival only. Width and height own the scale.
  if(k==='eyeSize')continue;
  const raw=Number(settings?.[k]);
  out[k]=Number.isFinite(raw)?Math.max(FACE_SLIDER_RANGES[k][0],Math.min(FACE_SLIDER_RANGES[k][1],raw)):v;
 }
 const spacing=Number(settings?.eyeSpacing);
 out.eyeSpacing=Number.isFinite(spacing)?
  Math.max(FACE_EYE_SPACING_RANGE[0],Math.min(FACE_EYE_SPACING_RANGE[1],spacing)):
  FACE_EYE_SPACING_DEFAULT;
 const depth=Number(settings?.eyeDepth);
 out.eyeDepth=Number.isFinite(depth)?
  Math.max(FACE_SLIDER_RANGES.eyeDepth[0],Math.min(FACE_SLIDER_RANGES.eyeDepth[1],depth)):0;
 // Modern sculpt controls are additive: preserve every original Library
 // face slider value and provide stable neutral defaults for new features.
 const extras={eyeWidth:1,eyeHeight:1,browWidth:1,browThickness:1,
  lashDensity:1,lashLength:1.4,lashThickness:1,lashCurl:.85,
  faceMorph:0,mouthSmile:0,eyePositionY:0,
  nosePositionX:0,nosePositionY:0,nosePositionZ:0,noseAngle:0,
  mouthPositionX:0,mouthPositionY:0,mouthPositionZ:0,mouthAngle:0};
 for(const [key,fallback] of Object.entries(extras)){
  const value=Number(settings?.[key]);
  const [low,high]=FACE_SLIDER_RANGES[key];
  out[key]=Number.isFinite(value)?Math.max(low,Math.min(high,value)):fallback;
 }
 // Calculated compatibility field; legacy eyeSize inputs are ignored.
 out.eyeSize=Math.sqrt(out.eyeWidth*out.eyeHeight);
 out.ageBand=resolveAgeBand(settings.ageBand).id;
 out.bodyType=resolveBodyType(settings.bodyType).id;
 return out;
}

/** A selectable cosmetic colored-contact palette. The default is natural brown. */
export const CONTACT_COLORS=Object.freeze({
 brown:'#514139',darkBrown:'#30231d',chocolate:'#684838',
 honeyBrown:'#936747',hazel:'#927953',amber:'#bc863f',
 green:'#5c886b',olive:'#64744d',emerald:'#34816a',
 blue:'#467fa7',lightBlue:'#78b8d9',iceBlue:'#a9d6e5',
 gray:'#7e858d',silver:'#b4bcc4',violet:'#8b74a8',
 pink:'#c487a8',red:'#a64045'
});
export const CONTACT_COLOR_LABELS=Object.freeze({
 brown:'ブラウン（標準）',darkBrown:'ダークブラウン',chocolate:'チョコレート',
 honeyBrown:'ハニーブラウン',hazel:'ヘーゼル',amber:'琥珀',
 green:'グリーン',olive:'オリーブ',emerald:'エメラルド',
 blue:'ブルー',lightBlue:'ライトブルー',iceBlue:'アイスブルー',
 gray:'グレー',silver:'シルバー',violet:'バイオレット',
 pink:'ピンク',red:'レッド'
});
export function safeContactColor(value){
 const input=String(value??CONTACT_COLORS.brown).trim().toLowerCase();
 return /^#[0-9a-f]{6}$/.test(input)?input:CONTACT_COLORS.brown;
}
/** Persisted reference presets do not require browser storage. */
export const FEMALE_REFERENCE_DEFAULT=FEMALE_V7_DEFAULTS;
// The male standard must be the SAVED FEMALE FACE without cosmetics.
// Facial sculpt/eye parameters remain identical at default; the separate
// beard control retains its existing default and may be set to zero.
export const MALE_REFERENCE_DEFAULT=Object.freeze({
 ...FEMALE_V7_DEFAULTS,
 beardDensity:.35,beardLength:1,
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
