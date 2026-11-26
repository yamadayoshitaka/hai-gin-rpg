import sys,json,hashlib
from pathlib import Path
from PIL import Image
src,out=map(Path,sys.argv[1:]);out.mkdir(parents=True,exist_ok=True)
rows={}
for p in src.glob('*/outfit-report.json'):
    m=json.loads(p.read_text());i=m['id'];f=p.parent/(i+'_outfit_candidate.glb')
    if i in rows or i not in ('commander-male','garan') or hashlib.sha256(f.read_bytes()).hexdigest()!=m['sha256']:raise ValueError('identity/hash')
    if len(m['legPlates'])!=8 or len(m['samples'])!=30 or len(m['drapeSearch'])!=4 or not m['originalGeometryAndMorphsUnchanged'] or not m['roundTrip'] or m['rigCount']!=1 or len(m['morphs'])!=13 or len(m['clips'])!=10:raise ValueError('inventory')
    if any(m[k] for k in ('visualApproved','collisionApproved','productionApproved')):raise ValueError('false approval')
    if i=='garan' and m['furClumps']<100:raise ValueError('fur missing')
    if i=='commander-male' and m['furClumps']:raise ValueError('unexpected fur')
    if any(q['zeroArea'] for q in m['newParts']):raise ValueError('invalid topology')
    imgs=list(p.parent.glob('*.png'))
    if len(imgs)!=19:raise ValueError('render inventory '+str(len(imgs)))
    for f in imgs:
        with Image.open(f) as im:im.verify()
    for n in ('ATTRIBUTION.md','ARMOR-LICENSE.txt'):
        if not (p.parent/n).is_file():raise ValueError('license')
    rows[i]=m
if set(rows)!={'commander-male','garan'}:raise ValueError('incomplete outfit candidates')
(out/'summary.json').write_text(json.dumps({'verified':2,'models':list(rows.values()),'productionApproved':0},indent=2))
print('R53 cast outfit candidate inventory verified',len(rows))
