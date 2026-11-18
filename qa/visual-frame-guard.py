#!/usr/bin/env python3
"""Reject blank/invalid real CI screenshots. Not an FF15/aesthetic similarity claim."""
import json
import sys
from pathlib import Path
from PIL import Image, ImageStat

def inspect(path):
    with Image.open(path) as image:
        image.load()
        width, height = image.size
        rgb = image.convert("RGB")
        thumbnail = rgb.resize((min(128, width), min(128, height)))
        stat = ImageStat.Stat(thumbnail)
        extrema = thumbnail.getextrema()
        span = max(b - a for a, b in extrema)
        entropy = thumbnail.entropy()
        valid = width >= 200 and height >= 200 and span >= 12 and entropy >= 0.8
        return {
            "status": "visible_pixels_verified" if valid else "invalid_or_blank_frame",
            "source": "actual GitHub Actions Chromium canvas screenshot",
            "width": width, "height": height, "rgbRange": span,
            "entropy": round(entropy, 3), "meanRgb": [round(v, 2) for v in stat.mean],
            "artisticQualityApproved": False, "androidFpsMeasured": False,
            "warning": "Pixel content proves a rendered nonblank frame, not FF15 fidelity",
        }

def main():
    if len(sys.argv) != 2:
        raise SystemExit("usage: visual-frame-guard.py <real-frame.png>")
    path = Path(sys.argv[1])
    report = inspect(path) if path.is_file() else {
        "status": "missing_actual_game_screenshot", "artisticQualityApproved": False,
        "androidFpsMeasured": False,
    }
    dest = Path("qa-reports/game-quality-six/visual-frame-guard.json")
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("REAL_VISUAL_GUARD", json.dumps(report, ensure_ascii=False))
    if report["status"] != "visible_pixels_verified":
        raise SystemExit(1)

if __name__ == "__main__":
    main()
