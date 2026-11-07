# 現行剣士でのAI生成比較テスト（2026-11-07）

## 現行モデル（観測済み）
- 職業: 剣士（`job01`）、男性、レアリティ N
- 使用画面: `outfit-maintenance.html?job=job01`
- 共通ランタイム: `buildRiggedJobOutfit`（ゲームと職業別アクション検証で共有）
- 衣装: 鎧57パーツ（兜含む）、片手剣1本、7頭身素体と骨格同期
- 実機撮影: 成功、9枚のPNGを `assets/ai-reference/swordsman/` に保存
- 自動診断上の骨XYZ最大誤差: 0.0 mm。**ただし外観や実ゲーム戦闘時の品質保証ではない。**
- 撮影方法: Playwright + Chromium + Three.js WebGL、現行の衣装画面を実際に描画
- 生成AIによる新規GLB: **未生成**。本テストでは既存の剣士をAI生成したと偽らない

## 参照画像
| 内容 | 正面 | 側面 | 背面 |
| --- | --- | --- | --- |
| 装備完了 | [画像](../assets/ai-reference/swordsman/equipped-front.png) | [画像](../assets/ai-reference/swordsman/equipped-side.png) | [画像](../assets/ai-reference/swordsman/equipped-back.png) |
| 素体 | [画像](../assets/ai-reference/swordsman/nude-front.png) | [画像](../assets/ai-reference/swordsman/nude-side.png) | [画像](../assets/ai-reference/swordsman/nude-back.png) |
| 衣装単独 | [画像](../assets/ai-reference/swordsman/outfit-front.png) | [画像](../assets/ai-reference/swordsman/outfit-side.png) | [画像](../assets/ai-reference/swordsman/outfit-back.png) |

## 再生成手順
1. `swordsman-ai-test.html` を開き、参照する面と状態を確認する。
2. `ai-model-studio.html?preset=swordsman_body`（素体）と `?preset=swordsman_armor`（鎧）の個別生成指示を使用する。
3. 無料Webサイトで参照画像を使いモデルを作成する。**無料サイト自身の生成・ダウンロードは接続APIがないため手動**。商用利用とDL形式の制約はサイトごとに確認する。
4. 実際に生成されたGLBを `swordsman-ai-test.html` に読み込んで、正面・側面・背面で比較する。
5. `assets/ai-model-inbox/` へGLBとmanifestをアップロードすると、共通GLB監査・候補登録が自動で走る。
6. 人間素体はリギング、独立鎧は衣装基準フィッティングを別工程で実施。顔、髪、手、兜、背中、関節、貫通などが合格するまでは既存のゲーム内剣士を変更しない。

## 注意
- AI生成と現在の手続きは別。9枚の画像は**現行ゲームの記録**であり新しいAI生成アセットではない。
- モデル自動比較は形式・メッシュ情報の表示を含むが、美的品質を自動保証しない。
- 今回は有料APIを一切実行していない。APIキーやGPUがなくても参照撮影とGLB読み込み検証は可能。
- 参照画像は公開GitHubリポジトリに配置されているため一般公開される。
