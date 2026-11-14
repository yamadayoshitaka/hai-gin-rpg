/**
 * Species-specific source-blended detail recipe for existing summoned dragons.
 * Source A is always the currently animated wyvern/dragon/elder dragon model.
 * Source B is an original bestiary anatomy reference, NOT another skinned rig.
 * Geometry is derived on source A's local bone batches to avoid seams,
 * floating parts, and GPU performance explosions in 1000v1000 battles.
 */
import {MONSTER_BY_ID} from './monster-catalog.js';

export const DRAGON_SOURCE_HYBRIDS=Object.freeze({
 wyvern:Object.freeze({donor:'m017',weight:.22,motif:'basilisk-scale-gorget'}),
 dragon:Object.freeze({donor:'m018',weight:.26,motif:'hydra-neck-fins'}),
 elder_dragon:Object.freeze({donor:'m020',weight:.18,motif:'leviathan-fin-crown'})
});
const clamp01=x=>Math.min(1,Math.max(0,Number.isFinite(x)?x:0));
const interp=(a,b,t)=>a+(b-a)*t;
const mixHex=(base,donor,t)=>{
 const c=i=>Math.round(interp((base>>>i)&255,(donor>>>i)&255,t));
 return c(16)*65536+c(8)*256+c(0);
};
export function blendSummonDragonBlueprint(type,base){
 const recipe=DRAGON_SOURCE_HYBRIDS[type];
 if(!recipe)throw Error('Unknown hybrid source: '+type);
 if(!['wyvern','dragon'].includes(base?.anatomy))
  throw Error('Draconic mix requires an original dragon/wyvern source');
 const donor=MONSTER_BY_ID[recipe.donor];
 if(!donor||donor.family!=='reptile')
  throw Error('Source must be existing reptile bestiary model');
 const t=clamp01(recipe.weight);
 return Object.freeze({
  ...base,
  width:interp(base.width,base.width*(1+.09*t),t),
  length:interp(base.length,base.length*(1+.12*t),t),
  tail:interp(base.tail,base.tail*(1+.06*t),t),
  highlight:mixHex(base.highlight,parseInt(donor.colors.highlight.slice(1),16),t*.30),
  hybrid:Object.freeze({
   sourceId:donor.id,weight:t,motif:recipe.motif,
   originalWingRig:true,originalLegRig:true,originalTailRig:true
  })
 });
}
/**
 * Reuse the sculpting primitives already assigned to animated body parts.
 * High LOD only; 3–5 raised plates per side, never hundreds of detached
 * nodes or a foreign mesh with a different skeleton.
 */
export function addSourceDragonRelief(g,type,s,detail='high'){
 const recipe=DRAGON_SOURCE_HYBRIDS[type];
 if(!recipe||detail!=='high')return false;
 const {width:w,height:h,length:l,skin,shadow,highlight}=s;
 const donor=MONSTER_BY_ID[recipe.donor];
 const accent=parseInt(donor.colors.accent.slice(1),16);
 for(const side of [-1,1]){
  if(type==='wyvern'){
   // Basilisk armour: small rooted plates fitted along BOTH cheeks and the
   // upper wing shoulder, rather than a generic human breastplate.
   for(let i=0;i<3;i++){
    const z=l*(.50-i*.24),x=side*w*(.70+i*.025);
    g.scute('core',i===0?accent:highlight,[x,h+.17-i*.035,z],
      [side*.86,.39,.10],w*.105,l*.13,w*.028);
   }
  }else if(type==='dragon'){
   // Hydra inspiration: layered lateral neck fins, without adding a second
   // head or disrupting the original biting-jaw hinge.
   for(let i=0;i<4;i++){
    const z=l*(.55+i*.20),x=side*w*(.52-i*.035);
    g.horn('core',i%3===0?accent:shadow,
      [x,h+.25+i*.095,z],
      [x+side*w*.17,h+.40+i*.125,z-.09],w*.062);
   }
  }else{
   // Leviathan inspiration: narrow luminous scales on the elder crown.
   // These belong to the CORE so pitch / flight remains skeleton-safe.
   for(let i=0;i<3;i++){
    const z=l*(.23+i*.30),x=side*w*(.40+i*.035);
    g.scute('core',i%2===0?accent:highlight,
      [x,h+.30+i*.07,z],[side*.59,.79,.18],
      w*.086,l*.105,w*.025);
   }
  }
 }
 return true;
}
