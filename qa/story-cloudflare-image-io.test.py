#!/usr/bin/env python3
"""Zero-API verification of Cloudflare image attachment/transcode geometry."""
import json
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts/story-cloudflare-image-io.py"

def call(mode: str, inp: Path, out: Path):
    return subprocess.run(
        [sys.executable, str(SCRIPT), mode, str(inp), str(out)],
        cwd=ROOT, text=True, capture_output=True
    )

with tempfile.TemporaryDirectory(prefix="story-cloudflare-image-test-") as tmp:
    base = Path(tmp)
    original = base / "physical-master.webp"
    Image.new("RGB", (1200, 800), (180, 140, 110)).save(original, "WEBP")
    resized = base / "real-attached-thumbnail.png"
    r = call("reference", original, resized)
    assert r.returncode == 0, r.stderr
    assert json.loads(r.stdout)["upscaled"] is False
    with Image.open(original) as src:
        assert src.size == (1200, 800), "Immutable original master got modified"
    with Image.open(resized) as ref:
        assert ref.format == "PNG"
        assert ref.width < 512 and ref.height < 512
        assert ref.size == (480, 320), ref.size
    real_generated = base / "generated-native.png"
    Image.new("RGB", (1024, 576), (25, 90, 130)).save(real_generated)
    candidate = base / "generated-native.webp"
    converted = call("result", real_generated, candidate)
    assert converted.returncode == 0, converted.stderr
    assert json.loads(converted.stdout)["inputPixels"] == [1024, 576]
    assert json.loads(converted.stdout)["outputPixels"] == [1024, 576]
    with Image.open(candidate) as im:
        assert im.format == "WEBP"
        assert im.size == (1024, 576)
    invalid = base / "too-small.png"
    Image.new("RGB", (700, 300)).save(invalid)
    forbidden = call("result", invalid, base / "rejected.webp")
    assert forbidden.returncode != 0, "Under-size image must fail closed"
    assert not (base / "rejected.webp").exists()
    assert "REJECTED_NATIVE_TOO_SMALL" in forbidden.stderr
print("PASS: real 1200x800 master untouched, reference PNG native thumbnail 480x320, source image 1024x576 -> native WebP, under-768x320 rejected; no upscaling")
