import sys,json,hashlib
from pathlib import Path
from PIL import Image
src,out=map(Path,sys.argv[1:]);out.mkdir(parents=True,exist_ok=True)
expected={f'mob_{s}_{i:02d}' for s in ('male','female') for i in range(1,11)}
rows={};errors=[]
for p in src.glob('*/assembly-report.json'):
    try:
        m=json.loads(p.read_text());i=m['id']
        if i not in expected or i in rows:raise ValueError('unexpected identity')
        if hashlib.sha256((p.parent/(i+'_assembled.glb')).read_bytes()).hexdigest()!=m['sha256']:raise ValueError('hash mismatch')
        if m['rigCount']!=1 or not m['roundTrip'] or len(m['morphs'])!=13 or len(m['clips'])!=10 or len(m['samples'])!=30:raise ValueError('missing integration evidence')
        if any(q['hairTrackingMaxError_m']>.003 for q in m['samples']) or m['skinMaskApplied'] or m['productionApproved'] or m['visualApproved']:raise ValueError('invalid validation state')
        imgs=list(p.parent.glob('*.png'))
        if len(imgs)!=18:raise ValueError('missing render evidence')
        for f in imgs:
            with Image.open(f) as im:im.verify()
        if not (p.parent/'ATTRIBUTION.md').is_file():raise ValueError('missing attribution')
        rows[i]=m
    except Exception as e:errors.append({'file':str(p),'error':str(e)})
(out/'summary.json').write_text(json.dumps({'expected':20,'verified':len(rows),'missing':sorted(expected-set(rows)),'errors':errors,'models':list(rows.values()),'productionApproved':0},indent=2))
print('R53 assembled candidates',len(rows),'of 20')
if set(rows)!=expected or errors:raise SystemExit(1)
