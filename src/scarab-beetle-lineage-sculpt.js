/**
 * Beetle lineage derived from the owner's m024 scarab sculpt.
 *
 * This is actual donor-mesh reuse: the 3D m024 sculptor builds the same
 * articulated thorax, elytra, compound eyes, six legs and four veined wings
 * for each beetle. Only species identity, keratin/crest anatomy and pigment
 * are changed here. Mantis (m023) and all eight-legged spiders are excluded.
 */
import * as THREE from 'three';
import {sculptM024PoisonScarab} from './m024-poison-scarab-sculpt.js?v=beetle-four-reference-sculpt-v1-20261121';
import {sculptBeetleConceptDetails,BEETLE_CONCEPT_REVISION}
 from './beetle-concept-upgrade.js?v=beetle-four-reference-sculpt-v1-20261121';

export const BEETLE_DONOR_ID='m024';
export const BEETLE_LINEAGE_REVISION='beetle-four-reference-sculpt-v1-20261121';

const BEETLE_VARIANTS=Object.freeze({
 m021:Object.freeze({theme:'iron',wingScale:.62,mandible:.73}),
 m022:Object.freeze({theme:'fire',wingScale:.84,mandible:.85}),
 m025:Object.freeze({theme:'divine',wingScale:1.12,mandible:.78}),
});
export const BEETLE_LINEAGE_IDS=Object.freeze(Object.keys(BEETLE_VARIANTS));
export const isBeetleLineage=id=>Object.hasOwn(BEETLE_VARIANTS,id);

function shadeFor(spec,source,surface){
 // The user-approved four-species reference keeps the same anatomy, but
 // steel gray, burgundy lacquer, gold-on-red, and poison violet have
 // intentionally different body and wing pigments.
 if(surface==='wing'){
  return {m021:'#bb835b',m022:'#ec914b',m025:'#f9d36f'}[spec.id]||source;
 }
 // Some donor meshes use semantic color names instead of literal hex.
 // Supply the receiving species' 2D-reference pigment to both kinds of
 // mesh, otherwise inherited m021 "skin" would stay olive green beneath
 // its steel armor and the m025 underbody would stay mustard yellow.
 const semantic={
  m021:{skin:'#643642',light:'#8b8e96',accent:'#bf9b79'},
  m022:{skin:'#772836',light:'#af3b47',accent:'#f0a057'},
  m025:{skin:'#853045',light:'#d5b769',accent:'#f3de93'}
 }[spec.id];
 if(typeof source==='string'&&semantic?.[source])return semantic[source];
 if(typeof source!=='string'||!source.startsWith('#'))return source;
 const original=new THREE.Color(source);
 const hsl={};original.getHSL(hsl);
 const ink={
  m021:{base:'#4e4e57',highlight:'#95939b',accent:'#bfae99'},
  m022:{base:'#762333',highlight:'#ba4146',accent:'#efa45a'},
  m025:{base:'#833044',highlight:'#bc6471',accent:'#f2d27a'}
 }[spec.id];
 const secondary=new THREE.Color(ink?.highlight||spec.colors.highlight);
 const primary=new THREE.Color(ink?.base||spec.colors.base);
 const accent=new THREE.Color(ink?.accent||spec.colors.accent);
 if(surface==='enamel')return source; // white talons stay ivory
 if(surface==='eye')return spec.id==='m025'?'#495061':'#1b181d';
 // Variation within one material family comes from the original donor's
 // brightness; all colored elements follow the receiving species palette.
 const luminous=THREE.MathUtils.clamp((hsl.l-.12)*1.32,0,1);
 let destination;
 if(surface==='crystal'||(hsl.h>.17&&hsl.h<.42&&hsl.s>.15)){
  destination=accent.clone().lerp(secondary,.16+luminous*.18);
 }else if(surface==='wing'){
  destination=secondary.clone().lerp(accent,.16+luminous*.22);
 }else{
  destination=primary.clone().lerp(secondary,luminous*.85);
 }
 // Dark gaps still read as a separation between interlocking chitin plates.
 if(hsl.l<.24&&surface!=='crystal')destination.multiplyScalar(.75);
 return '#'+destination.getHexString();
}

