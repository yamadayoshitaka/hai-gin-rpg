#!/usr/bin/env python3
"""Validate actual c01-s02 male WebP art, cut order, and registered page sources."""
from pathlib import Path
from PIL import Image, ImageStat
import json
import hashlib

root=Path(__file__).resolve().parent.parent
registry=json.loads((root/'assets/story/chapters/c01/c01-s02-male-draft-registry.json').read_text())
assert registry['stageId']=='c01-s02'
assert registry['protagonistGender']=='male'
assert registry['status']=='AI_DRAFT_UNAPPROVED'
assert registry['approved'] is False
assert registry['textAddedToImage'] is False
assert len(registry['panels'])==15
assert len(registry['pages'])==2
expected={
 'pre':['m01','m02','m03','m04','m05','m11','m13','m15'],
 'post-victory':['m06','m07','m08','m09','m16','m19','m10']
}
all_hashes=set()
for phase,ids in expected.items():
 page=next(x for x in registry['pages'] if x['phase']==phase)
 assert page['panels']==['c01-s02-'+id for id in ids]
 assert page['path']==f'assets/story/chapters/c01/c01-s02-{phase}-male-p01.webp'
 pagesrc=root/page['path']
 assert pagesrc.is_file(),pagesrc
 assert hashlib.sha256(pagesrc.read_bytes()).hexdigest()==page['sha256']
 with Image.open(pagesrc) as im:
  im.load()
  assert im.format=='WEBP'
  assert im.size==(1536,1728)
  if phase=='post-victory':
   # Odd seventh panel must not be misreported as an eighth scene.
   assert ImageStat.Stat(im.crop((768,1296,1536,1728)).convert('RGB')).stddev[0]<0.1
 for i,id in enumerate(ids):
  frame=next(x for x in registry['panels'] if x['panelId']=='c01-s02-'+id)
  assert frame['phase']==phase
  assert frame['path']==f'assets/story/chapters/c01/panels/c01-s02-{id}-male.webp'
  asset=root/frame['path']
  assert asset.is_file()
  data=asset.read_bytes()
  digest=hashlib.sha256(data).hexdigest()
  assert digest==frame['sha256'] and digest not in all_hashes
  all_hashes.add(digest)
  with Image.open(asset) as im:
   im.load()
   assert im.format=='WEBP' and im.size==(768,432)
   assert ImageStat.Stat(im.convert('L')).stddev[0]>15
print('PASS c01-s02: 15 distinct real WebP frames, 2 correct story pages, 8 pre / 7 victory, draft status preserved')
