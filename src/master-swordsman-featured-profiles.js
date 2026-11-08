/**
 * Static authored face designs for the TEN important characters.
 *
 * Not interchangeable with the 1000 soldiers: a named protagonist's identity
 * stays fixed and never depends on soldier ID. Values actually drive original
 * Blender Studio head morph targets, visible eye geometry and hair GLBs.
 *
 * Artistic caveat: these are visually distinct candidate previews, NOT ten
 * independently sculpted FF13-class faces or finished facial animation rigs.
 */
import {createSwordsmanAppearance,SWORDSMAN_FACE_KEYS}
 from './master-swordsman-1000-appearance.js';

const definitions=[
 ['hero-01','王道美少年','hero',3,
  [.12,.20,.35,.12,.20,.17,.22],'#dfb598','#4d7596','#322720','#293f5b','#b4bbc0',.94,1.16,.82],
 ['hero-02','クール系美少年','hero',9,
  [.18,.15,.55,.10,.17,.26,.38],'#d4a68c','#537482','#241f26','#2f394f','#a8b6bf',.93,1.12,.78],
 ['hero-03','中性的な少年剣士','hero',6,
  [.08,.16,.25,.08,.13,.12,.17],'#e6bea8','#708f91','#594037','#4b405a','#c1b7aa',.93,1.19,.72],
 ['hero-04','熱血系イケメン','hero',11,
  [.29,.27,.39,.22,.31,.32,.28],'#d8a07d','#735939','#6c352b','#623c3b','#a2a9ad',.97,1.10,.91],
 ['hero-05','王子・貴族系','hero',4,
  [.12,.19,.48,.10,.16,.18,.32],'#e0bca6','#60769a','#4b3d33','#333f63','#c8c1af',.94,1.13,.74],
 ['ally-01','親友剣士','ally',12,
  [.30,.34,.37,.24,.30,.31,.24],'#d0a281','#4a775f','#48372e','#364b53','#9aa6a9',.98,1.04,.92],
 ['ally-02','寡黙な剣士','ally',1,
  [.40,.24,.48,.32,.24,.44,.38],'#ba8c71','#665444','#252121','#3e424d','#839299',.99,1.01,.99],
 ['ally-03','若手騎士','ally',5,
  [.22,.28,.34,.18,.25,.24,.19],'#dfb497','#647c97','#72513c','#3b5462','#b4b3a4',.97,1.09,.86],
 ['ally-04','ベテラン美形','ally',10,
  [.48,.39,.42,.34,.38,.53,.42],'#c59573','#526f73','#332c26','#3f5145','#8d9ba4',1.00,1.00,1.02],
 ['ally-05','軽装の俊敏剣士','ally',7,
  [.19,.22,.39,.17,.26,.22,.33],'#cfa085','#6e8251','#604039','#533c49','#919c9e',.95,1.08,.80]
];
function buildPreset(row,i){
 const [key,label,category,hairStyle,faceVector,skin,iris,hairColor,clothColor,armorColor,
  faceWidth,eyeSize,shoulderSize]=row;
 const base=createSwordsmanAppearance(i);
 const face=Object.freeze(Object.fromEntries(
  SWORDSMAN_FACE_KEYS.map((name,j)=>[name,faceVector[j]])
 ));
 return Object.freeze({
  ...base,id:1000+i,key,displayCode:(category==='hero'?'主人公候補':'仲間候補')+
    '-'+String(1+(i%5)).padStart(2,'0'),
  category,role:key,label,face,skin,iris,hairStyle,hairColor,clothColor,armorColor,
  faceWidth,eyeSize,shoulderSize,
  youthfulness:category==='hero'?.88-i*.022:.49+(i-5)*.035,
  skinRoughness:category==='hero'?.47:.54,
  armorStyle:category==='hero'?i%3:1+(i%3),
  build:category==='hero'? .965+i*.007:.975+(i-5)*.008,
  importance:'authored-featured-profile',sourceAssetUnique:false,
  facialArtistApproval:false,artGradeCertified:false
 });
}
export const FEATURED_SWORDSMEN=Object.freeze(
 definitions.map((r,i)=>buildPreset(r,i))
);
export function featuredSwordsmanProfile(key){
 const found=FEATURED_SWORDSMEN.find(p=>p.key===key);
 if(!found)throw new Error('Unknown featured character '+String(key));
 return found;
}
