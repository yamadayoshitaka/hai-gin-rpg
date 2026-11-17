/**
 * Explicit wolf-king mother geometry. Offspring are copied from the
 * actual m001 axial sculpt, THEN morph only their physical silhouette.
 * No old sphere/cranium substitute, no copying a cat onto a wolf rig.
 * Pure blueprints: species retain existing material, elemental landmarks,
 * individual pivots and legacy rollback paths.
 */
export const WOLF_KING_DONOR_ID='m001';
export const WOLF_KING_DERIVED_IDS=Object.freeze(['m002','m003','m004']);
const MORPHS=Object.freeze({
 m002:Object.freeze({faceX:.94,faceY:1.02,faceZ:1.20,faceAdvance:.040,
  snoutWidth:1.20,snoutLength:1.32,noseWidth:1.30}),
 m003:Object.freeze({faceX:1.23,faceY:1.19,faceZ:1.17,faceAdvance:.018,
  snoutWidth:1.29,snoutLength:1.29,noseWidth:1.32}),
 m004:Object.freeze({faceX:1.20,faceY:1.16,faceZ:1.16,faceAdvance:.022,
  snoutWidth:1.25,snoutLength:1.25,noseWidth:1.30})
});
export const wolfKingCloneMorph=id=>MORPHS[id]||null;
export function copyWolfKingSourceRings(m001Rings,id,kind='cranium'){
 const morph=wolfKingCloneMorph(id);
 if(!morph)throw Error('No approved wolf-king clone profile: '+id);
 if(!Array.isArray(m001Rings)||m001Rings.length<4||
    m001Rings.some(r=>!Number.isFinite(r.z)||!Number.isFinite(r.y)||
     !Number.isFinite(r.rx)||!Number.isFinite(r.ry)))
  throw Error('Donor needs ordered physical axial stations');
 const snout=kind==='snout'||kind==='rhinarium';
 return m001Rings.map(r=>({
  ...r,
  z:r.z*(snout?morph.snoutLength:morph.faceZ)+
    (snout?.055:morph.faceAdvance),
  y:r.y*(snout?1.05:morph.faceY),
  rx:r.rx*(snout?(kind==='rhinarium'?morph.noseWidth:morph.snoutWidth):morph.faceX),
  ry:r.ry*(snout?(kind==='rhinarium'?1.15:1.12):morph.faceY)
 }));
}
export const WOLF_CLONE_SOURCE_REVISION='m001-physical-copy-m002-m004-v1-20261117';
