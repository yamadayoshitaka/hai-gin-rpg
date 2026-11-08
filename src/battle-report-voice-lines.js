/**
 * Spoken, prerecorded battlefield report summaries.
 * The full factual report (numbers/locations/names) stays visible as text.
 * Audio is only a matching short summary, never a fabricated number.
 * All voices are rendered offline by the free VOICEVOX engine.
 */
export const BATTLE_REPORT_VOICES=Object.freeze({
  start:{speaker:'軍師',voices:['麒ヶ島宗麟','玄野武宏'],lines:['各隊、戦闘開始！ 配置につけ！','戦況の監視を開始する。全隊、前進せよ！']},
  overview:{speaker:'軍師',voices:['麒ヶ島宗麟','玄野武宏'],lines:['戦況を報告する。引き続き各隊を監視する。','全部隊の戦況を確認中。指示を待て。']},
  leader:{speaker:'伝令',voices:['白上虎太郎','剣崎雌雄'],lines:['軍師が倒れました！ この隊は命令を受けられません！','大変です！指揮官が戦闘不能です！']},
  'commander-fallen':{speaker:'伝令',voices:['白上虎太郎','剣崎雌雄'],lines:['軍師が戦闘不能！指揮系統が途絶えました！','指揮官が倒れました！ 命令を確認できません！']},
  critical:{speaker:'軍師',voices:['麒ヶ島宗麟','玄野武宏'],lines:['味方部隊が壊滅寸前だ！ 援軍を急げ！','危険だ！ 直ちに撤退か援護を検討せよ！']},
  warning:{speaker:'軍師',voices:['麒ヶ島宗麟','玄野武宏'],lines:['前線が押されている！守備を固めろ！','味方部隊が劣勢だ！支援を急げ！']},
  recovered:{speaker:'伝令',voices:['白上虎太郎','剣崎雌雄'],lines:['味方部隊の態勢が回復しました！','前線が持ち直しました！']},
  close:{speaker:'斥候',voices:['雀松朱司','白上虎太郎'],lines:['敵影を確認！近距離に敵がいます！','敵が接近中です！警戒してください！']},
  mission:{speaker:'伝令',voices:['白上虎太郎','剣崎雌雄'],lines:['命令を達成しました！','任務完了！次の指示を待ちます！']},
  'commander-warp':{speaker:'伝令',voices:['白上虎太郎','剣崎雌雄'],lines:['軍師の帰還を確認しました！','軍師が味方陣地に帰還しました！']},
  'summon-fall':{speaker:'伝令',voices:['白上虎太郎','剣崎雌雄'],lines:['召喚獣が消滅！騎乗者が落下しました！','緊急報告！騎乗者が落下しました！']}
});
export function reportAudioCategory(report){
 const key=String(report?.key||'');
 if(key.startsWith('massmission:'))return 'mission';
 const category=key.split(':')[0];
 return Object.prototype.hasOwnProperty.call(BATTLE_REPORT_VOICES,category)?category:null;
}
export function reportAudioKey(category,line,voice){
 return 'report::'+category+'::'+line+'::'+voice;
}
