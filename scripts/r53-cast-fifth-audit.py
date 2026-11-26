import sys,json,hashlib
from pathlib import Path
from PIL import Image
src,out=map(Path,sys.argv[1:]);out.mkdir(parents=True,exist_ok=True)
rows={}
for p in src.glob('*/fifth-report.json'):
    m=json.loads(p.read_text());i=m['id'];f=p.parent/(i+'_fifth_candidate.glb')
    if i in rows or i not in ('commander-male','garan') or hashlib.sha256(f.read_bytes()).hexdigest()!=m['sha256']:raise ValueError('identity/hash')
    if len(m['terminalPlates'])!=4 or len(m['plateClearance'])!=19 or len(m['before'])!=30 or len(m['after'])!=30 or not m['sourceNonArmorGeometryUnchanged'] or not m['morphsUnchanged'] or not m['roundTrip'] or m['rigCount']!=1 or len(m['morphs'])!=13 or len(m['clips'])!=10:raise ValueError('inventory')
    if any(m[k] for k in ('visualApproved','collisionApproved','productionApproved')):raise ValueError('false approval')
    for k,v in m['plateClearance'].items():
        if any(a>b+1e-7 for a,b in zip(v['summary'],m['baseline'][k])):raise ValueError('regression '+k)
    if i=='commander-male' and m['ageSkin']['applied']:raise ValueError('unexpected age texture')
    imgs=list(p.parent.glob('*.png'))
    if len(imgs)!=15:raise ValueError('render inventory '+str(len(imgs)))
    for f in imgs:
        with Image.open(f) as im:im.verify()
    for n in ('ATTRIBUTION.md','ARMOR-LICENSE.txt'):
        if not (p.parent/n).is_file():raise ValueError('license')
    rows[i]=m
if set(rows)!={'commander-male','garan'}:raise ValueError('incomplete fifth candidates')
(out/'summary.json').write_text(json.dumps({'verified':2,'models':list(rows.values()),'productionApproved':0},indent=2))
print('R53 cast fifth candidate inventory verified',len(rows))
