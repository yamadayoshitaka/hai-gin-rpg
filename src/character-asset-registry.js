/** Explicit material-slot contract: model source, anatomy, cosmetics and equipment never share a namespace. */
import {CHARACTER_PARTS} from './character-assembly-bom.js';
import {PLAYER_JOBS} from './game-content.js';
import {resolveFantasyActor} from './fantasy-job-roster.js';
export const ASSET_SLOT_NAMES=Object.freeze(['body','face','hair','outfit','equipment']);
export const MODEL_IDS=Object.freeze(['Male_Peasant','Female_Peasant','Male_Ranger','Female_Ranger']);
export function characterAssetRecipe(job,sex='male',overrides={}){
 if(!PLAYER_JOBS[job])throw Error('Unknown job '+job);
 const actor=resolveFantasyActor(job,sex),ranged=['ranger','rogue','archer','assassin','monk'].includes(job);
 const modelId=(sex==='female'?'Female_':'Male_')+(ranged?'Ranger':'Peasant');
 const defaultOutfit=CHARACTER_PARTS.outfits[actor.outfit]?actor.outfit:(['mage','priest','scholar'].includes(job)?'mage':ranged?'bandit':'traveler');
 const base={body:CHARACTER_PARTS.bodies[actor.body]?actor.body:sex==='female'?'slim':'adult',face:CHARACTER_PARTS.faces[actor.face]?actor.face:sex==='female'?'youthful':'calm',hair:CHARACTER_PARTS.hairs[actor.hair]?actor.hair:sex==='female'?'long':'short',outfit:defaultOutfit,equipment:CHARACTER_PARTS.equipment[actor.weapon]?actor.weapon:'none'};
 const slots={...base};
 for(const key of ASSET_SLOT_NAMES)if(overrides[key]!==undefined){if(!Object.hasOwn(CHARACTER_PARTS[key==='body'?'bodies':key==='face'?'faces':key==='hair'?'hairs':key==='outfit'?'outfits':'equipment'],overrides[key]))throw Error('Invalid '+key+' asset '+overrides[key]);slots[key]=overrides[key];}
 return Object.freeze({job,sex,modelId,slots:Object.freeze(slots),motion:actor.motion,skill:PLAYER_JOBS[job].skill});
}
export function validateAssetRecipes(){
 for(const job of Object.keys(PLAYER_JOBS))for(const sex of ['male','female']){
  const r=characterAssetRecipe(job,sex);
  if(!MODEL_IDS.includes(r.modelId)||!r.motion.attack)throw Error('Invalid job assets '+job+'/'+sex);
  for(const slot of ASSET_SLOT_NAMES)if(!r.slots[slot])throw Error('Empty '+slot+' '+job+'/'+sex);
 }
 return true;
}
