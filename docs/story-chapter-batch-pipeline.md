# 章単位の漫画制作・承認・公開パイプライン（2026-11-12）

## 基準

- **前後5コマ・前後10コマという固定数を廃止**。イベントの内容と選択によって場面数が決まる。
- 制作単位は **1章 = 10ステージ**。各ステージの前編・後編を作るが、後編は戦闘結果（勝利／敗北）・選択方針・協力ルート・選択済みエンディングで必要な分だけ分岐する。
- **男主人公／女主人公は別原稿**。リュシアやガランなどの他人物や背景は同じ物語として統一する。
- **1枚の漫画原稿は最大10コマ、2列×必要行数**。コマ数は漫画の筋で決め、11コマ以上なら2枚目に続ける。1枚に無理やり10コマを詰めない。
- 作画はシーン画像の寄せ集めではなく、1ページとして構図と人物・衣装を揃えたオリジナル原稿を作る。表示画面でもコマ単位の別絵紙芝居には戻さない。
- **勝利の画像を敗北イベントに使い回さない**。戦果が検証される前は勝利の画像を出さない。台本とボイスも実際の分岐に従う。
- 原画の入力とマスター画像の目視確認、事実照合、男女の整合性、ページSHA256の承認は必須。台本／制作計画だけでは原画完成ではない。

## 章の一括作業

GitHub Actions の **Chapter comic production and reviewed release** を開き、`Run workflow` から `chapter: 1`、`mode: prepare` を実行する。

1. 登録された章のあらすじ・10ステージ・登場人物を読み、勝敗・選択方針・ルート・結末の全組み合わせを列挙する。
2. 各分岐についてセリフ／読み上げ／コマID／原画参照・必要ページ数を整理する。結果は Actions の `chapter-comic-production-1` というJSON成果物に保存する。
3. 原画制作担当（人または別の画像生成ツール）がJSON指示と**実画像**を読み、必要なページを描く。ゲームに新規画像を描画するAPIが接続されているとは限らないので、**生成完了を偽装しない**。
4. 描いたWebPを `assets/story/chapter-drafts/c01/` に置く。画像名は計画JSONの `files.male`／`files.female` のファイル名に一致させる。ページサイズは1セル768×432px、列数2、行数はページの掲載コマ数で決める（例：10コマ=1536×2160、6コマ=1536×1296）。
5. 同ディレクトリに `review-approved.json` を配置。全ページに一致するSHA256、キャラ整合性・勝敗・男女の確認を記録する。例：

```json
{
  "chapter": 1,
  "approved": true,
  "approvedBy": "実際に確認した担当者",
  "confirm": {
    "storyMatches": true,
    "characterMatches": true,
    "genderMatches": true,
    "outcomeMatches": true,
    "noDuplicatedScene": true,
    "noTextInArt": true
  },
  "pages": {
    "<制作計画JSONにあるWebPファイル名>": {
      "approved": true,
      "sha256": "<ファイルの実SHA256>"
    }
  }
}
```

6. **同じActionsで** `chapter: 1`、`mode: publish` を実行する。1章全10ステージ・勝敗と選択分岐・男女のページが全て揃った場合のみ公開先へ一括コピーし、Gitにコミットする。一つでも未承認・不整合・不足・複製があれば、公開ファイルは一切触らず失敗とする。
7. 章ごとの新規原稿の実数・未完成数は制作計画と登録台帳から確認する。1章が公開済みになってから次章へ進める。既存の章が未完成でもセーブデータ・ゲームの戦闘は破壊しない。

コマ数は必須の固定値ではない。データソースの場面を増減した場合、次回の `prepare` でページ数と必要原画が再計算される。**画像未制作の分岐は「原画未登録」と表示し、他の結末画像を代用しない。**

## 開発者用CLI

```sh
node scripts/prepare-story-chapter.mjs --chapter 1
node scripts/prepare-story-chapter.mjs --all
node qa/story-chapter-pipeline.test.mjs
python scripts/publish-story-chapter.py --chapter 1
python scripts/publish-story-chapter.py --chapter 1 --publish
```

旧 `scripts/prepare-story-art-batches.mjs` はレガシーの200ステージ×20コマ下書きの互換検証用。**新規原画の章単位制作・分岐・公開は本パイプラインが正本**であり、古い固定枚数のバッチを使って新規原画制作を進めない。

無償ツールとGitHub Actionsの許容範囲で実行する。追加の有料APIを自動起動しない。
