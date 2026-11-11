# 灰銀のレゾナンス：スマホ無料3D生成（第一段階）

## 目標と実際に動く経路
ゲームのHTML/JSを全面変更せず、スマホ向けの \`mobile-3d-generator.html\` を入口にする。

1. Pixel/Android等のブラウザで \`mobile-3d-generator.html\` を開く。
2. ページに埋め込まれた **Microsoft TRELLIS.2公式Hugging Face ZeroGPU Space** を操作。原画を選択して画像→3D生成する。
3. 生成サービス側のダウンロード操作でGLBをスマホへ保存する。画像はMicrosoft/Hugging Faceのサービスに送られ、**灰銀のGitHub PagesやCloudflare Workerには送られない**。
4. 同じページの「GLBをスマホで確認」で端末上のGLBを読み込み、3D回転プレビューとGLB構造サマリを表示する（端末内処理）。
5. モデルID／カテゴリ／制作条件を指定して登録JSONをコピーし、既存のGitHub Web uploadと \`assets/ai-model-inbox/manifest.json\` を更新する。
6. 既存の \`Free AI site GLB import and validation\` ActionsがGLB候補を構造検査・登録。**本編モデルを勝手に置換しない**。

### 重要な制約
- 「AI生成」は公式TRELLIS.2 Space内で行う。灰銀ページがGPUで生成しているという表示はしない。
- Hugging Faceのアカウントと無料GPU利用枠、順番待ち、Spaceの稼働状況に依存する。埋め込みが使えない場合は公式Spaceを別タブで開く。
- 今の段階では生成とGLBの端末保存、GitHubアップロードがそれぞれユーザー操作。アプリの「1回の生成ボタンでGitHubまで完全自動」は未実装。
- 空のモデル、姿勢/骨なし、衣装と肌の交差、髪の破綻、両面の欠落は起こり得る。GLBの構造検査は**実写品質や商用利用権を保証しない**。
- 非公開の原画・個人写真は第三者サービスへ送らない。公開GitHubへ上げたGLB/画像は第三者が読める。
- Tencent Hunyuan3D-2.1は別候補だが、実行・出力物のライセンスにTRELLIS.2とは異なる条件があり得るため既定にはしない。

## 無料運用の根拠（2026-11-11時点）
- ZeroGPU: https://huggingface.co/docs/hub/spaces-zerogpu
  - 無料アカウント利用は原則5分/24時間のGPU枠。無制限ではない。
  - 無料の自前ZeroGPU Spaceホスティングは健全なアカウント、認証済みメール、作成後30日以上などの条件がある。
- 公式Space: https://huggingface.co/spaces/microsoft/TRELLIS.2
- MITライセンスの公式モデルコード: https://github.com/microsoft/TRELLIS.2
  - 商用化前にモデル/生成出力/個別依存物の条件を別々に確認すること。
- Cloudflare Worker FreeのCPU枠はAIの大規模3D推論には不足。Workerは将来の認証/ジョブ中継用途のみ。

## 第二段階：本当の「スマホ内ワンクリック」
独自ZeroGPU Gradio Space（またはユーザー所有GPU）を用意できる場合：
- \`POST /jobs\`: 送信する原画と品質（プレビュー→高品質マスター）を受け付け、ジョブIDを返す。ブラウザ/WorkerにはHugging Face tokenを露出させない。
- \`GET /jobs/:id\`: queued/running/failed/completed と進捗を返す。待機状態は再試行可能。
- \`GET /jobs/:id/result\`: 生成したGLBを認証されたスマホに返す。容量上限を75MiBとし巨大モデルは別の認証付きストレージへ保存。
- クライアントは \`@gradio/client\` などを利用可能だが、**公開SpaceのAPIはendpoint・入出力スキーマがSpaceごとに違うため、事前確認せず固定呼び出ししない**。
- セキュリティ：CORSだけでは認証にならない。鍵はWorker/SpaceのSecretのみ、ユーザー認証とレート制限を設定し、本人以外から無料GPU枠を消費されないようにする。
- ZeroGPUの制限があるため、APIの自動連打と課金APIへのフォールバックは禁止。費用増になる設定は明示承認を必要とする。
- 真の独立APIや安定した高頻度生成が必要ならGPU費用が別途発生する可能性を明示する。

## ゲームに入れるまでの品質ゲート
1. 第一章の原画から人物1体を生成する（顔／全身／背面）。
2. 原画一致、顔の形状（目・鼻・口・頬）、頭頂部と前髪、髪の厚み、眼球とまつ毛、肌、鎧位置、肩パッド貫通を目視検査。
3. リトポロジー、UV/Normal/PBR、髪の表現をマスターと実機用LODに分ける。**10万本の毛を戦闘1000体にそのまま表示しない**。
4. 骨格生成・リターゲット、瞬き、口形状、ダッシュ・攻撃・死亡・騎乗を回帰テスト。GLB生成だけでアニメーション完成とは扱わない。
5. 50対50／1000対1000でLOD切替とGPUメモリ、fps、見た目の差を計測。
6. ライセンス確認後に個別承認したモデルのみゲームへの割当を更新する。

## 第一段階の実装範囲
- 新規：\`mobile-3d-generator.html\`
- 導線：\`dev-menu.html\` と \`ai-model-studio.html\`
- 既存：\`tools/ai-3d-free-import.mjs\`, \`qa/ai-3d-import.test.mjs\` は変更なし
- サーバー新規契約・有料API・秘密鍵・本編キャラ置換：**なし**
