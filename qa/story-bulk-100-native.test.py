#!/usr/bin/env python3
"""QA: 100 is review sheet capacity, not 100 AI-generated manga originals."""
import copy
import importlib.util
import json
import subprocess
from pathlib import Path
from tempfile import TemporaryDirectory

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
BULK = ROOT / "scripts/assemble-story-bulk-100.py"
SHEET = ROOT / "scripts/assemble-story-panel-sheet.py"
OUT = "qa-reports/story-stage-production/bulk-native-100"
SOURCE_3 = OUT + "/source-stage2-through-stage4.json"
SOURCE_1 = OUT + "/source-stage2-only.json"


def load_module(file, name):
    spec = importlib.util.spec_from_file_location(name, file)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def prepare(count, path):
    subprocess.run([
        "node", "scripts/prepare-story-stage-posters.mjs",
        "--start", "c01-s02", "--count", str(count), "--out", path
    ], cwd=ROOT, check=True, capture_output=True, text=True)
    return json.loads((ROOT / path).read_text(encoding="utf-8"))


bulk = load_module(BULK, "bulk_100_review")
native = load_module(SHEET, "one_native_sheet")
stage2 = prepare(1, SOURCE_1)
three = prepare(3, SOURCE_3)
assert sum(len(page["panels"]) for s in stage2["stages"]
           for v in s["variants"] for page in v["pages"]) == 48
assert sum(len(page["panels"]) for s in three["stages"]
           for v in s["variants"] for page in v["pages"]) == 144

b2 = bulk.build_queue(stage2, 0, check_real_files=False)
assert b2["canonicalShotsTotal"] == 48
assert b2["selectedShots"] == 48
assert b2["sheetCount"] == 5
assert [g["sceneCount"] for g in b2["groups"]] == [10, 10, 10, 10, 8]
assert b2["remainingAfterBatch"] == 0
assert b2["newArtActuallyGenerated"] == 0
assert b2["approved"] is False

batch_0 = bulk.build_queue(three, 0, check_real_files=False)
batch_1 = bulk.build_queue(three, 1, check_real_files=False)
assert batch_0["canonicalShotsTotal"] == 144
assert batch_0["selectedShots"] == 100
assert batch_0["sheetCount"] == 10
assert batch_0["remainingAfterBatch"] == 44
assert all(g["sceneCount"] == 10 and g["rows"] == 5
           and g["blankCells"] == 0
           and g["preferredSheetPixels"] == [4096, 5760]
           for g in batch_0["groups"])
assert batch_1["selectedShots"] == 44
assert batch_1["sheetCount"] == 5
assert [g["sceneCount"] for g in batch_1["groups"]] == [10, 10, 10, 10, 4]
assert batch_1["groups"][-1]["rows"] == 2

unique = [frame["shotKey"]
          for batch in (batch_0, batch_1)
          for group in batch["groups"]
          for frame in group["frames"]]
assert len(unique) == len(set(unique)) == 144
assert len([k for k in unique if k.startswith("c01-s02|")]) == 48
assert len([k for k in unique if k.startswith("c01-s03|")]) == 48
assert len([k for k in unique if k.startswith("c01-s04|")]) == 48
assert all(frame["approved"] is False
           for group in batch_0["groups"] for frame in group["frames"])

# Reject tampered scene provenance before planning, no cross-branch ID alias.
broken = copy.deepcopy(three)
broken["stages"][0]["variants"][0]["pages"][0]["panels"][0]["shotKey"] = "wrong"
try:
    bulk.build_queue(broken, 0, check_real_files=False)
except ValueError as exc:
    assert "canonical shot" in str(exc)
else:
    raise AssertionError("Tampered canonical shot passed")

# Simulate ten sheets of ten *test* patterns. Native full-resolution geometry
# has a separate 4096x5760 exact-pixel test in story-panel-sheet-native.test.py.
with TemporaryDirectory(prefix="bulk-review-synthetic-NOT-story-art-") as d:
    base = Path(d)
    for group in batch_0["groups"]:
        input_files = []
        for i, frame in enumerate(group["frames"]):
            # Intentionally high-contrast synthetic QA image. Earlier soft
            # colors sometimes tripped the genuinely enforced blank-frame gate.
            im = Image.new("RGB", (160, 90), (7, 11, 19))
            pen = ImageDraw.Draw(im)
            pen.rectangle((10 + i, 10, 90 + i, 70), fill=(245, 247, 251))
            pen.line((0, 0, 159, 89), fill=(246, 65, 43), width=5)
            filename = base / ("sheet-%02d-cell-%02d.webp" %
                               (group["sheetIndex"], i))
            im.save(filename, "WEBP", lossless=True, method=0)
            input_files.append(filename)
        output = base / ("synthetic-sheet-%02d.webp" % group["sheetIndex"])
        trial = native.assemble_sheet(
            input_files, [x["shotKey"] for x in group["frames"]],
            output, (160, 90))
        assert trial["sceneCount"] == 10
        assert trial["sheetPixels"] == [320, 450]
        assert trial["approved"] is False
        assert trial["deployed"] is False
        assert output.is_file()

# Production code refuses to assemble absent genuine native images.
verified = bulk.build_queue(stage2, 0, check_real_files=True)
assert verified["newArtActuallyGenerated"] == 0
assert all(g["approved"] is False and g["deployed"] is False
           for g in verified["groups"])
# Real stage2 is still incomplete; there cannot be 10 approved sheets.
assert not all(g["status"] == "READY_FOR_LOSSLESS_REVIEW_ASSEMBLY_NOT_APPROVED"
               for g in verified["groups"])

print("PASS: 48 stage2 frames = 5 sheets; 144 stage2..4 frames = 100 + 44; "
      "10 x 10 scene groups individually and pixel-roundtrip checked using "
      "synthetic test graphics only. No original AI art generated or approved.")
