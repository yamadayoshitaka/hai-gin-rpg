import sys,json,hashlib
from pathlib import Path
from PIL import Image
src,out=map(Path,sys.argv[1:]);out.mkdir(parents=True,exist_ok=True)
rows={}
for p in src.glob('*/visual-report.json'):
    m=json.loads(p.read_text());i=m['id'];f=p.parent/(i+'_visual_candidate.glb')
    if i in rows or i not in ('commander-male','garan') or hashlib.sha256(f.read_bytes()).hexdigest()!=m['sha256']:raise ValueError('identity/hash')
    if len(m['armorParts'])!=7 or len(m['samples'])!=30 or len(m['expressionSamples'])!=3 or not m['bodyUnchanged'] or not m['roundTrip'] or m['rigCount']!=1 or len(m['morphs'])!=13 or len(m['clips'])!=10:raise ValueError('candidate inventory')
    if m['visualApproved'] or m['collisionApproved'] or m['productionApproved'] or m['finalIdentity']:raise ValueError('false approval')
    if i=='garan' and (m['beard']['rootCount']<35 or len(m['beard']['morphs'])!=13):raise ValueError('beard inventory')
    if i=='commander-male' and m['beard'] is not None:raise ValueError('unexpected beard')
    imgs=list(p.parent.glob('*.png'))
    if len(imgs)!=16:raise ValueError('render inventory '+str(len(imgs)))
    for f in imgs:
        with Image.open(f) as im:im.verify()
    for n in ('ATTRIBUTION.md','ARMOR-LICENSE.txt'):
        if not (p.parent/n).is_file():raise ValueError('missing credit '+n)
    rows[i]=m
if set(rows)!={'commander-male','garan'}:raise ValueError('incomplete visual candidate set')
(out/'summary.json').write_text(json.dumps({'verified':2,'models':list(rows.values()),'visualApproved':0,'productionApproved':0},indent=2))
print('R53 cast visual candidates verified',len(rows))
