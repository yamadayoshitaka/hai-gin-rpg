#!/usr/bin/env python3
"""Verify a real ChatGPT-exported C01-S02 female review ZIP before importing.
The ZIP is NOT a deployment approval and is never copied to public panels.

Usage:
  python scripts/import-c01-s02-female-review.py /path/to/pack.zip
  python scripts/import-c01-s02-female-review.py /path/to/pack.zip --install-drafts

The --install-drafts flag copies individually checksum-verified WebPs under
assets/story/chapter-drafts/c01/individual/ only. It never changes game art
registration, human-approval flags, or commits to Git.
"""
import argparse
import hashlib
import json
from io import BytesIO
from pathlib import Path
from zipfile import ZipFile
from PIL import Image, ImageStat

ROOT=Path(__file__).resolve().parents[1]
REGISTRY=ROOT/'assets/story/chapter-drafts/c01/c01-s02-female-offline-handoff-20261113.json'
TARGET=ROOT/'assets/story/chapter-drafts/c01/individual'
def sha256(data):
    return hashlib.sha256(data).hexdigest()

def verify_zip(archive, install=False):
    registry=json.loads(REGISTRY.read_text(encoding='utf8'))
    if registry['kind']!='OFFLINE_REVIEW_ASSETS_HANDOFF_NOT_REGISTERED':
        raise ValueError('Invalid draft-only registry')
    names=set()
    verified=[]
    with ZipFile(archive) as z:
        members=set(z.namelist())
        for item in registry['newCandidateFiles']:
            name=item['assetName']
            if name in names or name not in [item['shotId']+'-'+item['edition']+'-female.webp']:
                raise ValueError('Duplicated/wrong output identity '+name)
            names.add(name)
            in_zip='candidate/'+name
            if in_zip not in members:
                raise ValueError('Missing real WebP in archive: '+in_zip)
            data=z.read(in_zip)
            if len(data)!=item['bytes'] or sha256(data)!=item['sha256']:
                raise ValueError('Bytes differ from registered draft SHA256: '+in_zip)
            with Image.open(BytesIO(data)) as im:
                im.load()
                if im.format!='WEBP' or im.size!=tuple(item['expectedWebPSize']):
                    raise ValueError('Invalid WebP dimensions: '+in_zip)
                if ImageStat.Stat(im.convert('L')).stddev[0]<12:
                    raise ValueError('Nearly blank illustration: '+in_zip)
            verified.append((name,data))
    if len(verified)!=10:
        raise ValueError('Need all 10 distinct real candidate images')
    if install:
        TARGET.mkdir(parents=True,exist_ok=True)
        for name,data in verified:
            destination=TARGET/name
            if destination.is_file() and sha256(destination.read_bytes())!=sha256(data):
                raise ValueError('Will not overwrite a different draft: '+name)
        for name,data in verified:
            (TARGET/name).write_bytes(data)
    return {'validatedWebPs':len(verified),'status':'DRAFT_UNAPPROVED',
            'installedToDraftDirectory':install,'registeredInLiveGame':False,
            'destination':str(TARGET) if install else None}

def main():
    cli=argparse.ArgumentParser()
    cli.add_argument('archive',type=Path)
    cli.add_argument('--install-drafts',action='store_true')
    args=cli.parse_args()
    print(json.dumps(verify_zip(args.archive,args.install_drafts),ensure_ascii=False))
if __name__=='__main__':
    main()
