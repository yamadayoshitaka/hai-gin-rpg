import sys,json,hashlib
from pathlib import Path
from PIL import Image
quality,lods,plan,out=map(Path,sys.argv[1:]);out.mkdir(parents=True,exist_ok=True)
expected={r['id'] for r in json.loads(plan.read_text())['models']};rows=[];errors=[]
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
for i in sorted(expected):
    try:
        q=quality/('r53-cast-quality-'+i);l=lods/('r53-cast-lod-'+i)
        a=json.loads((q/'assembly-report.json').read_text());b=json.loads((l/'cast-lod-report.json').read_text())
        if a['id']!=i or b['id']!=i or a['sha256']!=b['sourceSHA256'] or sha(q/(i+'_assembled.glb'))!=a['sha256']:raise ValueError('source')
        if not a['protectedGeometryPreserved'] or a['sampleCount']!=30 or a['protectedR6Used'] or a['productionApproved'] or not a['roundTrip']:raise ValueError('quality evidence')
        if len(a['morphs'])!=13 or len(a['clips'])!=10 or a['rigCount']!=1:raise ValueError('rig/morph/action')
        if len(b['levels'])!=2 or not 0<b['levels'][1]['triangles']<b['levels'][0]['triangles']<b['lod0']['triangles']:raise ValueError('LOD ordering')
        if not b['bodyMorphTopologyPreserved'] or b['morphCount']!=13 or b['clipCount']!=10 or b['productionApproved']:raise ValueError('LOD inventory')
        for m in b['levels']:
            if sha(l/(i+'_'+m['level']+'.glb'))!=m['sha256'] or not m['roundTrip'] or m['poseSamples']!=30:raise ValueError('LOD hash/pose')
        for folder,n in ((q,9),(l,8)):
            imgs=list(folder.glob('*.png'))
            if len(imgs)!=n:raise ValueError('image count '+str(len(imgs)))
            for f in imgs:
                with Image.open(f) as im:im.verify()
        rows.append({'id':i,'quality':a,'lod':b})
    except Exception as e:errors.append({'id':i,'error':str(e)})
(out/'summary.json').write_text(json.dumps({'expected':len(expected),'verified':len(rows),'errors':errors,'models':rows,'productionApproved':0},ensure_ascii=False,indent=2))
print('R53 CAST QUALITY LOD verified',len(rows),'of',len(expected))
if len(rows)!=len(expected) or errors:raise SystemExit(1)
