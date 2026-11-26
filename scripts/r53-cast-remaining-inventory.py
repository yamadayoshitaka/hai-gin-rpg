import sys,json,hashlib
from pathlib import Path
from PIL import Image
src,out=map(Path,sys.argv[1:]);out.mkdir(parents=True,exist_ok=True)
expected={'iris','shion','kai','leon','fio','edo','mina','noel','raizen','vald','zahar','grad','altea','orphe','meve','vess'};rows={}
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
    study=json.loads((root/'study/cast-study-report.json').read_text())
    ref=json.loads((root/'reference/reference.json').read_text())
    if study['id']!=i or ref['id']!=i or study['protectedR6Used'] or ref['protectedR6Used'] or r['bodySHA256']!=study['sha256'] or study['finalIdentity'] or ref['finalFitAllowed'] or ref['referenceUsedForFaceFit'] or study['referenceUsedForFaceFit']:raise ValueError('reference or source provenance')
    r['headGeometrySHA256']=study['headGeometrySHA256'];r['protectedR6Used']=False
    rows[i]=r
if len({m['headGeometrySHA256'] for m in rows.values()})!=len(rows):raise ValueError('duplicate face geometry')
if set(rows)!=expected:raise ValueError('incomplete named cast assembly')
(out/'summary.json').write_text(json.dumps({'provisionalRemainingAssemblies':len(rows),'castTarget':22,'models':list(rows.values()),'finalIdentityApproved':0,'femaleR6Replaced':False,'beardApproved':False,'armorApproved':False,'productionApproved':False},indent=2))
print('R53 provisional remaining cast assemblies',len(rows))
