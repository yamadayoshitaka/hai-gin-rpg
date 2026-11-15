/**
 * Nonhuman bestiary: wolf-first species identity and manually authored
 * secondary animation. No additional meshes, draw calls or physics.
 * Applies only to the existing articulated procedural rig; external GLB
 * animation remains owned by its source mixer.
 */
import {MONSTER_CATALOG} from './monster-catalog.js';
import {HUMAN_MONSTER_IDS} from './monster-character-cosplay-manifest.js';

export const NONHUMAN_SPECIES_ANIMATION=Object.freeze(Object.fromEntries(
 MONSTER_CATALOG.filter(m=>!HUMAN_MONSTER_IDS.includes(m.id)).map(m=>{
  const family=m.family;
  const locomotion=family==='avian'?'flight':
   family==='aquatic'?'swim':
   family==='insect'?'tripod':
   family==='arachnid'?'octopod':
   family==='reptile'?'reptilian':
   family==='feline'?'feline':'canine';
  const amplitude=family==='avian'?.16:
   family==='aquatic'?.12:family==='arachnid'?.085:.065;
  const frequency=family==='avian'?3.8:
   family==='aquatic'?2.4:family==='insect'?4.1:2.7;
  const seed=Number(m.id.slice(1));
  return [m.id,Object.freeze({
   sourceModel:family==='beast'?'r-wolf-anatomy-reference':
    family==='feline'?'real-feline-anatomy-reference':
    'species-specific-anatomy-reference',
   locomotion,element:m.element,rarity:m.rarity,
   // Species-specific offsets prevent all monsters moving in lockstep.
   phaseOffset:(seed*0.61803398875)%(Math.PI*2),
   breathAmplitude:amplitude,breathFrequency:frequency,
   tailAmplitude:family==='aquatic'?.21:family==='feline'?.13:.085,
   strikeAmplitude:m.rarity==='UR'?.22:.13,
   visualFeatures:Object.freeze([
    m.element+'-element',family+'-anatomy',
    'variant-'+m.variant,'skill-'+m.skill
   ])
  })];
 })
));
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
/** Bounded secondary pose on actual existing joint groups.
 * Never touch the root transform, scale, or any source GLB bones.
 * Idempotent per timestamp (repeated render passes cannot accumulate pose).
 */
export function animateNonhumanSpeciesDetails(model,time,action='idle',pulse=0){
 const id=model?.userData?.speciesId;
 const profile=NONHUMAN_SPECIES_ANIMATION[id];
 if(!profile||id==='m005'||id==='m006')return false;
 const p=model.userData.pivots;
 if(!p)return false;
 const t=Number.isFinite(time)?time:0;
 const phase=t*profile.breathFrequency+profile.phaseOffset;
 const motion=action==='defeat'?0:action==='run'?.5:1;
 const breath=motion*profile.breathAmplitude*Math.sin(phase);
 const strike=clamp(pulse,0,1)*profile.strikeAmplitude;
 // Secondary joints are independent from the main action's primary limbs.
 if(p.tailTip){
  p.tailTip.rotation.y+=breath*profile.tailAmplitude*4;
  if(action==='attack'||action==='special')
   p.tailTip.rotation.x+=strike*.45;
 }
 if(p.tailMid)p.tailMid.rotation.y+=breath*profile.tailAmplitude*2;
 if(p.neckCollar)p.neckCollar.rotation.x+=breath*.28-strike*.12;
 if(p.spineRear&&profile.locomotion==='swim')
  p.spineRear.rotation.y+=breath*.65;
 if(p.abdomen&&['tripod','octopod'].includes(profile.locomotion))
  p.abdomen.rotation.z+=breath*.20;
 for(const side of ['L','R']){
  const wing=p['wingWrist'+side];
  if(wing&&profile.locomotion==='flight')
   wing.rotation.x+=breath*(side==='L'?1:-1)*.5;
 }
 model.userData.nonhumanAnimationProfile=id;
 return true;
}