function sculptBeetleSpeciesDetails(g,spec,profile){
 const head=g.pivots.head,torso=g.pivots.torso,jaw=g.pivots.jaw;
 if(!head||!torso||!jaw)throw Error('Missing donor beetle articulation for '+spec.id);
 const low=g.root.userData.detail==='low';
 const s=side=>side<0?'L':'R';
 const palette=spec.colors;
 const horn=(parent,name,root,bend,tip,radius,{
  shade=palette.highlight,surface='chitin',finish=null,heroKeratin=false
 }={})=>g.curvedHorn(parent,shade,root,bend,tip,radius,{
  name:spec.id+'-'+name,capRoot:true,surface,finish,heroKeratin,
 });
 // No poisonous tusks/saliva on these three beetles. Each has a short,
 // articulated mandible pair inside the donor's original head+jaw joint.
 for(const side of [-1,1]){
  const v=(x,y,z)=>[x*side,y,z];
  horn(jaw,'mandible-'+s(side),v(.135,-.02,.18),
   v(.20,-.075,.31),v(.22,-.19,.46),.063*profile.mandible,{
    shade:'#e9ddc0',surface:'enamel',
   });
 }
 if(spec.id==='m021'){
  // A single central horn: no side horns from either temple.
  // Its root starts inside the frontal head shell and rises forwards.
  horn(head,'iron-charge-horn',[0,.16,.23],[0,.62,.43],
   [0,1.23,.48],.205,{shade:'#89503d',
    finish:'ironHorn',heroKeratin:true});
  for(const side of [-1,1]){
   const v=(x,y,z)=>[x*side,y,z];
   horn(head,'iron-horn-tip-'+s(side),[0,1.02,.46],
    v(.09,1.19,.49),v(.24,1.39,.51),.072,{
     shade:'#89503d',finish:'ironHorn',heroKeratin:true
    });
  }
 }else if(spec.id==='m022'){
  // Japanese rhinoceros beetle silhouette: ONE horn rooted on the
  // midline of the forehead. A thick forward-curving stem rises into a
  // small fork only at the tip; these branches are NOT independent horns.
  // Embed the two fork roots in the upper central stem to keep them
  // visually continuous from every camera angle.
  // Same carapace tint and atlas as the glossy elytra. A continuous
  // high-density cuticle stem avoids the old segmented matte cone.
  const polishedHornTint='#'+new THREE.Color(palette.base)
   .lerp(new THREE.Color(palette.highlight),.32).getHexString();
  horn(head,'central-rhinoceros-horn',[0,.19,.26],[0,.70,.51],
   [0,1.28,.49],.218,{
    shade:polishedHornTint,surface:'chitin',
    finish:'polishedHorn',heroKeratin:true,
   });
  for(const side of [-1,1]){
   const v=(x,y,z)=>[x*side,y,z];
   horn(head,'central-horn-tip-'+s(side),
    [0,1.06,.48],v(.095,1.23,.50),v(.245,1.41,.53),.076,{
     shade:polishedHornTint,surface:'chitin',
     finish:'polishedHorn',heroKeratin:true,
    });
  }
 }else if(spec.id==='m025'){
  // A single magnificent golden-rimmed horn with a tiny fork at its tip.
  // Wings and ornate leaf motifs are on the back, not extra temple horns.
  horn(head,'solar-central-crown',[0,.19,.26],[0,.72,.50],
   [0,1.31,.49],.207,{
    shade:'#974b37',surface:'chitin',
    finish:'divineHorn',heroKeratin:true
   });
  for(const side of [-1,1]){
   const v=(x,y,z)=>[x*side,y,z];
   horn(head,'solar-horn-tip-'+s(side),[0,1.07,.48],
    v(.08,1.23,.49),v(.23,1.41,.51),.072,{
     shade:'#974b37',surface:'chitin',
     finish:'divineHorn',heroKeratin:true
    });
  }
 }
 // Each kind has its own back-armour ridge, attached to the same torso.
 // Different numbers and heights mean "gold scarab" cannot accidentally
 // look like a simple recolor of the iron or fire species.
 const rows=low?3:6;
 for(let i=0;i<rows;i++){
  const z=-.04-i*.20;
  const height=spec.id==='m025'?.28:spec.id==='m022'?.20:.105;
  const width=spec.id==='m021'?.10:.073;
  horn(torso,'dorsal-cuticle-'+i,[0,1.71,z],
   [0,1.85+height*.48,z-.035],
   [0,1.89+height,z-.19],width,{
    shade:spec.id==='m021'?palette.highlight:palette.accent,
    surface:spec.id==='m021'?'chitin':'crystal',
   });
 }
 for(const side of [-1,1]){
  const wing=g.pivots['wing'+s(side)];
  if(!wing)throw Error('Missing donor veined wing '+spec.id);
  wing.scale.set(profile.wingScale,profile.wingScale,profile.wingScale);
 }
}

