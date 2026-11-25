import sys,json,hashlib
from pathlib import Path
from PIL import Image
src,out=map(Path,sys.argv[1:]);out.mkdir(parents=True,exist_ok=True)
expected={f'{s}_{a}_normal' for s in ('male','female') for a in ('under10','teens','20s','30s','40s','50s','60s','70s','80plus')}|{f'{s}_30s_{b}' for s in ('male','female') for b in ('slim','muscular','chubby','obese')}
models={};errors=[]
for p in src.glob('*/motion-report.json'):
    try:
        m=json.loads(p.read_text());i=m['id']
        if i not in expected or i in models:raise ValueError('unexpected/duplicate model')
        glb=p.parent/(i+'_motion.glb')
        if hashlib.sha256(glb.read_bytes()).hexdigest()!=m['sha256']:raise ValueError('GLB SHA mismatch')
        if len(m['clips'])!=5 or len(m['mapping'])!=60 or m['productionApproved']:raise ValueError('motion report invalid')
        if any(c['rootVerticalCorrectionMax_m']>.060001 or c['temporalVariation_m']<.0005 or not all('ankleSeparation_m' in q and 'footGroundDelta_m' in q for q in c['sampleChecks']) for c in m['clips']):raise ValueError('missing gait metrics')
        imgs=list(p.parent.glob('*.png'))
        if len(imgs)!=20:raise ValueError('missing motion evidence')
        for f in imgs:
            with Image.open(f) as im:im.verify()
        models[i]=m
    except Exception as e:errors.append({'file':str(p),'error':str(e)})
(out/'summary.json').write_text(json.dumps({'expected':len(expected),'verified':len(models),'clips':sum(len(m['clips']) for m in models.values()),'missing':sorted(expected-set(models)),'errors':errors,'productionApproved':0,'models':list(models.values())},indent=2))
print('R53 motion candidates',len(models),'of',len(expected))
if set(models)!=expected or errors:raise SystemExit(1)
