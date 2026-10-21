# Gemini 接続用 Cloudflare Worker

GitHub Pagesは静的ホスティングのため、AIを動かすには別サーバーが必要です。

1. Cloudflareの Workers & Pages で Worker を作成し、`worker.js` の内容を貼り付けて公開します。
2. Worker設定の **Settings → Variables and Secrets** から **GEMINI_API_KEY** を Secret として登録します。Gemini APIキーをGitHubやHTMLに書かないでください。
3. スマホのゲーム画面上部の「AI未設定」をタップし、公開された Worker の URL (`https://....workers.dev`) を入力します。
4. 「Gemini AI接続済み」が表示されれば会話を試します。

GitHubの `index.html` は既にWorker URLを保存する機能に対応しています。

## モデル素材
`assets/models.json` とモデルの実ファイルが必要です。モデルJSONには `{"models":["assets/models/hero.glb","assets/models/mage.glb"]}` のように相対パスで指定してください。glbファイルが存在しないと旧式の簡易人形が表示されます。Kenneyの追加町モデルも `assets/town.json` に `{"models":["assets/town/house.glb"]}` の形式で指定できます。
