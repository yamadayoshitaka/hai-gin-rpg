# 顔モデルv17：つむじセンター分け・重力・独立ヅラ実装仕様

## 要求と構成
- 髪は顔本体や保存GLBの顔パラメータとは独立した着脱可能な3D資産とする。
- 髪型ごとに固定IDと設定を持ち、同一頭部へ異なる髪型を装着可能にする。
- 初期髪型は `center-part-gravity-long`。実頭皮のつむじを基準にセンター分けし、左右へ分岐した髪束を重力で下ろす。
- 頭頂・前髪・左右側面・左右後頭・襟足の実メッシュ頂点に毛根を持たせる。10万本は不要で、連続した頭皮カバーと標準1,440束の太い毛束で皮膚を隠す。
- 顔表面はXY領域索引と三角形補間で計算し、顔中央部の髪は左右へ分け、顔/首/肩/胸の衝突制約で貫通を防ぐ。
- 髪型設定と形状はGLB単独で保存でき、顔メッシュのGLBと混同しない。

## ファイル・関数単位
- `src/face-wig-styles.js`:
  `DEFAULT_WIG_STYLE_ID`、`WIG_STYLES`、`getWigStyle(id)`、`listWigStyles()`。
  スタイルごとに髪の分け目・つむじ基準点・重力・顔クリアランス・ヘアカット定義・資産IDを管理。
- `src/face-scalp-wig.js`: 
  `createScalpAnchoredWig(head, {styleId,count,color,lengthScale,externalColliders})`で生成する。
  `actualScalpCandidates`の実頂点からつむじに最も近い頂点を選択し、
  左右毛束のパート方向を求める。
  `createHeadEnvelope`で頭皮をフィットし、
  重力落下の静止形状 `drop(t)=0.5*length*t+0.5*g*(t*T)^2`
  （`T=sqrt(length/g)`）で頭に沿わせて伸ばす。
  `resolveCollision`は顔表面と髪の交差をXY三角形補間で検出し、
  目と頬の中央では髪を分け目側から外へ逃がす。
  胴体/肩のカプセル接触も残し、静止形状へ反映する。
  20Hzでガイド約320束に制約付き重力運動を適用し、残りには軽い揺れを与える。
  `root.userData.assetType='independent-wig'`、
  `hairStyleId`、`whorlPosition`を保持。
- `face-mesh-studio.html`:
  `wigStyle`から髪型IDを選ぶ。顔スライダー、保存顔、色、ズームを変更せずに差し替える。
  `exportWig`でヅラのみのGLBを保存。
  通常の顔GLBには表示中のヅラが装着されるが、元頭部とドナーは保存・未改変。
- `qa/independent-face-masters.test.mjs`:
  スタイルIDの独立性、左右のセンター分け、実つむじ、重力設定、衝突補正。
- `qa/independent-face-masters-browser.cjs`:
  髪型ID切替で顔設定が変わらないこと、GLBのwig node extrasにスタイルIDが残ること、
  単独GLBにFACE_MASTERが混入しないこと、正面・側面・後頭部の描画。

## 受入条件と制約
静的検査だけで芸術的な完成を宣言しない。頭皮露出・顔への貫通・左右分け目・肩への自然な接触を正面、斜め、横、後頭のスクリーンショットとAndroid実機で見る。
髪は全本数の高コスト完全物理計算ではなく、現状のモバイル向けガイド毛束近似である。
顔の数値標準（顎5、鼻穴2、鼻筋2.5）、男女別GLB、戦闘・町のモデルは変更しない。
