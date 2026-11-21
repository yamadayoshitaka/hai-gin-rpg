/** Catalog-studied 3D silhouette recipes (v71).
 * Normalized cut levels are measured in donor HEAD heights from the chin/
 * scalp-box minimum (0 = base of face, 1 = crown). Negative = past nape.
 * Independently shape crown, side, back and front; never emulate medium/long
 * by placing a few tail strands under a short, blunt bob-cap silhouette.
 * These records describe original 3D geometry, not photographs/assets. */
const MALE=[
 // id, classification, crown, sides, back, face, side-part strength
 ['rb-m-crew','crew',.84,.84,.82,.85,.04],
 ['rb-m-natural-short','natural-short',.70,.72,.68,.74,.13],
 ['rb-m-textured','textured-short',.64,.67,.62,.69,.20],
 ['rb-m-mash','mash',.55,.62,.59,.64,.08],
 ['rb-m-two-block','two-block',.58,.77,.79,.64,.21],
 ['rb-m-undercut','undercut',.60,.82,.82,.67,.22],
 ['rb-m-seven-three','seven-three',.62,.71,.70,.72,.35],
 ['rb-m-slickback','slickback',.64,.75,.73,.79,.40],
 ['rb-m-short-wolf','short-wolf',.58,.68,.40,.64,.18],
 ['rb-m-short-perm','soft-perm',.58,.66,.59,.66,.15],
 ['rb-m-center-medium','center-medium',.32,.41,.24,.66,.26],
 ['rb-m-bangs-medium','fringe-medium',.32,.42,.25,.75,.07],
 ['rb-m-comma','comma-medium',.34,.43,.29,.67,.38],
 ['rb-m-wolf-medium','wolf-medium',.28,.43,.01,.62,.22],
 ['rb-m-medium-perm','nuance-perm',.32,.43,.25,.65,.18],
 ['rb-m-side-medium','side-medium',.31,.42,.25,.67,.42],
 ['rb-m-shoulder','shoulder',-.08,.09,-.22,.63,.24],
 ['rb-m-long','long',-.51,-.27,-.59,.65,.16],
 ['rb-m-long-wave','long-wave',-.49,-.25,-.56,.64,.22]
];
const FEMALE=[
 // Medium is a coherent draped layer, not a nape-length wall plus tails.
 ['rb-f-pixie','pixie',.75,.78,.75,.78],
 ['rb-f-natural-short','natural-short',.71,.74,.70,.74],
 ['rb-f-ear-short','ear-short',.70,.78,.71,.72],
 ['rb-f-bangs-short','bangs-short',.70,.77,.73,.78],
 ['rb-f-center-short','part-short',.69,.74,.70,.77],
 ['rb-f-wolf-short','short-wolf',.57,.63,.49,.71],
 ['rb-f-softperm-short','softperm',.62,.69,.63,.73],
 ['rb-f-bob-straight','bob',.31,.32,.30,.69],
 ['rb-f-bob-bangs','bob-bangs',.30,.32,.28,.79],
 ['rb-f-bob-in','bob-in',.29,.30,.27,.69],
 ['rb-f-bob-out','bob-out',.29,.31,.26,.69],
 ['rb-f-bob-wave','bob-wave',.28,.32,.27,.79],
 ['rb-f-medium','medium',-.01,.10,-.07,.68],
 ['rb-f-shoulder','shoulder',-.10,.06,-.16,.79],
 ['rb-f-medium-out','medium-out',-.13,.02,-.18,.70],
 ['rb-f-medium-wave','medium-wave',-.11,.02,-.17,.69],
 ['rb-f-wolf-medium','wolf-medium',-.05,.12,-.22,.70],
 ['rb-f-semilong','semilong',-.27,-.09,-.35,.70],
 ['rb-f-layered','layered',-.53,-.29,-.66,.69],
 ['rb-f-long','long',-.65,-.46,-.72,.68],
 ['rb-f-long-bangs','long-bangs',-.64,-.45,-.71,.79],
 ['rb-f-long-in','long-in',-.63,-.44,-.70,.68],
 ['rb-f-long-out','long-out',-.65,-.44,-.73,.68],
 ['rb-f-long-wave','long-wave',-.63,-.43,-.71,.68],
 // The defining HIME side lock is a separate jaw-level horizontal cut.
 ['rb-f-hime','hime',-.62,.47,-.72,.75]
];
export const HAIR_SHAPE_CATALOG_V71=Object.freeze(Object.fromEntries([
 ...MALE.map(([id,family,crown,temple,back,face,partStrength])=>[id,
  Object.freeze({id,gender:'male',family,crown,temple,back,face,partStrength,
   himeSide:false})]),
 ...FEMALE.map(([id,family,crown,temple,back,face])=>[id,
  Object.freeze({id,gender:'female',family,crown,temple,back,face,
   partStrength:0,himeSide:id==='rb-f-hime'})])
]));
export const MALE_SHAPE_FAMILIES_V71=Object.freeze(
 Object.fromEntries(MALE.map(row=>[row[0],row[1]])));
export function selectCatalogCutLevel(profile,zone='crown',{
 frontRoot=false,bangsCut=false
}={}){
 if(!profile||bangsCut)return null;
 if(zone.startsWith('nape')||zone.startsWith('back'))return profile.back;
 if(zone.startsWith('temple'))return profile.temple;
 if(zone.startsWith('fringe'))return profile.face;
 if(zone==='crown')return frontRoot?Math.max(profile.face-.09,profile.crown):profile.crown;
 return profile.crown;
}
