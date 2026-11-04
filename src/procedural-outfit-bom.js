/** Body-first procedural outfit BOM. Experimental: no approved garments yet. */
import {JOB_CATALOG} from './job-catalog.js';
const profiles={
 general:{shell:'tunic',material:'linen',shoulder:'none'},
 melee:{shell:'cuirass',material:'steel',shoulder:'pauldron'},
 ranged:{shell:'jerkin',material:'leather',shoulder:'light'},
 magic:{shell:'robe',material:'linen',shoulder:'none'},
 support:{shell:'robe',material:'linen',shoulder:'light'}
};
const special={
 swordsman:{shell:'cuirass',material:'steel'},
 knight:{shell:'cuirass',material:'steel',shoulder:'pauldron'},
 samurai:{shell:'lamellar',material:'leather',shoulder:'pauldron'},
 martial_artist:{shell:'wrap',material:'linen',shoulder:'none'},
 thief:{shell:'jerkin',material:'leather',shoulder:'none'},
 ninja:{shell:'wrap',material:'linen',shoulder:'none'},
 mage:{shell:'robe',material:'linen',shoulder:'none'},
 summoner:{shell:'robe',material:'royal',shoulder:'light'},
 blacksmith:{shell:'apron',material:'leather',shoulder:'none'}
};
export const MATERIAL_TEXTURES=Object.freeze({
 steel:'assets/textures/characters/steel.svg',
 leather:'assets/textures/characters/leather.svg',
 linen:'assets/textures/characters/linen.svg',
 royal:'assets/textures/characters/royal.svg'
});
export const PROCEDURAL_OUTFIT_BOM=Object.freeze(Object.fromEntries(
 Object.entries(JOB_CATALOG).map(([id,job])=>[id,Object.freeze({
  id,name:job.name,category:job.category,
  ...profiles[job.category]??profiles.general,...special[id],
  construction:'body-surface-offset',rig:'source-skeleton',
  requiredParts:['front','back','collar','leftShoulder','rightShoulder'],
  status:'design-only',photographicTextureVerified:false
 })])
));
export function resolveProceduralOutfit(jobId){
 return PROCEDURAL_OUTFIT_BOM[jobId]||PROCEDURAL_OUTFIT_BOM.civilian;
}
