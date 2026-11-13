#!/usr/bin/env python3
"""Generate ONLY optional review contact-sheets, never game panel art.

Native original WebPs remain unmodified. Each review page groups at most five
canonical frames in reading order. Text labels live in a separate header
outside the illustration; sheets are NEVER registered into the game.
"""
from __future__ import annotations
import json
import pathlib
import re
import html
from PIL import Image, ImageDraw, ImageOps
ROOT = pathlib.Path(__file__).resolve().parent.parent
REPORT = ROOT / 'qa-reports/story-stage-production/chapter1-free-render/c01-regression.json'
OUTPUT = ROOT / 'qa-reports/story-stage-production/chapter1-review-sheets'
WIDTH, HEIGHT, TITLE_HEIGHT = 768, 432, 40
COLUMNS, ROWS = 2, 3

def main():
    report = json.loads(REPORT.read_text(encoding='utf-8'))
    if report.get('canonicalScenes') != 462 or report.get('canonicalPages') != 132:
        raise RuntimeError('canonical chapter1 contract changed')
    OUTPUT.mkdir(parents=True,exist_ok=True)
    data = []
    total = 0
    for stage in report['stages']:
        variants = {}
        for scene in stage['scenes']:
            key = (scene['edition'],scene['gender'])
            variants.setdefault(key,[]).append(scene)
        for (edition,gender), scenes in variants.items():
            for start in range(0,len(scenes),5):
                chunk = scenes[start:start+5]
                total += 1
                if len(chunk) > 5:
                    raise RuntimeError('review sheet exceeds 5')
                available = sum(s['status'] in (
                  'VALID_REAL_DRAFT_VISUAL_QA_PENDING',
                  'EXISTING_REGISTERED_NOT_P0_CERTIFIED') for s in chunk)
                if not available:
                    continue
                canvas = Image.new('RGB',(COLUMNS*WIDTH,ROWS*(HEIGHT+TITLE_HEIGHT)),(28,29,34))
                drawer = ImageDraw.Draw(canvas)
                for ix,scene in enumerate(chunk):
                    x=(ix%2)*WIDTH;y=(ix//2)*(HEIGHT+TITLE_HEIGHT)
                    status=scene['status']
                    drawer.text((x+12,y+12),f"{scene['panelId']} | {status[:42]}",fill=(230,233,239))
                    name=scene['panelId']
                    if status=='EXISTING_REGISTERED_NOT_P0_CERTIFIED':
                        n=re.sub(r'-m(\d{1,2})$',lambda m:'-m'+m.group(1).zfill(2),name)
                        source=ROOT/'assets/story/chapters/c01/panels'/(n+'-'+gender+'.webp')
                    else:
                        source=ROOT/scene.get('path','__MISSING__')
                    if source.is_file():
                        try:
                            with Image.open(source) as loaded:
                                frame=ImageOps.contain(loaded.convert('RGB'),(WIDTH-16,HEIGHT-16))
                                offset=(x+(WIDTH-frame.width)//2,
                                        y+TITLE_HEIGHT+(HEIGHT-frame.height)//2)
                                canvas.paste(frame,offset)
                        except Exception as exc:
                            drawer.text((x+20,y+TITLE_HEIGHT+30),f'INVALID WEBP: {str(exc)[:45]}',fill=(250,105,105))
                    else:
                        drawer.text((x+28,y+TITLE_HEIGHT+30),'SOURCE NOT PRESENT - NO GAME ART',fill=(230,140,100))
                filename=f"{stage['stageId']}-{edition}-{gender}-p{(start//5)+1:02d}.webp"
                canvas.save(OUTPUT/filename,format='WEBP',quality=85,method=5)
                data.append({'stageId':stage['stageId'],'edition':edition,'gender':gender,
                             'page':start//5+1,'availableCount':available,
                             'count':len(chunk),'file':filename,
                             'shotKeys':[s['key'] for s in chunk]})
    if total!=132:
        raise RuntimeError(f'expected 132 logical pages, got {total}')
    (OUTPUT/'index.json').write_text(json.dumps({
      'kind':'VISUAL_REVIEW_SHEETS_NOT_REGISTERED_GAME_ART',
      'totalLogicalPages':total,'sheetCount':len(data),'sheets':data,
      'source':str(REPORT.relative_to(ROOT)),
      'allSheetsRequireHumanImageQA':True
    },ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    cards=''.join(
      '<article><img loading="lazy" src="'+html.escape(row['file'])+
      '" alt="5-scene review sheet"/><p>'+html.escape(row['stageId']+' / '+row['edition']+
      ' / '+row['gender']+f" / page {row['page']} ({row['availableCount']}/{row['count']})")+
      '</p></article>' for row in data)
    (OUTPUT/'index.html').write_text(
      '<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">'
      '<title>Chapter 1 draft visual QA - NOT GAME ART</title><style>'
      'body{font-family:system-ui;background:#191a1f;color:#f4f4f7;margin:18px}'
      'main{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,450px),1fr));gap:16px}'
      'article{background:#292b32;padding:12px;border-radius:10px}img{width:100%;height:auto}'
      'p{margin:.4rem 0}small{color:#b6b8be}</style>'
      '<h1>灰銀のレゾナンス 第一章・原画目視検査</h1>'
      '<small>レビュー専用の一覧。漫画本編への正式登録・承認・デプロイを意味しません。</small>'
      '<main>'+cards+'</main></html>',encoding='utf-8')
    print(json.dumps({'canonicalPages':total,'contactSheets':len(data),
      'visualApproval':False,'gameRegistrations':0,'out':str(OUTPUT.relative_to(ROOT))}))

if __name__=='__main__':
    main()
