# 全50種モンスター：種族別PBR表面処理（2026-11-21）

対象：`src/monster-catalog.js` の m001〜m050（全10ファミリー、50種類）。

## 実装内容
- `src/monster-all50-surface.js`：全50種類を16種の表面カテゴリに分類し、種族に適した共有Albedo / Normal / Roughnessの微細模様を使用。角・爪用の角質カテゴリは別途。
- 写真素材が適切な狼毛皮と竜鱗は従来どおり使用。昆虫に竜鱗、蜘蛛に竜鱗、死霊の皮膚に麻布、岩の体に鋼鉄を貼る誤分類を回避。
- 既存の特別なモデル・材質（m016 / m017 / m019、m021 / m022 / m024 / m025、m042の専用ガーゴイル石肌）、目・発光・半透明、アニメーションおよび敵AIには干渉しない。
- 高・中・原画LODのみ追加模様を割り当て、大規模戦闘のlow LODは従来どおり。
- 共有キャッシュで同種表面画像の毎フレーム生成とモデルごとのGPUメモリ重複を回避。

## 実写素材の出典（CC0）
| 用途 | 同梱ファイル | 元ファイル／作者 | ライセンス |
| --- | --- | --- | --- |
| 石ゴーレム色 | `assets/creatures/cc0-aerial-rocks-02-albedo.jpg` | Aerial Rocks 02, Rob Tuytel / Poly Haven | CC0 |
| 石ゴーレム粗さ | `assets/creatures/cc0-aerial-rocks-02-roughness.jpg` | Aerial Rocks 02, Rob Tuytel / Poly Haven | CC0 |

一次公開元：https://polyhaven.com/a/aerial_rocks_02

取り込み元の公開リポジトリ：
https://github.com/adithya-s-k/RCForge/tree/main/public/scenery

素材とライセンス一覧：
https://github.com/adithya-s-k/RCForge/blob/main/public/scenery/README.md

上記の2画像は元のJPEGバイナリから変更していません。1K normal写真は今回未取り込み（処理時のファイル取得上限）。代わりにマテリアルの微細凹凸は種族別のプログラム生成Normalで補完されます。

## 品質の限界と検証
- **現段階は50種の共通材質品質の底上げであり、提示されたAAA級画像に50種が到達したという意味ではない。**
- ほかの種族別模様は写真画像ではなく、パラメータから再現可能なGPU用の微細模様。完全実写化には種別専用のスキャン素材・UV調整・造形改善・顔/関節の検証が必要。
- `npm run test:monster-surfaces` で50種の対象漏れ、材質分類、モバイルLOD、既存マテリアル保護と共有アトラスを検証。
- 実機Pixel等のFPS測定とスクリーンショットでの見た目の合格は**未確認**。視覚的に不適切な素材貼り付けや動作異常は個別修正する。
