#!/usr/bin/env python3
"""Prepare a compact, functional GitHub Pages site from the game repository.

This is deployment-only optimization: never change or delete the source assets
in the repository. Master models, raw motion candidates, and the 1400+ recorded
voice clips remain in git. High-detail monster and voice clips use the public
raw.githubusercontent.com paths at runtime on github.io.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import shutil
from pathlib import Path

from PIL import Image, UnidentifiedImageError


SOURCE = Path(__file__).resolve().parents[1]
IGNORED_DIRS = {
    ".git", ".github", "node_modules", ".venv", "qa", "scripts", "docs",
    "test", "tests", "coverage", "pages-dist", "dist", "__pycache__",
}
REMOVED_TREE_PREFIXES = (
    "audio/voicevox/clips/",
    "assets/master-sources/",
    "assets/ai-reference/",
    "motions/candidates/",
    "assets/characters/experimental/",
    "assets/story/chapter1-provisional-live/",
    "assets/story/chapter1-chatgpt-inbox/",  # Generation/provenance staging, never game runtime
)
ROOT_DEV_SUFFIXES = (".md", ".py", ".ps1", ".yml", ".yaml", ".zip", ".blend")
REQUIRED = (
    "index.html",
    "game.html",
    "town-hub.html",
    "world-map.html",
    "tactics-wireframe.html",
    "src/game-core-flow.js",
    "src/character-system/rigged-outfit-runtime.js",
    "src/battle-voice-library.js",
    "audio/voicevox/manifest.json",
    "assets/characters/quaternius-base/Superhero_Male_FullBody.gltf",
)



# Publish only lightweight, urgently needed runtime assets through Pages.
# Large binary clips and models are fetched on demand from this exact commit.
# This affects only pages-dist; it does not modify or shrink git master files.
OFFLOAD_BINARY_SUFFIXES = {".glb", ".bin", ".bvh", ".mp3", ".ogg", ".wav", ".mp4", ".fbx", ".webm"}
OFFLOAD_MIN_BYTES = 128_000
REMOTE_ONLY_PREFIXES = (
    "audio/voicevox/clips/", "assets/master-sources/", "assets/ai-reference/",
    "motions/candidates/", "assets/characters/experimental/",
    "assets/story/chapter1-provisional-live/",
)
ASSET_RELAY_NAME = "pages-asset-relay-sw.js"


def is_large_runtime_binary(rel: Path, src: Path) -> bool:
    return rel.suffix.lower() in OFFLOAD_BINARY_SUFFIXES and src.stat().st_size > OFFLOAD_MIN_BYTES


def add_asset_relay(out: Path, offloaded: list[str], commit_sha: str) -> None:
    """Route only explicit missing binaries to GitHub raw (commit-pinned)."""
    if not offloaded:
        raise RuntimeError("Asset relay received an empty offload set")
    worker = r"""
'use strict';
const COMMIT = '__COMMIT__';
const ROOT = 'https://raw.githubusercontent.com/yamadayoshitaka/hai-gin-rpg/' + COMMIT + '/';
const OFFLOADED = new Set(__OFFLOAD_LIST__);
const EXTRA_PREFIXES = __EXTRA_PREFIXES__;
self.addEventListener('install', (event) => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  const scope = new URL(self.registration.scope).pathname;
  if (!url.pathname.startsWith(scope)) return;
  let file;
  try { file = decodeURIComponent(url.pathname.slice(scope.length)); }
  catch { return; }
  if (!OFFLOADED.has(file) && !EXTRA_PREFIXES.some((p) => file.startsWith(p))) return;
  const remote = ROOT + file.split('/').map(encodeURIComponent).join('/');
  event.respondWith((async () => {
    try {
      const headers = new Headers();
      const range = request.headers.get('Range');
      if (range) headers.set('Range', range);
      const response = await fetch(remote, {
        mode: 'cors', credentials: 'omit', redirect: 'follow', headers
      });
      if (response.ok || response.status === 206) return response;
    } catch (e) { /* Online fallback: retry the original local path. */ }
    return fetch(request);
  })());
});
"""
    worker = (worker.replace("__COMMIT__", commit_sha)
                    .replace("__OFFLOAD_LIST__", json.dumps(offloaded, ensure_ascii=False))
                    .replace("__EXTRA_PREFIXES__", json.dumps(REMOTE_ONLY_PREFIXES)))
    (out / ASSET_RELAY_NAME).write_text(worker, encoding="utf-8")
    # Self-install on all standalone game/preview routes, including deep links.
    # Wait for the asset relay before starting module runtimes. Claiming or
    # updating a worker must never reload an active game or replay its opening.
    boot = """<script id="pages-asset-relay-bootstrap">
