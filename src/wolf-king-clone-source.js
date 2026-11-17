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

/**
 * The old clone used one fixed +Z eye offset, even though each species
 * stretches the donor skull. Intersect a horizontal eye line against the
 * axial ring ellipses. This is only O(rings * 24) arithmetic at authoring
 * time and avoids per-frame raycasts/extra materials on mobile.
 */
export function copiedWolfEyeSurfaceZ(rings,x,y){
 if(!Array.isArray(rings)||rings.length<3)throw Error('Physical eye source rings required');
 let best=-Infinity;
 for(let i=1;i<rings.length;i++){
  const a=rings[i-1],b=rings[i];
  for(let k=0;k<=24;k++){
   const t=k/24;
   const rx=a.rx+(b.rx-a.rx)*t,ry=a.ry+(b.ry-a.ry)*t;
   if(rx<=0||ry<=0)continue;
   const cy=a.y+(b.y-a.y)*t;
   const q=(x/rx)**2+((y-cy)/ry)**2;
   if(q<=.985)best=Math.max(best,a.z+(b.z-a.z)*t);
  }
 }
 if(!Number.isFinite(best))throw Error('Eye line does not intersect donor skull');
 return best;
}
