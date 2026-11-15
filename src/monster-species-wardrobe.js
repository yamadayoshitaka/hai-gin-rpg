/**
 * Species-faithful cosplay overlays for the non-human bestiary.
 *
 * An existing wolf, cat, beetle, spider, bird, reptile or marine model remains
 * the anatomical base: no humanoid replacement, duplicate mannequin or rig.
 * Outfit anchors inherit motion from the existing body/limb pivot.
 * The original four boss regalia are preserved rather than doubled.
 */
import {MONSTER_CATALOG} from './monster-catalog.js';

const HUMANOIDS=new Set(['m015',...Array.from({length:15},(_,i)=>'m'+String(i+31).padStart(3,'0'))]);
const ARCHETYPES=Object.freeze({
 beast:Object.freeze({type:'wolf-harness',w:.42,y:1.40,z:.00,depth:.34}),
 feline:Object.freeze({type:'feline-harness',w:.43,y:1.40,z:.00,depth:.34}),
 avian:Object.freeze({type:'avian-breast-guard',w:.32,y:1.48,z:.09,depth:.24}),
 reptile:Object.freeze({type:'scaled-reptile-guard',w:.42,y:1.40,z:.00,depth:.32}),
 insect:Object.freeze({type:'beetle-carapace-regalia',w:.48,y:1.45,z:-.25,depth:.26}),
 arachnid:Object.freeze({type:'spider-silk-saddle',w:.47,y:1.44,z:-.25,depth:.27}),
 aquatic:Object.freeze({type:'marine-mantle',w:.44,y:1.40,z:.00,depth:.30}),
});
const LEGACY_BOSSES=new Set(['m008','m012','m017','m050']);
/** Match real coat, keratin and marine surfaces; do not wrap wolves or
 * spider abdomens in the same bright metal cuirass used by beetles. */
const outfitMaterialFor=spec=>{
 if(spec.family==='beast'||spec.family==='feline'||spec.family==='avian')
  return 'leather';
 if(spec.family==='arachnid')return 'fabric';
 if(spec.family==='aquatic')
  return ['m020','m048'].includes(spec.id)?'metal':'fabric';
 return 'metal'; // insects and scaled reptiles can support a fitted carapace
};
const normalizedBody=spec=>{
 const base=ARCHETYPES[spec.family];
 if(spec.id==='m020'||spec.id==='m048')
  return {...base,type:'serpent-collar',w:.34,y:1.04,z:.34,depth:.32};
 if(spec.id==='m046')
  return {...base,type:'slime-crest',w:.47,y:.81,z:.05,depth:.27};
 if(spec.id==='m047'||spec.id==='m049')
  return {...base,type:'octopod-mantle',w:.43,y:1.50,z:.00,depth:.24};
 return base;
};
export const SPECIES_COSPLAY_WARDROBE=Object.freeze(Object.fromEntries(
 MONSTER_CATALOG.filter(s=>!HUMANOIDS.has(s.id)).map(spec=>{
  const base=normalizedBody(spec);
  return [spec.id,Object.freeze({
   id:spec.id,baseFamily:spec.family,source:'native-species-anatomy',
   type:base.type,rarity:spec.rarity,element:spec.element,
   style:spec.rarity==='UR'?'royal':spec.rarity==='SR'?'ceremonial':
     spec.rarity==='R'?'armoured':'traveller',
   role:outfitMaterialFor(spec),
   w:base.w,y:base.y,z:base.z,depth:base.depth,
   legacy:LEGACY_BOSSES.has(spec.id),
  })];
 })
));
export const SPECIES_COSPLAY_IDS=Object.freeze(Object.keys(SPECIES_COSPLAY_WARDROBE));

/** Dress the native species, never a human stand-in. All pieces are parented
 * to anatomical pivots; low LOD uses only three extra inexpensive meshes. */
