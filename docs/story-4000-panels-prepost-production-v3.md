# 灰銀のレゾナンス — 漫画制作・ゲーム反映手順 v3

2026-11-12。人モデル・モンスター・戦闘エンジンは本変更の対象外。

## 優先順・完成条件

- 全20章×10ステージ = 200ステージ。
- **開戦／イベント前10コマ＋終了／イベント後10コマ = 1ステージ20コマ、全4,000コマ**。
- 1枚の制作シートは **2列×5行の10シーン**。1ステージで「前」「後」2枚、合計400シートを制作・レビューする。
- ストーリー原典は `src/story-stage-manga.js` と既存章・戦況データ。戦闘でのみ、検証済み結果を受けて後編のセリフを差し替える。敗北なのに勝利を描く絵は禁止（後編の絵は結果中立）。
- 町は前編を入場時、後編を世界地図へ戻る直前に表示する。戦闘は前編→3D合戦→結果検証→後編。
- **台本・プロンプト・フォールバック画像は完成原画に数えない**。専用WebPのファイル実体、レビュー承認、重複検証を通過して完成とする。

## 古い画像とIDを保存する

既存の10コマ（前 m1..m5、後 m6..m10）を絶対に別場面として流用しない。
新規10コマを m11..m20 に追加し、表示順は下記：

- 前10：`m1,m2,m3,m4,m5,m11,m12,m13,m14,m15`
- 後10：`m6,m7,m8,m9,m16,m17,m18,m19,m20,m10`

ゲーム内では各phaseで10コマを表示。セーブのステージID・音声既存ID・第1章の既存WebPは保持する。

## 1ステージの制作単位

1. `node scripts/prepare-story-art-batches.mjs --batch 1` で第一章第一ステージの**前10コマ**のシーン指示書を作る。
2. 2×5枚の画像として人物マスター参照を固定し、文字・吹き出しなしで10場面を実際に描く。最初は男性版。**後編は `--batch 2`** を同様に生成する。
3. `assets/story/sheets/batch-0001/base.png` と `batch-0002/base.png` に画像を追加する。
4. 女性主人公版は同じ絵の主人公の領域だけ差し替える。主人公が写らないコマは承認済みの中立IDとして共有する。必要に応じて `heroine-edit.png`, `hero-mask.png` を付ける。
5. レビュー後、画像のSHA256と差分・重複を `review-approved.json` で確定する。
6. `python scripts/slice-story-art-batch.py --batch 1` で10コマを個別WebPにし、後編もbatch 2として登録する。登録済み作品の元画像は上書きしない。進捗レポートの画像完成件数を更新する。
7. `node scripts/build-story-art-coverage.mjs` で **男性・女性・共通画像の実件数**を別々に算出。ブラウザの漫画ビューアに反映されるのはこの実ファイルのみ。
8. 音声は `storyVoiceText` と固定話者で登録する。音源がない場合は日本語端末音声にフォールバックし、有料APIを自動呼出ししない。

## 次のシート

`--batch 3` = c01-s02 前編、`--batch 4` = c01-s02 後編。以後同様に20章まで順に処理。
PRのCIが通り、マージできた変更だけを本番反映として扱う。日次／15分バッチを勝手に再起動しない。

## 検証

```sh
node --experimental-vm-modules qa/stage-manga-continuity.test.mjs
node qa/story-stage-prepost-v2.test.mjs
node scripts/prepare-story-art-batches.mjs
node qa/story-art-batches.test.mjs
node scripts/build-story-art-coverage.mjs
node qa/story-art-coverage.test.mjs
```

ゲームの町入出・勝敗分岐・男女性別・読み上げ・10コマ最後の次へ操作を維持する。画像がない場面の一時表示は完成画像ではなくフォールバック。
