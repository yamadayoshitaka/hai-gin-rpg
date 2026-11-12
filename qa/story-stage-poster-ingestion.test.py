#!/usr/bin/env python3
"""Synthetic QA fixtures only: never register as actual story artwork."""
import importlib.util
import json
import shutil
import tempfile
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('poster_ingest',ROOT/'scripts/ingest-story-stage-posters.py')
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
manifest=json.loads((ROOT/'qa-reports/story-stage-production/c01-s02-through-c01-s03.json').read_text())
variant=next(v for s in manifest['stages'] for v in s['variants']
             if v['stageId']=='c01-s02' and v['edition']=='post-gameover' and v['gender']=='male')
temp=Path(tempfile.mkdtemp(prefix='stage-poster-test-',dir=ROOT/'qa-reports'))
try:
    poster_root=temp/'posters'
    original=variant['pages'][0]['posterAsset']
    src=poster_root/'c01/posters'/Path(original).name
    src.parent.mkdir(parents=True,exist_ok=True)
    gradient=Image.linear_gradient('L').resize((1536,864))
    image=Image.new('RGB',(3072,864))
    image.paste(Image.merge('RGB',(gradient,gradient,gradient)),(0,0))
    image.paste(Image.merge('RGB',(gradient,gradient.transpose(Image.Transpose.FLIP_LEFT_RIGHT),gradient)),(1536,0))
    image.save(src,'WEBP',quality=80)
    result=module.process_variant(variant,None,poster_root,temp/'reviews')
    assert result['status']=='REVIEW_REQUIRED_NO_DEPLOY'
    assert result['frames']==2
    report=json.loads((temp/'reviews/c01-s02/post-gameover/male/review.json').read_text())
    assert report['approved'] is False
    assert all(f['pixelSize']==[1536,864] and f['approved'] is False for f in report['frames'])
    assert (temp/'reviews/c01-s02/post-gameover/male/compare.html').exists()
    # A small 1182px sequence poster can be a storyboard preview, never approved art.
    image.resize((1182,332)).save(src,'WEBP')
    try:
        module.process_variant(variant,None,poster_root,temp/'rejected')
        raise AssertionError('Low-resolution source was incorrectly accepted')
    except ValueError as exc:
        assert 'LOW-RES' in str(exc) or 'divisible' in str(exc)
finally:
    shutil.rmtree(temp)
print('PASS free poster ingestion: 2 original per-shot WebPs + provisional reference report; low-res poster blocked')
