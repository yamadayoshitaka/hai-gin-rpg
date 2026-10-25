/** Model-first actor catalog. Nothing is loaded unless its file exists and clips pass verification. */
import {PLAYER_JOBS} from './game-content.js';
const base='./assets/characters/quaternius-outfits/';
export const MODEL_FIRST_CATALOG=Object.freeze({
 adultMale:{url:base+'Male_Ranger.gltf',baseBody:'./assets/characters/quaternius-base/Superhero_Male_FullBody.gltf',rigFamily:'quaternius-universal',height:1.78},
 adultFemale:{url:base+'Female_Ranger.gltf',baseBody:'./assets/characters/quaternius-base/Superhero_Female_FullBody.gltf',rigFamily:'quaternius-universal',height:1.68},
 civilianMale:{url:base+'Male_Peasant.gltf',rigFamily:'quaternius-universal',height:1.72},
 civilianFemale:{url:base+'Female_Peasant.gltf',rigFamily:'quaternius-universal',height:1.64}
});
const jobIdentity={
 swordsman:['adultMale','sword','slash'],knight:['adultMale','shield','bash'],rogue:['adultFemale','dagger','stab'],monk:['adultMale','fists','combo'],
 merchant:['civilianMale','coins','toss'],traveler:['adultMale','shortsword','slash'],smith:['civilianMale','hammer','smash'],
 chef:['civilianFemale','knife','flurry'],herbalist:['civilianFemale','pouch','throw'],bard:['civilianFemale','lute','chord'],
 farmer:['civilianMale','sickle','sweep'],scholar:['adultFemale','book','cast'],innkeeper:['civilianMale','staff','strike'],
 priest:['adultMale','mace','bless'],mage:['adultFemale','staff','cast'],archer:['adultFemale','bow','shoot'],
 paladin:['adultMale','shield','holy'],assassin:['adultFemale','dagger','stab'],samurai:['adultMale','katana','draw'],ranger:['adultMale','bow','shoot']
};
export const JOB_MODEL_BOM=Object.freeze(Object.fromEntries(Object.entries(jobIdentity).map(([id,[model,weapon,attack]])=>[id,Object.freeze({model,weapon,attack,animations:{idle:'Idle',walk:'Walk',run:'Run',attack:'Attack',guard:'Guard',hit:'Hit',dead:'Death'},assetPack:'quaternius-universal-cc0'})])));
export function validateJobModelBom(){const jobs=Object.keys(PLAYER_JOBS);if(jobs.length!==20||jobs.some(j=>!JOB_MODEL_BOM[j]||!MODEL_FIRST_CATALOG[JOB_MODEL_BOM[j].model]))throw Error('Incomplete job model BOM');return true;}
export function auditAnimationClips(clips,actionMap){
 const names=(clips||[]).filter(c=>c&&c.tracks&&c.tracks.length>0).map(c=>c.name);
 const byAction={};for(const [action,pattern] of Object.entries(actionMap)){
  const found=names.find(name=>name.toLowerCase()===pattern.toLowerCase())||names.find(name=>name.toLowerCase().includes(pattern.toLowerCase()));
  byAction[action]=found||null;
 }
 const critical=['idle','walk','run','attack'];return {verified:critical.every(k=>byAction[k]),clipCount:names.length,byAction,missing:critical.filter(k=>!byAction[k])};
}
validateJobModelBom();
