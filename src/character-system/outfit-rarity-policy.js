// The same appearance tiers are used by the independent wardrobe studio,
// animation preview and real-time army. Do not replace a job's silhouette or
// lower polygon detail as a side effect of changing its rarity.
export const OUTFIT_RARITY = Object.freeze({
  N: Object.freeze({rank:0,label:'N・通常',fabricHue:0x6c7b86,fabricMix:0,
    trim:0x9aa7af,gem:0x8ea5b0,ornaments:0}),
  R: Object.freeze({rank:1,label:'R・精鋭',fabricHue:0x316f99,fabricMix:.24,
    trim:0xc5d8ed,gem:0x49cbe8,ornaments:1}),
  UR: Object.freeze({rank:2,label:'UR・伝説',fabricHue:0x643a8b,fabricMix:.29,
    trim:0xf3ce72,gem:0x9e67ed,ornaments:2})
});

export function normalizeOutfitRarity(rarity){
  const key=String(rarity??'N').toUpperCase();
  return Object.hasOwn(OUTFIT_RARITY,key)?key:'N';
}

export function outfitRarityFinish(rarity){
  return OUTFIT_RARITY[normalizeOutfitRarity(rarity)];
}
