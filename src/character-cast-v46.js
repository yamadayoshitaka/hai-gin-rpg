/** Chapter-1/2 canonical identities, and intentionally different NPC archetypes.
 * Distinct art references are metadata: never claim a scene crop is an approved 3D master.
 * The 3D preview is rendered by the existing independent real-head/real-outfit rig. */
import {normalizePartSelection,PART_CATALOG} from './face-part-catalog-v32.js';
import {synchronizeHeroHairSelection} from './hero-hair-controls-v43.js';
import {chooseHeroFacePreset,polishHeroFaceControls} from './hero-face-presets-v45.js';
import {resolveAgeBand,resolveBodyType,applyDemographicFaceControls,AGE_BAND_IDS,BODY_TYPE_IDS} from './character-demographics-v47.js?v=47';
export const BODY_SHAPES=Object.freeze({
 slim:Object.freeze({width:.91,depth:.92,label:'細身'}),
 average:Object.freeze({width:1,depth:1,label:'標準'}),
 sturdy:Object.freeze({width:1.12,depth:1.09,label:'がっしり'}),
 full:Object.freeze({width:1.23,depth:1.18,label:'ふくよか'}),
 heavy:Object.freeze({width:1.36,depth:1.28,label:'大柄・肥満'}),
 child:Object.freeze({width:.88,depth:.88,label:'子ども'})
});
export function resolveBodyShape(kind='average'){
 const shape=BODY_SHAPES[kind];
 if(!shape)throw Error('Unknown body shape '+kind);
 return shape;
}
const rows=[
 // id, label, gender, storyStatus, reference, ageGroup, shape, faceIndex, styleId, hairColor, eyeType, clothingRole
 ['commander-female','女性主人公・軍師','female','canon-provisional',
  'assets/story/characters/commander/female-master.webp','young','slim',0,'fringe-long','blonde','large','commander'],
 ['commander-male','男性主人公・軍師','male','canon-scene-only',
  'assets/story/panels/c01-s01-m01.webp','young','average',5,'male-comma','black','focused','commander'],
 ['lucia','リュシア・銀髪摂政','female','canon-master',
  'assets/story/characters/lucia/master.webp','adult','slim',3,'female-low-bun','silver','elegant','regent'],
 ['garan','ガラン・老騎士','male','canon-provisional',
  'assets/story-cinema/cast/garan.webp','elder','sturdy',9,'male-senior-sidepart','ash','narrow','knight'],
 ['iris','イリス・治癒師','female','canon-provisional',
  'assets/story-cinema/cast/iris.webp','young','average',8,'female-half-up','platinum','gentle','healer'],
 ['mina','ミナ・避難民の少女','female','canon-provisional',
  'assets/story-cinema/cast/mina.webp','child','child',1,'female-twin-braids','brown','large','refugee'],
 ['town-innkeeper','宿屋主人・太めの中年男性','male','npc','',
  'middle-aged','heavy',4,'male-senior-sidepart','darkBrown','narrow','inn'],
 ['town-matron','宿屋女将・ふくよかな中年女性','female','npc','',
  'middle-aged','full',8,'female-curly-bob','brown','narrow','inn'],
 ['town-elder-woman','町の老婆','female','npc','','elder','slim',7,'female-low-bun','silver','narrow','resident'],
 ['town-elder-man','町の長老','male','npc','','elder','slim',6,'male-senior-sidepart','white','narrow','resident'],
 ['town-merchant','肥満体の商人','male','npc','','middle-aged','heavy',4,'male-slick-back','chestnut','small','merchant'],
 ['town-craftswoman','細目の女性職人','female','npc','','adult','sturdy',4,'female-short-wolf','black','narrow','craft'],
 ['town-farmer','がっしり農夫','male','npc','','middle-aged','sturdy',8,'male-crew-cut','darkBrown','small','farmer'],
 ['town-librarian','細身の年配女性','female','npc','','elder','average',9,'female-pixie','ash','narrow','scholar']
];
// Rebuild characters against the v47 age/build system, preserving the
// canonical scene/portrait references and not confusing anyone's identity.
const castAges=Object.freeze({
 'commander-female':'twenties','commander-male':'twenties',
 lucia:'thirties',garan:'seventies',iris:'twenties',mina:'under10',
 'town-innkeeper':'forties','town-matron':'forties',
 'town-elder-woman':'eightyPlus','town-elder-man':'seventies',
 'town-merchant':'sixties','town-craftswoman':'thirties',
 'town-farmer':'forties','town-librarian':'sixties'
});
const cast=rows.map(([id,label,gender,status,artReference,age,bodyShape,facePreset,hairStyleId,hairColor,eyeShape,wardrobe])=>
 Object.freeze({id,label,gender,status,artReference,age,bodyShape,facePreset,hairStyleId,hairColor,eyeShape,wardrobe,
 ageBand:resolveAgeBand(castAges[id]).id,bodyType:resolveBodyType(bodyShape).id}));
export const CHARACTER_CAST_V46=Object.freeze(cast);
export const CHARACTER_CAST_BY_ID=Object.freeze(Object.fromEntries(cast.map(c=>[c.id,c])));
export const MAJOR_CHARACTER_IDS=Object.freeze(cast.filter(c=>c.status.startsWith('canon-')).map(c=>c.id));
export function characterAppearance(id,current={}){
 const item=CHARACTER_CAST_BY_ID[id];
 if(!item)throw Error('Unknown character '+id);
 const catalog=PART_CATALOG[item.gender].hair;
 const hairIndex=catalog.findIndex(row=>row.values.styleId===item.hairStyleId);
 if(hairIndex<0)throw Error('Gender-incompatible hairstyle '+item.gender+':'+item.hairStyleId);
 const parts=chooseHeroFacePreset(item.gender,item.facePreset,
  normalizePartSelection({...current,hairColor:item.hairColor,
   ageBand:item.ageBand,bodyType:item.bodyType}));
 const hair=synchronizeHeroHairSelection(item.gender,{...parts,hair:hairIndex},item.hairStyleId);
 const refined=polishHeroFaceControls(item.gender,{});
 const age=resolveAgeBand(item.ageBand);
 const eye=item.eyeShape==='narrow'?{eyeHeight:.72,eyeWidth:1.16,irisDiameter:1.03}:
  item.eyeShape==='small'?{eyeHeight:.83,eyeWidth:.92,irisDiameter:1.05}:
  item.eyeShape==='large'?{eyeHeight:1.31,eyeWidth:1.19,irisDiameter:1.23}:{};
 return {item,parts:hair.parts,styleId:hair.styleId,
  controls:applyDemographicFaceControls({...refined,...eye,
   beardDensity:item.gender==='male'?age.beard:0},
   item.ageBand,item.bodyType,item.gender),
  bodyShape:resolveBodyShape(item.bodyShape),ageBand:item.ageBand,
  bodyType:item.bodyType};
}
export function mountCharacterCastSelect(node,gender,onSelect){
 if(!node)throw Error('Missing character cast selection');
 node.replaceChildren();
 for(const [value,label] of [['','キャラクターを選択'],...CHARACTER_CAST_V46.filter(c=>c.gender===gender)
  .map(c=>[c.id,c.label+(c.status==='npc'?'（モブ）':'')])]){
  const option=document.createElement('option');option.value=value;option.textContent=label;
  node.append(option);
 }
 node.addEventListener('change',()=>{
  if(node.value)onSelect(node.value);
 });
 return node;
}
