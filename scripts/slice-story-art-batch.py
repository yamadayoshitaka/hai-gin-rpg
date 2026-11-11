#!/usr/bin/env python3
"""Crop an approved 2x5 ten-scene sheet into ten canonical 16:9 WebPs.

Male-to-female is an ALIGNED local replacement, not a second full-scene
generation: only pixels within the player-character mask change. The original
background and every other cast member are byte-identical outside that mask.

This script does NOT call any image-generation service or claim to create art.
It imports approved art that has actually been delivered as a sheet.
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import re
from pathlib import Path

from PIL import Image, ImageChops, ImageOps, ImageStat

ROOT = Path(__file__).resolve().parents[1]
PLAN_FILE = ROOT / "qa-reports/story-art-batch-plan.json"
STATUS_FILE = ROOT / "assets/story/sheets/processed-batches.json"
REGISTRY_FILE = ROOT / "src/story-panel-neutral-ids.js"
ID_RE = re.compile(r"^c\d{2}-s\d{2}-m[1-7]$")
OUTPUT_RE = re.compile(r"^assets/story/panels/c\d{2}-s\d{2}-m0[1-7](?:-female)?\.webp$")
GRID_COLUMNS, GRID_ROWS = 2, 5
FINAL_SIZE = (960, 540)


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def get_plan() -> dict:
    data = json.loads(PLAN_FILE.read_text(encoding="utf-8"))
    if data.get("totalBatches") != 140 or data.get("totalPanels") != 1400:
        raise ValueError("The canonical 20-chapter batch plan is incomplete")
    return data


def image_at(path: Path) -> Image.Image:
    with Image.open(path) as raw:
        raw.load()
        return raw.copy()


def verify_sheet(sheet: Image.Image, name: str, dims: tuple[int, int] | None = None):
    w, h = sheet.size
    if dims and sheet.size != dims:
        raise ValueError(f"{name} size differs from base sheet: {sheet.size} != {dims}")
    if w % GRID_COLUMNS or h % GRID_ROWS:
        raise ValueError(f"{name} dimensions must divide into 2 columns and 5 rows")
    cellw, cellh = w // GRID_COLUMNS, h // GRID_ROWS
    if cellw < 768 or cellh < 432:
        raise ValueError(f"{name} cannot yield detailed scenes: cell {cellw}x{cellh} is too small")
    aspect = cellw / cellh
    if abs(aspect - 16 / 9) > .19:
        raise ValueError(f"{name} panel aspect {aspect:.3f} is too far from 16:9")
    return cellw, cellh


def frame(sheet: Image.Image, index: int, cellw: int, cellh: int,
          resample=Image.Resampling.LANCZOS) -> Image.Image:
    col, row = index % GRID_COLUMNS, index // GRID_COLUMNS
    tile = sheet.crop((col * cellw, row * cellh,
                       (col + 1) * cellw, (row + 1) * cellh))
    return ImageOps.fit(tile, FINAL_SIZE, method=resample, centering=(.5, .5))


def dhash(image: Image.Image) -> int:
    gray = image.convert("L").resize((9, 8), Image.Resampling.LANCZOS)
    pixels = list(gray.getdata())
    acc = 0
    for row in range(8):
        for col in range(8):
            acc = (acc << 1) | int(pixels[row * 9 + col] > pixels[row * 9 + col + 1])
    return acc


def encode_webp(image: Image.Image) -> bytes:
    buf = io.BytesIO()
    image.convert("RGB").save(buf, format="WEBP", quality=92, method=6)
    content = buf.getvalue()
    if len(content) < 12000 or content[:4] != b"RIFF" or content[8:12] != b"WEBP":
        raise ValueError("Generated tile has invalid or nearly empty WebP bytes")
    return content


def approve(path: Path, base_hash: str, batch: dict) -> dict:
    if not path.is_file():
        raise ValueError(f"Missing image-approval record: {path}")
    data = json.loads(path.read_text(encoding="utf-8"))
    if data.get("approved") is not True or data.get("baseSha256") != base_hash:
        raise ValueError("A signed-off review must match the EXACT submitted base sheet")
    if not str(data.get("approvedBy", "")).strip():
        raise ValueError("Approval requires a named reviewer")
    expected = ["noText", "accurateStory", "charactersConsistent",
                "noRepeatedFrames", "notInfographic"]
    if any(data.get("confirm", {}).get(k) is not True for k in expected):
        raise ValueError("Review must confirm no text/UI, 10 distinct scenes and cast continuity")
    neutral = data.get("noHeroPanelIds", [])
    valid_ids = {p["id"] for p in batch["panels"]}
    if len(set(neutral)) != len(neutral) or not set(neutral).issubset(valid_ids):
        raise ValueError("Only distinct panel IDs from THIS sheet can be declared hero-free")
    return data


def read_registry() -> set[str]:
    if not REGISTRY_FILE.exists():
        return {"c01-s01-m5"}
    return set(re.findall(r"c\d{2}-s\d{2}-m[1-7]",
                          REGISTRY_FILE.read_text(encoding="utf-8")))


def status() -> dict:
    if STATUS_FILE.exists():
        return json.loads(STATUS_FILE.read_text(encoding="utf-8"))
    return {"schemaVersion": 1, "batches": {}}


def process(batch: dict, state: dict, neutrals: set[str]) -> dict:
    folder = ROOT / "assets/story/sheets" / batch["id"]
    sheet_file = folder / "base.png"
    if not sheet_file.exists():
        return {"id": batch["id"], "status": "not-ready"}
    base_bytes = sheet_file.read_bytes()
    base_hash = sha(base_bytes)
    prior = state["batches"].get(batch["id"])
    if prior and prior.get("baseSha256") == base_hash:
        return {"id": batch["id"], "status": "already-processed"}
    approval = approve(folder / "review-approved.json", base_hash, batch)
    base_sheet = image_at(sheet_file).convert("RGB")
    cellw, cellh = verify_sheet(base_sheet, str(sheet_file))
    female_file = folder / "heroine-edit.png"
    mask_file = folder / "hero-mask.png"
    if female_file.exists() != mask_file.exists():
        raise ValueError("Female edit sheet and hero mask sheet must appear together")
    heroine = image_at(female_file).convert("RGB") if female_file.exists() else None
    mask_sheet = image_at(mask_file).convert("L") if mask_file.exists() else None
    if heroine:
        verify_sheet(heroine, str(female_file), base_sheet.size)
        verify_sheet(mask_sheet, str(mask_file), base_sheet.size)

    new_assets: dict[Path, bytes] = {}
    hashes: list[int] = []
    patch_count = 0
    neutral_count = 0
    cells = batch["panels"]
    if len(cells) != 10:
        raise ValueError("Every batch must contain exactly ten canonical scene panels")
    for pos, spec in enumerate(cells):
        ident = spec["id"]
        if not ID_RE.fullmatch(ident):
            raise ValueError("Unexpected scene ID " + ident)
        male_path = spec["maleOutput"]
        female_path = spec["femaleOutput"]
        if not OUTPUT_RE.fullmatch(male_path) or not OUTPUT_RE.fullmatch(female_path):
            raise ValueError("Unexpected destination for " + ident)
        male = frame(base_sheet, pos, cellw, cellh).convert("RGB")
        variance = ImageStat.Stat(ImageOps.grayscale(male)).stddev[0]
        if variance < 11:
            raise ValueError(f"{ident}: almost uniform tile, not an illustration")
        current_hash = dhash(male)
        for earlier, oldhash in enumerate(hashes):
            if (oldhash ^ current_hash).bit_count() <= 3:
                raise ValueError(f"{ident}: near-duplicate of frame {earlier+1}")
        hashes.append(current_hash)
        new_assets[ROOT / male_path] = encode_webp(male)

        marked_neutral = ident in approval.get("noHeroPanelIds", [])
        if marked_neutral:
            if mask_sheet is not None:
                alpha = frame(mask_sheet, pos, cellw, cellh,
                              resample=Image.Resampling.NEAREST).convert("L")
                if alpha.getextrema()[1] > 1:
                    raise ValueError(f"{ident}: hero-free panel has a nonempty hero mask")
            neutrals.add(ident)
            neutral_count += 1
            continue
        # Do not label a protagonist-containing scene 'gender-neutral.'
        neutrals.discard(ident)
        female_output = ROOT / female_path
        if heroine is None:
            # Existing female scenes would now have a different background.
            # Reject silent drift until an aligned heroine replacement exists.
            if female_output.exists():
                raise ValueError(f"{ident}: existing heroine image needs the matching edit+mask")
            continue
        alpha = frame(mask_sheet, pos, cellw, cellh,
                      resample=Image.Resampling.NEAREST).convert("L")
        alpha = alpha.point(lambda x: 255 if x >= 128 else 0)
        coverage = sum(1 for x in alpha.getdata() if x > 0) / (FINAL_SIZE[0] * FINAL_SIZE[1])
        if not .003 <= coverage <= .40:
            raise ValueError(f"{ident}: hero mask must cover one character only (got {coverage:.1%})")
        edit = frame(heroine, pos, cellw, cellh).convert("RGB")
        result = Image.composite(edit, male, alpha)
        difference = ImageChops.difference(male, result)
        outside = Image.composite(difference, Image.new("RGB", FINAL_SIZE),
                                  ImageOps.invert(alpha))
        if outside.getbbox() is not None:
            raise ValueError(f"{ident}: other characters/background changed outside hero mask")
        new_assets[female_output] = encode_webp(result)
        patch_count += 1

    # Commit on disk only after ALL scenes of this batch pass quality gates.
    for dest, content in new_assets.items():
        dest.parent.mkdir(parents=True, exist_ok=True)
        temp = dest.with_suffix(dest.suffix + ".tmp")
        temp.write_bytes(content)
        temp.replace(dest)
    state["batches"][batch["id"]] = {
        "baseSha256": base_hash,
        "stageIds": batch["stages"],
        "panelIds": [p["id"] for p in cells],
        "maleFrames": 10,
        "femaleHeroReplacements": patch_count,
        "genderNeutralFrames": neutral_count,
        "reviewer": approval["approvedBy"],
    }
    return {"id": batch["id"], "status": "registered", "male": 10,
            "heroineEdited": patch_count, "heroFree": neutral_count}


def main() -> None:
    parser = argparse.ArgumentParser()
    selected = parser.add_mutually_exclusive_group(required=True)
    selected.add_argument("--batch", type=int)
    selected.add_argument("--all-ready", action="store_true")
    args = parser.parse_args()
    data = get_plan()
    if args.batch is not None and not 1 <= args.batch <= 140:
        parser.error("--batch must be 1..140")
    chosen = data["batches"] if args.all_ready else [data["batches"][args.batch-1]]
    state, neutrals = status(), read_registry()
    results = []
    for batch in chosen:
        item = process(batch, state, neutrals)
        results.append(item)
        print(json.dumps(item, ensure_ascii=False), flush=True)

    # Preserve canonical, reviewed gender-neutral panel IDs on reruns.
    for ident in neutrals:
        if not ID_RE.fullmatch(ident):
            raise ValueError("Invalid gender-neutral registry ID: "+ident)
    REGISTRY_FILE.parent.mkdir(parents=True, exist_ok=True)
    REGISTRY_FILE.write_text(
        "/* Exact protagonist-free panels: reviewed against scene artwork. */\n"
        "export const STORY_NEUTRAL_PANEL_IDS=Object.freeze("
        + json.dumps(sorted(neutrals), ensure_ascii=False) + ");\n", encoding="utf-8")
    STATUS_FILE.parent.mkdir(parents=True, exist_ok=True)
    STATUS_FILE.write_text(json.dumps(state, ensure_ascii=False, indent=2)+"\n",encoding="utf-8")
    registered = [r for r in results if r["status"]=="registered"]
    print(json.dumps({"processed":len(registered),"readyOrPreviouslyCompleted":
         sum(1 for r in results if r["status"]!="not-ready"),
         "totalBatches":140, "statusFile":str(STATUS_FILE)},ensure_ascii=False))


if __name__ == "__main__":
    main()
