# 3DAI Studio 無料Web自動生成（人間・モンスター・召喚獣・鎧）
 
## 接続先
- ブラウザUI: https://3dai.dev/en （登録不要と表示）
- 実装: `qa/3dai-swordsman-auto.cjs`
- GitHub Actions: `.github/workflows/3dai-swordsman-auto.yml`
- 設定の一例: `data/ai-generation-requests/swordsman-armor-3dai-001.json`
- 同じデータ受け口: `assets/ai-model-inbox/manifest.json` → `tools/ai-3d-free-import.mjs`
- 現行剣士比較: `swordsman-ai-test.html`
 
## 動作
GitHub Actionsの実行を1回選択するだけで、Chromiumが公開サイトへ移動し、Multi-viewタブを選び、4方向スロット（Front/Back/Left/Right）を認識します。
**Texturedが利用可能な場合にのみ**Fine detailを選択して指定画像を通常のファイル入力からアップロードし、公式のGenerateボタンを1回だけ押します。GLBダウンロードUIが出たら通常のダウンロードで取得し、PBR/UV/テクスチャ有無とGLB形式を検査します。合格した場合だけインボックスに保存し、既存のAI取り込みGitHub Actionsが本体未採用の候補として管理します。
 
**現在の制約（2026-11-07 の実機観測）:** 3dai.dev の Textured オプションは「Texture service starting / Unavailable」と表示され、白メッシュのみ利用可能でした。したがって、剣士の最初の自動生成実行は **blocked_texture_unavailable**、生成試行0件、GLB未生成でした。白メッシュへ勝手に変更することはしません。
 
## 起動
[GitHub Actions](https://github.com/yamadayoshitaka/hai-gin-rpg/actions/workflows/3dai-swordsman-auto.yml) から Run workflow:
- `mode=probe`：無料・画像アップロードやGenerate操作なし、画面とテクスチャサービスの状態を検査
- `mode=generate`：Texturedが有効な場合のみ、画像アップロード→生成→GLBダウンロード→候補登録
- `request_path`：デフォルトは現行剣士の単独鎧。別の `data/ai-generation-requests/*.json` を指定すれば人・動物・モンスター・召喚獣・衣装・武器に再利用可能
 
登録するリクエストJSONの構造:
 
```json
{
  "schema": "hai-gin/3dai-studio-generation/v1",
  "id": "my_dragon_01",
  "sourceUrl": "https://3dai.dev/en",
  "category": "monster",
  "input": "multi-view",
  "references": {
    "front": "assets/ai-reference/dragon/front.png",
    "back": "assets/ai-reference/dragon/back.png",
    "left": "assets/ai-reference/dragon/left.png",
    "right": "assets/ai-reference/dragon/right.png"
  },
  "quality": "fine-detail",
  "textureRequired": true,
  "allowWhiteMesh": false,
  "maxSubmissionsPerRun": 1,
  "paidAllowed": false
}
```
 
### 安全・品質
- **サイトUIのみ操作**。非公開API、認証情報、CAPTCHA、アクセス制御、レート制限を迂回しません。
- 1実行で最大1件。連続再試行や別アカウント切替なし。
- Texturedが無効な場合は生成せず、GitHub Actionsの成果物に理由を記録。
- 生成結果はQA候補のみ。顔、髪、関節、衣装の中空構造、尻尾、四足歩行、テクスチャの完成度、法的な商用利用可否は**自動では保証できません**。
- 生成サイト側で自動化が禁止されたり、ログイン・課金・CAPTCHAが求められた場合には終了します。サイトの利用規約に従ってください。
- 入力画像と結果GLBは公開リポジトリに格納されます。公開可能な、自分に利用権がある素材に限定してください。
- 本ゲームの戦闘モデルは自動で置き換えません。

## 実行結果
- 2026-11-07 インスペクション成功：[3DAI画面の構造調査](https://github.com/yamadayoshitaka/hai-gin-rpg/actions/runs/42371392064)
- 2026-11-07 事前チェック成功（Textured無効）：[Run](https://github.com/yamadayoshitaka/hai-gin-rpg/actions/runs/42371722440)
- 2026-11-07 一度だけ実行した高精細生成： [Run](https://github.com/yamadayoshitaka/hai-gin-rpg/actions/runs/42371840261) （Textured無効のため生成ボタン押下なし）
