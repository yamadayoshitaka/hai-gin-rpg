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
   'tengu',[0xb9a28d,0x283340,0x6c7278,0x9f6241],{wings:true,beak:true}),
 m031:define('m031','male','guard','slim','elder','bald','swordsman','sword',
   'skeleton',[0xd9d2ba,0x343b3d,0x747572,0x9a8d75],{skull:true}),
 m032:define('m032','male','civilian','slim','elder','bald','monk','none',
   'mummy',[0x9b8b71,0xb1a28a,0x65544a,0x665944],{wrappings:true}),
 m033:define('m033','male','guard','tall','stern','short','knight','sword',
   'death_knight',[0xb5aeb5,0x283747,0x607e90,0x6dbabd],{armor:true}),
 m034:define('m034','male','royal','slim','noble','swept','noble','dagger',
   'vampire',[0xd8b7b6,0x432331,0x947c73,0x933b4d],{fangs:true,cape:true}),
 m035:define('m035','male','civilian','slim','elder','bald','mage','staff',
   'lich',[0xb0c2cc,0x343f54,0x8b9bab,0x829dc3],{mage:true}),
 m041:define('m041','male','civilian','slim','stern','bald','rogue','dagger',
   'imp',[0x8d6670,0x3a2d3a,0x805961,0x966e4d],{horns:true,wings:true,scale:.80}),
 m042:define('m042','male','guard','sturdy','stern','bald','guard','fists',
   'gargoyle',[0x777a80,0x424852,0x8994a2,0x605961],{horns:true,wings:true}),
 m043:define('m043','male','guard','sturdy','stern','short','knight','sword',
   'demon',[0x8b5153,0x402b34,0x66535c,0xb97351],{horns:true,wings:true,armor:true}),
 m044:define('m044','female','royal','slim','noble','long','rogue','dagger',
   'succubus',[0xb69aa7,0x48334d,0x7e668b,0x9775a8],{horns:true,wings:true,cape:true}),
 m045:define('m045','male','guard','heavy','stern','short','knight','sword',
   'dark_knight',[0x937f85,0x282b34,0x4a4e59,0xa96a6c],{armor:true,cape:true}),
});

export const HUMAN_MONSTER_IDS=Object.freeze(Object.keys(HUMANOID_MONSTER_COSTUMES));
export const humanoidMonsterCostumeFor=spec=>HUMANOID_MONSTER_COSTUMES[
 typeof spec==='string'?spec:spec?.id]??null;
export function validateHumanoidMonsterCostumes(){
 const parts={body:'bodies',face:'faces',hair:'hairs',outfit:'outfits',equipment:'equipment'};
 const accepted=new Set(['m015',...Array.from({length:5},(_,i)=>'m0'+String(i+31)),...Array.from({length:5},(_,i)=>'m0'+String(i+41))]);
 if(accepted.size!==11||HUMAN_MONSTER_IDS.length!==11)throw Error('Expected 11 human-shaped monsters');
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
