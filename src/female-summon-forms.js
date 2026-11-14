/**
 * Optional FEMALE humanoid forms of EXISTING summoned species. The existing
 * animal/dragon forms and combat summon IDs remain unchanged; only the
 * separate inspection/visual form is switched.
 */
import {MODEL_IDS} from './character-asset-registry.js';
import {CHARACTER_PARTS} from './character-assembly-bom.js';
const make=(id,role,body,face,hair,outfit,equipment,costume,palette,options={})=>
 Object.freeze({
  id,sourceSpecies:id,sex:'female',role,body,face,hair,outfit,equipment,
  costume,modelId:MODEL_IDS[1],skin:palette[0],cloth:palette[1],
  metal:palette[2],accent:palette[3],...options
 });
export const FEMALE_SUMMON_FORMS=Object.freeze({
 forest_archer:make('forest_archer','civilian','slim','noble','long','ranger','bow',
  'forest_spirit_female',[0x8ea7a1,0x34503d,0xbca886,0x8ebe73],{
   leaf:0x62865b,feather:0xc1c5a3,makeup:0x243d32,lip:0x667c62
  }),
 seraph_guardian:make('seraph_guardian','royal','tall','noble','long','paladin','staff',
  'seraph_female',[0xc6c3dd,0xe7dfcd,0xd8c89a,0xffe1a1],{
   leaf:0xc8c3dc,feather:0xf4efe2,makeup:0x64668d,lip:0x8c759d
  }),
 dragon_lord:make('dragon_lord','guard','sturdy','stern','bald','paladin','sword',
  'dragonkin_female',[0x84636b,0x342a3b,0x797d88,0xc77369],{
   horns:true,wings:true,makeup:0x352435,lip:0x7f394b
  }),
});
export const FEMALE_SUMMON_FORM_IDS=Object.freeze(Object.keys(FEMALE_SUMMON_FORMS));
export const femaleSummonCosplayFor=id=>FEMALE_SUMMON_FORMS[id]??null;
export function validateFemaleSummonForms(){
 if(FEMALE_SUMMON_FORM_IDS.length!==3)throw Error('Expected 3 existing humanoid summon forms');
 for(const [id,form] of Object.entries(FEMALE_SUMMON_FORMS)){
  if(form.sex!=='female'||form.sourceSpecies!==id||
    form.modelId!=='Superhero_Female_FullBody')
   throw Error('Summon not backed by canonical female actor '+id);
  for(const [name,table] of Object.entries({
   body:CHARACTER_PARTS.bodies,face:CHARACTER_PARTS.faces,
   hair:CHARACTER_PARTS.hairs,outfit:CHARACTER_PARTS.outfits,
   equipment:CHARACTER_PARTS.equipment
  }))if(!table[form[name]])throw Error('Invalid female summon slot '+id+'/'+name);
 }
 return true;
}
validateFemaleSummonForms();
