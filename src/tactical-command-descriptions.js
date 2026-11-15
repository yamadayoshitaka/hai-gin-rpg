/**
 * Combat descriptions mirror the active battle-order-message modifiers.
 * Values are execution effects, NOT estimated tactical success probability.
 */
export const TACTICAL_STRATEGIES=Object.freeze({
 eliminate:Object.freeze({name:'全滅',effect:'敵部隊を最優先で追撃・撃破。勝利条件が敵殲滅の戦場向け。'}),
 environment_prepare:Object.freeze({name:'環境整備',effect:'ジョブに応じ、味方施設の消火・修復、敵の門の解錠、障害物への対応を優先。'}),
 recovery:Object.freeze({name:'支援',effect:'僧侶による負傷隊の回復・救護を優先。僧侶不在では回復効果なし。'}),
 objective:Object.freeze({name:'目的遂行',effect:'ステージ固有の勝利目標を優先。到達・防衛・拠点制圧など戦場により異なる。'})
});
export const TACTICAL_ORDERS=Object.freeze({
 charge:Object.freeze({name:'突撃',effect:'敵部隊を1つ以上選択。分隊がある場合は複数目標へ同時突撃。移動速度+25%（大軍戦+30%）。'}),
 defend:Object.freeze({name:'守備',effect:'地図で防衛地点を指定し、複数分隊へ別々の防衛地点を割当て。被ダメージ軽減（物理9〜24%・属性12〜32%）。'}),
 hold:Object.freeze({name:'待機',effect:'マップ上の指定地点で待機。追加の数値強化なし。'}),
 retreat:Object.freeze({name:'退却',effect:'マップ上の退却先へ後退。追加の数値強化なし。'}),
 support:Object.freeze({name:'支援',effect:'地図で支援先を指定し、僧侶などの分隊が救護。'}),
 explore:Object.freeze({name:'探索',effect:'指定した建物・宝箱などのオブジェクトを探索。'}),
 destroy:Object.freeze({name:'破壊',effect:'指定した門・橋・木・建物などのオブジェクトを破壊。忍者・魔法使い・召喚士・格闘家が担当。'}),
 weaken:Object.freeze({name:'弱体',effect:'忍者は機動-18%、シーフは防御-15%、魔法使いは攻撃-20%。狙った敵に時間制のデバフ。'}),
 warp:Object.freeze({name:'軍師ワープ',effect:'UR軍師のみ、味方陣地の空き地点へ戦闘中1回移動。'})
});
export function strategyEffect(id){return TACTICAL_STRATEGIES[id]?.effect??'状況に応じた自動行動を優先。';}
export function orderEffect(id){return TACTICAL_ORDERS[id]?.effect??'対象と編成によって効果が変化。';}
