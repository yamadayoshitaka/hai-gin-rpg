/**
 * Character cosplay manifest for HUMAN-SHAPED bestiary entries.
 *
 * The same canonical Superhero Male/Female GLBs, facial skeleton and animation
 * library as the playable character preview are the source of anatomy.
 * Costumes and textures belong to the monster instance only; character
 * assets/rigs/hero presets must never be edited for monsters.
 */
import {CHARACTER_PARTS} from './character-assembly-bom.js';
import {MODEL_IDS} from './character-asset-registry.js';

const define=(id,sex,role,body,face,hair,outfit,equipment,
  costume,palette,options={})=>Object.freeze({
 id,sex,role,body,face,hair,outfit,equipment,costume,
 modelId:sex==='female'?MODEL_IDS[1]:MODEL_IDS[0],
 skin:palette[0],cloth:palette[1],metal:palette[2],accent:palette[3],
 ...options,
});
export const HUMANOID_MONSTER_COSTUMES=Object.freeze({
 // Unique humanoid among the birds: Tengu is deliberately no longer a toy bird.
 m015:define('m015','male','guard','slim','stern','swept','assassin','staff',
   'tengu',[0x647881,0x232b35,0x6c7278,0xaf744c],{wings:true,beak:true}),
 m031:define('m031','male','guard','slim','elder','bald','swordsman','sword',
   'skeleton',[0x8a8574,0x343b3d,0x747572,0x9a8d75],{skull:true}),
 m032:define('m032','male','civilian','slim','elder','bald','monk','none',
   'mummy',[0x5f654c,0xa69a85,0x65544a,0x665944],{wrappings:true}),
 m033:define('m033','male','guard','tall','stern','short','knight','sword',
   'death_knight',[0x62697d,0x283747,0x607e90,0x6dbabd],{armor:true}),
 m034:define('m034','male','royal','slim','noble','swept','noble','dagger',
   'vampire',[0x77748e,0x30202e,0x786771,0xb13a5b],{fangs:true,cape:true}),
 m035:define('m035','male','civilian','slim','elder','bald','mage','staff',
   'lich',[0x547b83,0x343f54,0x8b9bab,0x91b9c9],{mage:true}),
 m041:define('m041','male','civilian','slim','stern','bald','rogue','dagger',
   'imp',[0x635079,0x3a2d3a,0x805961,0x966e4d],{horns:true,wings:true,scale:.80}),
 m042:define('m042','male','guard','sturdy','stern','bald','guard','fists',
   'gargoyle',[0x52636f,0x424852,0x8994a2,0x605961],{horns:true,wings:true}),
 m043:define('m043','male','guard','sturdy','stern','short','knight','sword',
   'demon',[0x87373c,0x402b34,0x66535c,0xd17752],{horns:true,wings:true,armor:true}),
 m044:define('m044','female','royal','slim','noble','long','rogue','dagger',
   'succubus',[0x76518f,0x30233f,0x7e668b,0xab69d0],{horns:true,wings:true,cape:true}),
 m045:define('m045','male','guard','heavy','stern','short','knight','sword',
   'dark_knight',[0x625168,0x282b34,0x4a4e59,0xa96a6c],{armor:true,cape:true}),
 // Five golems are also humanoid in the source geometry: use the same
 // animated person rig with armour replacing visible flesh, NOT a beast rig.
 m036:define('m036','male','guard','heavy','stern','bald','guard','fists',
   'stone_construct',[0x66645f,0x3d3c40,0x77736c,0x889284],{construct:true}),
 m037:define('m037','male','guard','sturdy','stern','bald','knight','guard',
   'bronze_construct',[0x3e6b64,0x323f42,0x8a7963,0x6bb3a0],{construct:true}),
 m038:define('m038','female','royal','tall','noble','bald','paladin','staff',
   'crystal_construct',[0x605c8f,0x302e4c,0x8b7db0,0xaebbed],{construct:true}),
 m039:define('m039','male','guard','heavy','stern','bald','smith','hammer',
   'lava_construct',[0x443c3a,0x292c2d,0x66534c,0xe48343],{construct:true}),
 m040:define('m040','male','royal','tall','noble','bald','paladin','sword',
   'silver_construct',[0x8296a0,0x404b55,0xabbcc8,0xffe3ae],{construct:true}),
});

// Optional second gothic vampire visual, without increasing the canonical
// 50-species catalog or changing battle damage/monster ID contracts.
export const FEMALE_VAMPIRE_COSTUME=define('m034','female','royal',
 'slim','noble','long','noble','dagger','vampire',
 [0x776782,0x36213a,0x77667e,0xb04479],{fangs:true,cape:true});
export const HUMAN_MONSTER_IDS=Object.freeze(Object.keys(HUMANOID_MONSTER_COSTUMES));
export const humanoidMonsterCostumeFor=(spec,{genderVariant=null}={})=>{
 const id=typeof spec==='string'?spec:spec?.id;
 return id==='m034'&&genderVariant==='female'?
  FEMALE_VAMPIRE_COSTUME:(HUMANOID_MONSTER_COSTUMES[id]??null);
};
export function validateHumanoidMonsterCostumes(){
 const parts={body:'bodies',face:'faces',hair:'hairs',outfit:'outfits',equipment:'equipment'};
 const accepted=new Set(['m015',...Array.from({length:5},(_,i)=>'m0'+String(i+31)),...Array.from({length:5},(_,i)=>'m0'+String(i+36)),...Array.from({length:5},(_,i)=>'m0'+String(i+41))]);
 if(accepted.size!==16||HUMAN_MONSTER_IDS.length!==16)throw Error('Expected 16 human-shaped monsters');
 for(const [id,s] of Object.entries(HUMANOID_MONSTER_COSTUMES)){
  if(!accepted.has(id)||s.id!==id)throw Error('Nonhuman monster selected for character cosplay '+id);
  if(!MODEL_IDS.includes(s.modelId)||!['male','female'].includes(s.sex))throw Error('Missing canonical character model '+id);
  if(s.modelId!==('Superhero_'+(s.sex==='female'?'Female':'Male')+'_FullBody'))throw Error('Model/sex mismatch '+id);
  for(const [field,category] of Object.entries(parts))
   if(!CHARACTER_PARTS[category][s[field]])throw Error('Invalid character slot '+id+'/'+field);
  for(const p of ['skin','cloth','metal','accent'])
   if(!Number.isInteger(s[p])||s[p]<0||s[p]>0xffffff)throw Error('Invalid costume palette '+id+'/'+p);
 }
 return true;
}
validateHumanoidMonsterCostumes();
