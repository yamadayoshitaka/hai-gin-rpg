#!/usr/bin/env python3
"""Assemble already-rendered independent WebPs into a review-only 2xN lossless sheet.

No generator is called. This script never creates a missing story illustration,
upscales a small source, approves artwork, changes game mappings, or deploys.
Use after producing real independent panels with the correct protagonist and
branch, and inspect every frame against its screenplay/character references.

python scripts/assemble-story-panel-sheet.py \\
  --manifest qa-reports/story-stage-production/batches/c01-s02/stage-manifest.json \\
  --stage c01-s02 --edition pre --gender female

For 10 true 2048x1152 panels: sheet is exactly 4096x5760.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path

from PIL import Image, ImageChops, ImageStat

ROOT = Path(__file__).resolve().parents[1]
MAX_COUNT = 10
COLS = 2
PREFERRED = (2048, 1152)
MOBILE_MINIMUM = (768, 320)  # Stage2 per-cut minimum; no minimum 1536x864 for stage2


def sha256(file):
    return hashlib.sha256(Path(file).read_bytes()).hexdigest()


def geometry(count, cell_size=PREFERRED, mobile=False):
    cap = 5 if mobile else MAX_COUNT
    if not isinstance(count, int) or not 1 <= count <= cap:
        raise ValueError("REJECTED: exceeded the active review-sheet scene limit")
    w, h = cell_size
    if not isinstance(w, int) or not isinstance(h, int) or w <= 0 or h <= 0:
        raise ValueError("Invalid native cell dimensions")
    if mobile:
        if w < MOBILE_MINIMUM[0] or h < MOBILE_MINIMUM[1] or w <= h:
            raise ValueError("REJECTED_MOBILE_NATIVE_RESOLUTION: requires true source >=768x320 landscape")
    elif w * 9 != h * 16:
        raise ValueError("REJECTED: legacy cells must be exactly 16:9")
    rows = math.ceil(count / COLS)
    return {"columns": COLS, "rows": rows, "sceneCount": count,
            "blankCells": rows * COLS - count,
            "cellNativePixels": [w, h],
            "sheetPixels": [w * COLS, h * rows]}


def safe_repo_file(relative):
    p = Path(relative)
    if p.is_absolute() or ".." in p.parts:
        raise ValueError("Unsafe filename in production manifest: " + str(relative))
    return ROOT / p


def assemble_sheet(files, scene_ids, output, cell_size=PREFERRED, mobile=False):
    """Lossless composite and exact split-roundtrip for supplied genuine WebPs.

    The assembly validates geometry/byte sources, not subjective visual quality.
    Output and companion JSON are unapproved review artifacts, never game art.
    """
    if len(files) != len(scene_ids) or len(set(scene_ids)) != len(scene_ids):
        raise ValueError("REJECTED: one unique canonical ID required for each source")
    info = geometry(len(files), cell_size, mobile=mobile)
    cw, ch = cell_size
    output = Path(output)
    output.parent.mkdir(parents=True, exist_ok=True)
    sheet = Image.new("RGB", tuple(info["sheetPixels"]), (20, 20, 24))
    source = []
    # Validate ALL inputs first; do not output partial sheets.
    for i, src in enumerate(files):
        src = Path(src)
        if not src.is_file():
            raise FileNotFoundError("BLOCKED_MISSING_REAL_FRAME: " + str(src))
        with Image.open(src) as im:
            im.load()
            if im.format != "WEBP":
                raise ValueError("REJECTED_NOT_WEBP: " + str(src))
            if im.size != (cw, ch):
                raise ValueError("REJECTED_UNDER_RESOLUTION_OR_SIZE_MISMATCH: " +
                                 str(src) + " has " + str(im.size) +
                                 "; needs independent native " + str((cw, ch)))
            if ImageStat.Stat(im.convert("L")).stddev[0] < 8:
                raise ValueError("REJECTED_NEAR_BLANK_FRAME: " + str(src))
            source.append({"panelId": scene_ids[i], "source": str(src),
                           "sha256": sha256(src), "pixels": [cw, ch]})
    # A sheet is made by pasting already-rendered originals, never by stretching.
    for i, src in enumerate(files):
        with Image.open(src) as im:
            sheet.paste(im.convert("RGB"), ((i % COLS) * cw, (i // COLS) * ch))
    sheet.save(output, format="WEBP", lossless=True, method=3)
    with Image.open(output) as saved:
        saved.load()
        if saved.size != tuple(info["sheetPixels"]):
            raise ValueError("REJECTED: sheet output pixel geometry wrong")
        for i, src in enumerate(files):
            with Image.open(src) as original:
                crop = saved.crop(((i % COLS) * cw, (i // COLS) * ch,
                                   (i % COLS + 1) * cw, (i // COLS + 1) * ch))
                if ImageChops.difference(crop, original.convert("RGB")).getbbox():
                    raise ValueError("REJECTED: roundtrip changed frame pixels: " +
                                     scene_ids[i])
    result = {"kind": "LOSSLESS_REVIEW_SHEET_NOT_GAME_ASSET",
              "status": "COMPOSITE_AND_PIXEL_ROUNDTRIP_PASS_VISUAL_QA_PENDING",
              "approved": False, "deployed": False,
              "nativeMinimumPixels": list(MOBILE_MINIMUM) if mobile else None,
              "sourceAspectRatioPreserved": mobile,
              "singleFrameNativeGenerationVerified": False,
              "actualCastImageAttachmentsVerified": False,
              "textFreeHumanReviewCompleted": False,
              "sheet": str(output), "sheetSha256": sha256(output),
              **info, "frames": source}
    output.with_suffix(".review.json").write_text(
        json.dumps(result, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8")
    return result


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--manifest", required=True, help="Prepared stage-manifest.json")
    p.add_argument("--stage", required=True)
    p.add_argument("--edition", required=True)
    p.add_argument("--gender", choices=["male", "female"], required=True)
    p.add_argument("--out-root",
                   default="qa-reports/story-stage-production/assembled-sheets")
    args = p.parse_args()
    manifest = json.loads(safe_repo_file(args.manifest).read_text(encoding="utf-8"))
    matches = [stage for stage in manifest["stages"] if stage["stageId"] == args.stage]
    if len(matches) != 1:
        raise ValueError("Unknown / ambiguous requested stage")
    variants = [v for v in matches[0]["variants"]
                if v["edition"] == args.edition and v["gender"] == args.gender]
    if len(variants) != 1:
        raise ValueError("Unknown / ambiguous gender-outcome variant")
    pages = variants[0]["pages"]
    mobile = args.stage == "c01-s02"
    if not mobile and len(pages) != 1:
        raise ValueError("Legacy per-edition review sheet count changed")
    out_root = Path(args.out_root)
    if out_root.is_absolute() or ".." in out_root.parts:
        raise ValueError("Unsafe review output location")
    reports = []
    for page in pages:
        if mobile and not 1 <= len(page["panels"]) <= 5:
            raise ValueError("REJECTED: stage2 must have <=5 real frames per sheet")
        files = [safe_repo_file(panel["individualAsset"]) for panel in page["panels"]]
        ids = [panel["panelId"] for panel in page["panels"]]
        if mobile:
            if not files[0].is_file():
                raise FileNotFoundError("BLOCKED_MISSING_REAL_FRAME: " + str(files[0]))
            with Image.open(files[0]) as first:
                native_size = first.size
        else:
            native_size = PREFERRED
        dest = ROOT / out_root / (args.stage + "-" + args.edition + "-" +
                                  args.gender + "-p%02d.webp" % page["page"])
        report = assemble_sheet(files, ids, dest, cell_size=native_size, mobile=mobile)
        reports.append({k: v for k, v in report.items() if k != "frames"})
    print(json.dumps({"stageId": args.stage, "edition": args.edition,
                      "gender": args.gender, "sheets": reports,
                      "approved": False, "deployed": False},
                     ensure_ascii=False))


if __name__ == "__main__":
    main()
