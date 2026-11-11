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
import {validateFaceProportions} from './master-swordsman-face-proportions.js';
import {createSwordsmanAppearance,SWORDSMAN_FACE_KEYS}
 from './master-swordsman-1000-appearance.js';

const definitions=[
 ['hero-01','美少年化改修中・外観未承認','hero',3,
  [.07,.16,.43,.08,.18,.14,.25],'#e7bca4','#4e80a7','#30242b','#263d5e','#bfc5ce',.91,1.085,.78],
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
  [.19,.22,.39,.17,.26,.22,.33],'#cfa085','#6e8251','#604039','#533c49','#919c9e',.95,1.08,.80],
 ['hero-girl-01','美少女01・ピンク髪の女騎士（顔・化粧調整中）','hero',2,
  [.20,.24,.29,.20,.21,.26,.27],'#edcbbf','#75a6ad','#d6a5ba','#393e53','#bdc5cb',.958,1.046,.70]
];
function buildPreset(row,i){
 const [key,label,category,hairStyle,faceVector,skin,iris,hairColor,clothColor,armorColor,
  faceWidth,eyeSize,shoulderSize]=row;
 const base=createSwordsmanAppearance(i);
 const female=key==='hero-girl-01';
 const face=Object.freeze(Object.fromEntries(
  SWORDSMAN_FACE_KEYS.map((name,j)=>[name,faceVector[j]])
 ));
 return Object.freeze({
  ...base,id:1000+i,key,displayCode:(category==='hero'?'主人公候補':'仲間候補')+
    '-'+String(1+(i%5)).padStart(2,'0'),
  category,role:key,label,face,skin,iris,hairStyle,hairColor,clothColor,armorColor,
  gender:female?'female':'male',headSource:female?'realistic-head-sculpt':'realistic-head-animation',
  referenceDesign:female?'original-rose-hair-fantasy-knight-20261110':null,
  visualDirection:female?'lightning-inspired-pink-side-sweep-almond-eyes-subtle-cosmetics':null,
  coiffureStyle:female?'fantasy-long-blonde':null, // Legacy runtime key; 100k rose-pink asymmetric wig
  proportions:female?validateFaceProportions({
    // FF13 Lightning as a *visual direction*, not borrowed Square Enix mesh
    // or copyrighted texture: slender natural nose, calm almond eyes and
    // focused expression, softer rose-pink skin, fine jaw with full cheeks.
    faceHeight:.954,upperThird:1.025,middleThird:.942,lowerThird:.951,
    jawTaper:.926,cheekRoundness:1.021,chinLength:.941,
    lowerFaceProjection:.87,
    preEarFullness:.70,lowerCheekLateral:.75,parotidWidth:.68,
    eyeWidth:1.067,eyeHeight:.970,eyeSpacing:1.008,
    eyeVertical:.002,eyeTilt:.036,
    // Single authoritative ocular parameters: iris != black pupil.
    // Eye size is the real sclera radius; depth is measured in metres.
    eyeballScale:.865,eyeSocketDepth:-.0042,
    irisDiameter:.80,pupilDiameter:.79,
    upperLidCoverage:.25,underEyeSoftness:.23,
    browVertical:.004,browEyeGap:1.008,
    browWidth:1.065,browThickness:.745,browAngle:.025,
    noseOverall:.815,noseLength:.907,noseWidth:.79,
    noseBridge:1.028,noseTip:.755,
    mouthWidth:.915,mouthHeight:.950,mouthVertical:.006,
    lipFullness:.865,mouthCorner:.007
   }):i===0?validateFaceProportions({
   faceHeight:.947,upperThird:1.07,middleThird:.86,lowerThird:.925,
   jawTaper:.85,chinLength:.87,eyeWidth:1.045,eyeHeight:1.045,
   eyeSpacing:.99,eyeVertical:-.004,browVertical:-.007,browEyeGap:.90,
   browWidth:1.03,browThickness:.83,noseLength:.86,noseWidth:.82,
   noseBridge:.98,noseTip:.82,mouthWidth:.86,
   mouthVertical:.008,lipFullness:.98,mouthCorner:.003
  }):category==='hero'?validateFaceProportions({
   faceHeight:.947,upperThird:1.07,middleThird:.855+(i%2)*.014,
   lowerThird:.915,jawTaper:.845+(i%3)*.013,chinLength:.87,
   eyeWidth:1.045,eyeHeight:1.035,eyeSpacing:1.0,
   browEyeGap:.91,browVertical:-.008,browThickness:.84,
   noseLength:.85,noseWidth:.80,noseTip:.84,
   mouthWidth:.87,lipFullness:1.015
  }):base.proportions,
  faceWidth,eyeSize:1+(eyeSize-1)*.70,shoulderSize,
  headScale:category==='hero'?(female?1.065:1.075):1,
  youthfulness:female?.69:category==='hero'?.97:.49+(i-5)*.035,
  skinRoughness:category==='hero'?(female?.55:i===0?.43:.47):.54,
  makeup:female?Object.freeze({
   strength:.83,blush:.68,lip:.57,eyeliner:.72,
   style:'light-natural-rose',eyeLiner:'defined upper lash',
   lips:'soft-rose',sourceFaceOnly:true
  }):null,
  armorStyle:female?0:category==='hero'?(i===0?1:i%3):1+(i%3),
  build:female?.955:category==='hero'?(i===0?.955:.965+i*.007):.975+(i-5)*.008,
  importance:'authored-featured-profile',sourceAssetUnique:false,
  visualGenderIdentity:female?'girl':'boy',
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
