/**
 * One shared cosmetic language for all character-based demon monsters.
 * Bone-parented, LOD-aware sculpted horns, eyeliner, lip shading, sigils,
 * tail and shaped wing membrane. These are optional layers only: the
 * canonical male/female skeleton and the source hero materials are immutable.
 */
import * as THREE from 'three';
import {createGothicHorn,createGothicBatWing} from './monster-gothic-sculpt.js';
import {createConstructCarapaceGeometry}
 from './monster-construct-costume.js';

export const DEMON_MAKEUP_PRESETS=Object.freeze({
 m034:Object.freeze({style:'blood-noble',eyeliner:.90,lips:.74,sigil:.24,tail:false,horns:'none',wings:false}),
 m041:Object.freeze({style:'impish',eyeliner:.45,lips:.53,sigil:.72,tail:true,horns:'short',wings:true}),
 m042:Object.freeze({style:'stone-demon',eyeliner:.65,lips:.21,sigil:.90,tail:true,horns:'broken',wings:true}),
 m043:Object.freeze({style:'infernal',eyeliner:1,lips:.68,sigil:1,tail:true,horns:'long',wings:true}),
 m044:Object.freeze({style:'succubus',eyeliner:1,lips:.92,sigil:.77,tail:true,horns:'existing',wings:false}),
 m045:Object.freeze({style:'cursed-knight',eyeliner:.64,lips:.26,sigil:1,tail:false,horns:'none',wings:false}),
});
export const hasDemonCosmetics=profile=>!!DEMON_MAKEUP_PRESETS[profile?.id];
export const DEMON_COLOR_THEMES=Object.freeze({
 species:Object.freeze({label:'種族固有'}),
 infernal:Object.freeze({label:'紅蓮',skin:0x813947,cloth:0x30202d,
  metal:0x6d515a,accent:0xda6b54,makeup:0x24141f,lip:0x762a39}),
 abyss:Object.freeze({label:'夜紫',skin:0x5b4a7e,cloth:0x282537,
  metal:0x625d81,accent:0x9c70db,makeup:0x201628,lip:0x5c305e}),
 necrotic:Object.freeze({label:'灰白',skin:0x82949b,cloth:0x31363f,
  metal:0x818a94,accent:0x95c9c1,makeup:0x292f37,lip:0x475861}),
});
export function withDemonColorTheme(profile,theme='species'){
 if(!profile||!hasDemonCosmetics(profile))return profile;
 const t=DEMON_COLOR_THEMES[theme];
 if(!t)throw Error('Unknown demon skin palette '+theme);
 if(theme==='species')return profile;
 return Object.freeze({...profile,...t,makeup:t.makeup,lip:t.lip});
}

