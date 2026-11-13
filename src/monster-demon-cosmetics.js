/**
 * One shared cosmetic language for all character-based demon monsters.
 * Bone-parented, LOD-aware sculpted horns, eyeliner, lip shading, sigils,
 * tail and shaped wing membrane. These are optional layers only: the
 * canonical male/female skeleton and the source hero materials are immutable.
 */
import * as THREE from 'three';
import {createGothicHorn,createGothicBatWing} from './monster-gothic-sculpt.js';

export const DEMON_MAKEUP_PRESETS=Object.freeze({
 m034:Object.freeze({style:'blood-noble',eyeliner:.90,lips:.74,sigil:.24,tail:false,horns:'none',wings:false}),
 m041:Object.freeze({style:'impish',eyeliner:.45,lips:.53,sigil:.72,tail:true,horns:'short',wings:true}),
 m042:Object.freeze({style:'stone-demon',eyeliner:.65,lips:.21,sigil:.90,tail:true,horns:'broken',wings:true}),
 m043:Object.freeze({style:'infernal',eyeliner:1,lips:.68,sigil:1,tail:true,horns:'long',wings:true}),
 m044:Object.freeze({style:'succubus',eyeliner:1,lips:.92,sigil:.77,tail:true,horns:'existing',wings:false}),
 m045:Object.freeze({style:'cursed-knight',eyeliner:.64,lips:.26,sigil:1,tail:false,horns:'none',wings:false}),
});
export const hasDemonCosmetics=profile=>!!DEMON_MAKEUP_PRESETS[profile?.id];

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
  const p=[[0,-.25,.15],[.17,-.47,.37],[.34,-.76,.55],
    [.22,-1.01,.71],[.05,-1.20,.67]];
  line(frames.chest,'horn','flexible-demon-tail',p,refined?.041:.054);
  add(frames.chest,createGothicHorn({
   side:1,detail,len:.19,radius:.063,curve:.10
  }),'horn','tail-barb',[.05,-1.23,.67],[0,0,Math.PI*.72]);
 }
 return true;
}
