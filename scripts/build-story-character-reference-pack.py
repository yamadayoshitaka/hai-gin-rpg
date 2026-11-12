#!/usr/bin/env python3
"""Build a no-cost, REAL image-reference bundle for scripted C01-S02 scenes.

The rendering system must attach image bytes, not merely cite a filename.
This tool copies/validates master images and emits a labelled reference sheet
for a human operator. Produces NOT artwork and does NOT approve anything.

python scripts/build-story-character-reference-pack.py --stage c01-s02
"""
import argparse
import hashlib
import json
from pathlib import Path
from PIL import Image, ImageOps, ImageDraw, ImageFont
from zipfile import ZipFile, ZIP_DEFLATED

ROOT=Path(__file__).resolve().parents[1]
CONFIG=ROOT/'assets/story/characters/c01-s02-reference-bible.json'
OUT=ROOT/'qa-reports/story-stage-production/reference-packs'
def sha(data): return hashlib.sha256(data).hexdigest()

def main():
    p=argparse.ArgumentParser()
    p.add_argument('--stage',default='c01-s02')
    args=p.parse_args()
    conf=json.loads(CONFIG.read_text(encoding='utf8'))
    if args.stage!=conf['stageId']:
        raise ValueError('No verified character reference bible for '+str(args.stage))
    out=OUT/args.stage
    out.mkdir(parents=True,exist_ok=True)
    records=[]
    cards=[]
    for actor in conf['actors']:
        source=ROOT/actor['path']
        if not source.is_file():
            raise FileNotFoundError('STOP: missing actual image reference '+str(source))
        original=source.read_bytes()
        with Image.open(source) as im:
            im.load()
            if im.format not in ('WEBP','PNG','JPEG'):
                raise ValueError('Not an image: '+str(source))
            if min(im.size)<100:
                raise ValueError('Too small to identify reference character: '+str(source))
            rgb=im.convert('RGB')
            preview=ImageOps.contain(rgb,(460,420),method=Image.Resampling.LANCZOS)
            block=Image.new('RGB',(480,475),'#162132')
            block.paste(preview,((480-preview.width)//2,8))
            draw=ImageDraw.Draw(block)
            draw.text((12,437),actor['id']+' | '+actor['masterQuality'][:22],fill='#ffffff')
            cards.append(block)
            records.append({'id':actor['id'],'source':actor['path'],
                'sha256':sha(original),'bytes':len(original),'pixels':list(im.size),
                'sourceFormat':im.format,'masterQuality':actor['masterQuality'],
                'requiredForGender':actor['requiredForGender'],
                'visualRule':actor['visualRule'],'attachedAsRealBytes':True})
    grid=Image.new('RGB',(480*len(cards),475),'#162132')
    for i,card in enumerate(cards):
        grid.paste(card,(i*480,0))
    sheet=out/'reference-contact-sheet.jpg'
    grid.save(sheet,quality=94)
    bundle={'stageId':args.stage,'status':'IMAGE_REFERENCES_AVAILABLE_NOT_RENDERED',
        'references':records,'requiresPhysicalImageAttachments':True,
        'humanQualityApproved':False,'qualityReferenceStatus':'NOT_HUMAN_APPROVED',
        'instructions':'Attach original referenced image bytes to the image-generation request for every visible actor; pass the preceding accepted scene as additional reference. Name-only prompts are insufficient.'}
    json_path=out/'reference-manifest.json'
    json_path.write_text(json.dumps(bundle,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
    zip_path=OUT/(args.stage+'-real-character-references.zip')
    with ZipFile(zip_path,'w',ZIP_DEFLATED) as z:
        z.write(sheet,'reference-contact-sheet.jpg')
        z.write(json_path,'reference-manifest.json')
        for a in conf['actors']:
            z.write(ROOT/a['path'], 'actual-image-inputs/'+a['id']+Path(a['path']).suffix)
    print(json.dumps({'stageId':args.stage,'refImagesVerified':len(records),
         'zip':str(zip_path.relative_to(ROOT)),'status':bundle['status'],
         'approved':False},ensure_ascii=False))
if __name__=='__main__':
    main()
