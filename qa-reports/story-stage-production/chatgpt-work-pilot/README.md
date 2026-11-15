# Stage 4 ChatGPT Work one-shot pilot

Source commit: `262eb99cc90a01d9506aa4727c0c183031302dbc`.
Target: `c01-s04|pre|female|c01-s04-m5` (Lucia / Vess).
Canonical sources: stage manifest plus runtime screenplay from chapterOneReviewPages(), backed by story-chapter-comic, stage-beats and stage-manga modules. Historical reconciliation file is stale: current source had 44/48 provisional entries, not 7. This pilot adds the 45th entry.

## Actual results

- One built-in ChatGPT image generation invocation, one generated image, one provisional registration. No paid external image API, Cloudflare generation, or paid service invoked.
- Actual generation inputs: two character images, same-gender style image, preceding environment image. Identity master overrides the preceding provisional frame's inconsistent Lucia costume.
- Original 1672x941 PNG; lossless center crop [4,2,1668,938] and lossless WebP encoding gives 1664x936, exact 16:9, without upscaling. Source hash and output hash are separate in the review proof.
- Assistant visual inspection passed: exactly Lucia/Vess, master-based appearance, blank decree and abstract wax seal, forest ruins, pre-battle confrontation, no visible lettering/UI. This is provisional assistant review, **not human approval**. Vess still has only an ensemble reference.
- Importer now supports an optional canonical shot key, so one proof can be safely processed at a time. Reference-attached assistant provisional review is distinguished from formal human PASS. Actual reference hashes, cast coverage and same-gender style are enforced.
- Plan: eligible 1; apply: 1; repeated plan: eligible 0. Existing approved artwork untouched.

## Validation

Passed locally:

```
node qa/story-chatgpt-work-pilot.test.mjs
node qa/story-c01-stage45-generation-guard.test.mjs
node qa/story-chatgpt-stage45-switch.test.mjs
node qa/story-chapter1-chatgpt-image-handoff.test.mjs
node qa/story-panel-one-at-a-time.test.mjs
node scripts/import-story-chapter1-chatgpt-staging.mjs --plan
```

## Repeating the procedure

1. Read current canonical shots and live registry, select an unregistered shot (do not use the stale reconciliation count).
2. Resolve exact cast, edition and gender. Verify and view physical character/style/preceding-scene image files.
3. Use buildStage45ArtPrompt, persist inputs/prompt, and invoke the built-in image_gen once with actual reference paths. The final prompt additionally labels image order and prioritizes master identity; see inputs and review proof for reference roles.
4. Inspect actual output and measure native geometry. Reject wrong identity, scene, text, branch or insufficient geometry. Never infer human approval.
5. Save passing WebP and truthful review proof, then run the importer with --plan and --apply plus the exact key. Test and commit in an isolated branch and open PR.
6. Repeat --plan to confirm duplicate import is a no-op.

Next unregistered keys after this pilot: female post-victory m8 (Iris/Lucia), female post-victory m19 (Lucia/Vess), female post-defeat m19 (Lucia/Vess). These are only queued observations; no second generation was performed. Victory and defeat need distinct scenes and separate files even when cast matches.

This demonstrates a tool-assisted active-conversation workflow. It does not demonstrate unattended scheduled ChatGPT image generation or a GitHub Actions API for the built-in generator. Existing Actions can ingest files after they are committed. Quotas/rate limits may interrupt later calls; no paid fallback is configured by this change.

## Rollback

The PR stays unmerged until reviewed. Closing the PR abandons this isolated change. After merge, reverting the pilot commit restores the prior registry/ledger and removes the added assets. The registry's originalLivePath is null because this exact shot had no previous live entry. No existing panel binary was overwritten.
