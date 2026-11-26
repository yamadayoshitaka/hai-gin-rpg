import sys,json,hashlib
from pathlib import Path
from PIL import Image
root,out=map(Path,sys.argv[1:]);out.mkdir(parents=True,exist_ok=True);rows=[]
for i in ('commander-male','commander-female'):
    a=root/('r53-hero-master-head-'+i);p=a/(i+'_master_head.glb');r=json.loads((a/'master-head-report.json').read_text())
    if r['id']!=i or r['sha256']!=hashlib.sha256(p.read_bytes()).hexdigest() or not r['roundTrip'] or r['productionApproved'] or r['protectedR6Used']:raise ValueError('source/approval')
    if r['eyeMeshes']!=4 or len(r['morphs'])!=13 or len(r['clips'])!=10 or any(m['newDefects'] for m in r['morphs']):raise ValueError('inventory')
    imgs=list(a.glob('*.png'))
    if len(imgs)!=28:raise ValueError('render count')
    for f in imgs:
        with Image.open(f) as im:im.verify()
    rows.append(r)
(out/'summary.json').write_text(json.dumps({'headCandidates':rows,'productionApproved':0},indent=2))
print('R53 master head candidate inventory verified',len(rows))
