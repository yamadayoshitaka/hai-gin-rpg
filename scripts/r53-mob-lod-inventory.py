import sys,json,hashlib
from pathlib import Path
from PIL import Image
src,out=map(Path,sys.argv[1:]);out.mkdir(parents=True,exist_ok=True)
expected={f'mob_{s}_{i:02d}' for s in ('male','female') for i in range(1,11)}
rows={};errors=[]
for p in src.glob('*/mob-lod-report.json'):
    try:
        m=json.loads(p.read_text());i=m['id']
        if i not in expected or i in rows:raise ValueError('identity mismatch')
        levels=m['levels']
        if len(levels)!=2 or not 0<levels[1]['triangles']<levels[0]['triangles']<m['lod0']['triangles']:raise ValueError('LOD ordering')
        if not m['bodyMorphTopologyPreserved'] or m['morphCount']!=13 or m['clipCount']!=10 or m['productionApproved']:raise ValueError('body/action inventory')
        for a in levels:
            f=p.parent/(i+'_'+a['level']+'.glb')
            if hashlib.sha256(f.read_bytes()).hexdigest()!=a['sha256'] or not a['roundTrip'] or a['poseSamples']!=30:raise ValueError('roundtrip evidence')
        imgs=list(p.parent.glob('*.png'))
        if len(imgs)!=8:raise ValueError('missing render evidence')
        for f in imgs:
            with Image.open(f) as im:im.verify()
        if not (p.parent/'ATTRIBUTION.md').is_file():raise ValueError('missing attribution')
        rows[i]=m
    except Exception as e:errors.append({'file':str(p),'error':str(e)})
(out/'summary.json').write_text(json.dumps({'expected':20,'verified':len(rows),'missing':sorted(expected-set(rows)),'errors':errors,'models':list(rows.values()),'productionApproved':0},indent=2))
print('R53 verified assembled LOD candidates',len(rows),'of 20')
if set(rows)!=expected or errors:raise SystemExit(1)
