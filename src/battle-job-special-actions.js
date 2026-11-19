/** Available live orders are tied to the squad's actual job, not its label. */
export const BATTLE_JOB_SPECIAL_ACTIONS=Object.freeze({
 '魔法使い':Object.freeze([
  {id:'high_ground',label:'🏰 高所攻撃（自動で登って射撃）',target:'height'},
  {id:'destroy_bridge',label:'🌉 橋を破壊',target:'bridge'},
  {id:'break_structure',label:'💥 建物を破壊',target:'building'},
  {id:'burn_building',label:'🔥 建物を燃やす',target:'building'}
 ]),
 '召喚士':Object.freeze([
  {id:'summon_and_attack',label:'🐉 召喚→攻撃',target:'self'},
  {id:'destroy_bridge',label:'🌉 召喚獣で橋を破壊',target:'bridge'},
  {id:'break_structure',label:'🐉 召喚獣で建物を破壊',target:'building'}
 ]),
 '弓使い':Object.freeze([{id:'high_ground',label:'🏹 高所攻撃（自動で登る）',target:'height'}]),
 '僧侶':Object.freeze([
   {id:'heal_ally',label:'✚ 味方を回復（MP）',target:'ally'},
   {id:'revive_ally',label:'✧ 戦闘不能者を蘇生（UR／MP）',target:'ally'}
  ]),
  'シーフ':Object.freeze([
  {id:'unlock_door',label:'🔓 鍵開け（対象の扉へ自動移動）',target:'door'},
  {id:'steal_item',label:'🎒 アイテムを盗む',target:'enemy'}
 ]),
 '忍者':Object.freeze([
  {id:'high_ground',label:'🏯 屋根から攻撃（自動で登る）',target:'height'},
  {id:'destroy_bridge',label:'💥 橋を破壊',target:'bridge'}
 ])
});
export function battleJobSpecialActions(job){
 const label=String(job||'');
 const key=Object.keys(BATTLE_JOB_SPECIAL_ACTIONS).find(name=>label.includes(name));
 return key?BATTLE_JOB_SPECIAL_ACTIONS[key]:[];
}
