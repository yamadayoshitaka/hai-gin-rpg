# 灰銀のレゾナンス — 公開構成

`index.html` が GitHub Pages の入口です。

3Dモデルを表示するには、`hai-gin-assets.zip` 内の `assets/` フォルダーをそのままリポジトリ直下に配置してください。具体的には `assets/models.json`、`assets/town.json`、`assets/characters/*.glb`、`assets/town/*.glb` が必要です。ZIPファイルをそのまま置くだけではモデルは読み込まれません。

GitHub Pages は静的ホスティングのため、`/api/status` と `/api/chat` のNode.jsサーバーは動作しません。Geminiとの会話には別途サーバー側APIキーを保護するバックエンドと、そのAPIへの接続設定が必要です。ブラウザのソースコードにAPIキーを直接埋め込まないでください。
