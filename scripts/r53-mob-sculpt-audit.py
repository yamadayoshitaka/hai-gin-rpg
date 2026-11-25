import sys,json,hashlib
from pathlib import Path
from PIL import Image
src,config,out=map(Path,sys.argv[1:]);out.mkdir(parents=True,exist_ok=True)
plan=json.loads(config.read_text());expected={x['id']:x for x in plan['mobs']}
assert len(expected)==20 and len(plan['cast'])==22
assert all(sum(x['sex']==s for x in expected.values())==10 for s in ('male','female'))
models={};errors=[];heads=set();fields=set()
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
for p in src.glob('*/mob-study-report.json'):
    try:
        m=json.loads(p.read_text());i=m['id']
        if i not in expected or i in models:raise ValueError('unexpected mob')
        if m['bodySource']!=expected[i]['bodySource'] or m['sex']!=expected[i]['sex']:raise ValueError('source mismatch')
        if sha(p.parent/(i+'.glb'))!=m['sha256']:raise ValueError('GLB SHA mismatch')
        if m['headGeometrySHA256'] in heads or m['headDisplacementSHA256'] in fields:raise ValueError('duplicate baked facial geometry or field')
        if m['newFaceFlips'] or m['collapsed'] or m['neckAnchorError_m'] or not m['roundTrip'] or m['visualApproved'] or m['finalIdentity'] or m['independentReferenceViews']:raise ValueError('invalid QA or approval')
        if len(m['renderHashes'])!=11:raise ValueError('missing render views')
        for tag,h in m['renderHashes'].items():
            f=p.parent/(tag+'.png')
            if sha(f)!=h:raise ValueError('render hash mismatch')
            with Image.open(f) as im:im.verify()
        heads.add(m['headGeometrySHA256']);fields.add(m['headDisplacementSHA256']);models[i]=m
    except Exception as e:errors.append({'file':str(p),'error':str(e)})
(out/'summary.json').write_text(json.dumps({'targetMobStudies':20,'verifiedMobStudies':len(models),'missing':sorted(set(expected)-set(models)),'errors':errors,'castTarget':22,'castFinalReady':0,'cast':plan['cast'],'models':list(models.values()),'releaseReady':False},ensure_ascii=False,indent=2))
print('R53 verified mob studies',len(models),'of 20; named cast remains unapproved')
if set(models)!=set(expected) or errors:raise SystemExit(1)
