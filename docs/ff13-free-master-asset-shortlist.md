# 『灰銀のレゾナンス』高品質マスター用・無料素材の一次候補（2026-11-08）

目的：FF13級の写実的な3D外観を目指し、最初に本物の高品質マスターを製作する。ゲーム側の軽量化・LODは承認後。**一覧登録は取得・インポート・品質検証の完了を意味しない。**

## 導入の優先順

| 優先 | 部品 | 配布元（公式） | 形式・注意 |
| --- | --- | --- | --- |
| 1 | 高精細人体／顔ワイヤー | [Blender Studio Human Base Meshes v1.4.1](https://www.blender.org/download/demo-files/) | [公式ZIP v1.4.1](https://download.blender.org/demo/asset-bundles/human-base-meshes/human-base-meshes-bundle-v1.4.1.zip) 約49 MB／CC0。Blenderでスカルプト・リトポロジーしてから骨格へ適合 |
| 1 | 顔・鼻・頬・体型の可変形状 | [MakeHuman MPFB](https://www.makehumancommunity.org/mpfb/) と [Nose01/Cheek01](https://www.makehumancommunity.org/assets/assetpacks/index.html) | コアモデル・ターゲット・出力はCC0、Blenderアドオン本体はGPL。Quaterniusと同一トポロジーではないため単純コピー不可 |
| 1 | 男女の肌テクスチャ | [Skins01：女性](https://www.makehumancommunity.org/assets/assetpacks/skins01.html)／[Skins02：男性](https://static.makehumancommunity.org/assets/assetpacks/skins02.html) | CC0、約99 MB／72 MB。UVアトラスの違いと顔の写真細部の粗さを検証 |
| 1 | 眉・まつ毛 | [Eyebrows01](https://www.makehumancommunity.org/assets/assetpacks/eyebrows01.html)／[Eyelashes01](https://www.makehumancommunity.org/assets/assetpacks/eyelashes01.html) | CC0、高精細の別パーツ。頭・眉骨・まぶたへの位置合わせと干渉検査 |
| 1 | 顔の表情・口パク | [Faceunits01](https://www.makehumancommunity.org/assets/assetpacks/faceunits01.html)／[Visemes01](https://www.makehumancommunity.org/assets/assetpacks/visemes01.html) | CC0、ターゲット形状。瞬き・口の開閉・発声連動にリターゲットが必要 |
| 1 | 高密度ヘア・獣毛 | [Hair Editor](https://www.makehumancommunity.org/assets/assetpacks/haireditor.html) | CC0、hair.blend/fur.blend。Geometry Nodesで毛髪マスターを作り、必要なら後日カード/LODへベイク |
| 1 | 布・革・金属の実写PBR | [Cotton Jersey](https://polyhaven.com/a/cotton_jersey)／[Fabric Leather 02](https://polyhaven.com/a/fabric_leather_02)／[Metal Plate 02](https://polyhaven.com/a/metal_plate_02) | CC0、Poly Havenに公式PBRパックあり。8K等をソース保管して適切なUV/Normal/Roughnessへ |
| 2 | 髪型参考 | [Hair01](https://www.makehumancommunity.org/assets/assetpacks/hair01.html) | CC0だが主にローポリ/スタイライズ。FF13級の最終髪としてそのまま使わない |
| 2 | 職業衣装・兜・武器 | [Suits02](https://www.makehumancommunity.org/assets/assetpacks/suits02.html)／[Hats02](https://www.makehumancommunity.org/assets/assetpacks/hats02.html)／[Equipment01](https://www.makehumancommunity.org/assets/assetpacks/equipment01.html) | CC0。元の品質差を確認し、既存65骨の体型と手把持へ再フィット |
| 2 | 召喚獣・モンスター系統 | [Animal01](https://www.makehumancommunity.org/assets/assetpacks/animal01.html)／[Bodyparts01](https://www.makehumancommunity.org/assets/assetpacks/bodyparts01.html) | CC0。獣人頭部の変形・角の装飾用。四足獣・ドラゴン本体の骨格を自動生成する素材ではない |
| 2 | 古い武具・荒れた環境 | [Rusty Metal Sheet](https://polyhaven.com/a/rusty_metal_sheet) | CC0。16Kまでの素材候補。磨かれた高級鎧の質感とは別 |

### 権利と実装方針
- Blender StudioのHuman Base Meshesバンドルは公式Demo Filesの対象項目にCC0と明記。隣の別アセットにはCC-BYがあるため混在させない。
- MakeHuman/MPFBは**コアアセットCC0、プログラム本体はGPL/AGPL**。追加のコミュニティ製アセットは**パック個別**でCC0かCC-BYか確認する。特にHair02、Bodyparts02/03、Equipment02/03等はCC-BYであるため今回のCC0リストには含めない。
- Poly Havenの公開素材はCC0、写真由来のPBRマップ。公式サイトからダウンロードし、ライセンスとソースURLを台帳へ残す。
- まず男性剣士１体で、顔のワイヤー、皮膚、髪、衣装、瞬き、口パクを品質検証。次に女性マスターと他職業へ派生。モンスターは系統別の骨格を先に作る。
- アセット取得時に元ZIP/Blendとメタデータを保持。顔写真は本人の同意が必要。テクスチャや頭部データのUV転写が済むまで既存のゲーム用顔を壊さない。
- **今回のGitHubへの登録は調査済みURLと用途の追加のみ。実際の画像・GLB/Blendの導入、8Kの貼付、FF13級の品質達成は未実施**。予算は新規課金ゼロ。

素材一覧のデータは `src/master-asset-acquisition-candidates.js`、UIは `master-model-manager.html` の折りたたみ欄。追加のQAは `qa/master-asset-acquisition-candidates.test.mjs`。
