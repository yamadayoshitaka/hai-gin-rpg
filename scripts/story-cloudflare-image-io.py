#!/usr/bin/env python3
"""Prepare physical cast reference bytes and validate/convert a genuine image
without enlarging either the reference or generated art.

Usage:
  python scripts/story-cloudflare-image-io.py reference INPUT.webp OUTPUT.png
  python scripts/story-cloudflare-image-io.py result RESPONSE.bin OUTPUT.webp
"""
import json
import sys
from pathlib import Path
from PIL import Image, ImageOps, UnidentifiedImageError

def main():
    if len(sys.argv) != 4 or sys.argv[1] not in ("reference", "result"):
        raise SystemExit("usage: ... reference|result INPUT OUTPUT")
    task, source, dest = sys.argv[1:]
    infile = Path(source)
    outfile = Path(dest)
    outfile.parent.mkdir(parents=True, exist_ok=True)
    try:
        with Image.open(infile) as opened:
            opened.load()  # Force decode; do not approve corrupt or truncated files.
            im = ImageOps.exif_transpose(opened).convert("RGB")
    except (UnidentifiedImageError, OSError) as exc:
        raise SystemExit(f"REJECTED_UNDECODABLE_IMAGE: {type(exc).__name__}") from exc
    native = im.size
    if task == "reference":
        # Cloudflare requires reference images to be SMALLER than 512x512.
        # This thumbnail is ONLY a separate model input; the source master is immutable.
        im.thumbnail((480, 480), Image.Resampling.LANCZOS)
        if not (0 < im.width < 512 and 0 < im.height < 512):
            raise SystemExit("REJECTED_REFERENCE_TOO_LARGE")
        im.save(outfile, "PNG", optimize=True)
    else:
        if im.width < 768 or im.height < 320:
            raise SystemExit("REJECTED_NATIVE_TOO_SMALL: " + str(native))
        # Never upscale the generated image. WebP is the game's native asset type.
        im.save(outfile, "WEBP", quality=95, method=6)
        with Image.open(outfile) as check:
            if check.size != native or check.format != "WEBP":
                raise SystemExit("REJECTED_CONVERSION_CHANGED_NATIVE_PIXELS")
    print(json.dumps({"task":task, "inputPixels":native,
                      "outputPixels":im.size,"outputPath":str(outfile),
                      "upscaled":False}))

if __name__ == "__main__":
    main()
