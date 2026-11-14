# m006 黒爪パンサー：肩甲帯と四肢の伸展、獲物の捕捉に使う可動爪

初回実装 2026-11-14。架空の黒爪パンサー m006 だけを変更。人型・人物・召喚・戦闘兵士の共有モデルを変更しない。

## 解剖学・比較運動の資料
- Hudson et al. (2011), Functional anatomy of the cheetah (Acinonyx jubatus) forelimb, Journal of Anatomy. https://pmc.ncbi.nlm.nih.gov/articles/PMC3077521/ — 肩甲帯を胸郭上で移動できる鋸筋と、接地時の前肢負荷の参考。**チーターとパンサーは同一種ではないため、移動量の推定値は転用しない。**
- Muscular anatomy of the forelimb of tiger (Panthera tigris), Journal of Anatomy (2022). https://pubmed.ncbi.nlm.nih.gov/35107175/ — ネコ科大型種にみられる肩の屈伸、肘伸展、指と手根の筋群を調べ、肩周りの筋量形状を設計。
- 3D Morphometric and Posture Study of Felid Scapulae Using Statistical Shape Modelling, PLoS ONE (2012). https://pmc.ncbi.nlm.nih.gov/articles/PMC3324489/ — 3D肩甲骨形態と姿勢の関係。肩甲帯に独立ピボットと立体筋面を導入する根拠。
- Updating the forelimb anatomy of the domestic cat based on evolutionary inferences of its muscles and nerves I: Shoulder and brachium, Journal of Anatomy (2026). https://pmc.ncbi.nlm.nih.gov/articles/PMC13398976/ — 指行性歩行・遠位趾関節の爪出し入れを形状と動作に採用。

**注意**：論文から新規コードでメッシュ・アニメーションを設計した。論文の図、原画、他者3Dデータは転載・流用していない。架空の種族 m006 の生態や黒爪の力学が実証されたわけではない。

## 立体モデル・動作の変更
1. 胸郭の左右に独立した肩甲帯ピボットと、厚みのある肩甲筋の実メッシュを追加。後背部の脊柱傍筋も独立した小振幅回転に対応する。
2. 頭部に左右の咬筋、頬骨の土台、眼窩上隆起、鼻孔・鼻鏡、ヒゲ根元を立体表面として追加。毛皮の滑らかな輪郭を維持。
3. 前後4肢の手根・足根ピボットに、足裏パッド4つ、肉球4本×4肢、16本の爪ピボットと埋め込み式爪を実装。旧固定足メッシュは m006 のみ除外して二重化を防止。
4. 歩行時は低姿勢の肩甲骨と前後肢の接地位相差、足首の屈伸。襲撃時は爪の角度を下げて捕捉、歩行では爪を引く。尾の筋肉は小さな逆位相の安定運動。
5. Three.js で局所的な骨格Group／材料実メッシュを追加し、low/high/detail別のLODを継承。

## 品質の境界
- 自動試験 qa/monster-m006-panther-retractile-claws.test.mjs では、新規造形実体・関節階層・UV/法線・LOD・全10動作・他49種への不意の波及・材料キャッシュの解放を検証。
- リアルな軟組織スキニング、実機fps、全方向シルエットの目視、接地物理・肩の皮膚貫通については未検証。テスト成功は写真品質の保証ではない。
- 有料APIは使用せず、既存の停止済み自動バッチは再開しない。
