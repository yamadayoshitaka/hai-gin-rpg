/** Campaign stage contract: classify the victory rule separately from squad tactics. */
export const BATTLE_STAGE_TYPE_LABELS=Object.freeze({
 town:'町探索',explore:'魔物殲滅戦',capture:'陣地制圧戦',
 defend:'拠点防衛戦',siege:'攻城戦',boss:'ボス決戦'
});
export const BATTLE_STAGE_OBJECTIVES=Object.freeze({
 explore:'出現した全モンスターを討伐',capture:'指定した陣地を確保',
 defend:'防衛時間終了まで拠点を守る',siege:'敵主将または拠点を制圧',
 boss:'章の決戦目標を達成'
});
export function battleStageType(kind='',enemyMode=''){
 const k=String(kind||'');
 if(Object.hasOwn(BATTLE_STAGE_TYPE_LABELS,k))return BATTLE_STAGE_TYPE_LABELS[k];
 return enemyMode==='monsters'?'魔物殲滅戦':'敵軍殲滅戦';
}
export function battleStageObjective(kind='',explicit=''){
 const objective=String(explicit||'').trim();
 return objective||BATTLE_STAGE_OBJECTIVES[kind]||'敵戦力を撃破';
}
