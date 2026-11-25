import sys,json,hashlib
from pathlib import Path
from PIL import Image
src,out=map(Path,sys.argv[1:]);out.mkdir(parents=True,exist_ok=True)
expected={'commander-male','garan'};rows={}
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
for p in src.glob('*/assembly/assembly-report.json'):
    r=json.loads(p.read_text());i=r['id'];root=p.parent.parent
    if i not in expected or i in rows:raise ValueError('unexpected identity')
    if sha(p.parent/(i+'_assembled.glb'))!=r['sha256'] or r['rigCount']!=1 or not r['roundTrip'] or len(r['morphs'])!=13 or len(r['clips'])!=10 or len(r['samples'])!=30:raise ValueError('assembly inventory')
    if r['visualApproved'] or r['productionApproved'] or r['skinMaskApplied']:raise ValueError('invalid approval state')
    w=json.loads((root/'wig/wig-fit-report.json').read_text())['models'][0]
    m=json.loads((root/'motion/motion-report.json').read_text())
    g=json.loads((root/'third/motion-garment-report.json').read_text())
    if r['wigSHA256']!=w['sha256'] or r['motionSHA256']!=m['sha256'] or r['garmentSHA256']!=g['garmentSHA256'] or len(g['samples'])!=51:raise ValueError('source provenance')
    if len(list(p.parent.glob('*.png')))!=18 or not (p.parent/'ATTRIBUTION.md').is_file():raise ValueError('missing visual evidence')
    for f in p.parent.glob('*.png'):
        with Image.open(f) as im:im.verify()
    rows[i]=r
if set(rows)!=expected:raise ValueError('incomplete named cast assembly')
(out/'summary.json').write_text(json.dumps({'provisionalMaleAssemblies':len(rows),'castTarget':22,'models':list(rows.values()),'finalIdentityApproved':0,'femaleR6Replaced':False,'beardApproved':False,'armorApproved':False,'productionApproved':False},indent=2))
print('R53 provisional named male assemblies',len(rows))
