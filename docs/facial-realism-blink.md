# 現行65骨剣士：顔のPBR仕上げと自然な瞬き

## 実装
- 元モデル: `assets/characters/quaternius-base/Superhero_Male_FullBody.gltf`。目 `Eyes` (スキンあり)、眉 `Eyebrows`、頭 `Head` ボーン。元GLTFには目を閉じるモーフターゲットが存在しない。
- 共通実装: `src/character-system/facial-blink-runtime.js`
- 連携: `src/character-system/shared-character-runtime.js` → `createCharacter()`。人物の `update(dt)` と同じ頻度で瞬きが動き、待機中でも再生される。
- 衣装連携: `src/character-system/rigged-outfit-runtime.js`。ゲームと顔編集で同じヘッドボーンを使い、更新の二重計算を防ぐ。
- 顔編集: `character-face.html`。元の剣士の顔を拡大、閉眼/開眼/自然な瞬き、目の割合、髪と兜/衣装の表示、全身・正面・側面を確認。
- 材質: 現行の肌・眼球の色・法線テクスチャを継承。眼球には低粗さ/クリアコート、肌には控えめな反射。まぶたは頭骨に追従する追加形状＋肌テクスチャの頬の部分を参照。新しい写真顔に置換したわけではない。
- 瞬き間隔: 約2.4〜6秒の個体差。閉0.09秒、保持0.055秒、開0.155秒。手動の閉眼も可能。
- 負荷対策: `hero` は左右上下4つのまぶたと閉眼ライン。戦闘用 `battle` は左右の上まぶた2つだけに縮小し、外部モーションの65骨を維持。将来の大軍LODには距離・画面占有率に応じた省略を追加する余地がある。

## 動作確認と限界
- `qa/facial-blink.test.mjs`: 自然な開閉曲線、瞬きタイミングの分散、眼球のない素材への安全な未対応処理
- `qa/facial-blink-browser.cjs`: Chromium実描画で65骨、左右2目、開閉、元の髪と兜/衣装ON/OFF、JavaScriptエラーなしを検証
- [GitHub Actions](https://github.com/yamadayoshitaka/hai-gin-rpg/actions/workflows/facial-blink-regression.yml)
- これで**現行の顔を瞬きさせることはできる**が、顔造形そのものは引き続き元のゲーム用メッシュ（フォトスキャン顔ではない）。超写実を目指すには高精細な顔専用メッシュと肌/毛穴法線マップ、首の継ぎ目・表情のリターゲットが別途必要。新AI顔・人体モデルは未取得。
