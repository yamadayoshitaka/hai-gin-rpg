/**
 * Deterministic appearance descriptors for 1,000 soldiers.
 * 1 shared set of 3D GLBs + immutable per-character descriptors.
 * Not 1,000 concurrently loaded hero GLBs and not a claim of FF13 quality.
 */
const SKIN=[
 '#e6c4aa','#d8ad8b','#c99575','#b87e5c','#996248','#79513f',
 '#f0cfb5','#e1b68f','#c68a67','#ae7356','#8d5b44','#684632'
];
const EYES=['#4b7798','#3d6548','#6b4931','#758c95','#8a714b','#575a76','#292e35','#5b8e88'];
const HAIR=['#211d1d','#392a24','#583b2f','#76503b','#94684d','#332b34','#58353c','#a07d5b','#241e28','#564134'];
const CLOTH=['#283951','#344850','#513941','#3f3c4b','#514032','#3f594a','#2c385d','#4b333a','#444e5a','#4c435c'];
const METAL=['#adb9bf','#879ca7','#b5b4aa','#768893','#c3b5a1','#a5aaa3'];
const FACE_KEYS=['JawWidth','CheekVolume','NoseProjection','NoseWidth','MouthWidth','ChinLength','BrowArc'];
const IRIS_MARKER='#';
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
function hash32(n){
 let x=(n+0x9e3779b9)>>>0;
 x=Math.imul(x^(x>>>16),0x85ebca6b);x=Math.imul(x^(x>>>13),0xc2b2ae35);
 return (x^(x>>>16))>>>0;
}
function randomField(id,salt){return hash32((id+1)*97+salt*7919)/4294967296;}
function pick(arr,id,salt){return arr[Math.floor(randomField(id,salt)*arr.length)];}
const fixedHerotypes={
 0:{role:'hero-candidate',skin:'#dcb393',eye:'#4b7798',hair:'#4c3329',hairStyle:8,
  cloth:'#273d59',metal:'#aab8be',armorStyle:2,
  face:[.34,.45,.53,.19,.49,.37,.53]},
 1:{role:'veteran',skin:'#bc8764',eye:'#66523a',hair:'#342822',hairStyle:3,
  cloth:'#3f5247',metal:'#90979c',armorStyle:1,
  face:[.73,.61,.42,.53,.39,.63,.45]},
 2:{role:'agile',skin:'#e1ae8b',eye:'#56758a',hair:'#66372d',hairStyle:12,
  cloth:'#593b48',metal:'#8f9a9e',armorStyle:0,
  face:[.16,.29,.51,.14,.43,.23,.37]},
 3:{role:'classic-ally',skin:'#c89973',eye:'#5f513f',hair:'#4d392b',hairStyle:6,
  cloth:'#4b4c40',metal:'#8a9a99',armorStyle:1,
  face:[.45,.43,.33,.32,.31,.48,.39]}
};
/** Name/geometry/appearance are derived from integer id only. */
export function createSwordsmanAppearance(id){
 if(!Number.isSafeInteger(id)||id<0||id>999)
  throw new RangeError('Character ID must be an integer from 0 through 999');
 const featured=fixedHerotypes[id];
 const face=Object.fromEntries(FACE_KEYS.map((key,i)=>[
  key,Number((featured?featured.face[i]:clamp(.08+randomField(id,100+i)*.84,.05,.95)).toFixed(4))
 ]));
 // Use a reversible 4-digit body-mark combination as part of the visible
 // inventory styling, plus continuous facial morphs, so ID profiles cannot
 // accidentally alias across 1,000 soldiers.
 const uniformMark=String(id).padStart(4,'0');
 const style=id%7;
 const profile={
  id,displayCode:'剣士-'+uniformMark,role:featured?.role||'troop',
  face:Object.freeze(face),
  skin:featured?.skin||pick(SKIN,id,9),
  iris:featured?.eye||pick(EYES,id,12),
  hairColor:featured?.hair||pick(HAIR,id,14),
  hairStyle:featured?.hairStyle||1+(Math.floor(randomField(id,19)*14)),
  clothColor:featured?.cloth||pick(CLOTH,id,21),
  armorColor:featured?.metal||pick(METAL,id,23),
  armorStyle:featured?.armorStyle??style%4,
  shoulderSize:Number((.75+randomField(id,27)*.20).toFixed(3)),
  build:Number((.96+randomField(id,28)*.09).toFixed(3)),
  weaponStyle:Math.floor(randomField(id,29)*4),
  skinRoughness:Number((.48+randomField(id,30)*.14).toFixed(3)),
  rankMark:uniformMark,
  bodyProportionsShared:true, sourceAssetUnique:false,
  renderedAsIndividualMesh:false, // unit preview renders one actor at a time
  artGradeCertified:false
 };
 return Object.freeze(profile);
}
export function createSwordsmanRoster(count=1000){
 if(!Number.isInteger(count)||count<0||count>1000)throw new RangeError('Roster count 0..1000');
 return Array.from({length:count},(_,id)=>createSwordsmanAppearance(id));
}
export function validateAppearanceOverrides(appearance,overrides={}){
 const resolved={...appearance,face:{...appearance.face}};
 for(const key of ['skin','iris','hairColor','clothColor','armorColor']){
  const input=overrides[key];
  if(input!==undefined){
   if(typeof input!=='string'||!/^#[0-9a-fA-F]{6}$/.test(input))
    throw Error('Color must be 6-digit HEX: '+key);
   resolved[key]=input.toLowerCase();
  }
 }
 for(const k of FACE_KEYS){
  if(overrides.face?.[k]!==undefined){
   const v=Number(overrides.face[k]);
   if(!Number.isFinite(v)||v<0||v>1)throw Error('Face morph out of range: '+k);
   resolved.face[k]=Number(v.toFixed(4));
  }
 }
 for(const [key,min,max] of [['youthfulness',0,1],['faceWidth',.90,1.04],['eyeSize',.85,1.24]]){
  if(overrides[key]!==undefined){
   const value=Number(overrides[key]);
   if(!Number.isFinite(value)||value<min||value>max)
    throw Error('Facial proportion out of range: '+key);
   resolved[key]=Number(value.toFixed(4));
  }
 }
 if(overrides.hairStyle!==undefined){
  if(!Number.isInteger(overrides.hairStyle)||overrides.hairStyle<1||overrides.hairStyle>14)
   throw Error('Hair style must be 1–14');
  resolved.hairStyle=overrides.hairStyle;
 }
 if(overrides.shoulderSize!==undefined){
  const v=Number(overrides.shoulderSize);
  if(!Number.isFinite(v)||v<.5||v>1.3)throw Error('Shoulder size out of range');
  resolved.shoulderSize=v;
 }
 return Object.freeze({...resolved,face:Object.freeze(resolved.face)});
}
export const SWORDSMAN_FACE_KEYS=Object.freeze([...FACE_KEYS]);
export const SWORDSMAN_PALETTES=Object.freeze({
 skin:Object.freeze([...SKIN]),iris:Object.freeze([...EYES]),
 hair:Object.freeze([...HAIR]),cloth:Object.freeze([...CLOTH]),armor:Object.freeze([...METAL])
});
