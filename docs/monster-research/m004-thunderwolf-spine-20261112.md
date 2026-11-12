# m004 雷迅の魔狼：疾走・急加速時の脊柱／骨盤／四肢の実改修
調査・実装日：2026-11-12。非人型の雷属性狼。現実のイヌ科を骨格・筋力学上のアナロジーとして使用。ゲーム内の超自然的な電撃能力そのものに科学的根拠はない。

## 今回ネットで実際に確認した一次文献
1. *Running, jumping, hunting, and scavenging: Functional analysis of vertebral mobility and backbone properties in carnivorans*. Journal of Anatomy. https://pmc.ncbi.nlm.nih.gov/articles/PMC10780164/ — オオカミの持久追跡と捕獲直前の脊柱可動度を区別。**常時大きく体幹をしならせるのではなく、急加速・捕獲時に腰部運動を強める**設計根拠。
2. Walter & Carrier (2007), *Ground forces applied by galloping dogs*. Journal of Experimental Biology. https://pubmed.ncbi.nlm.nih.gov/17210958/ — 四肢が疾走周期においてそれぞれ異なる力学的役割を担う。左右肩甲帯と前後肢の位相を分離。
3. Sharir et al. (2006), *Structural and functional anatomy of the neck musculature of the dog*. Journal of Anatomy. https://pmc.ncbi.nlm.nih.gov/articles/PMC2100244/ — 頸部の筋肉は頭の姿勢安定・方向付け・首と肩甲帯の制御に関与。頸筋の実メッシュと脊柱屈伸に逆相する補正を追加。
4. *Planar Covariation of Hindlimb and Forelimb Elevation Angles during Terrestrial and Aquatic Locomotion of Dogs*. PLOS ONE. https://pmc.ncbi.nlm.nih.gov/articles/PMC4517757/ — 歩行・速歩・駈歩で前肢・後肢の節間角と協調位相が異なる。飛脚／着地に応じた足根関節と足趾の分離。

上記は独自コードを設計するための文献。画像・論文図版・他人の3Dモデルをコピーしていない。

## 具体的な実メッシュ修正
- 腰部（lumbar）に左右の脊柱起立筋隆起と長軸方向の筋束を造形。骨盤（pelvis）を腰ピボットの子にし、実際の後ろ脚2本と尻尾を**骨盤の子**へ再配置。従来の尻尾・後肢の世界座標は変えない。
- 左右肩甲帯（scapulaL/R）を別メッシュ・別ピボットとして追加。頸部支持筋（neckCollar）の頭部安定化用の可動メッシュを追加。
- 四肢それぞれに独立した足根関節（hock）と趾節グループ（toe）を新設し、4本の足趾と爪の3D形状を可動。
- 顔の側頭筋、頬骨・鼻梁、鼻孔、ヒゲ毛根、左右耳軟骨を追加して単なる色替えでない固有造形にした。

## モーション改修
- 持久走と瞬間的な捕獲・急加速で腰部の屈伸振幅を変える。骨盤は腰とは異なる位相・角度で連動。
- 歩行・疾走で肩甲帯を左右位相差つきで駆動。足根屈伸と足趾接地／蹴り出しを分離。
- 頭部の上下反動を頸部で抑制。襲撃時は首・耳の反応を連携。
- 飛びかかり／ジャンプ時は骨盤屈伸と尻尾のピッチ制御を追加。
- 対象は **m004だけ**。m001～m003、m005～m050、人型16体、共通face/rig/GLBには変更を波及させない。

## 検証・未達
- qa/monster-m004-thunderwolf-gallop.test.mjs で真の THREE.Group 親子関係、後脚/尻尾の静止時の世界座標、実メッシュとUV、low/high LOD、全10アクション、人型の隔離、メモリ解放を検証。
- **実骨格スキニングや筋肉ウェイト変形ではない**。局所剛体メッシュの親子変換であり、関節部の柔らかい皮膚の変形、自己貫通防止、環境との接地制約は別工程。
- Android実機FPS、近接画面スクリーンショット、自然さの目視評価、実写級の美術品質は未検証。品質カウンター更新を完成と誤認しない。
- 追加有料AI/モデルAPIを使用しない。

次の個別対象：m005「翠森の古狼」。旧15分自動品質バッチとChatGPT個別改修タスクはユーザーの指示により停止したまま維持する。
