/** Battle target captions must never expose internal English object IDs. */
export const BATTLE_OBJECT_LABELS_JA=Object.freeze({
 bridge:'橋',stone_bridge:'石橋',wood_bridge:'木橋',building:'建物',
 manor_noble:'領主の館',manor:'館',noble_manor:'領主の館',
 house:'民家',home:'民家',cottage:'小屋',hut:'小屋',
 horse:'馬',mount:'騎乗馬',stable:'厩舎',door:'扉',gate:'門',
 gatehouse:'門楼',castle:'城',tower:'塔',church:'教会',
 shrine:'祠',temple:'寺院',inn:'宿屋',tavern:'酒場',
 shop:'店',weapon_shop:'武器屋',armor_shop:'防具屋',
 market:'市場',farm:'農場',barn:'納屋',warehouse:'倉庫',
 well:'井戸',fountain:'噴水',barrel:'樽',crate:'木箱',
 chest:'宝箱',fence:'柵',wall:'壁',window:'窓',roof:'屋根',
 stairs:'階段',stair:'階段',ladder:'はしご',
 rock:'岩',stone:'石',tree:'木',forest:'森林',bush:'茂み',
 river:'川',pond:'池',water:'水辺',camp:'野営地',
 statue:'像',bench:'ベンチ',lantern:'街灯',lamp:'灯り',
 structure:'建造物',object:'設備',prop:'設備',unknown:'設備'
});
/** Japanese authored names are preserved; generated slug labels are translated. */
export function japaneseBattleObjectName(value,fallback='設備'){
 const raw=String(value??'').trim();
 if(!raw)return fallback;
 // Do not accidentally turn an authored Japanese name into a generic label.
 if(/[ぁ-んァ-ヶ一-龠々]/u.test(raw))return raw;
 const normalized=raw.toLowerCase().replace(/[-\s]+/g,'_')
  .replace(/[^a-z0-9_]/g,'').replace(/_\d+$/,'');
 if(BATTLE_OBJECT_LABELS_JA[normalized])return BATTLE_OBJECT_LABELS_JA[normalized];
 const parts=normalized.split('_').filter(Boolean);
 for(let length=parts.length;length>0;length--){
  const key=parts.slice(0,length).join('_');
  if(BATTLE_OBJECT_LABELS_JA[key])return BATTLE_OBJECT_LABELS_JA[key];
 }
 for(const part of parts){
  if(BATTLE_OBJECT_LABELS_JA[part])return BATTLE_OBJECT_LABELS_JA[part];
 }
 // Never show a raw English identifier to Japanese players.
 return fallback;
}
/** Skill first: only living enemy squads with locations can be selected for attack. */
export function eligibleEnemyBattleTargets(targets=[]){
 return targets.filter(t=>t&&Number(t.team)===1&&t.squadId!=null&&
  t.alive!==false&&Number.isFinite(t.x)&&Number.isFinite(t.z));
}
export function battleAttackNeedsEnemy(attackKind){
 return ['near','far','intercept'].includes(String(attackKind||''));
}
