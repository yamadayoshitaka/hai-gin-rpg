# Stage 1: high-fidelity master models and facial QA

## Source catalog
- File: src/master-model-catalog.js. Contains inventory REFERENCES for 50 job types × 2 sexes (100 humanoid records), 50 monsters and 8 summon/mount kinds.
- Humanoid records currently share the existing Quaternius GLTF donors and have deterministic, distinct facial profile metadata. These are NOT 100 new photorealistic face meshes.
- Monster/summon records refer to registered SOURCE procedural geometry creators, not downloaded GLBs. Recording source metadata is not new mesh generation.
- No triangle/texture/file-size budget applies to SOURCE masters. Do not automatically optimize source masters or load all source records simultaneously in battle.
- Game-ready LODs are separate and may be generated only after visual sign-off.

## Tests and progress
- Execute: node qa/stage1-master-quality-regression.mjs
- CI: .github/workflows/stage1-master-quality-regression.yml, using free runtime checks and optional manual dispatch.
- Report: qa-reports/stage1-master-quality.json, uploaded as a GitHub Actions artifact.
- Suites cover the source inventory; eye/nose/mouth, facial speaking and blink; face skin PBR; eyebrows; hair and helmet; outfits, clothing, rig attachments; creature anatomy and facial fur.
- Completion rate = passed automated gates / all required stage-1 gates, including pending manual gates. Also report automated pass percentage separately.
- Manual review remains pending for real browser frames, reference-art realism, and actual high-quality source verification.
- Neither reference registration nor test pass proves FF13-level art, a new realistic GLB, or a completed Android deployment.

## Persistent failures: free research then bounded correction
1. Capture the failing check name, exact symptom, model source, last good commit and failure evidence.
2. If the SAME check fails in two consecutive runs, stop blindly adjusting the same parameters. The next stage-1 run places it into a research queue.
3. Research free official manuals and public code/issues first. Compare at least two plausible root causes where possible.
4. Confirm licensing for models/textures, and verify that a proposed solution requires zero new charges.
5. Apply only a small reversible correction on a branch, never replace a high-fidelity master with a low-detail workaround.
6. Rerun the failing test plus neighboring regressions; capture screenshots/brief animation only if visual evidence is needed.
7. If not proven better, mark unresolved. Never auto-certify visual beauty, merge, deploy, purchase, or run unbounded retries.

## Public no-cost references
- Khronos glTF-Validator: https://github.com/KhronosGroup/glTF-Validator — check GLTF asset validity, buffers, animation and material references.
- Blender glTF 2.0 documentation: https://docs.blender.org/manual/en/dev/addons/scene_gltf2.html — rigged models, PBR, textures, morph targets.
- glTF Transform inspect: https://gltf-transform.dev/cli — inspect geometry without optimizing master data.
- Playwright trace viewer: https://playwright.dev/docs/trace-viewer — retain frame history only when useful.

Zero-new-charge policy: no paid APIs, paid assets, subscriptions or billable GitHub options are used. This does not guarantee an unlimited quota on any hosting or CI service. Hourly reporting, if enabled, is separate from GitHub Actions; it measures evidence rather than guessing progress.
