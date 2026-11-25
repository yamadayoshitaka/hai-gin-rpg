import sys,json,hashlib
from pathlib import Path
from PIL import Image
src,out=map(Path,sys.argv[1:]);out.mkdir(parents=True,exist_ok=True)
expected={(s+'_30s_'+b,t) for s in ('male','female') for b in ('normal','obese') for t in ('Peasant','Ranger')}
rows={};errors=[]
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
for p in src.glob('*/garment-third-report.json'):
    try:
        m=json.loads(p.read_text());key=(m['id'],m['style'])
        if key not in expected or key in rows:raise ValueError('unexpected identity')
        f=p.parent/(m['id']+'_'+m['style']+'_garment.glb')
        if sha(f)!=m['sha256']:raise ValueError('GLB hash')
        for v in m['parts']:
            for k in ('penetrationProxy','deepPenetrationProxy'):
                if v['after'][k]>v['before'][k]+1e-9:raise ValueError('rest regression')
        for j,parts in m['poseAfter'].items():
            for name,v in parts.items():
                for k in ('penetrationProxy','deepPenetrationProxy'):
                    if v[k]>m['poseBefore'][j][name][k]+.00301:raise ValueError('pose regression')
        a=json.loads((p.parent/'motion-garment-report.json').read_text())
        mask=p.parent/'skin-mask-candidate.json'
        if a['garmentSHA256']!=m['sha256'] or a['bodySHA256']!=m['bodySHA256'] or a['maskSHA256']!=sha(mask) or len(a['samples'])!=21 or a['maskApplied'] or a['visualApproved'] or a['bodyModified']:raise ValueError('invalid motion evidence')
        z=json.loads(mask.read_text())
        if z['runtimeApplied'] or len(z['candidateTriangleIndices'])!=a['maskTriangles']:raise ValueError('mask evidence invalid')
        imgs=list(p.parent.glob('*.png'))
        if len(imgs)!=18:raise ValueError('missing render evidence '+str(len(imgs)))
        for f in imgs:
            with Image.open(f) as im:im.verify()
        rows[key]={'fit':m,'motion':a}
    except Exception as e:errors.append({'file':str(p),'error':str(e)})
(out/'summary.json').write_text(json.dumps({'expected':len(expected),'verified':len(rows),'missing':sorted(expected-set(rows)),'errors':errors,'models':list(rows.values()),'visualApproved':0},indent=2))
print('Verified third-pass and sampled motion',len(rows),'of',len(expected))
if set(rows)!=expected or errors:raise SystemExit(1)
