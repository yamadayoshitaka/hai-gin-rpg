# 灰銀のレゾナンス：4系統の品質回帰／手動指示引継ぎ

## 対象と費用
| カテゴリ | 確定QA workflow | 実コード改修 |
|---|---|---|
| human | human-v65-quality.yml | ChatGPT定期タスクが次回確認・担当PRへ |
| monster | monster-anatomy-qa.yml | ChatGPT定期タスクが次回確認・担当PRへ |
| world | world-quality-photoreal.yml | GitHub Actionsが無料枠の範囲で別ブランチの基準画・PBR候補を生成 |
| anime | story-cinematic-qa.yml | シナリオQAのみ。Cloudflare無料原画生成／ChatGPT画面での画像生成は別途 |

外部有料の生成APIはこの導線から実行しない。ChatGPTサブスクリプションのタスクとGitHub ActionsのQAは別実行主体。

## 所有者の1回限りの指示
1. GitHub Pagesの `batch-monitor.html` にあるカテゴリ別の「次の手動指示」で修正内容を入力。
2. GitHub Issuesへ移動して本人が **Submit new issue** で確定。本文先頭の `<!-- hai-gin-hourly-batch-v1 -->` を保持する。
3. `hourly-batch-manual.yml` は所有者のIssueだけを検証し、カテゴリ別QAを `workflow_dispatch` で起動。このとき `batch_issue=N` を引き継ぐ。
4. 各QAワークフローはテスト後、`scripts/batch-qa-report.mjs` で **元IssueへQA結果とrun URLをコメント** する。Worldは静的検証と生成・比較フェーズを別々に報告する。
5. 人モデル・モンスターはChatGPTの既存の毎時タスクが未処理のIssueとQA証跡を読み、原コード修正→実WebGL比較→テスト→コミット→PRへ進める（タスクの実行時刻をGitHubは直接制御しない）。
6. QA成功だけでは `MANUAL_BATCH_HANDLED` は付けない。実コード変更・QA・PRが追跡できる場合のみ実作業担当がIssueに記録する。
7. マージ・Pages公開は実画像の目視、必要なCI、互換性／性能の品質ゲートを満たしてから行う。合格条件に満たなければ止め、未完了の状態を残す。

## 未保証の部分
- GitHub Actionsは、ChatGPT定期タスクを任意の秒に即時起動できない。
- deterministic QAの成功と3Dモデルの実写品質は別。
- ChatGPTの定期タスクが実ソースを直さず終了することはあり得る。Issueを「処理済み」にせず次回以降の調査対象として残す。
- animeの自動画像生成はAPI無料枠・モデル使用制約を受ける。追加課金でのフォールバックはしない。
- 複数のカテゴリのソースを一度に上書きしない。各PRで責任範囲を分けて回帰修正する。

## 実装・検証
- `qa/manual-hourly-batch-dispatch.test.mjs`: owner限定、全カテゴリへのQA dispatch、origin Issue番号の保持、UIの構文
- `qa/batch-qa-report.test.mjs`: origin Issue所有者・カテゴリ・状態の妥当性、QA成功だけで完了扱いしないこと
- `batch-monitor.html`: GitHubから最新の手動Issue・対応QAコメント・実改修の処理済み有無を参照（GitHub API制限や公開更新遅延に注意）
- QA用Issueコメントは `<!-- hai-gin-batch-qa-v1:... -->` で識別し、run/attempt/stageが一致する重複を防ぐ。
