#!/usr/bin/env python3
"""Regression tests for auto provisional registration ZIP preflight (no network)."""
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED

SCRIPT = Path(__file__).resolve().parents[1] / "scripts/ingest-story-chatgpt-zip.py"
PREFIX = "assets/story/chapter1-chatgpt-inbox/"
SLUG = "c01-s05__pre__female__c01-s05-m4"
IMAGE = b"RIFF" + b"0" * 22 + b"WEBP" + b"\x00" * 32

def reviewed_image():
    return {
        "shotKey": "c01-s05|pre|female|c01-s05-m4",
        "scriptText": "valid screenplay is later checked by canonical importer",
        "sourceModel": "ChatGPT Images",
        "reviewedBy": "assistant-visual-inspection",
        "reviewedAt": "2026-11-16T00:00:00Z",
        "qaStatus": "OWNER_PROVISIONAL",
        "ownerAuthorized": True,
        "humanVisualQAConfirmed": False,
        "finalP0Approved": False,
        "generationReferencesAttached": False,
        "quality": {
            "exactCanonicalScene": True, "exactCast": True,
            "genderAndOutcomeCorrect": True, "noTextUI": True,
            "original3DCinematicStyle": True, "nativeDetail": True,
            "realReferenceBytesAttachedToImageGenerator": False,
        },
        "imageSha256": hashlib.sha256(IMAGE).hexdigest(),
        "nativePixels": [1664, 936],
        "referenceImagesAttached": [],
    }

class ArchiveValidationTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.base = Path(self.tmp.name)
        self.queue = self.base / "zip"
        self.inbox = self.base / "inbox"
        self.receipts = self.base / "receipts"
        self.queue.mkdir()
        self.review = reviewed_image()

    def write_archive(self, name="test.zip", extras=None, with_image=True, with_review=True):
        dest = self.queue / name
        with ZipFile(dest, "w", compression=ZIP_DEFLATED) as z:
            if with_image:
                z.writestr(PREFIX + SLUG + ".webp", IMAGE)
            if with_review:
                z.writestr(PREFIX + SLUG + ".review.json", json.dumps(self.review))
            for filename, body in (extras or {}).items():
                z.writestr(filename, body)
        return dest

    def run_cli(self, mode="plan"):
        return subprocess.run(
            [sys.executable, str(SCRIPT), "--mode", mode,
             "--queue-dir", str(self.queue),
             "--inbox", str(self.inbox), "--receipts", str(self.receipts)],
            text=True, capture_output=True, check=False,
        )

    def test_accepts_known_chatgpt_zip_format_as_provisional_only(self):
        self.write_archive(extras={
            "package-index.json": "{}",
            "README_重要.txt": "archive contains only unapproved images",
        })
        plan = self.run_cli()
        self.assertEqual(plan.returncode, 0, plan.stderr)
        self.assertEqual(json.loads(plan.stdout)["candidates"], 1)
        self.assertFalse(self.inbox.exists())
        applied = self.run_cli("apply")
        self.assertEqual(applied.returncode, 0, applied.stderr)
        self.assertEqual((self.inbox / (SLUG + ".webp")).read_bytes(), IMAGE)
        receipt = json.loads((self.receipts / "test.json").read_text("utf-8"))
        self.assertFalse(receipt["humanVisualQualityCertified"])
        self.assertEqual(receipt["registrationStatus"], "AUTO_PROVISIONAL_PENDING_P0")

    def test_missing_review_is_rejected_atomically(self):
        self.write_archive(with_review=False)
        result = self.run_cli("apply")
        self.assertEqual(result.returncode, 2)
        self.assertIn("ZIP_REQUIRES_IMAGE_AND_REVIEW_PAIR", result.stderr)
        self.assertFalse(self.inbox.exists())

    def test_sha_mismatch_rejected(self):
        self.review["imageSha256"] = "0" * 64
        self.write_archive()
        r = self.run_cli("apply")
        self.assertEqual(r.returncode, 2)
        self.assertIn("ZIP_SHOT_KEY_OR_SHA_MISMATCH", r.stderr)

    def test_auto_final_approval_forbidden(self):
        self.review["qaStatus"] = "PASS"
        self.review["finalP0Approved"] = True
        self.write_archive()
        r = self.run_cli("apply")
        self.assertEqual(r.returncode, 2)
        self.assertIn("ZIP_NOT_OWNER_AUTHORIZED_PROVISIONAL", r.stderr)

    def test_zip_slip_rejected(self):
        self.write_archive(extras={"../outside.txt": "malicious"})
        r = self.run_cli("apply")
        self.assertEqual(r.returncode, 2)
        self.assertIn("ZIP_UNSAFE_MEMBER_PATH", r.stderr)
        self.assertFalse((self.base / "outside.txt").exists())

    def test_rogue_scene_files_rejected(self):
        self.write_archive(extras={PREFIX + "wrong.webp": "wrong"})
        r = self.run_cli("apply")
        self.assertEqual(r.returncode, 2)
        self.assertIn("ZIP_UNEXPECTED_ART_FILE", r.stderr)

    def test_refuses_overwrite_existing_candidate(self):
        self.inbox.mkdir()
        (self.inbox / (SLUG + ".webp")).write_bytes(b"different bytes")
        self.write_archive()
        r = self.run_cli("apply")
        self.assertEqual(r.returncode, 2)
        self.assertIn("ZIP_WOULD_OVERWRITE_EXISTING_ART", r.stderr)

    def test_same_filename_reuploaded_after_receipt_rejected(self):
        self.write_archive()
        self.assertEqual(self.run_cli("apply").returncode, 0)
        r = self.run_cli("apply")
        self.assertEqual(r.returncode, 2)
        self.assertIn("PACKAGE_ALREADY_PROCESSED", r.stderr)

if __name__ == "__main__":
    unittest.main(verbosity=2)
