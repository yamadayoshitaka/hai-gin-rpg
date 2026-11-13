/**
 * v43 single source of truth for hair-style selection on female/male face
 * and full-body editors. Each of the 16 catalog entries must resolve to a
 * finite guide length. No silently undefined length when indexes reach 13-15.
 */
import {PART_CATALOG,normalizePartSelection} from './face-part-catalog-v32.js?v=43';
import {getWigStyle} from './face-wig-styles.js?v=44';

export const MALE_HAIR_LENGTH_V43=Object.freeze({
 'center-part-gravity-long':.57,'salon-layered-long':.33,
 'princess-long':.37,'curtain-bangs-long':.39,
 'knight-long':.49,'soft-medium':.52,
 'mature-layer-long':.34,'fringe-long':.50,
 'shag-long':.58,'rounded-bob':.61,
 'natural-short':1,'very-short':1,'buzz-cut':1,
 'soft-wave-long':.64,'full-fringe-straight':.45,
 'airy-shoulder-layers':.66
});
export function resolveHeroHairSpec(gender,rawParts={},requestedStyleId=null){
 const catalog=PART_CATALOG[gender]?.hair;
 if(!catalog)throw Error('Unknown hero hair gender '+gender);
 const selection=normalizePartSelection(rawParts);
 const requested=requestedStyleId&&catalog.some(row=>row.values.styleId===requestedStyleId)
  ?requestedStyleId:null;
 const styleId=requested||catalog[selection.hair].values.styleId;
 const hairIndex=catalog.findIndex(row=>row.values.styleId===styleId);
 const style=getWigStyle(styleId);
 const lengthScale=gender==='male'?MALE_HAIR_LENGTH_V43[styleId]:1;
 if(!Number.isFinite(lengthScale)||lengthScale<=0)throw Error('Undefined hair length for '+gender+': '+styleId);
 return Object.freeze({gender,styleId,hairIndex,lengthScale,
  shortCutKind:style.shortCutKind||null,
  cut:style.cut,part:style.part,
  selection:Object.freeze({...selection,hair:hairIndex})});
}

/** One atomic selection for both the stored parts.hair and the live styleId. */
export function synchronizeHeroHairSelection(gender,parts={},requestedStyleId=null){
 const spec=resolveHeroHairSpec(gender,parts,requestedStyleId);
 return Object.freeze({
  parts:Object.freeze({...spec.selection,hair:spec.hairIndex}),
  styleId:spec.styleId,lengthScale:spec.lengthScale
 });
}
