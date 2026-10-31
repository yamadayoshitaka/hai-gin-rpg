/** Single source of truth for character appearance and authored animation actions. */
import {resolveCharacterJobProfile} from './character-job-profiles.js';
export const BASIC_ACTIONS=Object.freeze(['idle','walk','run','jump','jumpAttack','attack','ranged','cast','item','guard','hit','dead','getup']);
export const ACTION_LABELS=Object.freeze({idle:'待機',walk:'歩行',run:'ダッシュ',jump:'ジャンプ',jumpAttack:'ジャンプ攻撃',attack:'近接攻撃',ranged:'遠距離攻撃',cast:'詠唱',item:'アイテム使用',guard:'防御',hit:'被弾',dead:'戦闘不能',getup:'起き上がる'});
const RANGED=new Set(['ranger','archer','hunter','sniper','gunner','thrower','machinist']);
const MAGIC=new Set(['mage','wizard','priest','cleric','healer','sorcerer','necromancer','summoner','alchemist','white_mage','black_mage']);
const COMBAT=new Set(['ranger','archer','hunter','sniper','gunner','thrower','machinist','swordsman','knight','samurai','spearman','axeman','martial_artist','thief','assassin','berserker','paladin','mage','wizard','priest','cleric','healer','sorcerer','necromancer','summoner','alchemist']);
export function bindCharacterActions(occupationId,sex='male'){
 const profile=resolveCharacterJobProfile(occupationId);
 const capabilities={attack:COMBAT.has(occupationId),ranged:RANGED.has(occupationId),cast:MAGIC.has(occupationId)};
 const enabled=BASIC_ACTIONS.filter(a=>!['attack','ranged','cast','jumpAttack'].includes(a)||a==='jumpAttack'&&COMBAT.has(occupationId)||capabilities[a]);
 return Object.freeze({occupationId,sex,modelId:(sex==='female'?'Female_':'Male_')+profile.modelFamily,outfit:profile.outfit,profile,enabled:Object.freeze(enabled),capabilities:Object.freeze(capabilities)});
}
