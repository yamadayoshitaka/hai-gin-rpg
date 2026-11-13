#!/usr/bin/env python3
"""Verify the exact 11 real Stage 2 artwork files in a user-provided ZIP.

The command does not create artwork, send to a paid API, change story display
mappings, approve visual quality, or claim that a local archive is on GitHub.

python scripts/verify-stage2-draft-pack.py /path/to/c01s02_11_candidates.zip
python scripts/verify-stage2-draft-pack.py /path/to/c01s02_11_candidates.zip --install-drafts

Archive layout: candidate/<exact-registered-name>.webp,
candidate-manifest.json, candidate-contact.jpg and README.txt.
"""
from __future__ import annotations

import argparse
import hashlib
from io import BytesIO
import json
from pathlib import Path
from zipfile import ZipFile

from PIL import Image, ImageStat

ROOT = Path(__file__).resolve().parents[1]
LEDGER = ROOT / 'assets/story/chapter-drafts/c01/c01-s02-11-draft-handoff-20261113.json'
DEST = ROOT / 'assets/story/chapter-drafts/c01/individual'

def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()

def inspect_archive(archive: Path, install_drafts: bool = False) -> dict:
    ledger = json.loads(LEDGER.read_text(encoding='utf-8'))
    if ledger['kind'] != 'EXISTING_OFFLINE_IMAGE_DRAFTS_NOT_GITHUB_ASSETS' or ledger['stageId'] != 'c01-s02':
        raise ValueError('Unexpected stage ledger or image status')
    expected = ledger['images']
    if len(expected) != 11 or ledger['qualityApprovedTotal'] != 0:
        raise ValueError('Expected 11 unapproved Stage 2 candidates')
    seen = set()
    imported = []
    with ZipFile(archive) as z:
        entries = z.namelist()
        if len(entries) > 200:
            raise ValueError('Too many archive entries')
        for x in expected:
            name = x['assetName']
            if name in seen or Path(name).name != name or '/' in name or not name.endswith('.webp'):
                raise ValueError('Unsafe/duplicate candidate file name')
            seen.add(name)
            if x['edition'] not in ('pre','post-victory','post-defeat','post-gameover'):
                raise ValueError('Unknown result edition')
            if x['gender'] not in ('male','female') or x['status'] != 'UNAPPROVED_DRAFT_OFFLINE':
                raise ValueError('Unexpected gender or false approval')
            if not name.startswith('c01-s02-') or not name.endswith('-'+x['edition']+'-'+x['gender']+'.webp'):
                raise ValueError('File name and story branch disagree: '+name)
            member = 'candidate/'+name
            if member not in entries:
                raise ValueError('Missing real artwork: '+member)
            info = z.getinfo(member)
            if info.file_size > 25 * 1024 * 1024:
                raise ValueError('Image too large: '+member)
            content = z.read(member)
            if len(content) != x['bytes'] or sha(content) != x['sha256']:
                raise ValueError('Original WebP bytes do not match GitHub SHA-256 ledger: '+member)
            with Image.open(BytesIO(content)) as im:
                im.load()
                if im.format != 'WEBP' or im.size != tuple(x['pixels']) or im.width/im.height != 16/9:
                    raise ValueError('Not a genuine 1536x864 16:9 WebP: '+member)
                if ImageStat.Stat(im.convert('L')).stddev[0] < 10:
                    raise ValueError('Near-blank artwork: '+member)
            imported.append((name,content))
        if len(imported) != 11:
            raise ValueError('Stage 2 draft count mismatch')
    if install_drafts:
        DEST.mkdir(parents=True,exist_ok=True)
        for name,content in imported:
            file=DEST/name
            if file.exists() and sha(file.read_bytes()) != sha(content):
                raise ValueError('Refusing to overwrite a differing existing draft: '+name)
        for name,content in imported:
            (DEST/name).write_bytes(content)
    return {
        'stageId':'c01-s02',
        'verifiedUnapprovedWebPs':len(imported),
        'githubRegisteredMaleDraftsUnchanged':15,
        'stillWithoutAnyLocalCandidate':22,
        'installedInUnapprovedLocalDirectory':install_drafts,
        'visualApproval':False,
        'registeredInGame':False,
        'published':False,
        'nextAction':'Human visual and script QA, then explicit binary commit and game mapping for accepted scenes'
    }

def main():
    p=argparse.ArgumentParser()
    p.add_argument('archive',type=Path)
    p.add_argument('--install-drafts',action='store_true')
    args=p.parse_args()
    print(json.dumps(inspect_archive(args.archive,args.install_drafts),ensure_ascii=False))

if __name__ == '__main__':
    main()
