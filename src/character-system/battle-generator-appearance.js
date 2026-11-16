/**
 * ONE visual contract between the heroine's real face/body editor and battle.
 * Previously battle used the authored *head source* but substituted unrelated
 * face controls, random brown hair colors, fitted-GLB hairstyles and helmets.
 * Consequently a 100/100 graft count did not mean a 100/100 studio pattern.
 *
 * This adapter consumes the SAME persisted localStorage preset when present,
 * the SAME v47 default heroine design when absent, and the SAME v32 catalogue
 * for all other age/sex/job variants. It never claims that editor clothing
 * has been geometrically re-skinned onto the battle torso.
 */
import {loadHeroineFacePreset} from '../heroine-face-preset-store.js?v=60';
import {defaultPartSelection,resolvePartSelection,PART_CATALOG}
 from '../face-part-catalog-v32.js?v=43';
import {resolveHeroHairSpec} from '../hero-hair-controls-v43.js?v=44';
import {heroineBeautyControlsV47,HEROINE_BEAUTY_PART_SELECTION_V43}
 from '../heroine-beauty-preset-v42.js?v=51';

export const BATTLE_STUDIO_PATTERN_VERSION='studio-face-hair-parity-v1';
const limit=(n,max)=>Math.max(0,Math.floor(Math.abs(Number(n)||0))%max);
const hex=n=>'#'+(Math.round(Number(n)||0)&0xffffff).toString(16).padStart(6,'0');
export function currentHeroineStudioPreset(){
 return loadHeroineFacePreset();
}
export function resolveBattleStudioPattern(recipe,{
 preset=null,lead=false,previewFemale=false
}={}){
 if(!recipe||!['female','male'].includes(recipe.sex))
  throw Error('Valid male/female production recipe required');
 const sex=recipe.sex,catalog=PART_CATALOG[sex];
 const useCanonical=sex==='female'&&(!!lead||!!previewFemale);
 const saved=useCanonical&&preset?.parts&&preset?.controls?preset:null;
 const fallbackParts=useCanonical?
  {...defaultPartSelection(),...HEROINE_BEAUTY_PART_SELECTION_V43,
   hairColor:'blonde',ageBand:recipe.ageBand,bodyType:recipe.bodyType}:
  {...defaultPartSelection(),
   face:limit(recipe.faceIndex,catalog.face.length),
   eye:limit(recipe.faceIndex+2,catalog.eye.length),
   nose:limit(recipe.faceIndex+5,catalog.nose.length),
   mouth:limit(recipe.faceIndex+3,catalog.mouth.length),
   hair:limit((recipe.hairStyle||1)-1,catalog.hair.length),
   makeup:sex==='female'?limit(recipe.faceIndex,catalog.makeup.length):0,
   ageBand:recipe.ageBand,bodyType:recipe.bodyType};
 const parts={...fallbackParts,...(saved?.parts||{}),
  // An adult appearance may have a saved hair color, but the actual combat
  // age and physique must still match its roster/level demographics.
  ageBand:recipe.ageBand,bodyType:recipe.bodyType};
 const selection=resolvePartSelection(sex,parts);
 const hairSpec=resolveHeroHairSpec(sex,parts,saved?.hairStyleId||null);
 const controls={
  ...(useCanonical?(saved?.controls||heroineBeautyControlsV47(selection.controls)):selection.controls),
  ageBand:recipe.ageBand,bodyType:recipe.bodyType
 };
 // Keep the author-selected blonde/black/white color for protagonists;
 // stable procedural color for nonhero soldiers (including grey hair).
 const hairColor=useCanonical?parseInt(selection.hairHex.slice(1),16):
  Math.max(0,Math.round(Number(recipe.hairColor)||0))&0xffffff;
 const pigment=saved?.contactColor||'#514139';
 return Object.freeze({
  version:BATTLE_STUDIO_PATTERN_VERSION,
  source:saved?'saved-heroine-editor':useCanonical?'v47-heroine-editor-default':'v32-catalog-production',
  sex,ageBand:recipe.ageBand,bodyType:recipe.bodyType,
  faceIndex:recipe.faceIndex,parts,partIds:selection.ids,
  faceControls:controls,contactColor:pigment,makeupType:sex==='female'?selection.selection.makeup:0,
  hairStyleId:hairSpec.styleId,hairIndex:hairSpec.hairIndex,
  hairLengthScale:hairSpec.lengthScale,hairColor,hairHex:hex(hairColor),
  hairVolume:selection.hairVolume,hairDensity:saved?.hairDensity||1,
  fullStudioSculpt:true,studioHairEligible:true,
  // Physical studio groom is LOD-managed; fitted GLBs still handle mid/far.
  fullStudioHairAttached:false
 });
}
