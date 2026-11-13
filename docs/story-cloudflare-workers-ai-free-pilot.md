# Chapter 1 / Stage 2: Cloudflare Workers AI **Free-plan** first five-frame pilot

## Scope

This workflow connects **real API image-generation requests** to the canonical Chapter 1 Stage 2, female post-victory page 1. It submits **one scene per request, never a storyboard/contact sheet**, and at most five images per dispatch. The physical character-reference master bytes are resized to thumbnail inputs smaller than 512×512px and attached as `input_image_0`…`input_image_3`.

First five panels: `c01-s02-m6,m7,m8,m9,m16`. Page 2 is `m19,m10` (two images). Other outcomes/chapters are **not** implicitly generated.

- Model: `@cf/black-forest-labs/flux-2-klein-4b`
- Output: 1024×576 **native** image; no upscaling; convert to WebP by Pillow without resizing.
- Cloudflare free plan daily limit: 10,000 Neurons across the account, **shared with any other Workers AI usage**.
- Pricing estimate: 26.05 neurons per 512×512 output tile + 5.37 per reference input tile. Our 1024×576 frame is conservatively four output tiles, plus one thumbnail tile per attached reference. `--mode plan` prints the estimate before any request.
- Per invocation: **max 5 images**, conservative estimate **max 1,000 Neurons**, zero automatic retries, no paid-model fallback.
- Most important: **Workers Free plan required**. The script refuses requests without explicit confirmation of the Free plan. Since account settings are private, you must verify in your Cloudflare dashboard that this account is on **Workers Free**; a variable alone cannot independently prove account billing status. **Never enable a Paid subscription for this pilot.**

Official docs:
- https://developers.cloudflare.com/changelog/post/2026-01-15-flux-2-klein-4b-workers-ai/
- https://developers.cloudflare.com/workers-ai/platform/pricing/
- https://developers.cloudflare.com/workers-ai/get-started/rest-api/

## One-time authorization (no API keys in repo)

1. In the [Cloudflare Workers AI dashboard](https://dash.cloudflare.com/), confirm the **Workers Free** plan. On Workers AI, choose **Use REST API**, create a Workers AI token and copy the Cloudflare Account ID.
2. Open GitHub repo **Settings → Secrets and variables → Actions → Secrets** and create:
   - `CLOUDFLARE_ACCOUNT_ID` — account ID from Cloudflare.
   - `CLOUDFLARE_WORKERS_AI_API_TOKEN` — token with Workers AI permission.
3. Under **Actions → Variables**, set `CLOUDFLARE_FREE_PLAN_CONFIRMED` to exactly `true`, **only after verifying the account is Workers Free**.
4. Open **Actions → Story Cloudflare Workers AI Free five-frame pilot → Run workflow**. Run `mode=plan, page=1` first (no external API). Read the report and estimate.
5. Run `mode=generate, page=1` for the five actual pictures. **If secrets or Free-plan confirmation are missing, no API calls occur**. On a 429/403 the script stops, without paid fallback or automatic retries.

A valid run generates five separate WebPs and corresponding `.generation.json` provenance records, saves them to a **review-only branch** and attempts a review PR. The build also publishes a downloadable Actions artifact containing candidates. If GitHub Actions PR creation is disabled, the committed branch is still available to open a PR manually.

## Gate before formal registration

Generated artwork is **not automatically approved** by its API. Review each panel against the immutable stage-specific manifest, exact speaker and script, physical cast masters, victory/defeat and gender, no characters not listed in the shot, and no in-image captions, digits, labels or UI. Verify original resolution and actual scene detail; re-render only individual failures. Only real per-shot human-approved WebP and matching proof may be promoted to canonical `assets/story/chapters/c01/panels` and submitted to `scripts/story-chapter-page-loop.mjs --chapter 1 --execute --commit --push`.

The chapter loop is fail-closed: one missing shot stops that page's transaction. It cannot claim chapter completion until all required page tasks have passed. Do not use the 7 earlier unapproved candidates as formal registered images.

## Verification in repo (zero external inference)

```sh
node scripts/generate-story-cloudflare-free-page.mjs --mode plan --page 1
node qa/story-cloudflare-free-page.test.mjs
python3 -m pip install Pillow==11.3.0
python3 -m py_compile scripts/story-cloudflare-image-io.py
```

GitHub CI runs only the safe zero-network planning/checks automatically for PR/push. The actual generation is **manual workflow_dispatch only** and never an automatic main-branch merge hook.

All existing Gemini chat/VOICEVOX workers are left unchanged.
