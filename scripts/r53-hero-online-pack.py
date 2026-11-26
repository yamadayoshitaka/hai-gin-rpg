import json,hashlib,shutil,sys
from pathlib import Path
from PIL import Image
root,out=map(Path,sys.argv[1:3]);out.mkdir(parents=True,exist_ok=True)
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
models={};names=None
for i in ('commander-male','commander-female'):
    a=root/'new'/('r53-hero-master-head-'+i);b=root/'old'/('r53-hero-anatomy-'+i)
    d=out/'assets'/i;d.mkdir(parents=True,exist_ok=True)
    nr=json.loads((a/'master-head-report.json').read_text());orr=json.loads((b/'anatomy-report.json').read_text())
    if nr['id']!=i or orr['id']!=i or nr['sourceSHA256']!=orr['sha256'] or not nr['roundTrip'] or not orr['roundTrip'] or nr['productionApproved']:raise RuntimeError('provenance '+i)
    models[i]={}
    for v,p,h in [('new',a/(i+'_master_head.glb'),nr['sha256']),('old',b/(i+'_anatomy_candidate.glb'),orr['sha256'])]:
        if sha(p)!=h:raise RuntimeError('hash '+i)
        f=d/(v+'.glb');shutil.copyfile(p,f);models[i][v]={'path':f.relative_to(out).as_posix(),'sha256':h}
    ns=[m['name'] for m in nr['morphs']]
    if len(ns)!=13 or (names is not None and ns!=names):raise RuntimeError('morph inventory')
    names=ns
    files=list(a.glob('*.png'))
    if len(files)!=28:raise RuntimeError('image inventory')
    for f in files:
        with Image.open(f) as im:im.verify()
        shutil.copyfile(f,d/f.name)
(out/'manifest.json').write_text(json.dumps({'sourceRun':45748909583,'models':models,'morphs':names,'productionApproved':False},ensure_ascii=False,indent=2))
for f in ('index.html','viewer.mjs'):shutil.copyfile(Path('review-tools/r53-hero-online')/f,out/f)
print('R53 preview 4 actual GLBs and 56 original render images staged')