export function addDemonicFaceCosmetics({profile,frames,detail='high',attach,tube}={}){
 const preset=DEMON_MAKEUP_PRESETS[profile?.id];
 if(!preset)return false;
 const refined=detail!=='low';
 const line=(parent,role,name,points,radius)=>tube(parent,role,'demon-'+name,points,radius);
 const add=(parent,g,role,name,position=[0,0,0],rotation=[0,0,0])=>
  attach(parent,g,role,'demon-'+name,position,rotation);
 const crystal=(parent,role,name,pos,size)=>{
  const g=new THREE.IcosahedronGeometry(1,refined?1:0);
  g.scale(...size);
  return add(parent,g,role,name,pos);
 };
 for(const side of [-1,1]){
  // Brow/eyeliner is a shaped 3D curve hugging the skinned face; there is
  // no separate toy-like eyeball, and the native source cornea remains intact.
  const extra=preset.eyeliner*.013;
  line(frames.head,'makeup','upper-eyeliner-'+side,[
   [side*.017,.065,-.136],
   [side*.049,.076+extra,-.145],
   [side*.095,.066+extra,-.122],
   [side*.131,.090+extra,-.095]
  ],refined?.006:.007);
  line(frames.head,'stain','under-eye-shade-'+side,[
   [side*.018,.008,-.139],
   [side*.060,-.010,-.146],
   [side*.101,-.006,-.115]
  ],refined?.004:.005);
  line(frames.head,'makeup','angular-cheek-rune-'+side,[
   [side*.093,-.050,-.118],[side*.117,-.092,-.086],
   [side*.103,-.133,-.094]
  ],.0045*preset.sigil+.002);
  if(preset.horns!=='none'&&preset.horns!=='existing'){
   const long=preset.horns==='long',broken=preset.horns==='broken';
   const radius=long?.059:broken?.045:.030;
   crystal(frames.head,'horn','horn-root-'+side,
    [side*.108,.126,-.012],[radius*1.12,.032,radius]);
   add(frames.head,createGothicHorn({
    side,detail,len:long?.36:broken?.21:.15,
    radius,curve:long?.39:broken?.22:.14
   }),'horn','swept-horn-'+side,[side*.108,.125,-.015]);
  }
 }
 line(frames.head,'lip','upper-lip-outline',[
  [-.080,-.106,-.141],[-.035,-.112,-.158],
  [0,-.116,-.161],[.035,-.112,-.158],[.080,-.106,-.141]
 ],.003+preset.lips*.005);
 line(frames.head,'lip','lower-lip-outline',[
  [-.066,-.118,-.146],[-.030,-.135,-.151],
  [0,-.142,-.154],[.030,-.135,-.151],[.066,-.118,-.146]
 ],.003+preset.lips*.003);
 if(preset.sigil>.50){
  line(frames.head,'rune','forehead-v-sigil',[
   [-.065,.120,-.092],[0,.073,-.146],[.065,.120,-.092]
  ],refined?.005:.007);
  line(frames.chest,'rune','chest-cursed-sigil',[
   [-.09,.11,-.205],[0,-.03,-.262],[.09,.11,-.205]
  ],.008);
 }
 if(preset.wings){
  for(const side of [-1,1]){
   add(frames.chest,createGothicBatWing({
    side,detail,width:preset.style==='infernal'?1.26:.86,height:.83
   }),'membrane','membranous-wing-'+side,[0,.065,.065]);
   for(let k=0;k<3;k++)line(frames.chest,'horn','wing-bone-'+side+'-'+k,[
    [side*.12,.24,.22],
    [side*(.48+k*.15),.44-k*.14,.45],
    [side*(.93+k*.10),.18-k*.16,.66]
   ],refined?.018:.023);
  }
 }
 if(preset.tail){
  if(!frames.pelvis)throw Error('Demonic tail requires anatomical hip attachment');
  // The base starts behind the pelvis. The original chest-bone y=-.25
  // landed below the abdomen and looked like a large crotch appendage.
  const p=[[0,.02,.18],[.11,-.12,.32],[.30,-.35,.51],
    [.22,-.56,.74],[.08,-.72,.83]];
  line(frames.pelvis,'horn','flexible-demon-tail',p,refined?.033:.043);
  add(frames.pelvis,createGothicHorn({
   side:1,detail,len:.16,radius:.050,curve:.09
  }),'horn','tail-barb',[.08,-.76,.84],[0,0,Math.PI*.73]);
 }
 // Unlike a human wearing black underwear, gargoyles and infernal demons
 // must have a complete lower-body silhouette and connected armour seams.
 if(['m041','m042','m043'].includes(profile.id)){
  if(!frames.pelvis)throw Error('Demon loin armour requires hips');
  const gargoyle=profile.id==='m042';
  const stone=gargoyle?'skin':'metal';
  const hem=new THREE.CylinderGeometry(gargoyle?.275:.25,
     gargoyle?.337:.29,.42,refined?22:10,3,true);
  add(frames.pelvis,hem,stone,'species-bone-anchored-loin-plate',
    [0,-.075,0]);
  for(const side of [-1,1]){
   const i=side<0?0:1;
   const hipPlating=new THREE.IcosahedronGeometry(1,refined?1:0);
   hipPlating.scale(.13,.19,.18);
   add(frames.pelvis,hipPlating,stone,
     'hip-joint-cover-'+i,[side*.185,-.12,.012]);
   if(gargoyle){
    const shoulder=new THREE.IcosahedronGeometry(1,refined?1:0);
    shoulder.scale(.165,.14,.17);
    add(frames.arms[i],shoulder,'skin',
      'gargoyle-shoulder-stone-'+i,[side*.03,.0,.006]);
   }
  }
  if(gargoyle){
   add(frames.chest,createConstructCarapaceGeometry({
      detail,material:'stone',width:.32,height:.62,depth:.215
    }),'skin','gargoyle-fitted-stone-chest');
   // Three cold-stone dorsal ridges grow from the skull. Gargoyles have
   // stony crests instead of a smooth human bald scalp.
   for(let i=0;i<3;i++){
    const crest=new THREE.ConeGeometry(.045,.13-i*.014,
      refined?9:6,2);
    crest.rotateZ(.17*(i-1));
    add(frames.head,crest,'skin',
      'gargoyle-cranial-ridge-'+i,[(i-1)*.09,.18,.045]);
   }
  }
 }
 return true;
}
