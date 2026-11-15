# ChatGPT Images: ZIP１個で自動仮登録

ここは第1章のChatGPT生成原画をGitHub Actionsに渡す**アップロード専用**フォルダです。

## 手順
1. 通常ChatGPTで、1コマ＝1枚の実画像を制作・目視確認する。
2. WebPごとの審査JSON（仮登録の明示許可、SHA-256、公式コマID、台本、元サイズ）を添えたZIPを作る。既存の \`hai_gin_c01_s05_female_inbox_4shots_unregistered.zip\` 形式に対応。
3. GitHubでこのフォルダを開き、**Add file → Upload files** からZIP **１個だけ**をアップロードしてmainにコミットする。ZIPを展開する必要なし。
4. \`.github/workflows/story-chatgpt-zip-autoregister.yml\` が自動起動する。ZIP展開・危険なパス拒否・ペア数検査・SHA検査・台本/人物/分岐/寸法検査・仮登録・ゲーム参照更新・コミットを実行。
5. 全ゲート成功で \`publish-pages.yml\` が起動しPagesへ公開される。失敗したZIPは自動登録も公開もしない。GitHub Actionsのエラーで修正して再投入する。

## 受け付ける形式
- ZIP内に \`assets/story/chapter1-chatgpt-inbox/<canonical-slug>.webp\` と同名の \`<canonical-slug>.review.json\` の**完全ペア**
- 任意： \`package-index.json\` と \`README_重要.txt\` のみ
- 1 ZIP最大25MB・展開100MB・候補最大50コマ・安全な相対パスのみ
- 品質審査記録は \`qaStatus: OWNER_PROVISIONAL\`、\`ownerAuthorized: true\`、
  \`humanVisualQAConfirmed: false\`、\`finalP0Approved: false\` を必須とする
- 各画像は第1章の正本台本と完全一致し、実WebP 16:9、ステージ1/3/4/5は1536×864以上（ステージ2は別寸法規則）であること
- 失敗・差し戻し画像と未作成コマは含めない。1コマ画像に文字やコマ割りを入れない

## 重要な制約
- **ChatGPT Plusの画像をGitHubへ完全無人で直接転送する機能はありません。** ZIP１個のアップロードのみ人の操作が必要です。アップロード後は自動です。
- SHA/形式/台本/分岐の機械検査と審査記録の確認はできますが、**画像内の文字、登場人物の顔、画風の正しさを機械検査だけで完全保証しません。** 既存の目視審査済み候補以外は登録しないでください。
- 自動登録は正式P0承認ではありません。登録済み原画の元SHA・承認の差分・履歴を保持し、差し戻し可能です。
- ワークフローは追加API/Work/RPAを呼びません。GitHubと既存Pagesの構成を使用します。
- ZIP本体は処理後mainから取り除き、Git履歴に残します。受け付けた内容とSHAは \`assets/story/chapter1-chatgpt-upload-receipts/\` に保管します。
