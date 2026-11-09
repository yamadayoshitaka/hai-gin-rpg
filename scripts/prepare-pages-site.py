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
    for root, dirs, files in os.walk(SOURCE):
        root_path = Path(root)
        dirs[:] = [d for d in dirs if not d.startswith(".") and d not in IGNORED_DIRS
                   and (root_path / d).resolve() != out]
        for name in files:
            src = root_path / name
            rel = src.relative_to(SOURCE)
            if not include(rel) or src.is_symlink():
                continue
            dst = out / rel
            dst.parent.mkdir(parents=True, exist_ok=True)
            copy_asset(src, dst)
            file_count += 1

    (out / ".nojekyll").touch()
    release = {
        "sha": os.environ.get("GITHUB_SHA", "local"),
        "version": "town-pages-slim-v1",
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
    print(f"PAGES RUNTIME: {file_count} files, {mb:.1f} MiB, source remains intact.")
    if content_bytes > 195 * 1024 * 1024 or file_count > 1600:
        raise RuntimeError(
            f"Pages payload is still too large ({mb:.1f} MiB / {file_count} files). "
            "Refine the package instead of publishing the entire repository."
        )


if __name__ == "__main__":
    main()
