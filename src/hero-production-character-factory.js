/**
 * Data-only master recipe for battle-ready humanoid variants.
 *
 * The independent hero studio has a high-detail static prototype, but it
 * currently has no skinned battle rig. Instead of falsely loading that static
 * mesh as 100 animated characters, this adapter transfers its established
 * authoring dimensions (sex, age, physique, face, hair, job and rarity) to the
 * EXISTING 65-bone rig and its fitted wardrobe. Replacing the donor mesh is
 * gated on later retarget/geometry QA, not claimed here.
 *
 * Variants are GENERATED ON DEMAND. A 10-job x 3-rarity x 2-sex x 8-age
 * x 4-build matrix is only metadata: never allocate 1,920 dressed GLTFs.
 */
import {AGE_BAND_IDS,BODY_TYPE_IDS,resolveDemographicProfile} from './character-demographics-v47.js';
import {normalizeOutfitRarity} from './character-system/outfit-rarity-policy.js';
import {hashFaceIdentity} from './facial-feature-profiles.js';

export const HERO_PRODUCTION_JOBS=Object.freeze({
 swordsman:{name:'剣士',outfit:'剣士',motion:'剣士',element:'physical'},
 fighter:{name:'格闘家',outfit:'格闘家',motion:'格闘家',element:'physical'},
 mage:{name:'魔法使い',outfit:'魔法使い',motion:'魔法使い',element:'fire'},
 archer:{name:'弓使い',outfit:'弓使い',motion:'弓使い',element:'physical'},
 guardian:{name:'盾戦士',outfit:'盾戦士',motion:'盾戦士',element:'earth'},
 thief:{name:'盗賊',outfit:'盗賊',motion:'盗賊',element:'physical'},
 ninja:{name:'忍者',outfit:'忍者',motion:'忍者',element:'physical'},
 farmer:{name:'農民・職人',outfit:'農民・職人',motion:'農民・職人',element:'earth'},
 priest:{name:'僧侶',outfit:'僧侶',motion:'僧侶',element:'nature'},
 summoner:{name:'召喚士',outfit:'召喚士',motion:'召喚士',element:'arcane'},
 strategist:{name:'軍師',outfit:'軍師',motion:'剣士',element:'arcane'}
});
const BY_NAME=Object.freeze(Object.fromEntries(Object.entries(HERO_PRODUCTION_JOBS)
 .map(([id,row])=>[row.name,id])));
