# 召喚獣・モンスター高品質GLB取込 / v4.4.82

## 何が自動化されたか

1. CC0と出所の証拠を持つ3Dモデルを固定コミットの素材庫から取得する
2. .gltf（埋込バイナリ＋写真/カラー画像）を自己完結のGLBにする
3. 元データ(source)、PBR圧縮版(high)、メッシュ簡略版(low)を生成する
4. アニメーションの残存、頂点・三角形数、実ファイル、出所/権利情報を検査する
5. 合格したGLBだけを`assets/creatures/external/`に登録して公開する
6. モンスター管理画面で「CC0外部モデル」を選択すると、従来モデルと比較できる
7. 同じモーションボタンでGLBの内部クリップを名前から自動対応させる
8. スマホ上の単独GLBも**公開せずブラウザー内だけ**で読み込める

## 素材

- 公開元：Quaternius, [Ultimate Monsters](https://quaternius.com/packs/ultimatemonsters.html)
- 作者の案内： [50体のCC0モンスター](https://www.patreon.com/quaternius/posts/ultimate-50-73633148)
- ライセンス：CC0-1.0（正式な証拠は上記サイトと`data/creature-external-sources.json`に記録）
- リポジトリ上の検証可能なミラー：`kxpedro/vp-game` の **固定コミット**
- 初期素材：Demon / BlueDemon / Orc / Orc_Skull / Ghost_Skull / Ninja / Dragon_Evolved の7モデル
- 50体全部が写真品質GLBに入れ替わった、という意味ではない。これらは3Dアニメ付き**比較候補**である

本機能はユーザーが購入したモデル、Sketchfabの再配布禁止モデル、AI生成の出所不明モデルを自動でコピーしない。**ライセンスとソースを明示できないモデルは公開禁止**。

## ローカル/CIビルド

Node 22以降。Nodeモジュールはビルド環境のみ必要。

```sh
npm install --no-save --package-lock=false \
  @gltf-transform/core@4.5.1 @gltf-transform/extensions@4.5.1 \
  @gltf-transform/functions@4.5.1 meshoptimizer@0.25.0 sharp@0.34.5
node tools/acquire-cc0-creatures.mjs
node tools/build-creature-library.mjs
CREATURE_REQUIRE_IMPORTS=1 node qa/creature-import-pipeline.test.mjs
```

GitHub Actions： `Creature licensed GLB intake and 3-stage LOD`
- PRでは取得・変換・検証を行い、生成モデルはArtifactとして保管
- mainへのマージ後、検証済みGLBと`registry.json`をbotがコミット
- 生成アセットのコミットでGitHub Pagesのデプロイが実行される
- ネットワークや変換が失敗した場合はデプロイ対象を上書きせず、従来モデルに戻る

## 見る場所

- `/monster-manager.html?v=4.4.82`
- 「3Dモデルの入手元」→「CC0外部モデル（比較候補）」
- レア度、属性、顔の形、3Dモーション、テクスチャと各LODを比較できる
- 未登録キャラクターでは従来のプロシージャルモデルを維持
- 「手元のGLB」から本人が正当な権利を持つ高品質GLBを個人的に試せる

## 新しい高品質モデルを登録する際のルール

`data/creature-external-sources.json`の入力値は、コードに固定したCC0ミラーのみ許可される。
別の素材元を使うときは、ソースURL・作者・ライセンス証明・再配布可否・変換前SHA256をレビューした上で取得機構へ追加する。生成するGLBはサイズ・テクスチャ・アニメーションをQAで検証する。

元GLBのポリゴン数・質感が低ければ、LODを作ってもAAA品質にはならない。
画面例の筋肉・顔・鎧の密度に近づけるためには高密度の原型そのものが必要。後続はBlenderなどの作者が提供した高精細原型、写真ベースPBR、法線ベイク、リギング・モーション修正を行う。

## 重要な境界

- **管理画面内では外部モデルに切替可能**
- **リアルタイム戦闘は既存のGPUインスタンス描画を維持**。7体の外部GLBを自動的に1000対1000に配置するわけではない
- **自動で最大50体**を登録できるようにデータ型・ランタイムの受け口を備えた。初期の導入モデルは7体
- 取得先を固定し、未承認の外部URLをGitHub Actionsのシェルコマンドに埋め込まない