/**
 * Redirect only the donor's material shades and species-specific details.
 * The actual m024 mesh builder still creates the full structural skeleton;
 * these substitutions never touch an already constructed source model.
 */
export function sculptBeetleLineage(g,spec){
 if(!isBeetleLineage(spec.id)||spec.family!=='insect')
  throw Error('Incompatible species cannot inherit m024 beetle skeleton: '+spec.id);
 const profile=BEETLE_VARIANTS[spec.id];
 const skip=(name='')=>name.startsWith('m024-venom-flow')||
  name.startsWith('m024-fang-venom-drop')||
  name==='m024-toxic-saliva'||
  name.startsWith('m024-long-venom-fang')||
  name.startsWith('m024-venom-crystal')||
  name.startsWith('m024-side-toxic-spine')||
  // The donor's two upright toxic antennae and temple crests looked like
  // extra head horns on beetles, obscuring their true central horn.
  name.startsWith('m024-curved-antenna')||
  name.startsWith('m024-temple-crest');
 const nameFor=name=>typeof name==='string'?name.replace(/^m024-/,spec.id+'-'):name;
 const wrapper=Object.create(g);
 for(const key of ['axialLoft','sphere','curvedHorn','tube','bone','fin']){
  wrapper[key]=(...original)=>{
   const args=[...original];
   const optAt=key==='sphere'||key==='curvedHorn'||key==='fin'?key==='sphere'?4:key==='fin'?5:6:
    key==='axialLoft'?3:key==='tube'?4:key==='bone'?5:null;
   const options=optAt===null?null:args[optAt];
   if(options?.name&&skip(options.name))return null;
   const materialTag=options?.surface||null;
   args[1]=shadeFor(spec,args[1],materialTag);
   if(options?.name)args[optAt]={...options,name:nameFor(options.name)};
   return g[key](...args);
  };
 }
 // Source sculpt uses its original anatomical pivots, LOD, UVs and PBR
 // surface tags; the same geometry code runs for each derivative.
 sculptM024PoisonScarab(wrapper,spec);
 sculptBeetleSpeciesDetails(g,spec,profile);
 sculptBeetleConceptDetails(g,spec);
 delete g.root.userData.m024ConceptBasedSculpt;
 delete g.root.userData.m024Anatomy;
 g.root.userData.beetleDonorId=BEETLE_DONOR_ID;
 g.root.userData.beetleLineage={speciesId:spec.id,theme:profile.theme,
  legPairs:3,wingMembranes:4,donor:BEETLE_DONOR_ID};
 g.root.userData.gameModelRevision=BEETLE_LINEAGE_REVISION;
 g.root.userData.beetleConceptRevision=BEETLE_CONCEPT_REVISION;
}
