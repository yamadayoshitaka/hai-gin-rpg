# 灰銀のレゾナンス — HTTPSで安全に開けるマスター素材

2026-11-08更新。2026-10-21、MakeHuman Communityは古いPHPベースのフォーラムと個別アセットリポジトリをセキュリティ対策で停止した。www / static / download.makehumancommunity.org の個別パックURLは環境によってHTTPS警告、接続不可、タイムアウトとなるため、**ゲーム内の素材一覧には旧リンクを出さない**。

旧MakeHumanの特定高精細パック（Skins01/02、Eyebrows01、Eyelashes01、Hair Editor等）と、GitHubで確認した代替**コアアセット**は同じ内容ではない。GitHubリンクを貼っただけで旧パックが取得できたと主張しない。

## HTTPSの公式素材配布（実ファイル確認済）

- Blender Studio Human Base Meshes v1.4.1。CC0、約49MB。公式紹介ページ：https://www.blender.org/download/demo-files/ 、公式ZIP：https://download.blender.org/demo/asset-bundles/human-base-meshes/human-base-meshes-bundle-v1.4.1.zip
- Makehuman-2 CC0のGitHub Releases（配布タグとZIPファイルをAPIで確認）：https://github.com/Makehuman-2/MH2_Asset_Repository_CCO/releases/tag/CC0
  - Viking Gear Set CC0、約21MB：https://github.com/Makehuman-2/MH2_Asset_Repository_CCO/releases/download/CC0/RP_Viking_set_CC0.zip
  - MakeHuman system assets CC0、約405MB：https://github.com/Makehuman-2/MH2_Asset_Repository_CCO/releases/download/CC0/mh_system_CC0.zip
  - 公式プレビュー：https://github.com/Makehuman-2/MH2_Asset_Repository_CCO/tree/main/resource
  - **重要：** Vikingは既存のSuits02/Hats02パックと同じではない。ボーンやUVの互換性も未検証。ZIPは未ダウンロード、3Dには未適用。
- 写真PBRのCC0： https://polyhaven.com/a/cotton_jersey 、 https://polyhaven.com/a/fabric_leather_02 、 https://polyhaven.com/a/metal_plate_02 、 https://polyhaven.com/a/rusty_metal_sheet

## HTTPS GitHub上のコア資料（元の追加パックとは異なる）

- MakeHuman本体とコアアセット：https://github.com/makehumancommunity/makehuman
- 標準スキン：https://github.com/makehumancommunity/makehuman/tree/master/makehuman/data/skins
- 標準の顔・人体の形状変形ターゲット：https://github.com/makehumancommunity/makehuman/tree/master/makehuman/data/targets
- Blender用MPFBアドオンの公式コード：https://github.com/makehumancommunity/mpfb2

GitHubへ遷移できても、そこに旧リンクにあった「高解像度眉01」などの**同一実データ**が置かれていると意味しない。旧MakeHumanの停止した追加パックについては、安全な一次配布元が確認できるまで「直接取得不可・同一パック未確認」とする。

## モデルライブラリ内の表示ルール

- 候補の公式URLは HTTPS で Blender.org / Poly Haven / GitHub.com のみ。
- GitHubの公式アーカイブに実体のあるものは、プレビュー画像と正確なZIPサイズ・直接取得リンクを表示。
- 元の詳細パックが存在しないケースは「安全なGitHub参考元／元の高精細パックとは異なる」と明記。
- HTTPまたは証明書警告を回避する手順は書かない。ユーザーが「詳細設定から進む」などをしなくても利用できるリンクだけ案内。
- モデルは高品質マスターの参照から順次導入。素材選定・リンク修正は**FF13品質達成やインポート完了ではない**。

## 費用とライセンス

新規課金なし。Blender公式のHuman Base MeshesはCC0、MakeHuman本体の**コアデータはCC0**、MakeHumanプログラム本体はAGPL系、MPFBソフトはGPL系。MakeHumanのユーザー投稿パックにはCC-BY等もあり、一括してCC0とは扱わない。GitHubリリースのViking装備とシステムパックはCC0公開リポジトリの公式タグから取得する。Poly HavenはCC0。

旧サイトや一部の安全でないインフラを利用する代わりに、今回の安全な配布先で使える人型や写真PBRを先に検証する。
