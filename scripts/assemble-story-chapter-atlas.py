#!/usr/bin/env python3
"""Assemble a single high-resolution, 150-frame atlas from 20 genuine art sheets.

Each source sheet is already an original 2-column comic with 5-10 panels,
not a repeated stock photo or pre-rendered story summary poster.
This preserves 768x432 *real* source pixels per frame.

python scripts/assemble-story-chapter-atlas.py \
  --plan qa-reports/story-chapters/c01-male-mainline-150.json \
  --source-dir assets/story/chapter-drafts/c01 \
  --output assets/story/atlases/c01-male-mainline-150.webp
"""
import argparse
import json
from pathlib import Path
from collections import defaultdict
from PIL import Image
ROOT=Path(__file__).resolve().parent.parent
Image.MAX_IMAGE_PIXELS=100_000_000
def assemble(plan_path,source_dir,output):
 plan=json.loads(Path(plan_path).read_text(encoding='utf8'))
 atlas=plan['atlas']
 if len(plan['frames'])!=150 or atlas['columns']!=10 or atlas['rows']!=15:
  raise ValueError('Expected 150 storyboard cells')
 pages=defaultdict(list)
 for item in plan['frames']:
  pages[item['pagePath']].append(item)
 if len(pages)!=20:raise ValueError('Expected twenty input story sheets')
 canvas=Image.new('RGB',(atlas['width'],atlas['height']),(12,16,24))
 missing=[]
 for page,items in pages.items():
  f=Path(source_dir)/Path(page).name
  if not f.is_file():
   missing.append(str(f));continue
  with Image.open(f) as sheet:
   sheet.load()
   rows=(len(items)+1)//2
   if sheet.size!=(atlas['cellWidth']*2,atlas['cellHeight']*rows):
    raise ValueError('Source too small / incorrect page grid: '+str(f))
   rgb=sheet.convert('RGB')
   for frame in items:
    pos=frame['comicPanelIndex']
    x=(pos%2)*atlas['cellWidth']
    y=(pos//2)*atlas['cellHeight']
    crop=rgb.crop((x,y,x+atlas['cellWidth'],y+atlas['cellHeight']))
    xout=frame['atlasColumn']*atlas['cellWidth']
    yout=frame['atlasRow']*atlas['cellHeight']
    canvas.paste(crop,(xout,yout))
 if missing:
  raise ValueError('Cannot fake missing artwork ('+str(len(missing))+' sheets). First four: '+str(missing[:4]))
 out=Path(output);out.parent.mkdir(parents=True,exist_ok=True)
 canvas.save(out,'WEBP',quality=92,method=6)
 return {'sourcePages':len(pages),'atlas':str(out),'pixels':canvas.size,
         'chapter':plan['chapter'],'gender':plan['gender']}
def main():
 p=argparse.ArgumentParser()
 p.add_argument('--plan',required=True);p.add_argument('--source-dir',required=True)
 p.add_argument('--output',required=True)
 args=p.parse_args()
 print(json.dumps(assemble(args.plan,args.source_dir,args.output),ensure_ascii=False))
if __name__=='__main__':main()
