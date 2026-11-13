#!/usr/bin/env python3
"""Verify 25 uploaded real WebP candidate images, not just a manifest claim.

These are unapproved chapter 1 DRAFTS. This test MUST NOT register them into a
canonical gender/outcome scene or misreport them as completed manga panels.
"""
from pathlib import Path
import collections
import hashlib
import json

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
BASE = Path("assets/story/chapter-drafts/c01/mobile-5x5-20261113")
manifest = json.loads((ROOT / BASE / "manifest.json").read_text(encoding="utf8"))
assert manifest["schemaVersion"] == 1
assert manifest["kind"] == "CHAPTER_1_25_MOBILE_DRAFT_ART_INTAKE"
assert manifest["totalPanels"] == 25
assert manifest["sources"] == 5
assert manifest["p0"]["approvedForLiveManga"] is False
assert manifest["p0"]["canonicalScriptMapping"] == "NOT_VERIFIED"
assert manifest["p0"]["masterImageBytesAttachedAtGeneration"] == "NOT_VERIFIED"
assert manifest["p0"]["outcomeAndGenderMatch"] == "NOT_VERIFIED"
assert len(manifest["panels"]) == 25

seen = set()
sizes = collections.Counter()
total_size = 0
for index, panel in enumerate(manifest["panels"]):
    sheet, cell = index // 5 + 1, index % 5 + 1
    assert panel["sheetIndex"] == sheet
    assert panel["cellIndex"] == cell
    assert panel["id"] == f"ch01-draft-sheet{sheet:02}-panel{cell:02}"
    relative = BASE / f"sheet{sheet:02}-panel{cell:02}.webp"
    assert panel["path"] == relative.as_posix()
    assert panel["path"] not in seen
    seen.add(panel["path"])
    assert panel["canonicalSceneId"] is None
    assert panel["gender"] is None
    assert panel["edition"] is None
    assert panel["mobileResolutionEligible"] is True
    assert panel["approval"] == "DRAFT_ONLY_NOT_VALIDATED_FOR_MANGA_VIEWER"
    file = ROOT / relative
    assert file.exists(), "Physical WebP missing: " + str(file)
    raw = file.read_bytes()
    total_size += len(raw)
    assert len(raw) > 10000 and raw[:4] == b"RIFF" and raw[8:12] == b"WEBP"
    assert hashlib.sha256(raw).hexdigest() == panel["sourceSha256"], str(file)
    with Image.open(file) as im:
        im.load()
        assert im.format == "WEBP"
        assert list(im.size) == panel["nativePixels"]
        assert im.width >= 768 and im.height >= 320
        assert im.width <= 2048 and im.height <= 1152
        sizes[im.size] += 1

# Real assets are visible in review UI, not auto-bound to unrelated scene IDs.
review = (ROOT / "story-art-review.html").read_text(encoding="utf8")
viewer = (ROOT / "src/story-manga-viewer.js").read_text(encoding="utf8")
registered = (ROOT / "src/story-panel-registered-art.js").read_text(encoding="utf8")
assert "mobile-5x5-20261113/manifest.json" in review
assert "試作原画25枚" in review
assert "story-art-review.html#drafts" in viewer
assert "c01-draft" not in registered
assert "provisionalRegisteredStoryPanel" in registered
assert "artrev=c01s02female20261113" in registered
provisional = (ROOT / "src/story-provisional-registered-art.js").read_text(encoding="utf8")
assert "PROVISIONAL_MOBILE_DRAFT_UNAPPROVED" in provisional
assert "screenplayExactnessApproved:false" in provisional
assert "textAndCharacterHumanQAComplete:false" in provisional
assert "mustNotPromoteAsFinal:true" in provisional
# Registered-to-game is allowed ONLY as an explicit, visibly unapproved P0 draft.
assert provisional.count("'c01-s02|pre|female|") == 8
assert "'c01-s02|post-" not in provisional
assert "'c01-s02|pre|male|" not in provisional

print(f"PASS: 25 real, intact SHA256-verified WebPs ({total_size} bytes); "
      f"{len(sizes)} native dimensions; 5x5 original crop order; "
      "mobile image-size accepted; registered in draft review UI; "
      "canonical chapter manga scenes intentionally unchanged until P0 alignment.")
