#!/usr/bin/env python3
"""Plan at most 100 canonical independent frames as ten 2x5 review sheets.

This is a deterministic preflight + optional lossless assembler, not an image
generator. It never makes fake story art, copies between genders/outcomes,
upscales small frames, approves art, changes game mappings, or deploys.

Example:
  node scripts/prepare-story-stage-posters.mjs --start c01-s02 --count 3 \
      --out qa-reports/story-stage-production/bulk-100-source.json
  python scripts/assemble-story-bulk-100.py \
      --manifest qa-reports/story-stage-production/bulk-100-source.json \
      --batch-index 0 --prepare-only
  # When 100 genuine source frames exist and pass P0 review:
  python scripts/assemble-story-bulk-100.py \
      --manifest qa-reports/story-stage-production/bulk-100-source.json \
      --batch-index 0 --assemble

The 100-shot batch is a *capacity*, not a fabricated fixed scene quota.
For a 144-shot source, batch 0 has 100 and batch 1 has 44; for stage 2 alone,
there are exactly 48 canonical scenes (5 review sheets, last sheet 8).
"""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
MAX_SHEETS = 10
MAX_PER_SHEET = 10
MAX_BATCH = MAX_SHEETS * MAX_PER_SHEET
MIN_FRAME = (1536, 864)
PREFERRED_FRAME = (2048, 1152)
SCENE_PROVENANCE_SEPARATOR = "|"
MODULE = ROOT / "scripts/assemble-story-panel-sheet.py"


def repo_path(path):
    p = Path(path)
    if p.is_absolute() or ".." in p.parts:
        raise ValueError("Unsafe repository-relative path: " + str(path))
    return ROOT / p


