# AI白メッシュへの現行剣士の金属PBR再利用（2026-11-07）

## 実装済み

- 比較: [剣士GLB比較画面](../swordsman-ai-test.html)
- 写真鋼材: `assets/textures/outfits/steel.jpg` / `gold-brocade.jpg`
- PBR仕上げ: `src/character-system/ai-swordsman-steel-finish.js`（旧金属写真を明るさ補正し、鋼材・微細な凹凸・金属感を再利用）
- UVなしGLB: 面ごとの平面投影UVを表示用ジオメトリへ非破壊的に生成
- 元の白メッシュへ: 比較画面のチェックをOFF。材質・元のジオメトリ参照を復元
- ゲーム内テスト: [100対100・剣士1体の写真鋼材試験](../tactics-wireframe.html?army=100&aiSteelTrial=1)。試験ボタンでON/OFF可能
- ゲーム本体の試験は**現在の骨付き剣士の鎧の質感だけ**を変える。未リギングのAIメッシュを戦闘に強制投入しない

## QA結果

2026-11-07、非AIの既存無料GLB (`assets/characters/free-knight/knight_full_plate_armor.glb`) で検証。
- 元モデル 56メッシュ / 4,010三角形（現在の高品質目標未満）
- 53メッシュに現行剣士の写真鋼材を適用
- UVを持たない53メッシュに投影UVを自動生成
- 元のGLB材質への切り戻し→再適用成功
- [WebGL比較試験記録](https://github.com/yamadayoshitaka/hai-gin-rpg/actions/runs/42375998368)

このモデルは**AI生成結果ではなく、仕上げ処理の動作確認用**である。高品質なAIモデルが生成されるまでは代用として正式採用しない。

## 3DAI Studioの実行状況

3DAI Studioに1回ずつブラウザから画像アップロード・公式生成ボタンクリックを実施：
- Multi-view / 白メッシュ Fine detail: [生成ログ](https://github.com/yamadayoshitaka/hai-gin-rpg/actions/runs/42375717586)
- Single image / 白メッシュ Fine detail: [生成ログ](https://github.com/yamadayoshitaka/hai-gin-rpg/actions/runs/42376363207)

**どちらもサイト側の「Generation failed. Try another image or setting.」で終了したため、現時点では新規AI生成GLBは0体。** 有料APIや自動再試行・回避操作はしていない。

新しい候補GLBが正常取得された場合は `assets/ai-model-inbox/` を経て `assets/ai-generated/armor/<id>/candidate.glb` として登録し、比較画面で写真鋼材仕上げを有効にできる。骨格・向き・内外面・貫通・商用利用条件を確認するまではライブ戦闘モデルを自動置換しない。

## 品質上の制約

写真鋼材は**質感の改善**であり、幾何形状・生体解剖・鎧のサイズ・関節アニメーションを自動修理するわけではない。4,010三角形の既存鎧に適用しても、生成のポリゴン品質や細工が高級化したことにはならない。肌、兜の前後軸、毛、顔、指、手首、膝と背面の目視検証が必要。
