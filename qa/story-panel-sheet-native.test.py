#!/usr/bin/env python3
"""Real pixel-geometry test using only synthetic test patterns, NEVER story art."""
import importlib.util
import json
from pathlib import Path
from tempfile import TemporaryDirectory

from PIL import Image, ImageDraw

MODULE = Path(__file__).resolve().parents[1] / "scripts/assemble-story-panel-sheet.py"
spec = importlib.util.spec_from_file_location("story_sheet", MODULE)
assembly = importlib.util.module_from_spec(spec)
spec.loader.exec_module(assembly)


def create_test_frames(directory, count, size):
    paths = []
    w, h = size
    for i in range(count):
        im = Image.new("RGB", size, ((i * 17) % 200, 31, 92))
        d = ImageDraw.Draw(im)
        d.rectangle((w // 8, h // 8, w * 5 // 8, h * 5 // 8),
                    fill=((i * 31 + 70) % 256, 215, 125))
        d.line((0, 0, w-1, h-1), fill=(255, 255, 255),
               width=max(1, w // 90))
        d.line((0, h-1, w-1, 0), fill=(10, 10, 15),
               width=max(1, w // 90))
        file = directory / ("synthetic_test_%02d.webp" % i)
        im.save(file, "WEBP", lossless=True, method=1)
        paths.append(file)
    return paths


assert assembly.geometry(10)["sheetPixels"] == [4096, 5760]
assert assembly.geometry(10)["blankCells"] == 0
assert assembly.geometry(8)["sheetPixels"] == [4096, 4608]
assert assembly.geometry(7)["sheetPixels"] == [4096, 4608]
assert assembly.geometry(7)["blankCells"] == 1
assert assembly.geometry(2)["sheetPixels"] == [4096, 1152]
for bad in (0, 11):
    try:
        assembly.geometry(bad)
    except ValueError:
        pass
    else:
        raise AssertionError("Invalid number of frames was accepted")
try:
    assembly.geometry(10, (2048, 1024))
except ValueError:
    pass
else:
    raise AssertionError("16:9 invariant was not enforced")

with TemporaryDirectory(prefix="story-sheet-geometry-only-") as temp:
    root = Path(temp)
    # This is a full native-resolution 10-frame test, not an AI generation.
    test_root = root / "10"
    test_root.mkdir()
    originals = create_test_frames(test_root, 10, (2048, 1152))
    ids = ["synthetic-test-panel-%02d" % i for i in range(10)]
    out = test_root / "review-only-2x5.webp"
    result = assembly.assemble_sheet(originals, ids, out)
    assert result["sheetPixels"] == [4096, 5760]
    assert result["cellNativePixels"] == [2048, 1152]
    assert result["blankCells"] == 0
    assert result["sceneCount"] == 10
    assert result["approved"] is False and result["deployed"] is False
    assert result["singleFrameNativeGenerationVerified"] is False
    assert result["textFreeHumanReviewCompleted"] is False
    assert len(result["frames"]) == 10
    assert out.exists() and out.with_suffix(".review.json").exists()
    assert json.loads(out.with_suffix(".review.json").read_text())["status"].startswith(
        "COMPOSITE_AND_PIXEL_ROUNDTRIP_PASS")

    # Stage2 actual edition lengths: 8 pre, 7 outcome, 2 death.
    for count in (8, 7, 2):
        dir = root / str(count)
        dir.mkdir()
        inputs = create_test_frames(dir, count, (160, 90))
        spec = assembly.geometry(count, (160, 90))
        report = assembly.assemble_sheet(
            inputs, ["synthetic-%d" % n for n in range(count)],
            dir / "review-only.webp", (160, 90))
        assert report["sheetPixels"] == spec["sheetPixels"]
        assert report["blankCells"] == spec["blankCells"]
        assert report["approved"] is False

    # Explicit rejection of low-res originals; never enlarge.
    low = root / "low-resolution.webp"
    create_test_frames(root, 1, (160, 90))[0].rename(low)
    try:
        assembly.assemble_sheet([low], ["bad-low-res"], root / "reject.webp",
                                (2048, 1152))
    except ValueError as error:
        assert "UNDER_RESOLUTION" in str(error)
    else:
        raise AssertionError("A low-res input was upscaled or accepted")
    assert not (root / "reject.webp").exists()

    try:
        assembly.assemble_sheet([root / "missing.webp"], ["missing"],
                                root / "missing-output.webp", (160, 90))
    except FileNotFoundError as error:
        assert "BLOCKED_MISSING_REAL_FRAME" in str(error)
    else:
        raise AssertionError("A missing frame was fabricated")
    assert not (root / "missing-output.webp").exists()

# Stage 2 accepts truly native mobile cuts with ORIGINAL wide aspect, not upscale.
with TemporaryDirectory(prefix="story-mobile-five-sheet-") as temp:
    base = Path(temp)
    inputs = create_test_frames(base, 5, (787, 350))
    ids = ["c01-s02-test-%02d" % i for i in range(5)]
    assert assembly.geometry(5, (787, 350), mobile=True)["sheetPixels"] == [1574, 1050]
    out = base / "mobile-five-review.webp"
    result = assembly.assemble_sheet(inputs, ids, out, (787, 350), mobile=True)
    assert result["sourceAspectRatioPreserved"] is True
    assert result["nativeMinimumPixels"] == [768, 320]
    assert result["cellNativePixels"] == [787, 350]
    assert result["approved"] is False
    try:
        assembly.geometry(6, (787, 350), mobile=True)
        raise AssertionError("P0 accepted six scenes in a stage2 sheet")
    except ValueError:
        pass
    try:
        assembly.geometry(2, (767, 320), mobile=True)
        raise AssertionError("P0 accepted below minimum phone-native width")
    except ValueError:
        pass
    try:
        assembly.assemble_sheet(inputs[:1], ids[:1],
                                base / "false-upscale.webp", (1536, 864),
                                mobile=True)
        raise AssertionError("P0 enlarged a mobile source")
    except ValueError:
        pass
    assert not (base / "false-upscale.webp").exists()

print("PASS: synthetic 10x2048x1152 -> lossless 4096x5760 and exact split; "
      "stage2 8/7/2 geometry, blank cell, low-res and missing-input rejection. "
      "ZERO ARTWORK GENERATED OR APPROVED.")
