# 汎用3D生成AI連携（人間・魔獣・召喚獣・装備）

## 実装
- Web Studio: \`ai-model-studio.html\`
- Templates: \`data/ai-model-presets.json\`
- Candidate registry: \`data/ai-model-registry.json\`
- Provider runner: \`tools/ai-3d-generate.mjs\`
- Manual workflow trigger: \`.github/workflows/ai-3d-generate.yml\`

### Cost and authorizations
- \`dry-run\` is the DEFAULT and performs only a request/asset-id check. Zero generation, zero paid API requests.
- \`hunyuan\` sends a reference image to a separately provisioned HTTPS Hunyuan GPU API server. It is NOT free cloud compute on GitHub Actions; you need your own GPU/hosting.
- \`tripo\` is an optional PAID API provider. It explicitly refuses to submit unless workflow input \`allow_paid=true\` AND GitHub Actions secret \`TRIPO_API_KEY\` is set. Never check API keys into source control.
- Meshy Free Web does NOT support API access; it cannot be invoked as a zero-cost automation API.
- Open-source models and public API providers have separate licensing. Confirm commercial use rights for *each model version, dependencies and output* before a game release.

### Github actions setup
Go to Actions → **AI 3D universal generator** → **Run workflow**, then select \`category\`, \`preset\`, unique ASCII \`asset_id\` and optionally enter a descriptive \`prompt\` and \`negative_prompt\`. First use \`dry-run\` to validate without charge.

Hunyuan requires:
- \`HUNYUAN_API_URL\` GitHub Actions secret, exact \`https://.../generate\` endpoint on YOUR GPU server.
- Optional \`HUNYUAN_API_TOKEN\` secret if your gateway authenticates bearer tokens.
- \`reference_image\` path committed inside \`assets/\`, ending \`.png\`, \`.jpg\`, \`.jpeg\` or \`.webp\`. **Warning: this public repo exposes committed reference images to everyone**. Never commit private photographs.
- The Hunyuan3D-2 reference API accepts a base64 \`image\` POST and returns a GLB binary. Other server versions may need a custom adapter. It does not generate from the text prompt in this adapter.

Tripo requires:
- \`TRIPO_API_KEY\` secret, explicit \`allow_paid=true\`, then choose \`tripo\`.
- Optional \`public_image_url\` for image-to-3D or text-only prompt for text-to-3D.
- External service costs are not estimated or capped by this script. One requested run submits one task. Never opt in if any fee is unacceptable.

### Asset QA
Successful provider responses create:
- \`assets/ai-generated/<category>/<asset_id>/candidate.glb\`
- \`assets/ai-generated/<category>/<asset_id>/manifest.json\`
- \`data/ai-model-registry.json\` entry marked \`pending-visual-qa\`.

GLB binary and mesh presence, PBR material presence, mesh/triangle/texture counts, rig/animation existence are checked. **Passing structural QA does not prove geometry quality, face quality, fur quality, hollow armor, correct skeleton, motion fidelity, collision, commercial rights, or model-to-clothing fit.** No generated model is ever auto-assigned to a battle or monster actor. Production adoption requires explicit review and game-specific mapping.

### Game integration strategy
1. Human and elf: rig → retarget to existing actor skeleton → hair/garment-first fit → action QA.
2. Quaduped animal: four-legged skeleton, paws/fur/ears, gait QA, different LOD.
3. Monster and summon: type-specific rig, idle/locomotion/attack/death, effects, collisions and grounded scale.
4. Equipment: independent mesh; grip slot, surface occlusion and attachment; keep armor separate until visual fit is accepted.
5. Optimize texture (KTX2, mips) and geometry (LOD/compression) only after initial quality acceptance.

## API reference
- Tripo: https://developers.tripo3d.com/en/docs/quick-start
- Hunyuan3D-2 local server: https://github.com/Tencent-Hunyuan/Hunyuan3D-2
- TRELLIS.2: https://github.com/microsoft/TRELLIS.2

**Known limitation:** A free consumer web-account cannot be automated via this safe API adapter, and GitHub-hosted CPUs are not a substitute for an inference GPU. The browser page prepares prompts and previews GLBs; GitHub Actions triggers actual generation only after the backend exists.

## 無料Web版で作ったGLBの自動取り込み（追加）

ゲームメニュー → 「AI 3D生成スタジオ」 → 「無料AIサイトからGLBを登録する」から操作します。
これは**無料WebサイトのAPIを無断で使うものではありません**。Webサイトで生成し、本人がダウンロードしたGLBをGitHubにアップロードすると、それ以降の検査・候補登録を自動化します。

1. スタジオでカテゴリ（\`human\`／\`monster\`／\`summon\`／\`animal\`／\`armor\`／\`weapon\`）と生成指示を作成する。
2. 利用規約を確認した無料AIサイト（Meshy／Tripo等）でモデルを生成し、\`.glb\`をダウンロードする。高品質テクスチャ付きモデルが無料でダウンロードできるかはサイト・プラン次第。
3. GitHubの \`assets/ai-model-inbox/\` フォルダへ \`dragon_01.glb\` のようなファイル名でアップロードする。
4. スタジオの「登録情報JSONをコピー」で作成した内容を \`assets/ai-model-inbox/manifest.json\` に貼り付けてコミットする。複数モデルは \`entries\` にまとめられる。
5. \`Free AI site GLB import and validation\` が自動実行され、共通のGLB品質検査後に \`assets/ai-generated/<category>/<id>/candidate.glb\` に移し、\`data/ai-model-registry.json\` へ \`pending-visual-qa\` として登録する。
6. スタジオのGLBプレビューから候補を確認する。**ゲーム本体への自動適用・骨格の自動生成・商用利用承認は行わない。**

入力例（JSON内容は実際の生成情報へ変更）：

\`\`\`json
{
  "schema": "hai-gin/ai-3d-inbox/v1",
  "entries": [
    {
      "id": "dragon_01",
      "category": "monster",
      "filename": "dragon_01.glb",
      "provider": "Meshy Web",
      "sourceUrl": "https://www.meshy.ai/",
      "license": "unknown",
      "prompt": "High-detail full-body fantasy dragon ..."
    }
  ]
}
\`\`\`

\`license=unknown\` は登録をブロックしませんが、製品版への採用は禁止扱いです。無料素材でも商用利用は規約確認が必要です。GitHubリポジトリが公開のためGLBや画像は一般公開されます。許可のない素材や非公開のモデルをここへコミットしないでください。

対応ファイル名：英小文字で始まる2〜74文字（\`.glb\`を含む）、小文字英字・数字・\`_\`・\`-\`のみ。最大75MiB／モデル。IDとカテゴリの組み合わせは重複不可。一括処理は最大15体／回。

モデルの品質指標は三角形数・材質・テクスチャ・法線・UV・スキン・アニメーション等。これは構造チェックにすぎず、尻尾・毛・顔・鎧の内外面・衝突・前後位置は目視検証する。
