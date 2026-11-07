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
