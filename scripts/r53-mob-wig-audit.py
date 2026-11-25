import sys,json,hashlib
from pathlib import Path
from PIL import Image
src,out=map(Path,sys.argv[1:]);out.mkdir(parents=True,exist_ok=True)
expected={f'mob_{s}_{i:02d}' for s in ('male','female') for i in range(1,11)}
rows={};errors=[]
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
for p in src.glob('*/wig-fit-report.json'):
    try:
        r=json.loads(p.read_text())
        if r['failures'] or len(r['models'])!=1:raise ValueError('invalid fit report')
        m=r['models'][0];i=m['id']
        if i not in expected or i in rows:raise ValueError('unexpected identity')
        if not m['sourceHair'].startswith(m['sex']+'_hair_'):raise ValueError('wrong sex hair')
        if sha(p.parent/(i+'_wig.glb'))!=m['sha256']:raise ValueError('GLB hash mismatch')
        if not m['G0Measured'] or not m['G1FitCandidate'] or any(m[k] for k in ('G2MaterialApproval','G3CollisionApproval','G4MobileApproval','G5VisualApproval')):raise ValueError('invalid gate status')
        images=list(p.parent.glob('*.png'))
        if len(images)!=15:raise ValueError('missing fit renders')
        for f in images:
            with Image.open(f) as im:im.verify()
        if not (p.parent/'ATTRIBUTION.md').exists():raise ValueError('missing credit')
        rows[i]=m
    except Exception as e:errors.append({'file':str(p),'error':str(e)})
(out/'summary.json').write_text(json.dumps({'expected':20,'verified':len(rows),'missing':sorted(expected-set(rows)),'errors':errors,'models':list(rows.values()),'visualApproved':0},indent=2))
print('R53 mob wig candidates',len(rows),'of 20')
if set(rows)!=expected or errors:raise SystemExit(1)
