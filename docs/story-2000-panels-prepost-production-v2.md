# 灰銀のレゾナンス — 20章×10ステージ×10コマ 実装仕様 v2

2026-11-11。既存200ステージ、キャラクターID20種、セーブのステージ識別子を変更しない。

## 開戦前と戦闘結果の接続
- 20章 × 10ステージ = 200ステージ。
- 1ステージのID `c01-s01` のまま、`c01-s01-m1` ～ `c01-s01-m10` という**10個の別々のシーンID**を持つ。前半 `m1..m5` は `phase=pre`、後半 `m6..m10` は `phase=post`。合計2,000コマ。
- 地図の出撃 → 開戦前5コマ → 元の3D戦闘 → 信頼できる戦闘結果を `settleCoreBattle` が検証 → 後半5コマ → 次のステージ／再挑戦。
- 勝利、敗北で後半台詞を変える。具体的な損害人数や救出人数を原画用台詞に捏造せず、ゲームから渡された実測情報で結果メッセージを作る。
- 戦闘後の漫画再生待ちは `sessionStorage` の `hai-gin-story-post-manga-pending-v2` に保存し、画面が再読み込みされても戦闘前からやり直しにならない。最後のコマ／スキップで処理済みを保存する。
- 町ステージは戦闘ではない。開幕5コマは町に入った時、後半5コマは町から世界地図へ向かう時に「町の後日談」として表示する。
- 登場人物と台詞の原典は `src/story-chapters.js`、`src/story-stage-manga.js`、`src/story-cinematic.js`。現在の後半5コマはステージ結果・章目標・人物会話を合成した**台本初版**。イベントごとの手動演出磨き込みは別途必要。

## ボイス
- 表示と読み上げは分離：`subtitleText` は作品の漢字・造語を維持、`voiceText` は `src/story-pronunciations.js` の辞書を適用。
- `星鐘→せいしょう`, `灰銀→はいぎん`, `翠嵐→すいらん`, `レヴナ→れぶな` など。
- キャラIDからVOICEVOX話者を固定。ガランは歴戦の騎士向けに変更した `剣崎雌雄` を維持。
- `story::panel::ID::voiceText::speaker` を音声のキャッシュ識別子に用い、実MP3があれば優先。なければ端末の日本語読み上げへフォールバックし、その場で有料AI APIは呼ばない。
- `scripts/generate-story-panel-voicevox.mjs --all` は正規の2,000コマ（勝利後）と別途の敗北後シーンを生成。過去の2D漫画1,400コマの収録済みMP3は保持し、適切な新しい読み音声が登録されるまで残す。
- GitHub Actions `story-panel-voicevox-generation.yml` は20章を順に合成し、4章ごとに進捗をコミットする。実際に録音／公開済みと断言できるのは後続のCIが成功した分だけ。

## 一枚で10コマ — 200枚のステージ別シート
- `node scripts/prepare-story-art-batches.mjs` で、厳密に1ステージ10コマ×200ステージの制作ブリーフを作る。
- コマの並びは2列×5行。1コマは16:9、シート全体は縦長、均等なサイズ・隙間なし・文字なし・吹き出しなし。ナレーションと台詞はゲームで重ねる。
- 基礎シート `assets/story/sheets/batch-0001/base.png` は男性軍師を含む1ステージ10場面。
- 女性版は**新たに背景を作り直さず**、`heroine-edit.png` と `hero-mask.png` により主人公の体・髪・顔だけを同位置で差し替える。キャラクターが写らないコマはレビューの `noHeroPanelIds` で指定し、背景を男女共用。
- `review-approved.json` は承認者、元画像SHA256、文字・場面・人物統一・10コマ重複などの検査結果が必要。元画像と承認ハッシュが一致しない場合は登録拒否。
- `python scripts/slice-story-art-batch.py --batch 1` で10コマを `c01-s01-m01.webp ... c01-s01-m10.webp` に切り出す。女性差分は `-female.webp`。マスク外の人物と背景が変更されていれば拒否。
- `.github/workflows/story-sheet-import.yml` はレビュー済みシートが実ファイルとして追加された時だけトリガーし、実画像を切り出し、重複・ファイル形式・ステージ一致・人物マスターの保存をチェックして本番登録。
- **注意：プロンプトや空のシートフォルダは画像実体ではない。** 画像が200シート生成されたと誤認しないこと。高品質の画像生成には、別途実際の画像出力可能な生成エンジンとレビューが必要。

## 動作確認
- `node --experimental-vm-modules qa/stage-manga-continuity.test.mjs`
- `node qa/story-stage-prepost-v2.test.mjs`
- `node scripts/prepare-story-art-batches.mjs`
- `node qa/story-art-batches.test.mjs`
- `node scripts/build-story-art-coverage.mjs && node qa/story-art-coverage.test.mjs`
- `node qa/story-panel-voice-assets.test.mjs`（生成済み音声を検査）
- 町／タイトル／地図／戦闘／結果確認、女性軍師、ボイスOFF、途中再読込をAndroidで回帰確認する。3D人物モデル・戦闘物理コードは触らない。

## 朝の報告で必ず区別するもの
1. **台本・ゲーム導線**：合格CIとmainへのマージ状態。
2. **原画**：指定200シートが準備されてもWebP実登録数は別。男性・女性・共通の実ファイル数を明記。
3. **音声**：MP3実登録件数と本番の現行読みに一致する件数を分けて計測。未収録分は「合成待ち」。
4. **実機QA**：成功・失敗のジョブと残る回帰リスクを明記。