def sha256(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def canonical_frames(doc):
    if doc.get("kind") != "production-manifest-not-generated-art" or \
            doc.get("artGeneratorAttached") is not False or \
            doc.get("absolutePriority") != "P0_ABSOLUTE_MUST_FOLLOW":
        raise ValueError("Incorrect/untrusted canonical production manifest")
    entries = []
    seen = set()
    for stage in doc.get("stages", []):
        stage_id = stage["stageId"]
        for variant in stage["variants"]:
            edition, gender = variant["edition"], variant["gender"]
            if variant.get("stageId") != stage_id or \
                    gender not in ("male", "female") or \
                    variant.get("panels") != sum(
                        len(page["panels"]) for page in variant["pages"]):
                raise ValueError("Variant contract / scene count mismatch")
            for page in variant["pages"]:
                for panel in page["panels"]:
                    shot_id = panel["panelId"]
                    key = SCENE_PROVENANCE_SEPARATOR.join(
                        (stage_id, edition, gender, shot_id))
                    if key != panel["shotKey"] or key in seen:
                        raise ValueError("Duplicate/inconsistent canonical shot: " + key)
                    seen.add(key)
                    if panel.get("absolutePriority") != "P0_ABSOLUTE_MUST_FOLLOW" \
                            or panel.get("renderReady") is not False \
                            or panel.get("approval", {}).get("approved") is not False:
                        raise ValueError("Unsafe P0/approval status in canonical source")
                    if panel.get("attachmentGate") != \
                            "ATTACH_REAL_IMAGE_BYTES_BEFORE_GENERATION" \
                            or not panel.get("generationPrompt", "").startswith(
                                "P0_ABSOLUTE_MUST_FOLLOW."):
                        raise ValueError("Missing actual-cast-reference P0 gate")
                    filename = panel["individualAsset"]
                    repo_path(filename)
                    entries.append({
                        "shotKey": key,
                        "stageId": stage_id,
                        "edition": edition,
                        "gender": gender,
                        "panelId": shot_id,
                        "sourceImage": filename,
                        "scriptText": panel["scriptText"],
                        "qualityReferenceImage": panel["qualityReferenceImage"],
                        "requiredReferenceImagePaths": [
                            r["sourceImage"] for r in panel["requiredCharacterReferences"]],
                        "imageTextAllowed": False,
                        "sourceAttachedAtGeneration": False,
                        "visualQA": "PENDING",
                        "approved": False,
                    })
    return entries


def inspect_native_frame(file):
    if not file.is_file():
        return {"status": "MISSING_REAL_INDEPENDENT_WEBP", "nativePixels": None}
    try:
        with Image.open(file) as im:
            im.load()
            size = im.size
            webp = im.format == "WEBP"
        if not webp:
            return {"status": "REJECTED_NOT_WEBP", "nativePixels": list(size)}
        if size[0] < MIN_FRAME[0] or size[1] < MIN_FRAME[1] or \
                size[0] * 9 != size[1] * 16:
            return {"status": "REJECTED_NATIVE_PIXELS_OR_ASPECT",
                    "nativePixels": list(size)}
        return {"status": "NATIVE_PIXELS_VALID_VISUAL_QA_PENDING",
                "nativePixels": list(size), "sha256": sha256(file)}
    except (OSError, ValueError):
        return {"status": "REJECTED_DAMAGED_WEBP", "nativePixels": None}


def build_queue(doc, batch_index=0, check_real_files=True):
    if batch_index < 0:
        raise ValueError("batch_index cannot be negative")
    all_frames = canonical_frames(doc)
    start = batch_index * MAX_BATCH
    frames = all_frames[start:start + MAX_BATCH]
    if not frames:
        raise ValueError("No real canonical scenes in selected batch index")
    results = []
    for i in range(0, len(frames), MAX_PER_SHEET):
        group = frames[i:i + MAX_PER_SHEET]
        sheet_no = i // MAX_PER_SHEET + 1
        checked = []
        for panel in group:
            result = inspect_native_frame(repo_path(panel["sourceImage"])) \
                if check_real_files else {
                    "status": "NOT_INSPECTED_TEST_ONLY",
                    "nativePixels": None
                }
            checked.append({**panel, **result})
        native_sizes = [tuple(x["nativePixels"]) for x in checked
                        if x["status"] == "NATIVE_PIXELS_VALID_VISUAL_QA_PENDING"]
        all_ready = len(native_sizes) == len(group)
        uniform = all_ready and len(set(native_sizes)) == 1
        status = "READY_FOR_LOSSLESS_REVIEW_ASSEMBLY_NOT_APPROVED" if uniform \
            else "BLOCKED_MISSING_OR_UNSUITABLE_NATIVE_SOURCES"
        results.append({
            "sheetIndex": sheet_no,
            "sceneCount": len(group),
            "capacity": MAX_PER_SHEET,
            "columns": 2,
            "rows": (len(group) + 1) // 2,
            "blankCells": (len(group) + 1) // 2 * 2 - len(group),
            "preferredNativeFramePixels": list(PREFERRED_FRAME),
            "preferredSheetPixels": [2 * PREFERRED_FRAME[0],
                                      ((len(group) + 1) // 2) * PREFERRED_FRAME[1]],
            "nativePixelsWhenReady": list(native_sizes[0]) if uniform else None,
            "status": status,
            "sourceCount": len(group),
            "frames": checked,
            "approved": False,
            "deployed": False,
            "reviewOnly": True,
            "mixedStageOrOutcomeImagesAreNeverReused": True,
        })
    return {
        "schemaVersion": 1,
        "kind": "CANONICAL_BULK_100_REVIEW_QUEUE_NOT_GENERATED_ART",
        "priority": "P0_ABSOLUTE_MUST_FOLLOW",
        "maxSheets": MAX_SHEETS,
        "maxPanelsPerSheet": MAX_PER_SHEET,
        "batchCapacity": MAX_BATCH,
        "batchIndex": batch_index,
        "canonicalShotsTotal": len(all_frames),
        "selectedShots": len(frames),
        "remainingAfterBatch": max(0, len(all_frames) - start - len(frames)),
        "sheetCount": len(results),
        "fullTenCellPreferredSize": [4096, 5760],
        "directGiantImageGeneratorCapability": "UNVERIFIED",
        "newArtActuallyGenerated": 0,
        "approved": False,
        "registeredAsNewGameArt": False,
        "deployed": False,
        "actualMasterInputsToGeneratorVerified": False,
        "visualQaMustBePerformedManually": True,
        "groups": results,
    }


def produce_review_sheets(queue, out_rel):
    """Optional review-only assembly; missing/invalid sources remain blocked.

    Grouping across variants never changes a shot's stage/outcome/gender key.
    """
    out_root = repo_path(out_rel)
    spec = importlib.util.spec_from_file_location("native_story_sheet", MODULE)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    processed = 0
    for group in queue["groups"]:
        if group["status"] != "READY_FOR_LOSSLESS_REVIEW_ASSEMBLY_NOT_APPROVED":
            continue
        source = [repo_path(frame["sourceImage"]) for frame in group["frames"]]
        keys = [frame["shotKey"] for frame in group["frames"]]
        native = tuple(group["nativePixelsWhenReady"])
        output = out_root / ("batch-%02d-sheet-%02d.webp" %
                             (queue["batchIndex"], group["sheetIndex"]))
        result = module.assemble_sheet(source, keys, output, native)
        if result["approved"] is not False or result["deployed"] is not False:
            raise AssertionError("Review-only assembler improperly approved a sheet")
        group["reviewSheetFile"] = str(output.relative_to(ROOT))
        group["reviewSheetSha256"] = sha256(output)
        group["status"] = "SHEET_ROUNDTRIP_PASS_P0_HUMAN_QA_REQUIRED"
        processed += 1
    queue["assembledReviewSheets"] = processed
    queue["blockedReviewSheets"] = queue["sheetCount"] - processed
    return queue


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--batch-index", type=int, default=0)
    parser.add_argument("--out-root",
                        default="qa-reports/story-stage-production/bulk-native-100")
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--prepare-only", action="store_true")
    mode.add_argument("--assemble", action="store_true")
    args = parser.parse_args()
    doc = json.loads(repo_path(args.manifest).read_text(encoding="utf-8"))
    queue = build_queue(doc, args.batch_index)
    if args.assemble:
        queue = produce_review_sheets(queue, args.out_root)
    else:
        queue["assembledReviewSheets"] = 0
        queue["blockedReviewSheets"] = queue["sheetCount"]
    out = repo_path(args.out_root)
    out.mkdir(parents=True, exist_ok=True)
    report = out / ("batch-%02d.review.json" % args.batch_index)
    report.write_text(json.dumps(queue, ensure_ascii=False, indent=2) + "\n",
                      encoding="utf-8")
    print(json.dumps({
        "batchIndex": queue["batchIndex"],
        "canonicalShotsTotal": queue["canonicalShotsTotal"],
        "selectedShots": queue["selectedShots"],
        "sheetCount": queue["sheetCount"],
        "remainingAfterBatch": queue["remainingAfterBatch"],
        "assembledReviewSheets": queue["assembledReviewSheets"],
        "blockedReviewSheets": queue["blockedReviewSheets"],
        "newArtActuallyGenerated": 0,
        "approved": False, "deployed": False,
        "reviewReport": str(report.relative_to(ROOT)),
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
