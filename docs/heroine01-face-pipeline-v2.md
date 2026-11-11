# 美少女01：顔・眼球・まぶた・頭皮／髪の一貫造形手順（v2）

## 目的・前提
- 対象は `master-swordsman-prototype.html?featured=hero-girl-01&view=face` の **実3D試作**。ゲーム／戦闘用の完成美術認定とは区別する。
- ユーザー画像の主な不一致：眼球の飛び出し、平面の黒目と強い黒輪、上下まぶた不足、厚い下唇と突き出した下顔面、ピンク一色の頭皮キャップ、スパイク状の前髪。
- 「美人」は唯一の普遍的寸法ではない。今回の造形目標は、ユーザーの指定した**自然な成人女性の顔、眼窩に収まる目、なだらかな頬〜顎、繊細な口元、毛根が自然につながる髪**であり、既存作品のキャラクターを複製しない。

## 権威資料と採用した手順
1. [Blender Studio — Learn Character Modeling](https://studio.blender.org/training/blenderella/56040ecf044a2a00a515adb5/)：頭部→眼球・角膜→眼窩→眼球フィット→眼窩ディテール→鼻／口→頬・顎→まつ毛→毛髪の順に検証。
2. [Reallusion — CC Face Topology Guide](https://wiki.reallusion.com/Content_Dev%3ACC_Face_Topology_Guide)：眼球の寸法・位置を優先し、眼球形状を不自然に歪めるより眼瞼リムを合わせる。唇の内側境界も面として成立させる。
3. [Epic MetaHuman — 目のマテリアルコントロール](https://dev.epicgames.com/documentation/metahuman/eye-material-tools?lang=ja)：強膜、虹彩、瞳孔、角膜を分離。虹彩の直径と瞳孔の散大は独立設定。角膜縁の幅と彩度に注意。
4. [Blender — Interpolate Hair Curves](https://docs.blender.org/manual/fi/5.1/modeling/geometry_nodes/hair/generation/interpolate_hair_curves.html)：頭皮に固定したガイドから密度補間。髪の本数は流れ／被覆／毛先が一致しなければ見た目の品質にはならない。

## データの単一責任者
- **顔の全パラメータ定義**：`src/master-swordsman-face-proportions.js` の `FACE_PROPORTION_FIELDS`。
- **主人公の標準値**：`src/master-swordsman-featured-profiles.js` の `hero-girl-01.proportions`。
- **ジオメトリ**：`src/master-swordsman-assembly.js`（眼球・上／下瞼・黒目の追従）、`src/master-swordsman-face-proportions.js`（下顔面）、`src/master-heroine-facial-refinement.js`（鼻・唇の微細部）。
- **色材質**：`src/master-heroine-iris-fibers.js`（虹彩の放射繊維）、`src/master-heroine-skin-pbr.js`（皮膚）。
- **毛髪**：`src/master-heroine-long-hair.js`（頭皮から10万本の3Dライン＋生え際／下地）、プレビューで肌色と毛根色を連続補間。
- **旧 `eyeSize`** は量産兵の互換性のため維持。美少女01の黒目を変える正式な制御は `irisDiameter`（虹彩全体）と `pupilDiameter`（中心の黒い瞳孔）。

## この順序で調整（推奨）
1. **下顔面と唇**：`lowerFaceProjection` と `lipFullness` を先に下げて口〜顎の突き出しを減らす。耳前の横幅は `preEarFullness`／`parotidWidth` に限定し、顎先を無闇に尖らせない。
2. **眼球を眼窩に収める**：`eyeballScale`（サイズ）と `eyeSocketDepth`（頭部ローカルm単位・負で奥）で実メッシュを縮小・後退。強膜は自然なオフホワイト。
3. **上下まぶた・涙袋**：`upperLidCoverage` を上げ、まばたき時の上瞼とまつ毛を同じ親変換で追従させる。`underEyeSoftness` は控えめに、顔の肌メッシュ頂点色へなじませる。目が完全に隠れないこと。
4. **虹彩と瞳孔**：`irisDiameter` と `pupilDiameter` を独立調整。大きい黒い円の二重描画を避け、虹彩の輪郭と内部繊維、ハイライトを控えめにする。
5. **頭皮と髪**：毛根色は地肌から徐々に濃くする。**頭皮全体をピンク一色の不透明なヘルメットにしない。** 元メッシュの根元から10万本のラインを維持し、前髪は眉にかからず側頭部・後髪につながるガイドに沿わせる。
6. **検証**：正面＋左右側面＋頭頂＋背面を連続確認。眼球突出、二重虹彩、上下まぶたの貫通、口紅の顎への流出、髪のトゲと抜けを検査。美術品質が未完成なら「完成」とは表記しない。

## 後ろ髪の12束成形（2026-11-11追加）
- 頭皮の各毛根から生える10万本・6区間の線ジオメトリと3層を維持し、後ろ髪7万本の毛先を12本の重なり合うガイド束へ穏やかに収束させる。前髪・側頭髪の経路は変更しない。
- 末端の判定は定数や自己申告ではなく**身体衝突処理後の実メッシュ座標**から計算する。頭部中心から十分離れた根元の毛束で、毛先が内側へ寄った比率 `rearEndTaperRatio` が57%を超えることをQAで検査。
- 実描画による正面・側面・背面の最終美術確認は別途必要。ストランドを12本に減らした変更ではない。

## QAと公開ゲート
- `qa/master-heroine-wig-ocular-face-regression.test.mjs`：数値／実3Dデータ、顔の原本非破壊。
- `qa/heroine01-focused-browser.cjs`：実WebGLで目・瞼・黒目・髪の総合検証。
- `qa/master-swordsman-browser.cjs`：元の剣士・衣装・瞬きのリグレッション。
- `Stage-1 integrated swordsman asset QA` と `Heroine 01 100k hair face and wire QA` の両方に成功した変更だけを main にマージ。公開は GitHub Pages ワークフローの success を別途確認。
- テスト成功は美術品質の自動認定ではない。ユーザーの比較画像と正面／側面の目視判断を最終段階で行う。
