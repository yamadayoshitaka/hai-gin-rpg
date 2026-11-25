import sys,json,hashlib
from pathlib import Path
from PIL import Image
src,out=map(Path,sys.argv[1:]);out.mkdir(parents=True,exist_ok=True)
expected={(s+'_30s_'+b,t) for s in ('male','female') for b in ('normal','obese') for t in ('Peasant','Ranger')}
rows={};errors=[]
for p in src.glob('*/garment-refine-report.json'):
    try:
        m=json.loads(p.read_text());key=(m['id'],m['style'])
        if key not in expected or key in rows:raise ValueError('unexpected identity')
        f=p.parent/(m['id']+'_'+m['style']+'_garment.glb')
        if hashlib.sha256(f.read_bytes()).hexdigest()!=m['sha256']:raise ValueError('GLB hash mismatch')
        if m['bodyModified'] or m['visualApproved'] or m['collisionApproved']:raise ValueError('invalid approvals')
        for v in m['parts']:
            for k in ('penetrationProxy','deepPenetrationProxy'):
                if v['after'][k]>v['before'][k]+1e-9:raise ValueError('rest regression')
        for j,parts in m['poseAfter'].items():
            for name,v in parts.items():
                for k in ('penetrationProxy','deepPenetrationProxy'):
                    if v[k]>m['poseBefore'][j][name][k]+.00301:raise ValueError('pose regression')
        imgs=list(p.parent.glob('*.png'))
        if len(imgs)!=10:raise ValueError('missing render evidence')
        for f in imgs:
            with Image.open(f) as im:im.verify()
        rows[key]=m
    except Exception as e:errors.append({'file':str(p),'error':str(e)})
(out/'summary.json').write_text(json.dumps({'expected':len(expected),'verified':len(rows),'missing':sorted(expected-set(rows)),'errors':errors,'models':list(rows.values()),'visualApproved':0},indent=2))
print('Verified refined garment candidates',len(rows),'of',len(expected))
if set(rows)!=expected or errors:raise SystemExit(1)
