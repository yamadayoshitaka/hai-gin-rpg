#!/usr/bin/env python3
"""One-command: 150-panel image -> 150 WebP frames -> 20 game sheets -> manifest -> git commit.

python scripts/ingest-story-chapter-atlas.py \
  --plan qa-reports/story-chapters/c01-male-mainline-150.json \
  --atlas assets/story/atlases/c01-male-mainline-150.webp \
  --register --commit

The original atlas MUST already have 150 authentic, meaningful, textless
illustrations. This program never draws or claims images that don't exist.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import subprocess
import sys
import tempfile
from PIL import Image, ImageStat, UnidentifiedImageError

ROOT=Path(__file__).resolve().parent.parent
Image.MAX_IMAGE_PIXELS=100_000_000

def sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()

def safe_path(relative):
    p=Path(relative)
    if p.is_absolute() or not p.parts or '..' in p.parts:
        raise ValueError('Unsafe path: '+str(relative))
    result=(ROOT/p).resolve()
    if not result.is_relative_to(ROOT):
        raise ValueError('Path escapes repository: '+relative)
    return result

def ingest(plan_path,atlas_path,register=False,replace=False,commit=False):
    if commit and not register:
        raise ValueError('--commit requires --register')
    plan=json.loads(Path(plan_path).read_text(encoding='utf8'))
    atlas=plan['atlas']
    if plan.get('schemaVersion')!=1 or plan.get('kind')!='original-art-atlas-registration-plan':
        raise ValueError('Unknown atlas manifest')
    if plan.get('chapter') not in range(1,6) or plan.get('gender') not in ('male','female'):
        raise ValueError('Out of scope')
    frames=plan['frames']
    if len(frames)!=150 or atlas['frames']!=150 or atlas['columns']*atlas['rows']!=150:
        raise ValueError('Atlas must have exactly 150 scenes')
    if len({f['atlasIndex'] for f in frames})!=150:
        raise ValueError('Missing or duplicate atlas positions')
    if len({f['framePath'] for f in frames})!=150:
        raise ValueError('Duplicate frame destination')
    if not Path(atlas_path).is_file():
        raise ValueError('Missing actual source atlas: '+str(atlas_path))
    with Image.open(atlas_path) as source:
        source.load()
        expected=(atlas['width'],atlas['height'])
        if source.size!=expected:
            raise ValueError(f'High-quality atlas must be {expected} real pixels, got {source.size}')
        if source.format not in ('WEBP','PNG'):
            raise ValueError('Expected a real WebP/PNG atlas image')
        src=source.convert('RGB')
    width,height=atlas['cellWidth'],atlas['cellHeight']
    if width<512 or height<288:
        raise ValueError('Low resolution: input must have at least 512x288 source pixels per scene')
    by_page={}
    hashes=set()
    with tempfile.TemporaryDirectory(prefix='story-atlas-') as tmp:
        stage=Path(tmp)
        content=[]
        for f in sorted(frames,key=lambda x:x['atlasIndex']):
            i=f['atlasIndex']
            if i<0 or i>=150 or i!=len(content) or (f['atlasColumn'],f['atlasRow'])!=(i%10,i//10):
                raise ValueError('Frame order / grid does not match atlas')
            if f['gender']!=plan['gender'] or f['stageId'][:3]!='c'+str(plan['chapter']).zfill(2):
                raise ValueError('Incorrect gender/chapter in frame '+str(i))
            if f.get('textInsideArt') is not False or not f['voiceTextExternal']:
                raise ValueError('Textless policy or spoken-script assignment missing')
            if f['phase']=='post' and f['stageKind']!='town' and f['verifiedOutcome'] is None:
                raise ValueError('Unverified victory in '+f['stageId'])
            rect=(f['atlasColumn']*width,f['atlasRow']*height,
                  (f['atlasColumn']+1)*width,(f['atlasRow']+1)*height)
            cell=src.crop(rect)
            if ImageStat.Stat(cell.convert('L')).stddev[0]<12:
                raise ValueError('Blank/low-detail frame '+str(i))
            fp=safe_path(f['framePath'])
            if not str(fp).startswith(str(ROOT/'assets/story/chapters')):
                raise ValueError('Wrong output asset root')
            tmp_frame=stage/('frame_'+str(i).zfill(3)+'.webp')
            cell.save(tmp_frame,format='WEBP',quality=90,method=6)
            digest=sha(tmp_frame)
            if digest in hashes:
                raise ValueError('Repeated identical illustration at frame '+str(i))
            hashes.add(digest)
            item={'path':str(fp.relative_to(ROOT)),'prepared':tmp_frame,
                  'sha256':digest,'frame':f,'index':i}
            content.append(item)
            by_page.setdefault(f['pagePath'],[]).append(item)
        if len(by_page)!=20:
            raise ValueError('Atlas must map to 20 unique pre/post game pages')
        sheets=[]
        for page,panels in by_page.items():
            if not (5<=len(panels)<=10):
                raise ValueError('Unexpected page scene count '+page)
            panels.sort(key=lambda x:x['frame']['comicPanelIndex'])
            cells=[x['frame']['comicPanelIndex'] for x in panels]
            if cells!=list(range(len(panels))):
                raise ValueError('Out-of-order script to image binding '+page)
            rows=math.ceil(len(panels)/2)
            full=Image.new('RGB',(width*2,rows*height),(17,21,30))
            for n,p in enumerate(panels):
                with Image.open(p['prepared']) as frame:
                    full.paste(frame,((n%2)*width,(n//2)*height))
            target=safe_path(page)
            tmp_page=stage/('page_'+str(len(sheets)).zfill(2)+'.webp')
            full.save(tmp_page,format='WEBP',quality=89,method=6)
            sheets.append({'path':str(target.relative_to(ROOT)),'prepared':tmp_page,
                           'sha256':sha(tmp_page),'count':len(panels),
                           'panels':[x['frame']['comicPanelId'] for x in panels]})
        registry={
            'schemaVersion':1,'chapter':plan['chapter'],'gender':plan['gender'],
            'status':'AI_GENERATED_DRAFT_NEEDS_VISUAL_REVIEW','humanApproved':False,
            'originalAtlas':str(Path(atlas_path)),'atlasSHA256':sha(Path(atlas_path)),
            'frameCount':len(content),'pageCount':len(sheets),
            'textlessRule':'No text may appear in source artwork; captions/ruby/audio are external',
            'frameFiles':{x['frame']['comicPanelId']:x['sha256'] for x in content},
            'pageFiles':{x['path']:x['sha256'] for x in sheets}
        }
        registry_dest=f"assets/story/chapters/c{plan['chapter']:02d}/atlas-drafts/c{plan['chapter']:02d}-{plan['gender']}-mainline-150.json"
        reg_tmp=stage/'registry.json'
        reg_tmp.write_text(json.dumps(registry,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
        assets=content+sheets+[{'path':registry_dest,'prepared':reg_tmp,'sha256':sha(reg_tmp)}]
        if register:
            if not replace:
                existing=[x['path'] for x in assets if safe_path(x['path']).exists()]
                if existing:raise ValueError('Existing art must be protected; pass --replace after reviewing: '+', '.join(existing[:3]))
            for a in assets:
                dest=safe_path(a['path'])
                dest.parent.mkdir(parents=True,exist_ok=True)
                dest.write_bytes(a['prepared'].read_bytes())
            if commit:
                rels=[x['path'] for x in assets]
                subprocess.run(['git','add','--',*rels],cwd=ROOT,check=True)
                subprocess.run(['git','commit','-m',
                  f"assets(story): register chapter {plan['chapter']} {plan['gender']} real 150-panel atlas and 20 game sheets"],
                  cwd=ROOT,check=True)
        return {'chapter':plan['chapter'],'gender':plan['gender'],'status':'registered-draft' if register else 'verified-not-registered',
                'inputAtlasPixels':expected,'frames':len(content),'gamePages':len(sheets),
                'outputFiles':len(assets),'humanApproved':False,'committed':bool(commit)}
def main():
    p=argparse.ArgumentParser()
    p.add_argument('--plan',required=True)
    p.add_argument('--atlas',required=True)
    p.add_argument('--register',action='store_true')
    p.add_argument('--replace',action='store_true')
    p.add_argument('--commit',action='store_true')
    args=p.parse_args()
    try:
        print(json.dumps(ingest(args.plan,args.atlas,args.register,args.replace,args.commit),ensure_ascii=False))
    except (ValueError,OSError,KeyError,subprocess.CalledProcessError,UnidentifiedImageError) as ex:
        print('ATLAS NOT REGISTERED: '+str(ex),file=sys.stderr)
        raise SystemExit(1)
if __name__=='__main__':main()
