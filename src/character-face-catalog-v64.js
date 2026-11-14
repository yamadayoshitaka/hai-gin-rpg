/** v64 canonical face / hairstyle / expression / character management catalog.
 * All existing face IDs, canon character references and saved presets remain
 * untouched. This read model never invents a rendered thumbnail. */
import {HERO_FACE_PRESETS} from './hero-face-presets-v45.js';
import {PART_CATALOG} from './face-part-catalog-v32.js';
import {listWigStyles,WIG_SILHOUETTE_PROFILES} from './face-wig-styles.js';
import {FACE_EXPRESSIONS} from './face-expression-animation-v48.js';
import {CHARACTER_CAST_V46} from './character-cast-v46.js';

const FEMALE_TAGS=Object.freeze(['主人公','童顔','騎士','王族','クール','剣姫',
 '可愛い','大人','癒し','中性','可憐','女王','戦乙女','魔導士','姉御','妖精']);
const MALE_TAGS=Object.freeze(['主人公','王子','中性','剣士','優しい','軍師',
 '爽やか','静か','素朴','騎士','清楚','憂い','快活','魔導士','吟遊詩人','貴公子']);
export const FACE_CATALOG_V64=Object.freeze(
 Object.fromEntries(['female','male'].map(gender=>[gender,Object.freeze(
  HERO_FACE_PRESETS[gender].map((preset,index)=>{
   const use=CHARACTER_CAST_V46.filter(c=>c.gender===gender&&c.facePreset===index);
   const parts=Object.fromEntries(['face','eye','nose','mouth','makeup'].map(part=>
    [part,PART_CATALOG[gender][part][preset[part]]?.label||'未定義']));
   return Object.freeze({id:preset.id,index,gender,name:preset.label,
    tag:(gender==='female'?FEMALE_TAGS:MALE_TAGS)[index]||'その他',
    parts:Object.freeze(parts),characters:Object.freeze(use.map(c=>c.id)),
    canonical:true,facePresetIndex:index});
  })
 )])));
export const HAIR_CATALOG_V64=Object.freeze(
 Object.fromEntries(['female','male'].map(gender=>[gender,Object.freeze(
  listWigStyles(gender).map(row=>Object.freeze({
   id:row.id,label:row.label,gender,
   silhouetteDefined:!!WIG_SILHOUETTE_PROFILES[row.id],
   part:row.part,cut:row.cut,
   uses:CHARACTER_CAST_V46.filter(c=>c.gender===gender&&c.hairStyleId===row.id)
    .map(c=>c.id)
  }))
 )])));
export const EXPRESSION_CATALOG_V64=Object.freeze(
 Object.entries(FACE_EXPRESSIONS).map(([id,x])=>Object.freeze({
  id,label:x.label,parameterSignature:
   [x.brow,x.tilt,x.squint,x.smile,x.open,x.cheek].join(','),
  features:Object.freeze({brow:x.brow,tilt:x.tilt,squint:x.squint,
   smile:x.smile,open:x.open,cheek:x.cheek})
 })));
export const CHARACTER_CATALOG_V64=Object.freeze(
 CHARACTER_CAST_V46.map(c=>Object.freeze({
  id:c.id,name:c.label,gender:c.gender,ageBand:c.ageBand,
  bodyType:c.bodyType,faceTypeId:HERO_FACE_PRESETS[c.gender][c.facePreset]?.id||null,
  faceIndex:c.facePreset,hairStyleId:c.hairStyleId,hairColor:c.hairColor,
  wardrobe:c.wardrobe,status:c.status,artReference:c.artReference||null
 })));
export function catalogValidationV64(){
 const issues=[];
 for(const gender of ['female','male']){
  const faces=FACE_CATALOG_V64[gender],hair=HAIR_CATALOG_V64[gender];
  const faceIds=new Set(faces.map(x=>x.id));
  if(faceIds.size!==faces.length)issues.push(gender+' duplicate-face');
  for(const entry of faces)
   if(Object.values(entry.parts).some(x=>x==='未定義'))
    issues.push(entry.id+' unbound-face-part');
  for(const entry of hair)if(!entry.silhouetteDefined)
   issues.push(entry.id+' missing-3d-hair-silhouette');
  for(const c of CHARACTER_CATALOG_V64.filter(x=>x.gender===gender)){
   if(!faceIds.has(c.faceTypeId))issues.push(c.id+' face-not-found');
   if(!hair.some(x=>x.id===c.hairStyleId))issues.push(c.id+' hair-not-found');
  }
 }
 if(new Set(EXPRESSION_CATALOG_V64.map(x=>x.parameterSignature)).size!==
  EXPRESSION_CATALOG_V64.length)issues.push('duplicate-expression-geometry');
 return issues;
}
export function resolveCatalogFaceV64(gender,id){
 return FACE_CATALOG_V64[gender]?.find(entry=>entry.id===id)||null;
}
export function catalogStudioUrlV64({gender='female',faceIndex=null,
 hairStyleId='',expression='neutral',view='front',characterId=''}={}){
 const params=new URLSearchParams({gender,view});
 if(Number.isInteger(faceIndex)&&faceIndex>=0)params.set('facePreset',String(faceIndex));
 if(hairStyleId)params.set('hair',hairStyleId);
 if(FACE_EXPRESSIONS[expression])params.set('expression',expression);
 if(characterId)params.set('character',characterId);
 return 'face-mesh-studio.html?'+params.toString();
}
