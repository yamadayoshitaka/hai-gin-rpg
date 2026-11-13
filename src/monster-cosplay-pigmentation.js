/**
 * Per-instance monster pigmentation for imported canonical character skins.
 *
 * The source hero material can be named "Material" or "body_low", so tinting
 * just faces whose mesh name contains 'skin' missed whole torsos and arms.
 * Retain maps, normals and eye lenses; never edit the source hero material.
 */
import * as THREE from 'three';

export const COSPLAY_INHUMAN_SKIN_IDS=Object.freeze([
 'm015','m031','m032','m033','m034','m035',
 'm036','m037','m038','m039','m040',
 'm041','m042','m043','m044','m045',
]);
export function classifyCosplaySurface(nodeName='',materialName='',{
 isSkinnedMesh=false,
}={}){
 const name=(String(nodeName)+' '+String(materialName)).toLowerCase();
 // Eye / cornea / iris / mouth interiors need their original optical detail,
 // otherwise a cyan corpse with cyan glass eyes looks toy-like.
 if(/eyes?\b|eyeball|eyewhite|eyelash|eyebrow|iris|pupil|cornea|tear|tongue|tooth|teeth|gum|mouth/i.test(name))return 'preserve';
 if(/hair|eyebrow|beard|facialhair|eyelash|wig|scalp/i.test(name))return 'hair';
 if(/armor|armour|metal|steel|plate|gauntlet|bracer|helmet|shield/i.test(name))return 'metal';
 if(/fabric|cloth|tunic|shirt|pants|trouser|coat|robe|cloak|cape|mantle|vest|dress|skirt|belt|boot|shoe|leather|outfit|uniform/i.test(name))return 'cloth';
 if(/skin|body|head|face|hand|arm|leg|torso|neck|chest|foot|finger|nail|flesh/i.test(name))return 'skin';
 // The source GLB often labels a full skinned character simply 'Material'.
 // Tint it instead of silently leaving healthy peach skin untouched.
 return isSkinnedMesh?'skin':'cloth';
}
export function applyMonsterMaterialPigment(material,role,profile){
 if(!material||!profile)throw Error('Missing canonical monster pigmentation');
 const tinted=material.clone();
 if(role==='preserve')return tinted;
 const color=role==='hair'?(profile.hairColor??profile.cloth):
   (profile[role]??profile.skin);
 if(!Number.isInteger(color)||color<0||color>0xffffff)
  throw Error('Invalid monstrous material role '+role);
 // The old code MULTIPLIED the import tint by an almost white overlay and
 // some naked meshes were excluded by name. Directly controlling the cloned
 // PBR material color guarantees a visibly otherworldly epidermis, while
 // retaining photographic albedo/normal textures, roughness and UV maps.
 const target=new THREE.Color(color);
 const original=tinted.color?.clone?.()??new THREE.Color(0xffffff);
 if(tinted.color)tinted.color.copy(target.lerp(original,role==='skin'?.055:.12));
 if(role==='skin'){
  const mineral=!!profile.construct;
  tinted.roughness=mineral?.92:profile.costume==='vampire'?.75:.88;
  tinted.metalness=mineral&&profile.costume==='bronze_construct'?.27:
   mineral&&profile.costume==='silver_construct'?.38:
   mineral&&profile.costume==='crystal_construct'?.18:0;
  // Low energy subsurface impression for undead skin, NEVER a luminous toy.
  if('emissive' in tinted)tinted.emissive.setHex(0x000000);
  if('emissiveIntensity' in tinted)tinted.emissiveIntensity=0;
 }
 if(role==='cloth'){
  tinted.roughness=Math.max(.79,tinted.roughness??.8);
 }
 tinted.userData={...tinted.userData,
  monsterCosplayPigment:true,pigmentRole:role,
  monsterId:profile.id,sourceModelId:profile.modelId};
 return tinted;
}
