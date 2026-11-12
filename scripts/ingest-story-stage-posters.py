#!/usr/bin/env python3
"""Free, review-only poster->individual-WebP conversion.

The input is an ACTUAL high-resolution, textless multi-scene poster. The
pipeline refuses low-resolution cells and never auto-approves or publishes art.

    node scripts/prepare-story-stage-posters.mjs --start c01-s02 --count 2
    python scripts/ingest-story-stage-posters.py

Place poster sources at:
    assets/story/chapter-drafts/c01/posters/c01-s02-pre-male-p01.webp
Output is isolated in qa-reports/story-stage-production/review-packs/.
"""
import argparse
import hashlib
import html
import json
from pathlib import Path
from PIL import Image, ImageStat

ROOT=Path(__file__).resolve().parents[1]
def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def inside(root, rel):
    if Path(rel).is_absolute() or '..' in Path(rel).parts:
        raise ValueError('Unsafe relative path '+str(rel))
    return root/rel

def process_variant(variant, parent, poster_root, output_root):
    stage=variant['stageId']
    if len(variant['pages']) != 1:
        raise ValueError('Use one page per variant; unsupported multi-page '+stage)
    page=variant['pages'][0]
    source=inside(poster_root,stage[:3]+'/posters/'+Path(page['posterAsset']).name)
    if not source.exists():
        return {'id':stage+'|'+variant['edition']+'|'+variant['gender'],
                'status':'MISSING_SOURCE_POSTER', 'source':str(source.relative_to(ROOT))}
    with Image.open(source) as image:
        image.load()
        width,height=image.size
        columns=page['posterSpec']['columns']
        rows=page['posterSpec']['rows']
        if image.format!='WEBP':
            raise ValueError('Poster must be real WebP: '+str(source))
        if columns!=2 or len(page['panels'])!=page['posterSpec']['cellCount']:
            raise ValueError('Scene cells do not match poster manifest')
        if width%columns or height%rows:
            raise ValueError('Poster dimensions not divisible by grid: '+str(source))
        cell_w,cell_h=width//columns,height//rows
        if cell_w<1536 or cell_h<864 or abs(cell_w/cell_h-16/9)>0.002:
            raise ValueError('REJECTED LOW-RES/ASPECT poster: '+str(source)+
                             f' each cell {cell_w}x{cell_h} (needs >=1536x864 at 16:9)')
        output=output_root/stage/variant['edition']/variant['gender']
        output.mkdir(parents=True,exist_ok=True)
        target_poster=output/source.name
        target_poster.write_bytes(source.read_bytes())
        reference=inside(ROOT,page['panels'][0]['qualityReferenceImage'])
        reference_name='candidate-stage1-reference-'+variant['gender']+'.webp'
        if reference.exists():
            (output/reference_name).write_bytes(reference.read_bytes())
        frames=[]
        for p in page['panels']:
            c,r=p['cell']
            crop=image.crop((c*cell_w,r*cell_h,(c+1)*cell_w,(r+1)*cell_h)).convert('RGB')
            if ImageStat.Stat(crop.convert('L')).stddev[0]<8:
                raise ValueError('REJECTED nearly blank art cell '+p['panelId'])
            name=Path(p['individualAsset']).name
            dst=output/name
            crop.save(dst,'WEBP',quality=96,method=6)
            frames.append({'panelId':p['panelId'],'scriptText':p['scriptText'],
                'edition':variant['edition'],'gender':variant['gender'],
                'individualAsset':p['individualAsset'],'localReviewAsset':name,
                'pixelSize':[cell_w,cell_h],'sourcePoster':str(source.relative_to(ROOT)),
                'posterSha256':digest(source),'sha256':digest(dst),
                'qualityReferenceImage':p['qualityReferenceImage'],
                'qualityReferenceStatus':p['qualityReferenceStatus'],
                'approved':False,'reviewer':None,
                'approvalStatus':'REVIEW_REQUIRED',
                'checklist':p['requiredChecks']})
        report={'stageId':stage,'edition':variant['edition'],'gender':variant['gender'],
            'approved':False,'overallStatus':'REVIEW_REQUIRED_NO_DEPLOY',
            'qualityReferenceStatus':'PROVISIONAL_STAGE1_REFERENCE_NOT_HUMAN_APPROVED',
            'sourcePoster':str(source.relative_to(ROOT)), 'frames':frames}
        (output/'review.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
        rows_html=[]
        for f in frames:
            title=html.escape(f['panelId'])
            text=html.escape(f['scriptText'])
            rows_html.append(f'<section><h2>{title}</h2><div class="pair"><img src="{reference_name}" alt="Stage1 provisional reference"><img src="{html.escape(f["localReviewAsset"])}" alt="Review candidate"></div><p>{text}</p><p>NOT APPROVED · manual inspection required</p></section>')
        markup='<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{background:#151c29;color:#f4f5f6;font:16px sans-serif;max-width:1200px;margin:auto;padding:20px}.pair{display:grid;grid-template-columns:1fr 1fr;gap:12px}img{width:100%;height:auto;display:block}section{padding:12px;border-bottom:1px solid #445}h2{font-size:18px}</style><h1>Provisional quality reference (left) / candidate (right) — manual review only</h1>'+''.join(rows_html)
        (output/'compare.html').write_text(markup,encoding='utf8')
        return {'id':stage+'|'+variant['edition']+'|'+variant['gender'],
                'status':'REVIEW_REQUIRED_NO_DEPLOY','frames':len(frames),
                'output':str(output.relative_to(ROOT))}

def main():
    p=argparse.ArgumentParser()
    p.add_argument('--manifest-dir',default='qa-reports/story-stage-production')
    p.add_argument('--poster-root',default='assets/story/chapter-drafts')
    p.add_argument('--out-root',default='qa-reports/story-stage-production/review-packs')
    args=p.parse_args()
    manifest_root=inside(ROOT,args.manifest_dir)
    poster_root=inside(ROOT,args.poster_root)
    out_root=inside(ROOT,args.out_root)
    found=sorted(f for f in manifest_root.glob('*.json') if f.is_file())
    if not found:
        raise ValueError('No generated storyboard manifest. Run prepare-story-stage-posters.mjs')
    # The newest manifest is preferred for duplicate scene editions.
    by_id={}
    for file in found:
        doc=json.loads(file.read_text(encoding='utf8'))
        if doc.get('kind')!='production-manifest-not-generated-art':
            continue
        for stage in doc['stages']:
            for variant in stage['variants']:
                key=(variant['stageId'],variant['edition'],variant['gender'])
                by_id[key]=variant
    results=[process_variant(v,None,poster_root,out_root) for v in by_id.values()]
    output=manifest_root/'ingestion-review-status.json'
    summary={'schemaVersion':1,'kind':'free-visual-review-input-not-approved-art',
       'variantsFound':len(by_id),'postersProcessed':sum(x['status']=='REVIEW_REQUIRED_NO_DEPLOY' for x in results),
       'postersMissing':sum(x['status']=='MISSING_SOURCE_POSTER' for x in results),
       'artworkAutoApproved':False,'deployed':False,
       'results':results}
    output.write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
    print(json.dumps({k:v for k,v in summary.items() if k!='results'},ensure_ascii=False))
if __name__=='__main__':
    main()
