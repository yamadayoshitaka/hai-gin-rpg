#!/usr/bin/env python3
"""Validate a user-uploaded ChatGPT Images ZIP before the existing provisional importer.

This NEVER invokes the ChatGPT website, Images API, or any paid service.
All writes stay in the GitHub Actions workspace until every QA step passes.
"""
import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import re
import stat
import sys
import zipfile

INBOX = Path("assets/story/chapter1-chatgpt-inbox")
QUEUE = Path("assets/story/chapter1-chatgpt-queue")
RECEIPTS = Path("assets/story/chapter1-chatgpt-upload-receipts")
PREFIX = str(INBOX) + "/"
NAME = re.compile(
    r"^c01-s0[1-5]__(?:pre|post-town|post-victory|post-defeat|post-gameover)"
    r"__(?:male|female)__c01-s0[1-5]-m\d{1,2}\.(?:webp|review\.json)$"
)
MAX_ZIP = 25 * 1024 * 1024
MAX_TOTAL = 100 * 1024 * 1024
MAX_MEMBER = 12 * 1024 * 1024
MAX_FILES = 200
MAX_PACKAGES = 10
REQUIRED_VISUAL_DECLARATIONS = (
    "exactCanonicalScene", "exactCast", "genderAndOutcomeCorrect",
    "noTextUI", "original3DCinematicStyle", "nativeDetail"
)

def sha(data):
    return hashlib.sha256(data).hexdigest()

def check_package(archive, inbox=INBOX, receipts=RECEIPTS):
    """Do not modify disk. Return (reviewable images, harmless metadata, receipt)."""
    if archive.stat().st_size > MAX_ZIP:
        raise ValueError("ZIP_TOO_LARGE")
    fingerprint = sha(archive.read_bytes())
    receipt_path = receipts / (archive.stem + ".json")
    if receipt_path.exists():
        old = json.loads(receipt_path.read_text("utf-8"))
        if old.get("zipSha256") != fingerprint:
            raise ValueError("ZIP_NAME_ALREADY_USED_WITH_DIFFERENT_BYTES")
        raise ValueError("PACKAGE_ALREADY_PROCESSED")
    incoming = {}
    metadata = {}
    total = 0
    with zipfile.ZipFile(archive, "r") as handle:
        files = [info for info in handle.infolist() if not info.is_dir()]
        if not files or len(files) > MAX_FILES:
            raise ValueError("ZIP_MEMBER_COUNT_INVALID")
        for info in files:
            raw_name = info.filename
            relative = PurePosixPath(raw_name)
            if (not raw_name or "\\" in raw_name or raw_name.startswith("/") or
                    any(part in (".", "..") for part in relative.parts) or
                    len(relative.parts) < 1):
                raise ValueError("ZIP_UNSAFE_MEMBER_PATH")
            if stat.S_IFMT(info.external_attr >> 16) == stat.S_IFLNK:
                raise ValueError("ZIP_LINK_FORBIDDEN")
            if raw_name in incoming or raw_name in metadata:
                raise ValueError("ZIP_DUPLICATE_FILENAME")
            if info.file_size > MAX_MEMBER:
                raise ValueError("ZIP_MEMBER_TOO_LARGE")
            total += info.file_size
            if total > MAX_TOTAL:
                raise ValueError("ZIP_EXPANDED_BYTES_TOO_LARGE")
            body = handle.read(info)
            if len(body) != info.file_size:
                raise ValueError("ZIP_TRUNCATED_MEMBER")
            if raw_name.startswith(PREFIX):
                basename = raw_name[len(PREFIX):]
                if "/" in basename or not NAME.fullmatch(basename):
                    raise ValueError("ZIP_UNEXPECTED_ART_FILE")
                incoming[basename] = body
            elif raw_name in ("package-index.json", "README_重要.txt"):
                metadata[raw_name] = body
            else:
                raise ValueError("ZIP_UNEXPECTED_MEMBER")
    if not incoming:
        raise ValueError("ZIP_HAS_NO_ART")
    images = {name[:-5] for name in incoming if name.endswith(".webp")}
    sidecars = {name[:-12] for name in incoming if name.endswith(".review.json")}
    if not images or images != sidecars:
        raise ValueError("ZIP_REQUIRES_IMAGE_AND_REVIEW_PAIR")
    if len(images) > 50:
        raise ValueError("ZIP_SHOT_LIMIT_EXCEEDED")
    for slug in sorted(images):
        review = json.loads(incoming[slug + ".review.json"])
        key_parts = review.get("shotKey", "").split("|")
        if (len(key_parts) != 4 or
            slug != "__".join(key_parts) or
            not isinstance(review.get("imageSha256"), str) or
            review["imageSha256"] != sha(incoming[slug + ".webp"])):
            raise ValueError("ZIP_SHOT_KEY_OR_SHA_MISMATCH:" + slug)
        if (review.get("qaStatus") != "OWNER_PROVISIONAL" or
            review.get("ownerAuthorized") is not True or
            review.get("humanVisualQAConfirmed") is not False or
            review.get("finalP0Approved") is not False or
            review.get("generationReferencesAttached") is not False or
            review.get("reviewedBy") != "assistant-visual-inspection" or
            review.get("sourceModel") != "ChatGPT Images" or
            any(review.get("quality", {}).get(k) is not True
                for k in REQUIRED_VISUAL_DECLARATIONS) or
            review.get("quality", {}).get("realReferenceBytesAttachedToImageGenerator") is not False):
            raise ValueError("ZIP_NOT_OWNER_AUTHORIZED_PROVISIONAL:" + slug)
        # Structure/size/canonical script and production binding are independently
        # verified by scripts/import-story-chapter1-chatgpt-staging.mjs.
        # A self-reported quality boolean is NOT proof of visual correctness.
        for suffix in (".webp", ".review.json"):
            dest = inbox / (slug + suffix)
            if dest.exists() and dest.read_bytes() != incoming[slug + suffix]:
                raise ValueError("ZIP_WOULD_OVERWRITE_EXISTING_ART:" + slug)
    receipt = {
        "schemaVersion": 1, "sourceZip": str(archive),
        "zipSha256": fingerprint, "shotKeys": [
            "__".join(slug.split("__")).replace("__", "|") for slug in sorted(images)
        ],
        "candidateCount": len(images),
        "registrationStatus": "AUTO_PROVISIONAL_PENDING_P0",
        "humanVisualQualityCertified": False,
        "note": ("Validated package metadata and SHA. Existing canonical importer "
                 "validates the actual WebP bytes, screenplay, gender/outcome and state. "
                 "This receipt alone does not certify character/style/text accuracy.")
    }
    return incoming, receipt

