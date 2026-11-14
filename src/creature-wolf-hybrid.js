/**
 * Single-source-of-truth morphological blend for the summoned grey wolf.
 * Keep the fast, fully articulated summon geometry and its real fur/photo
 * material. Borrow the independent bestiary wolf king (m001) ANATOMY and
 * coat palette by interpolating blueprint proportions before building LODs.
 *
 * The two source meshes have incompatible topology and bone rigs: vertex
 * mixing would create detached paws/jaws. A weighted source blueprint blend
 * preserves coherent head, jaw, all four legs, and animated tail parts.
 */
import {MONSTER_BY_ID} from './monster-catalog.js';

export const SUMMON_WOLF_HYBRID=Object.freeze({
 primary:'combat-summon-wolf',secondary:'m001',weight:.42,
 sourceDimensions:Object.freeze({
  // The existing m001 quadruped constructor builds a .43m half-width
  // torso at Y=1.30 and +/-0.72 length. Normalize these proportions to
  // the summoned wolf's target coordinate frame before interpolation.
  width:.43,height:.85,length:.72,legs:.68,tail:1.10
 }),
 features:Object.freeze([
  'wolf-king-cranium','longer-bridge','shoulder-ruff',
  'cheek-tufts','paw-coat','continuous-animated-neck'
 ])
});
const blend=(a,b,t)=>a+(b-a)*t;
const blendColor=(a,b,t)=>{
 const channel=shift=>Math.round(blend((a>>shift)&255,(b>>shift)&255,t));
 return channel(16)*0x10000+channel(8)*0x100+channel(0);
};
export function blendSummonedWolfBlueprint(current,weight=SUMMON_WOLF_HYBRID.weight){
 if(!current||current.anatomy!=='quadruped')
  throw Error('Wolf source blend requires a quadruped summon blueprint');
 const t=Math.max(0,Math.min(1,Number.isFinite(weight)?weight:0));
 const donor=MONSTER_BY_ID[SUMMON_WOLF_HYBRID.secondary];
 if(!donor||donor.family!=='beast')throw Error('Missing canine bestiary source m001');
 const d=SUMMON_WOLF_HYBRID.sourceDimensions;
 const donorPrimary=parseInt(donor.colors.base.slice(1),16);
 const donorHighlight=parseInt(donor.colors.highlight.slice(1),16);
 // At 0 the exact existing summon survives; at 1 the scaled m001
 // reference drives proportions. Keep current eyes/photographic normals.
 return Object.freeze({
  ...current,width:blend(current.width,d.width,t),
  height:blend(current.height,d.height,t),
  length:blend(current.length,d.length,t),
  legs:blend(current.legs,d.legs,t),
  tail:blend(current.tail,d.tail,t),
  skin:blendColor(current.skin,donorPrimary,t*.45),
  highlight:blendColor(current.highlight,donorHighlight,t*.45),
  hybrid:Object.freeze({sourceId:donor.id,weight:t,
   keepsOriginalRig:true,sourceAnatomy:'bestiary-wolf-king'})
 });
}