window.__haiGinAssetRelayReady = new Promise(function (resolve) {
  if (!('serviceWorker' in navigator)) { resolve(); return; }
  let complete = false;
  const finish = function () {
    if (complete) return;
    complete = true;
    clearTimeout(timer);
    navigator.serviceWorker.removeEventListener('controllerchange', finish);
    resolve();
  };
  const timer = setTimeout(finish, 15000);
  navigator.serviceWorker.addEventListener('controllerchange', finish);
  const revision = '__COMMIT__';
  navigator.serviceWorker.register('./pages-asset-relay-sw.js?rev=' + revision, {scope: './'})
    .then(function (registration) {
      if (navigator.serviceWorker.controller && !registration.installing && !registration.waiting) finish();
    })
    .catch(function (error) { console.warn('Pages asset relay unavailable', error); finish(); });
});
</script>
""".replace("__COMMIT__", commit_sha)
    changed = 0
    for html in out.rglob("*.html"):
        contents = html.read_text(encoding="utf-8")
        if 'id="pages-asset-relay-bootstrap"' in contents:
            continue
        if re.search(r"</head>", contents, flags=re.IGNORECASE):
            contents = re.sub(r"</head>", boot + "</head>", contents, count=1,
                              flags=re.IGNORECASE)
        elif re.search(r"<body", contents, flags=re.IGNORECASE):
            contents = re.sub(r"<body", boot + "<body", contents, count=1,
                              flags=re.IGNORECASE)
        else:
            continue
        contents = re.sub(r'(<script\s+type=["\']module["\']\s*>)',
                          r'\1\nawait window.__haiGinAssetRelayReady;\n', contents)
        html.write_text(contents, encoding="utf-8")
        changed += 1
    if changed < 5:
        raise RuntimeError("Pages relay must be available on all game routes")
    print(f"PAGES ASSET RELAY: {len(offloaded)} large binaries offloaded, {changed} HTML routes bootstrapped.")


def include(path: Path) -> bool:
    rel = path.as_posix()
    parts = path.parts
    if parts[0] in IGNORED_DIRS:
        return False
    if len(parts) == 1 and rel.startswith("play-v") and rel.endswith(".html"):
        return False  # Keep latest named gameplay pages; skip 36 obsolete versions.
    if len(parts) == 1 and rel.endswith(ROOT_DEV_SUFFIXES):
        return False
    if any(rel.startswith(prefix) for prefix in REMOVED_TREE_PREFIXES):
        return False
    if rel.startswith(("assets/creatures/external/", "assets/creatures/quaternius50/")):
        if re.search(r"/(?:source|high)\.glb$", rel):
            return False  # Loaded from raw repository for full-resolution preview.
    return True


def copy_asset(src: Path, dst: Path) -> None:
    # GLTF references expect the original .png path and preserved alpha.
    if (
        src.suffix.lower() == ".png"
        and "/quaternius-modular/textures/" in "/" + src.relative_to(SOURCE).as_posix()
        and src.stat().st_size > 400_000
    ):
        try:
            with Image.open(src) as image:
                if max(image.size) > 1024:
                    image.thumbnail((1024, 1024), Image.Resampling.LANCZOS)
                image.save(dst, format="PNG", optimize=True, compress_level=7)
                return
        except (UnidentifiedImageError, OSError) as err:
            print("WARNING: PNG optimization fallback:", src, err)
    shutil.copy2(src, dst)




STORY_RELEASE_PLACEHOLDER = "__HAI_GIN_STORY_RELEASE_SHA__"


def pin_public_story_images(out: Path, sha: str) -> None:
    """Make game and reviewer load the same revision-specific source originals.

    145+ provisional WebPs are over 37 MiB, so packaging all of them exceeds
    the existing 90 MiB limit. Every image URL resolves by SHA to the exact
    release instead. Reloaded HTML and all nested JS imports are also cache-
    busted together so old modules cannot select outdated artwork.
    """
    if not re.fullmatch(r"[0-9a-f]{40}", sha):
        if os.environ.get("GITHUB_ACTIONS") == "true":
            raise RuntimeError("The published Pages artifact requires an exact 40-character commit SHA")
        print("LOCAL PREVIEW: no deployment revision; keeping local artwork paths.")
        return
    registry = out / "src" / "story-panel-registered-art.js"
    source = registry.read_text(encoding="utf-8")
    if source.count(STORY_RELEASE_PLACEHOLDER) != 1:
        raise RuntimeError("Cannot pin the shared manga game/review URL resolver")
    registry.write_text(source.replace(STORY_RELEASE_PLACEHOLDER, sha), encoding="utf-8")
    suffix = sha[:12]

    # Only rewrite actual JS module imports or script src attributes.
    # Leave image URLs, external packages and source repository files untouched.
    pattern = re.compile(
        r"(?P<lead>\bfrom\s*|\bimport\s*\(\s*|\bimport\s+|\bsrc=)"
        r"(?P<q>['\"])(?P<path>\./[^'\"\n]+?\.(?:m?js)(?:\?[^'\"\n]*)?)(?P=q)"
    )
    # Game/review art must share a single immutable release query. An
    # earlier ?v=story-* cache token is not the commit SHA and must NEVER
    # precede ?release= here: the Pages parity gate deliberately asserts
    # the directly pinned source module URL, and older mobile caches could
    # otherwise load the correct art with the wrong viewer revision.
    canonical_story_modules = {
        "story-manga-viewer.js",
        "story-chapter1-approval-ui.js",
        "story-panel-registered-art.js",
        "story-chapter1-provisional-live.js",
    }
    def version_import(match):
        url = match.group("path")
        bare = url.split("?", 1)[0]
        if bare.rsplit("/", 1)[-1] in canonical_story_modules:
            # Always REPLACE old v/release query: never leave stale SHA.
            next_url = bare + "?release=" + suffix
        elif "release=" in url:
            return match.group(0)
        else:
            sep = "&" if "?" in url else "?"
            next_url = url + sep + "release=" + suffix
        return match.group("lead") + match.group("q") + next_url + match.group("q")

    updated = 0
    for file in list(out.rglob("*.js")) + list(out.rglob("*.html")):
        before = file.read_text(encoding="utf-8")
        after = pattern.sub(version_import, before)
        if after != before:
            file.write_text(after, encoding="utf-8")
            updated += 1
    print(f"PAGES STORY PARITY: pinned artwork to {sha[:12]}, versioned {updated} HTML/JS files.")

def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", default="pages-dist")
    args = parser.parse_args()
    out = (SOURCE / args.out).resolve()
    if out == SOURCE or SOURCE not in out.parents:
        raise ValueError("Output must be a new subfolder inside repository")
    if out.exists():
        shutil.rmtree(out)
    out.mkdir(parents=True)
    file_count = 0
    offloaded: list[str] = []
    offloaded_bytes = 0
    for root, dirs, files in os.walk(SOURCE):
        root_path = Path(root)
        dirs[:] = [d for d in dirs if not d.startswith(".") and d not in IGNORED_DIRS
                   and (root_path / d).resolve() != out]
        for name in files:
            src = root_path / name
            rel = src.relative_to(SOURCE)
            if not include(rel) or src.is_symlink():
                continue
            if is_large_runtime_binary(rel, src):
                offloaded.append(rel.as_posix())
                offloaded_bytes += src.stat().st_size
                continue
            dst = out / rel
            dst.parent.mkdir(parents=True, exist_ok=True)
            copy_asset(src, dst)
            file_count += 1

    # Every release gets unique URLs for the town hub and its heavy iframe.
    # Without this, mobile browsers can reuse an older 3D page despite the
    # latest Pages deployment completing successfully.
    release_sha = os.environ.get("GITHUB_SHA", "local")
    stamp = release_sha[:12]
    pin_public_story_images(out, release_sha)
    # URLs are bound to the exact deployed revision to prevent stale assets.
    add_asset_relay(out, sorted(offloaded), os.environ.get("GITHUB_SHA", "main"))
    for page in ("game.html", "world-map.html", "town-hub.html"):
        file = out / page
        if file.exists():
            content = file.read_text(encoding="utf-8")
            content = content.replace("town-visit-20261110", stamp)
            file.write_text(content, encoding="utf-8")

    # Stamp the exact deployed source revision on both model-management UIs
    # as well as tactical combat. A successful Pages action alone cannot prove
    # the browser received the same HTML revision (mobile CDN/cache regressions).
    for page_name in ("tactics-wireframe.html", "batch-monitor.html", "batch-pr-preview.html"):
        public_page = out / page_name
        if not public_page.is_file():
            raise RuntimeError("Required public page absent: " + page_name)
        html = public_page.read_text(encoding="utf-8")
        if "<head>" not in html:
            raise RuntimeError("Missing <head> in " + page_name)
        html = html.replace(
            "<head>",
            '<head><meta name="hai-gin-pages-sha" content="' + release_sha + '">',
            1,
        )
        public_page.write_text(html, encoding="utf-8")

    (out / ".nojekyll").touch()
    release = {
        "sha": os.environ.get("GITHUB_SHA", "local"),
        "version": "town-pages-slim-asset-relay-v3-story-pinned",
        "story_art_revision": release_sha,
        "story_art_source": "github-raw-exact-release",
        "offloaded_binary_count": len(offloaded),
        "offloaded_binary_bytes": offloaded_bytes,
        "voice_source": "github-raw",
        "creature_high_source": "github-raw",
    }
    (out / "release.json").write_text(
        json.dumps(release, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    for file in REQUIRED:
        if not (out / file).is_file():
            raise RuntimeError("Missing required runtime asset: " + file)
    content_bytes = sum(p.stat().st_size for p in out.rglob("*") if p.is_file())
    mb = content_bytes / 1024 / 1024
    print(f"PAGES RUNTIME: {file_count} files, {mb:.1f} MiB, "
          f"{offloaded_bytes / 1024 / 1024:.1f} MiB binaries offloaded, source intact.")
    if content_bytes > 90 * 1024 * 1024 or file_count > 1600:
        raise RuntimeError(
            f"Pages payload is still too large ({mb:.1f} MiB / {file_count} files). "
            "Refine the package instead of publishing the entire repository."
        )


if __name__ == "__main__":
    main()
