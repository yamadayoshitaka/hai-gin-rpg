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
 forest_archer:make('forest_archer','civilian','slim','narrow-eyed','long','ranger','bow',
  'forest_spirit_female',[0xe1b496,0x245f39,0xbca886,0x65cb67],{
   hairColor:0xa3885e,leaf:0x32964a,feather:0xbad4a8,makeup:0x665347,lip:0xae756b,forestGreen:true
  }),
 seraph_guardian:make('seraph_guardian','royal','tall','noble','long','paladin','staff',
  'seraph_female',[0xf4f4f2,0xf3f0e7,0xd8c89a,0xffe9b3],{
   hairColor:0xe8d7a8,leaf:0xe9e3d9,feather:0xffffff,makeup:0xaaa5af,lip:0xcbb9bc,faceOpenHair:true
  }),
 dragon_lord:make('dragon_lord','guard','sturdy','stern','long','paladin','sword',
  'dragonkin_female',[0x925e51,0x342a3b,0xc5a682,0xc77369],{
   hairColor:0x78566f,horns:true,wings:true,makeup:0x352435,lip:0x7f394b
  }),
});
/** The Dragon Lord is a male sovereign, not the female dragon-queen
 * prototype. Keep that legacy prototype as an internal asset for comparison,
 * but do not offer it as the default 3D gallery appearance. */
export const MALE_DRAGON_LORD_FORM=Object.freeze({
 id:'dragon_lord',sourceSpecies:'dragon_lord',sex:'male',
 role:'guard',body:'sturdy',face:'stern',hair:'swept',
 outfit:'knight',equipment:'sword',costume:'dragonkin_male',
 modelId:MODEL_IDS[0],skin:0x765d59,cloth:0x302733,
 metal:0x85777a,accent:0xb78d63,hairColor:0x30232a,
 horns:true,wings:true,makeup:0x34252c,lip:0x583d3f
});
export const FEMALE_SUMMON_FORM_IDS=Object.freeze(Object.keys(FEMALE_SUMMON_FORMS));
export const femaleSummonCosplayFor=id=>FEMALE_SUMMON_FORMS[id]??null;
export function validateFemaleSummonForms(){
 if(MALE_DRAGON_LORD_FORM.sex!=='male'||
   MALE_DRAGON_LORD_FORM.modelId!=='Superhero_Male_FullBody'||
   MALE_DRAGON_LORD_FORM.costume!=='dragonkin_male')
  throw Error('Dragon Lord must use canonical male anatomy');
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