def run(args):
    queued = sorted(args.queue_dir.glob("*.zip"))
    if len(queued) > MAX_PACKAGES:
        raise ValueError("TOO_MANY_QUEUED_PACKAGES")
    if not queued:
        print(json.dumps({"packages": 0, "candidates": 0, "mode": args.mode}))
        return
    packages = []
    already = {}
    for archive in queued:
        contents, receipt = check_package(archive, args.inbox, args.receipts)
        for name, body in contents.items():
            if name in already and already[name] != body:
                raise ValueError("CONFLICT_ACROSS_PACKAGES:" + name)
            already[name] = body
        packages.append((archive, receipt))
    if args.mode == "apply":
        # All packages have passed ZIP-level preflight. The downstream canonical
        # importer/QA operates before ANY git push: failure cannot publish images.
        args.inbox.mkdir(parents=True, exist_ok=True)
        args.receipts.mkdir(parents=True, exist_ok=True)
        for name, body in already.items():
            destination = args.inbox / name
            if not destination.exists():
                destination.write_bytes(body)
        for archive, receipt in packages:
            filename = args.receipts / (archive.stem + ".json")
            filename.write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + "\n", "utf-8")
    print(json.dumps({"packages": len(packages), "candidates": len(already) // 2,
        "mode": args.mode, "processed": [str(a) for a, _ in packages]}))

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=("plan", "apply"), default="plan")
    parser.add_argument("--queue-dir", type=Path, default=QUEUE)
    parser.add_argument("--inbox", type=Path, default=INBOX)
    parser.add_argument("--receipts", type=Path, default=RECEIPTS)
    opt = parser.parse_args()
    try:
        run(opt)
    except (OSError, ValueError, zipfile.BadZipFile, json.JSONDecodeError) as exc:
        print(json.dumps({"status": "REJECTED", "reason": str(exc)}), file=sys.stderr)
        sys.exit(2)
