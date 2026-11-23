# 新・ウィッグ工房の外部GLB素材とライセンス

## 配布元
- リポジトリ: https://github.com/kblood/CharacterCreator
- ソース: MakeHuman system assets (CC0), CharacterCreator が加工して公開した髪用GLB
- ライセンス: CC0-1.0。配布元の [LICENSE-NOTES.md](https://github.com/kblood/CharacterCreator/blob/master/LICENSE-NOTES.md) の **Generated files** に `output/hair_*.glb` を CC0 と明記
- 同梱するのは **GLB資産のみ**。配布元の GPL-3.0-or-later の生成ツール、Three.jsのアプリケーションコードは導入しない

## 初期取り込みGLB
| Style | File | Git blob SHA-1 (asset identity) | bytes |
| --- | --- | --- | --- |
| long01 | hair_long01.glb | 3a898bb098bd81ff45b24422890a47320a5d922d | 1,545,168 |
| bob01 | hair_bob01.glb | 8982bedabde11928b18bcedc9084fc77db9ee455 | 1,971,860 |
| ponytail01 | hair_ponytail01.glb | eb86d1319e83feec5c314b4639a8b35fd31d866a | 1,825,960 |

GitHub Actions Pagesのデプロイで `scripts/import-cc0-wigs.py` が配布元から直接ダウンロードして、**GLBのバージョン・ファイルサイズ・Git blob SHA-1・メッシュの存在**を検証し、`pages-dist/assets/wigs/cc0/` にステージします。許可なしの新バイナリ差し替えは失敗させます。

## 新モデルの装着と出力
- 従来の `hair-asset-studio.html` は新しい `wig-studio.html` へ移動
- 三角形メッシュ `assets/generated/neutral-face-v121.glb` を採寸のみに使用。ウィッグプレビューの既定値では顔・身体のメッシュは描画しない
- インポートしたCC0 GLBの髪の形・UV・テクスチャを保ち、頭型の横幅・頭頂・前後位置にフィットさせる
- 未完成の旧GLB・旧毛束生成器は読み込まない
- GLTFExporterによる **装着済みウィッグだけ** のGLB書き出しをサポート
- CC0素材の元の形状が、利用者の4面見本にそのまま一致するとは限らない。横髪・前髪・毛流れの造形は実機品質監査の対象

配布元のコードと素材ではライセンスが異なるので、GLBアセットのみを取得すること。クレジットはCC0の義務ではないが監査用に記録する。
