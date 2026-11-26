import sys,json,hashlib
from pathlib import Path
from PIL import Image
root,out=map(Path,sys.argv[1:]);out.mkdir(parents=True,exist_ok=True)
rows=[]
for i in ('commander-male','commander-female'):
    a=root/('r53-hero-anatomy-'+i);p=a/(i+'_anatomy_candidate.glb');r=json.loads((a/'anatomy-report.json').read_text())
    if r['id']!=i or hashlib.sha256(p.read_bytes()).hexdigest()!=r['sha256'] or not r['roundTrip'] or r['productionApproved']:raise ValueError('source/approval')
    if len(r['morphs'])!=13 or len(r['clips'])!=10 or len(r['poseSamples'])!=30 or not r['facePolish']['morphDeltaPreserved']:raise ValueError('inventory')
    if len(list(a.glob('*.png')))!=15:raise ValueError('render count')
    for f in a.glob('*.png'):
        with Image.open(f) as im:im.verify()
    rows.append(r)
a=root/'r53-hero-female-outfit';r=json.loads((a/'outfit-report.json').read_text());p=a/'commander-female_outfit_candidate.glb'
if r['id']!='commander-female' or hashlib.sha256(p.read_bytes()).hexdigest()!=r['sha256'] or len(r['legPlates'])!=8 or len(r['samples'])!=30 or not r['roundTrip'] or r['productionApproved']:raise ValueError('outfit inventory')
(out/'summary.json').write_text(json.dumps({'anatomyCandidates':rows,'femaleOutfit':r,'productionApproved':0},indent=2))
print('R53 hero independent anatomy/outfit candidates verified')
