#!/usr/bin/env python3
"""Fail when mandatory RPG character references are missing or are only names."""
import hashlib,json
from pathlib import Path
from zipfile import ZipFile
ROOT=Path(__file__).resolve().parents[1]
CONFIG=ROOT/'assets/story/characters/c01-s02-reference-bible.json'
OUT=ROOT/'qa-reports/story-stage-production/reference-packs/c01-s02-real-character-references.zip'
x=json.loads(CONFIG.read_text(encoding='utf8'))
assert x['policy']['attachRealImageBytesToGeneration'] is True
assert x['stageId']=='c01-s02'
assert set(a['id'] for a in x['actors'])=={'commander_male','commander_female','lucia','garan','iris','vess'}
assert all(a['path'].endswith('.webp') and 'masterQuality' in a for a in x['actors'])
assert OUT.is_file(), 'Run build-story-character-reference-pack.py first'
with ZipFile(OUT) as z:
    meta=json.loads(z.read('reference-manifest.json'))
    assert meta['requiresPhysicalImageAttachments'] is True
    assert meta['humanQualityApproved'] is False
    assert len(meta['references'])==6
    for item in meta['references']:
        a=next(a for a in x['actors'] if a['id']==item['id'])
        data=z.read('actual-image-inputs/'+a['id']+'.webp')
        assert len(data)>10000 and hashlib.sha256(data).hexdigest()==item['sha256'],a['id']
        assert Path(ROOT/a['path']).read_bytes()==data
    assert z.read('reference-contact-sheet.jpg')[:2]==bytes([0xff,0xd8])
print('PASS: 6 physical character image references including Vess with hashes; approval remains false')
