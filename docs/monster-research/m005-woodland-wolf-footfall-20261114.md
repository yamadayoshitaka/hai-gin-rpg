# m005 翠森の古狼 — 足先の接地・頸部・肩甲帯の個別リアル化

実装：2026-11-14。対象は非人型 m005 のみ。既存キャラクター／人型モンスター／戦闘兵士／GLB資産は変更しない。

## 研究出典（構造・運動の参考）

1. Holler et al. (2010), *Kinematic motion analysis of the joints of the forelimbs and hind limbs of dogs during walking exercise regimens*, American Journal of Veterinary Research, https://pubmed.ncbi.nlm.nih.gov/20594074/ 。低い障害物を越える歩行では肘・手根・膝・足根の屈曲が増加。m005 の足首と足趾を独立に配置する設計根拠。
2. Wada et al. (1993), *Electromyographic and kinematic studies of tail movements in dogs during treadmill locomotion*, Journal of Morphology, https://pubmed.ncbi.nlm.nih.gov/8411184/ 。犬の歩行と速歩で尾筋が左右交互に活動し、疾走時は安定化に関与。尾の基部／中間の小幅な位相差の根拠。
3. *Planar Covariation of Hindlimb and Forelimb Elevation Angles during Terrestrial and Aquatic Locomotion of Dogs*, PLOS ONE, https://pmc.ncbi.nlm.nih.gov/articles/PMC4517757/ 。歩容による前後肢の協調と差異の設計参考。

研究対象はイヌ科を中心とする。架空の「森林で忍び歩く古狼」固有の歩き方を科学的に実証したものではない。図版や他人のメッシュを流用せず、Three.jsで形状と動きを実装。

## 変更内容
- 左右の肩甲帯を実メッシュ＋独立回転 Group として造形。頸部に厚い筋肉・襟毛の根元メッシュを設置し頭部回転時に見える滑らかな重なりを狙う。
- 耳の皮膚と内耳軟骨を頭部ピボットに接続。頬の咬筋／上顎／鼻孔を深さのある立体造形へ。
- 4本脚それぞれの carpal（前脚手根・後脚足根相当）と toe ピボットを独立させ、足裏パッドと16本の趾、皮膚に埋まる爪を追加。固定式の旧足先とは重複させない。
- 静かな歩行は肩の左右位相差、足首の接地屈伸、頭頸の低い姿勢、尾の小さな補正を用いる。疾走・襲撃・跳躍と分ける。
- 元の 50種、戦闘アニメ、モンスターの行動IDは維持。source/high/low のメッシュ密度設定にも対応。

## テストと留保
- qa/monster-m005-forestwolf-footfall.test.mjs で独立関節、親子関係、造形パーツ、UV/法線、LOD、全10動作、他種への波及なし、素材解放を確認。
- 実写級のGLBスキニングや完成版リトポロジーではなく、骨格Groupに結び付いた局所メッシュである。
- Android実機の近接美観、足裏接地、メッシュ貫通とFPSは未検証。テストが通っても実写品質達成と扱わない。
- 新たな有料APIは使用していない。従来の定期タスクは停止維持。
