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
    # Native pixel gate: no resize/upscale is performed. Allow 0.5% aspect tolerance.\n    dimension_ok = w >= 800 and h >= 450 and abs(w * 9 - h * 16) <= max(w * 9, h * 16) * 0.005\n    pixels = im.load()
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
        "nativePixels": [w, h],
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
    if any(not v["nativeDimensionsValid"] or v["collageOrHardGutterSuspected"] for v in verdicts):
        raise SystemExit(1)


if __name__ == "__main__":
    main()
