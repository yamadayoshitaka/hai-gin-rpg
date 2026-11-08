# 第1段階：人型頭部マスター・衣装ソース検証（CC0）

## 現状（2026-11-08）
- **高精細原本**：Blender Studioの Human Base Meshes v1.4.1 を公式HTTPSで取得、SHA-256固定で検証。元Blend約49 MBは加工しない。
- **実物の頭部**：`Head (Animation) - Realistic` = 頭部3242頂点＋眼球・虹彩、`Head (Sculpting) - Realistic` = 3307頂点＋眼球・虹彩。どちらも実際のBlenderソース形状。
- **実物の人体**：`Body Male - Realistic`、`Body Female - Realistic` は各約10,582頂点の人体と眼球を保持。
- **立体的な差別化**：元のBlendは触らず、プレビュー用メッシュの頂点に7種類の変形ターゲットを導入：JawWidth、CheekVolume、NoseProjection、NoseWidth、MouthWidth、ChinLength、BrowArc。剣士・魔法使い・忍者の暫定プリセット。
- **衣装の本物の素材**：Makehuman-2 CC0のViking Gear SetからTunic/Pants/Boots/Scalp/Beard/Eyebrows/Moustacheの実OBJと元PNGを保持し、MakeHuman UVを壊さずに別GLBへ出力。これは**未フィットの独立原型**であり、現行のQuaternius 65骨体に装着済みではない。
- **モデル検証**：`master-human-source-inspector.html` で顔と人体の3D回転・正面側面背面・ワイヤーフレーム・顔の立体形状プリセットを目視可能。
- **回帰**：`qa/blender-human-source-browser.cjs` は各実GLBをChromium+WebGLで読み込み、頭部形状プリセットの画素差、ワイヤ差、男女人体の読み込み、衣装の写真系Diffuseテクスチャを測定。
- **公開**：PR合格後にのみプレアセットを`assets/master-sources/blender/`へ配置し、ゲーム本編・50vs50戦闘のアバターは置き換えない。

## 注意点と品質ゲート
1. Sourceの3,200頂点の頭部は変形用ワイヤーであり、FF13級の写実的な顔が完成しているわけではない。
2. BLEND原本はCC0、プレビューに割り当てた頭部マテリアルは**仮の単色**。実写顔専用UV/PBR材質は未装着。実測Normal/Roughnessの欠けた材質を「フォトスキャン」と呼ばない。
3. オリジナルの頭部は表情シェイプキーなし。7種類はこの作業で生成した**造形バリエーション**であり、瞬きや口パク用FACS/AUではない。まぶた・口のアニメーションは別のQAが必要。
4. Blender頭部・Viking衣装・Quaternius骨格は異なるソース。体格・向き・ボーン・UV・手指・髪と兜の被覆を照合するまでは、これらの形状を無条件で合成してゲームに配置しない。
5. 実際の見た目の評価は頭部の正面・45度・横顔・逆光・目のアップ、髪と兜、重装備鎧、表情を確認してから。今は品質ゲート未通過。
6. LOD・テクスチャ圧縮・デシメートなどの**ゲーム向け最適化はマスター造形の承認後のみ**。
7. 追加課金ゼロ：CC0実体、Blender/GitHub Actionsの公開リポジトリ内無料機能のみで作成。

## 次に完成させる内容
- 顔：実写系肌アトラスと表情シェイプキー（閉眼、視線、5母音、口角）、眼球装着、眉・毛髪のフィット
- 衣装：元OBJのリギング/骨長合わせ、人体カット、貫通検査、金属鎧と兜の別PBR、武器を手に把持
- 召喚獣：四足獣・竜系の骨格を人間とは分離して作り、毛・鱗・皮膚のCC0テクスチャを部品別採用
- 比較UI：全マスターの正面・側面・動作、アートレビュー承認、品質指標をライブラリに表示

公式ソース：<https://www.blender.org/download/demo-files/>、<https://github.com/Makehuman-2/MH2_Asset_Repository_CCO/releases/tag/CC0>
