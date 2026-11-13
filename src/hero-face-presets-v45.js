/** v45 complete-face choices. Hair, color, wig volume and user gear are
 * intentionally outside the face preset. Source GLB stays immutable. */
import {PART_CATALOG,normalizePartSelection} from './face-part-catalog-v32.js';

const definitions={
 female:[
  ['主人公・透明感',8,9,6,1,1],
  ['愛らしい童顔',1,6,4,7,5],
  ['凛々しい女騎士',4,8,7,9,8],
  ['優美な王女',5,1,1,6,4],
  ['クールな美女',7,4,5,5,6],
  ['華やかな剣姫',2,5,9,8,7],
  ['柔らかな美少女',0,0,0,3,2],
  ['大人びた女性',6,7,2,4,3],
  ['やさしい癒し顔',3,3,3,2,1],
  ['中性的な美顔',9,2,8,0,0]
 ],
 male:[
  ['主人公・美少年',0,9,1,1,0],
  ['王子・端正な顔',1,1,1,6,1],
  ['中性的な少年',2,6,4,7,5],
  ['凛々しい剣士',3,8,7,9,8],
  ['優しい青年',4,0,3,3,2],
  ['知的な軍師',6,7,5,5,3],
  ['爽やかな英雄',7,2,2,8,1],
  ['物静かな青年',5,4,6,0,0],
  ['素朴な少年',8,3,0,2,5],
  ['精悍な騎士',9,5,9,9,6]
 ]
};
export const HERO_FACE_PRESETS=Object.freeze(
 Object.fromEntries(Object.entries(definitions).map(([sex,rows])=>[
  sex,Object.freeze(rows.map(([label,face,eye,nose,mouth,makeup],i)=>
   Object.freeze({id:sex+'-face-'+String(i+1).padStart(2,'0'),
    label,face,eye,nose,mouth,makeup})))
 ]))
);
const fields=['face','eye','nose','mouth','makeup'];
export function chooseHeroFacePreset(gender,index,current={}){
 const preset=HERO_FACE_PRESETS[gender]?.[Number(index)];
 if(!preset)throw Error('Unknown complete face preset: '+gender+' / '+index);
 for(const key of fields)
  if(!PART_CATALOG[gender][key][preset[key]])
   throw Error('Missing real face part '+gender+':'+key+':'+preset[key]);
 // Complete-face presets define face geometry plus linked eye/nose/mouth
 // positions. Leave hairstyle + hair color exactly as selected.
 const raw={...current};
 for(const key of fields)raw[key]=preset[key];
 for(const key of ['eyeX','eyeY','eyeZ','eyeAngle',
  'noseX','noseY','noseZ','noseAngle',
  'mouthX','mouthY','mouthZ','mouthAngle'])raw[key]=0;
 return normalizePartSelection(raw);
}
export function matchHeroFacePreset(gender,current={}){
 const parts=normalizePartSelection(current);
 return HERO_FACE_PRESETS[gender]?.findIndex(p=>
  fields.every(key=>parts[key]===p[key]))??-1;
}
export function polishHeroFaceControls(gender,controls={}){
 if(gender==='female')return {
  ...controls,
  // Distinct authored eye shapes survive, but the v43 eye-in-lid realism
  // (iris inset, eyeliner clearance and curled lashes) never regresses.
  irisDiameter:Math.max(1.19,Number(controls.irisDiameter)||1.19),
  eyeDepth:Math.max(.045,Number(controls.eyeDepth)||0),
  lashCurl:Math.max(1.15,Number(controls.lashCurl)||0),
  lashLength:Math.max(1.55,Number(controls.lashLength)||0),
  lashDensity:Math.max(1.12,Number(controls.lashDensity)||0)
 };
 if(gender==='male')return {
  ...controls,eyeDepth:Math.max(.035,Number(controls.eyeDepth)||0),
  irisDiameter:Math.max(1.19,Number(controls.irisDiameter)||1.19),
  eyeHeight:Math.max(1.11,Number(controls.eyeHeight)||1),
  eyeWidth:Math.max(1.10,Number(controls.eyeWidth)||1)
 };
 throw Error('Unknown face gender '+gender);
}
/** Responsive ten-button palette; every button applies an actual 3D face. */
export function mountHeroFacePresetPicker(target,{gender,getParts,onPick}){
 if(!target||!HERO_FACE_PRESETS[gender])throw Error('Face selector target missing');
 target.classList.add('hero-face-preset-grid');
 target.replaceChildren();
 for(const [i,preset] of HERO_FACE_PRESETS[gender].entries()){
  const button=document.createElement('button');
  button.type='button';button.dataset.presetIndex=String(i);
  button.textContent=String(i+1).padStart(2,'0')+' '+preset.label;
  button.setAttribute('aria-label',preset.label+'の顔に変更');
  button.addEventListener('click',()=>onPick(i));
  target.append(button);
 }
 const refresh=(parts=getParts())=>{
  const selected=matchHeroFacePreset(gender,parts);
  for(const button of target.querySelectorAll('button[data-preset-index]')){
   const chosen=Number(button.dataset.presetIndex)===selected;
   button.setAttribute('aria-pressed',String(chosen));
  }
 };
 refresh();
 return {refresh};
}