const ALIASES=Object.freeze({
 knight:'swordsman',warrior:'swordsman',shield:'guardian',monk:'fighter',
 wizard:'mage',ranger:'archer',rogue:'thief',assassin:'ninja',
 '槍兵':'swordsman','盾騎士':'guardian','騎士':'swordsman','シーフ':'thief'
});
export const HERO_PRODUCTION_RARITIES=Object.freeze(['N','R','UR']);
export const HERO_PRODUCTION_SEXES=Object.freeze(['female','male']);
export const HERO_VARIANT_COUNT=10*3*2*AGE_BAND_IDS.length*BODY_TYPE_IDS.length;
const NATURAL_HAIR=Object.freeze([0x342925,0x594536,0x77523b,0x26292f,0x917454,0x58383b]);
const clamp=(x,min,max)=>Math.max(min,Math.min(max,x));
export function resolveHeroProductionJob(jobId,jobName=''){
 const name=String(jobName||'');
 const requested=String(jobId||'');
 const normalized=HERO_PRODUCTION_JOBS[requested]?requested:
  BY_NAME[name]||BY_NAME[requested]||ALIASES[requested]||ALIASES[name]||'swordsman';
 return {id:normalized,...HERO_PRODUCTION_JOBS[normalized]};
}
const hashChoice=(hash,shift,length)=>Math.floor((hash>>>shift)%length);
export function createHeroProductionRecipe({
 id=0,jobId='swordsman',jobName='',sex='male',ageBand='twenties',
 bodyType='normal',rarity='N',faceId=null,hairStyle=null,
 hairColor=null,role='soldier'
}={}){
 const job=resolveHeroProductionJob(jobId,jobName);
 const gender=sex==='female'?'female':'male';
 const demographics=resolveDemographicProfile(ageBand,bodyType);
 const rank=normalizeOutfitRarity(rarity);
 const stableHash=hashFaceIdentity(job.id+':'+id+':'+gender);
 const faceHash=hashFaceIdentity('hero-face:'+job.id+':'+id+':'+rank+':'+gender);
 // A selected protagonist faceId is preserved; normal soldiers get stable
 // identities, never random faces/hair that change on the next reload.
 const faceIndex=Number.isInteger(Number(faceId))&&faceId!=null?
  Math.max(0,Math.min(9,Math.floor(Number(faceId)))):faceHash%10;
 const age=demographics.age,body=demographics.body;
 const hairCount=gender==='female'?12:14;
 const style=Number.isInteger(Number(hairStyle))&&hairStyle!=null&&
  Number(hairStyle)>=1&&Number(hairStyle)<=hairCount?
  Number(hairStyle):1+hashChoice(stableHash,5,hairCount);
 const natural=NATURAL_HAIR[hashChoice(stableHash,13,NATURAL_HAIR.length)];
 const color=Number.isInteger(Number(hairColor))&&hairColor!=null?
  Number(hairColor):age.id==='eightyPlus'?0xd2d0c9:
  age.id==='seventies'?0xb8b6b1:
  age.id==='sixties'?(stableHash%2?0x999493:natural):natural;
 const eyes=['almond','round','narrow','hooded'];
 const noses=['straight','aquiline','broad','short'];
 const mouth=['neutral','wide','bow','thin'];
 const faceProfile=Object.freeze({
  eyeSize:+clamp((1+(faceIndex-4.5)*.016)*age.eyelidScale,.72,1.34).toFixed(3),
  eyeSpacing:+clamp(1+(faceHash%9-4)*.018,.78,1.24).toFixed(3),
  noseWidth:+clamp(1+(faceHash%7-3)*.036,.72,1.32).toFixed(3),
  noseLength:+clamp(1+(faceHash%5-2)*.037,.78,1.29).toFixed(3),
  mouthWidth:+clamp(1+(faceIndex-4.5)*.024,.72,1.36).toFixed(3),
  mouthFullness:+clamp(1+.12*age.lipFullness-.10+(faceHash%5-2)*.024,.72,1.32).toFixed(3),
  eyesType:eyes[faceIndex%4],noseType:noses[Math.floor(faceIndex/2)%4],
  mouthType:mouth[Math.floor(faceIndex/3)%4]
 });
 return Object.freeze({
  recipeVersion:'hero-production-v1',
  id:String(id),jobId:job.id,jobName:job.name,outfitJob:job.outfit,
  motionJob:job.motion,sex:gender,rarity:rank,role,
  ageBand:age.id,bodyType:body.id,faceIndex,hairStyle:style,hairColor:color,
  // Scale the entire dressed rig consistently; physics/grid positioning is
  // unchanged, armor and skin are not displaced independently.
  height:+((gender==='female'?1.68:1.78)*age.heightScale).toFixed(4),
  visualScaleX:+clamp(body.width,.88,1.17).toFixed(3),
  visualScaleZ:+clamp(body.depth,.88,1.16).toFixed(3),
  faceProfile,element:job.element,
  source:'rigged-hero-authoring-recipe',
  donorSkinnedRig:'quaternius-65-bone',
  photoMasterGeometrySwapped:false,
  battleOptimized:true
 });
}
export function* enumerateHeroProductionRecipes({
 jobs=Object.keys(HERO_PRODUCTION_JOBS).filter(j=>j!=='strategist')
}={}){
 for(const jobId of jobs)for(const rarity of HERO_PRODUCTION_RARITIES)
  for(const sex of HERO_PRODUCTION_SEXES)for(const ageBand of AGE_BAND_IDS)
   for(const bodyType of BODY_TYPE_IDS)
    yield createHeroProductionRecipe({
     id:jobId+':'+rarity+':'+sex+':'+ageBand+':'+bodyType,
     jobId,rarity,sex,ageBand,bodyType
    });
}
/** Existing battle renderer's pooled ActionVfxRuntime receives a recipe,
 * never additional per-soldier continuously running particle systems. */
export function heroProductionActionCue(recipe,state){
 if(!recipe||state!=='skill')return null;
 const job=recipe.jobId;
 const action=job==='mage'||job==='summoner'||job==='strategist'?'magic':
  job==='priest'?'heal':
  job==='archer'?'aim':job==='guardian'?'guard':
  job==='fighter'?'punch':job==='farmer'?'guard':'heavy';
 return Object.freeze({
  action,element:recipe.element,
  scale:recipe.rarity==='UR'?1.20:recipe.rarity==='R'?1.10:1
 });
}