export function addSpeciesCosplayWardrobe(g,spec){
 const profile=SPECIES_COSPLAY_WARDROBE[spec?.id];
 if(!profile)return false;
 const torso=g.pivots.torso;
 if(!torso)throw Error('Species costume missing original torso pivot: '+spec.id);
 if(profile.legacy){
  if(!g.root.userData.nonhumanOutfit)
   throw Error('Existing boss regalia missing before species wardrobe: '+spec.id);
  g.root.userData.speciesCosplay={
   ...profile,applied:'existing-boss-regalia',anchor:'torso'
  };
  return true;
 }
 const hi=g.root.userData.detail!=='low';
 const name='monster-outfit-'+spec.id+'-'+profile.type;
 const w=profile.w,y=profile.y,z=profile.z,depth=profile.depth;
 const metal=profile.role==='metal',body=profile.role;
 const add=(parent,role,label,position,scale)=>{
  const piece=g.sphere(parent,role,position,scale,{
   name:name+'-'+label,metal:role==='metal'?.63:.04,
   rough:role==='metal'?.49:.83
  });
  piece.userData.costumeAnchor=parent.name;
  piece.userData.costumeSpeciesId=spec.id;
  return piece;
 };
 // Fitted side plates sit against the anatomical chest or carapace.
 // Do not obscure the head, wings, claws, jaws, stingers or mouth.
 for(const side of [-1,1]){
  const sign=side<0?'L':'R';
  add(torso,body,'side-'+sign,[side*w,y,z],
   [.065,.128,depth*.58]);
  if(hi){
   add(torso,'accent','trim-'+sign,
    [side*(w+.030),y+.055,z+.045],
    [.026,.040,depth*.30]);
   const points=[
    [side*w*.62,y+.15,z+depth*.65],
    [side*w*.91,y+.19,z+.025],
    [side*w*.89,y+.18,z-depth*.70],
   ];
   const strap=g.tube(torso,'leather',points,.018);
   strap.name=name+'-strap-'+sign;
   strap.userData.costumeSpeciesId=spec.id;
   strap.userData.costumeAnchor=torso.name;
  }
 }
 // Central clasp or crest, embedded in the shell; not a floating badge.
 add(torso,'accent','chest-clasp',[0,y+.115,z+depth*.86],
  [.090,.065,.030]);
 if(hi){
  add(torso,metal?'metal':'fabric','back-panel',
   [0,y+.22,z-depth*.38],[w*.49,.052,depth*.68]);
  // Upper limb cuffs follow limb rotation instead of staying on torso.
  const family=spec.family;
  // Spider abdomen is a separate animated joint, not the thorax. The
  // cloth saddle must travel with abdomen motion instead of floating at
  // the original torso position; leave spinnerets and legs uncovered.
  if(family==='arachnid'&&g.pivots.abdomen){
   add(g.pivots.abdomen,'fabric','abdomen-saddle',
    [0,.475,-.25],[.35,.047,.31]);
  }
  // Beetle carapace has an upper shell. Make its costume visibly beetle-
  // specific instead of using the canine chest harness geometry alone.
  if(family==='insect'){
   add(torso,'metal','elytra-crown',[0,1.59,-.34],
    [.245,.043,.24]);
  }
  // For wolves/dogs, position a soft collar at the anatomical nape.
  // This remains on the torso/neck pivot, clear of muzzle and paws.
  if(family==='beast'){
   add(torso,'leather','nape-collar',[0,1.565,.52],
    [.235,.050,.09]);
  }
  let joints=[];
  if(['beast','feline','reptile'].includes(family)&&
      !['m020','m048'].includes(spec.id)){
   joints=['legfrontL','legfrontR'];
  }else if(family==='avian'){
   joints=['wingL','wingR'];
  }else if(family==='insect'||family==='arachnid'){
   joints=['legL0','legR0'];
  }
  for(const key of joints){
   const joint=g.pivots[key];
   if(!joint)throw Error('Species costume missing animated limb pivot: '+spec.id+' '+key);
   const side=key.includes('L')?-1:1;
   const isWing=family==='avian';
   // Keep flight feathers and the wing hinge exposed: the old bulky cuff
   // covered the root feathers during flapping and silhouette inspection.
   const scale=isWing?[.075,.043,.068]:
     family==='insect'||family==='arachnid'?[.12,.055,.11]:
       [.19,.058,.18];
   add(joint,body,'joint-'+key,
    isWing?[side*.015,0,0]:[0,.12,0],scale);
  }
 }
 g.root.userData.nonhumanOutfit=profile.type+'-'+profile.style;
 g.root.userData.speciesCosplay={
  ...profile,applied:'species-fitted',anchor:'torso',detail:hi?'high':'low',
 };
 return true;
}
