/**
 * Theme-specific 3D action catalog for all 50 original monsters.
 * Stable species IDs and the 11 legacy animations remain unchanged.
 * Each technique plays an authored canonical pose plus a family-specific
 * articulated overlay (see monster-theme-motion.js), never a fake GLB clip.
 */
import {MONSTER_BY_ID,MONSTER_FAMILIES} from './monster-catalog.js';
const entry=(id,label,base,pose,duration)=>Object.freeze({
 id,label,base,pose,duration
});
const LOOP=Infinity;
export const MONSTER_THEME_REVISION='monster-50-family-actions-v1-20261121';
export const MONSTER_FAMILY_ACTIONS=Object.freeze({
 beast:Object.freeze([
  entry('scent_track','匂いを追う','idle','scent',LOOP),
  entry('beast_lunge','飛び掛かり','leap','pounce',1.30),
  entry('fang_combo','連続噛みつき','attack','bite',1.25),
  entry('pack_howl','群れの咆哮','roar','howl',1.55)]),
 feline:Object.freeze([
  entry('predator_stalk','低姿勢で忍び寄る','walk','stalk',LOOP),
  entry('cat_pounce','跳躍急襲','leap','pounce',1.25),
  entry('claw_combo','両爪連撃','attack','claw',1.32),
  entry('predator_roar','威圧咆哮','roar','howl',1.42)]),
 avian:Object.freeze([
  entry('air_glide','滑空','idle','glide',LOOP),
  entry('wing_gust','大羽ばたき','special','wing',1.48),
  entry('sky_dive','急降下襲撃','attack','dive',1.27),
  entry('aerial_roll','旋回飛行','run','bank',LOOP)]),
 reptile:Object.freeze([
  entry('scale_brace','鱗防御','guard','brace',1.15),
  entry('tail_whip','尻尾薙ぎ払い','attack','tail',1.35),
  entry('reptile_bite','噛み砕き','attack','bite',1.25),
  entry('element_breath','属性ブレス','special','breath',1.74)]),
 insect:Object.freeze([
  entry('elytra_guard','甲殻防御','guard','brace',1.14),
  entry('horn_charge','角突進','run','charge',1.32),
  entry('mandible_strike','大顎・鎌の一撃','attack','claw',1.19),
  entry('wing_buzz','羽の振動','special','wing',1.43)]),
 arachnid:Object.freeze([
  entry('eightleg_skitter','八脚疾走','run','skitter',LOOP),
  entry('web_launch','糸射出','special','web',1.46),
  entry('venom_sting','毒牙刺突','attack','bite',1.23),
  entry('web_bind','巣の捕縛','special','web',1.65)]),
 undead:Object.freeze([
  entry('grave_rise','不死の立ち上がり','idle','rise',1.28),
  entry('soul_curse','呪詛詠唱','special','cast',1.65),
  entry('life_drain','生命吸収','special','drain',1.51),
  entry('bone_sweep','骸骨剣斬','attack','claw',1.28)]),
 golem:Object.freeze([
  entry('golem_stomp','地鳴り踏み込み','attack','stomp',1.39),
  entry('stone_bulwark','重装防壁','guard','brace',1.38),
  entry('double_hammer','両腕粉砕','special','slam',1.52),
  entry('ground_tremor','大地震動','special','stomp',1.73)]),
 fiend:Object.freeze([
  entry('shadow_dash','影移動','run','bank',1.15),
  entry('hell_sweep','魔刃薙ぎ払い','attack','claw',1.27),
  entry('dark_burst','魔炎放出','special','cast',1.64),
  entry('demon_menace','魔族の威圧','roar','howl',1.40)]),
 aquatic:Object.freeze([
  entry('water_drift','水中漂泳','idle','glide',LOOP),
  entry('tentacle_grasp','触手捕縛','attack','grasp',1.48),
  entry('whirlpool','渦潮旋回','special','coil',1.61),
  entry('tidal_wave','海流衝撃','special','breath',1.70)]),
});
const signature=Object.freeze({id:'signature',base:'special',pose:'signature',duration:1.65});
export const MONSTER_THEME_ACTIONS_PER_SPECIES=5;
export function monsterThemeActionsFor(spec){
 const monster=typeof spec==='string'?MONSTER_BY_ID[spec]:spec;
 const group=MONSTER_FAMILY_ACTIONS[monster?.family];
 if(!group)return Object.freeze([]);
 return Object.freeze([...group,Object.freeze({
  ...signature,label:monster?.skill||'種族固有技'
 })]);
}
export function resolveMonsterThemeAction(spec,action){
 if(typeof action!=='string')return null;
 const monster=typeof spec==='string'?MONSTER_BY_ID[spec]:spec;
 if(!monster)return null;
 if(action==='signature')return monsterThemeActionsFor(monster)[4];
 return MONSTER_FAMILY_ACTIONS[monster.family]?.find(x=>x.id===action)??null;
}
export function monsterThemeActionForId(id,action){
 return resolveMonsterThemeAction(MONSTER_BY_ID[id],action);
}
export function defaultMonsterThemeAttack(spec){
 const m=typeof spec==='string'?MONSTER_BY_ID[spec]:spec;
 return MONSTER_FAMILY_ACTIONS[m?.family]?.find(x=>x.base==='attack')?.id??'attack';
}
/** Rules are quality gates, not a claim that a particular GLB was polished. */
export const MONSTER_FAMILY_QUALITY_CONTRACT=Object.freeze({
 beast:Object.freeze(['four-leg contacts','jaw/eye alignment','spine flexion','fur silhouette']),
 feline:Object.freeze(['mobile shoulders','toe claws','feline spine','grounded landing']),
 avian:Object.freeze(['wing/feather silhouette','airborne movement','bill/eye detail','flight landing']),
 reptile:Object.freeze(['four-foot or serpent frame','continuous scales','tail motion','jaw articulation']),
 insect:Object.freeze(['segment continuity','correct limb count','antennae/horns','chitin surface']),
 arachnid:Object.freeze(['eight articulated legs','body/abdomen join','fangs/spinnerets','silk pose']),
 undead:Object.freeze(['joint stability','species costume','facial integrity','weapon motion']),
 golem:Object.freeze(['full mineral coverage','continuous joint shell','crack shading','heavy stomp']),
 fiend:Object.freeze(['horn/wing attachments','species face','spell/weapon gestures','nonhuman skin']),
 aquatic:Object.freeze(['tentacle/fin continuity','wet surface','hydrostat motion','underwater pose'])
});
export function monsterActionQualityPlan(){
 return Object.freeze(Object.entries(MONSTER_FAMILIES).map(([family,label])=>
  Object.freeze({family,label,species:Object.values(MONSTER_BY_ID).filter(x=>x.family===family).map(x=>x.id),
   actions:MONSTER_FAMILY_ACTIONS[family].map(x=>x.id),
   quality:MONSTER_FAMILY_QUALITY_CONTRACT[family]})));
}
