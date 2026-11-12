# 第1〜5章　漫画・台本・音声：制作の現状と原稿指示書

## 実施状況（2026-11-12）

- 対象：5章／50ステージ。
- 分岐版：222種類。男女別で**444枚の独立した漫画シート**（1枚は2列・最大10コマ）。
- 原画：完成・承認した「分岐別の一枚絵」は未登録。従来の個別シーン画および人物マスターを**新規完成原稿として数えない**。
- 音声：無料VOICEVOXの第1〜5章の新規生成ジョブは成功（[Actions](https://github.com/yamadayoshitaka/hai-gin-rpg/actions/runs/43216655757)）。パネル音声は台本・固定話者・確定読みでキャッシュされる。過去音声の重複は実バイナリ完全一致を条件に再参照後削除。
- 本作業では人間・モンスターの3Dデータは変更しない。

## 原稿の制作指示書をまとめて生成する方法

```bash
node scripts/prepare-story-five-chapters.mjs
node scripts/compile-story-art-briefs.mjs
node qa/story-art-briefs.test.mjs
```

出力は `qa-reports/story-chapters/c01-c05-art-briefs.json`。
各原稿に**ステージ、フェーズ、勝敗・選択分岐、男性／女性、コマ順、構図、登場人物IDと参照画像、セリフ、音声用読み**を記録する。GitHub Actionsの `Story chapters 1-5 production readiness` から成果物として取得できる。CLIの出力は制作指示書であって画像ファイルではない。

### 原画の必須品質

1. 1枚には同一ステージ／同一分岐／同一性別の実際の漫画を最大10コマ描く。ポスター、仕様表、完了報告画像、キャラクターの切り抜き反復は不合格。
2. 文字、吹き出し、ルビは原画に描かない。漫画UIが**セリフ・ふりがなを重ね、別キーのVOICEVOX録音を再生**する。
3. キャラクターは毎コマ同一人物。リュシアは銀髪の摂政、男性軍師は黒髪、女性軍師は別の女性（リュシアとは別人）。ガランは老騎士であり国王ではない。
4. 物語の発端は戦闘前、結果は勝利確認後。敗北で勝った絵を表示しない。主人公戦死は帰還・生存の絵へつなげない。
5. `assets/story/characters/lucia/master.webp` は専用人物マスター。`assets/story/characters/commander/female-master.webp` は女性軍師マスター。男性軍師の `assets/story/panels/c01-s01-m01.webp` は暫定シーン参照のみ。他の `assets/story-cinema/cast/` は切り抜きであり、人物マスターとしての外見確認が必要。
6. ファイル名の文字列だけを画像生成へ渡しても顔を参照できない。**画像の実データをモデルの参照入力へ与え、完成原稿を目視照合する**。

### 登録

画像は制作指示書の `outputPath` に従う。原稿のサイズ・内容・性別・分岐別画像を確認し、10ステージ全原画のレビュー証跡がある場合のみ以下を使用する。

```bash
node scripts/prepare-story-chapter.mjs --chapter 1
python scripts/publish-story-chapter.py --chapter 1 --publish
```

`publish-story-chapter.py` は画像の不足・レビューの欠落が一枚でもあれば章全体を公開しない。ゲームへの反映は公開された実画像のみ。無料APIを超える課金を伴う生成は自動実行しない。

## 目標

1〜5章の実画像444枚を**台本・原画・人物の三点照合**で制作し、性別／分岐ごとに別原稿登録。制作指示書の生成や音声収録を、画像制作完了と混同しない。
