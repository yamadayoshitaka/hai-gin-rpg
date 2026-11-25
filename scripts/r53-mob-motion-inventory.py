import sys,json,hashlib
from pathlib import Path
from PIL import Image
src,out=map(Path,sys.argv[1:]);out.mkdir(parents=True,exist_ok=True)
expected={f'mob_{s}_{i:02d}' for s in ('male','female') for i in range(1,11)}
rows={};errors=[]
for p in src.glob('*/motion-report.json'):
    try:
        m=json.loads(p.read_text());i=m['id']
        if i not in expected or i in rows:raise ValueError('identity mismatch')
        if hashlib.sha256((p.parent/(i+'_motion.glb')).read_bytes()).hexdigest()!=m['sha256']:raise ValueError('GLB hash mismatch')
        if len(m['clips'])!=10 or len(m['morphs'])!=13 or len(m['mapping'])!=60 or m['productionApproved']:raise ValueError('missing motion or expression')
        if any(x['defects'] or x['peak_m']<.0001 for x in m['morphs']):raise ValueError('invalid single morph')
        imgs=list(p.parent.glob('*.png'))
        if len(imgs)!=53:raise ValueError('missing render evidence '+str(len(imgs)))
        for f in imgs:
            with Image.open(f) as im:im.verify()
        rows[i]=m
    except Exception as e:errors.append({'file':str(p),'error':str(e)})
(out/'summary.json').write_text(json.dumps({'expected':20,'verified':len(rows),'missing':sorted(expected-set(rows)),'errors':errors,'models':list(rows.values()),'combinedMorphFailures':sum(not c['pass'] for m in rows.values() for c in m['combinedMorphs']),'visualApproved':0},indent=2))
print('Verified mob motion and expression candidates',len(rows),'of 20')
if set(rows)!=expected or errors:raise SystemExit(1)
