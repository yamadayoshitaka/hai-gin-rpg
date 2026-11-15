#!/usr/bin/env python3
"""Conservative no-collage gate for GENERATED story images.

This gate detects near-white/black hard gutters inside a single requested
frame. It is not a human semantic, identity, or no-text review and never
approves artwork by itself. No upscaling, no fictional art generated.
"""
import argparse
import json
from pathlib import Path
from PIL import Image


def inspect(path):
    p = Path(path)
    with Image.open(p) as source:
        source.load()
        im = source.convert("RGB")
    w, h = im.size
    # Reject undersized or non-16:9 source frames before any visual heuristics.\n    # Tolerance allows a few native encoder pixels, never an upscale.\n    geometry_ok = w >= 800 and h >= 450 and abs(w * 9 - h * 16) <= max(w, h) * 0.015\n    pixels = im.load()
    ys = range(max(0, h // 10), max(1, h * 9 // 10), max(1, h // 256))
    xs = range(max(0, w // 10), max(1, w * 9 // 10), max(1, w // 256))

    def solid_share(samples):
        samples = list(samples)
        if not samples:
            return 0.0
        light = sum(all(v > 235 for v in r) for r in samples)
        dark = sum(all(v < 25 for v in r) for r in samples)
        return max(light, dark) / len(samples)

    vertical = [x for x in range(int(w * .15), int(w * .85))
                if solid_share(pixels[x, y] for y in ys) > .93]
    horizontal = [y for y in range(int(h * .15), int(h * .85))
                  if solid_share(pixels[x, y] for x in xs) > .93]
    return {
        "path": str(p),
        "nativePixels": [w, h],\n        "nativeGeometryPass": geometry_ok,\n        "geometryFailure": None if geometry_ok else "NATIVE_SIZE_OR_ASPECT_RATIO_REJECTED",
        "possibleVerticalGutterColumns": vertical[:20],
        "possibleHorizontalGutterRows": horizontal[:20],
        "collageOrHardGutterSuspected": bool(vertical or horizontal),
        "status": "REJECTED_MULTI_PANEL_SUSPECTED"
        if vertical or horizontal else "RASTER_GUTTER_GATE_PASS_HUMAN_QA_PENDING",
        "humanSemanticAndIdentityQA": "NOT_PERFORMED",
        "automaticallyApproved": False
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("frames", nargs="+")
    args = parser.parse_args()
    verdicts = [inspect(name) for name in args.frames]
    print(json.dumps(verdicts, ensure_ascii=False, indent=2))
    if any(v["collageOrHardGutterSuspected"] or not v["nativeGeometryPass"] for v in verdicts):
        raise SystemExit(1)


if __name__ == "__main__":
    main()
