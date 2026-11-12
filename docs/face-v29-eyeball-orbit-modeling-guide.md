# 顔モデルv29：奥まった目を解消する3D眼球・眼窩・まぶた制作指針

## 制作資料
- [Blender Studio: Eyeball and Cornea / Eyeball Fitting / Eye Socket Detailing](https://studio.blender.org/training/blenderella/56040ecf044a2a00a515adad/)
- [Blender Studio: Geometry Eyelashes](https://studio.blender.org/training/blenderella/56040ecf044a2a00a515adb5/)
- [Anatomy For Sculptors: Realistic human 3D model — the eye](https://anatomy4sculptors.com/blog/realistic-human-3d-model-the-eye/)
- [Basic anatomy of the human eye for artists](https://pubmed.ncbi.nlm.nih.gov/3360770/)

※ Blender Studioは講座目次が参照できる。実際の動画視聴にはログイン・契約が必要な場合がある。本プロジェクトは無料公開の記述と造形原則に基づき実装したものであり、有料動画を視聴したと主張しない。

## ユーザー実機フィードバック
「目が奥に入ってる」。以前のv28は眼球を球体から顔面貼り付きの薄いアーモンド状メッシュに変更し、皮膚からの浮き量 .025×eyeRadius、中央の盛り上がり .23×eyeRadius しかない。原頭部の眼窩が深い場合、虹彩・白目が顔面に埋もれて見える。

## 造形ルール（女性・日本風の美少女方向）
1. 眼球の前面は局所眼窩の実面を基準に球面状に凸化。眼の中心は皮膚より十分前、上下まぶた付近では実皮膚へ自然に接続。**眼球全体だけを前へ平行移動しない**。
2. 眼窩中央/左右内側の深度を測り、凹んだ元メッシュに前面が飲み込まれないよう前方包絡面を使う。
3. 女性向けアーモンド形の眼裂の縦幅を、基本半径 .33 から .40 に変更。眼尻は引き延ばしすぎず、眉・アイライン・まつ毛も一つの linked eye pivot を使用。
4. 黒目/瞳孔を真円メッシュのまま維持。まぶた開口に収まる半径へ調整し、頂点を縦に clamp して横線状にしない。
5. アイラインは実まぶた面に追従。まつ毛はアイライン上から根元を作り、毛先をテーパー/カール。眼球・上下まぶた・眉・まつ毛の表示/GLB出力機能を維持。
6. 顔部位の前後調整は eyeDepth [-0.3,0.85]。デフォルトは既存GLBの値を維持（0）。過度の突出・眼裂の隙間がないか実機の正面/45度/横顔で確認する。
7. 髪v28の静的ウィッグ、首・肩の穴補修、顔の保存プリセットは触らない。

## 数値/品質確認
- 眼球前面の曲率: 女性 .58×eyeRadius（旧 .23）
- 眼球端（waterline）付近の前方浮き: min .15×eyeRadius（旧 .025）
- 女性眼裂の縦半幅: .40×eyeRadius×eyeHeight（旧 .33）
- source faceの深い眼窩を救済する局所包絡面を追加
- QA: 左右とも中心皮膚からの前面露出量 > .60×eyeRadius、目の中心がまぶた上縁より前、虹彩真円、eyeDepth操作時に前後距離が変化する。
- QAはコード形状条件であり美少女らしさを保証しない。Android実機の拡大／正面／45°／横顔で、突出しすぎ・寄り目・涙袋の不自然さ・瞳色・まつ毛長を確認して最終採否を判断。
