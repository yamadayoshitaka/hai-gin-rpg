import sys,json,hashlib
from pathlib import Path
from PIL import Image
src,config,out=map(Path,sys.argv[1:]);out.mkdir(parents=True,exist_ok=True)
expected={r['id']:r['style'] for r in json.loads(config.read_text())['models']}
if len(expected)!=20:raise ValueError('invalid plan')
rows={};errors=[]
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
for p in src.glob('*/motion-garment-report.json'):
    try:
        a=json.loads(p.read_text());i=a['id'];t=a['style']
        if expected.get(i)!=t or i in rows:raise ValueError('unexpected identity')
        m=json.loads((p.parent/'garment-third-report.json').read_text())
        f=p.parent/(i+'_'+t+'_garment.glb')
        if sha(f)!=m['sha256'] or a['garmentSHA256']!=m['sha256'] or a['bodySHA256']!=m['bodySHA256']:raise ValueError('provenance mismatch')
        if m['visualApproved'] or m['collisionApproved'] or m['bodyModified'] or m['bodyMaskApplied']:raise ValueError('incorrect approval flags')
        for v in m['parts']:
            for k in ('penetrationProxy','deepPenetrationProxy'):
                if v['after'][k]>v['before'][k]+1e-9:raise ValueError('rest regression')
        for j,parts in m['poseAfter'].items():
            for n,v in parts.items():
                for k in ('penetrationProxy','deepPenetrationProxy'):
                    if v[k]>m['poseBefore'][j][n][k]+.00301:raise ValueError('pose regression')
        if len(a['samples'])!=51 or a['motionProfile']!=i or a['maskApplied'] or a['bodyModified'] or a['visualApproved'] or a['sameSexNormalMotionStressTest']:raise ValueError('missing own-motion evidence')
        z=p.parent/'skin-mask-candidate.json'
        if sha(z)!=a['maskSHA256']:raise ValueError('mask SHA mismatch')
        mask=json.loads(z.read_text())
        if mask['runtimeApplied'] or mask['bodySHA256']!=m['bodySHA256'] or len(mask['candidateTriangleIndices'])!=a['maskTriangles']:raise ValueError('mask provenance')
        imgs=list(p.parent.glob('*.png'))
        if len(imgs)!=30:raise ValueError('missing renders '+str(len(imgs)))
        for f in imgs:
            with Image.open(f) as im:im.verify()
        rows[i]={'fit':m,'motion':a}
    except Exception as e:errors.append({'file':str(p),'error':str(e)})
(out/'summary.json').write_text(json.dumps({'expected':20,'verified':len(rows),'missing':sorted(set(expected)-set(rows)),'errors':errors,'models':list(rows.values()),'productionApproved':0},indent=2))
print('R53 mob garment and own-motion audit',len(rows),'of 20')
if set(rows)!=set(expected) or errors:raise SystemExit(1)
