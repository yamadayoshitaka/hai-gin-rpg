import sys,json,hashlib
from pathlib import Path
from PIL import Image
root,out=map(Path,sys.argv[1:]);out.mkdir(parents=True,exist_ok=True)
rows=[]
for i in ('commander-male','commander-female'):
    a=root/('r53-hero-pbr-'+i);p=a/(i+'_hero_pbr.glb');r=json.loads((a/'hero-pbr-report.json').read_text())
    if r['id']!=i or hashlib.sha256(p.read_bytes()).hexdigest()!=r['sha256'] or not r['roundTrip'] or not r['sourceGeometryPreservedBeforeExport'] or r['productionApproved'] or r['protectedR6Used']:raise ValueError('source or approval '+i)
    if len(r['morphs'])!=13 or len(r['clips'])!=10 or len(r['poseSamples'])!=30 or not r['materialChanges']:raise ValueError('inventory '+i)
    imgs=list(a.glob('*.png'))
    if len(imgs)!=17:raise ValueError('render count '+str(len(imgs)))
    for f in imgs:
        with Image.open(f) as im:im.verify()
    rows.append(r)
(out/'summary.json').write_text(json.dumps({'verified':2,'models':rows,'productionApproved':0},indent=2))
print('R53 HERO PBR inventory verified',len(rows))
