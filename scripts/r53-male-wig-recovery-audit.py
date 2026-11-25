"""Recover verified G0/G1 wig candidates without treating them as visual approvals."""
import sys,json,hashlib,shutil,struct
from pathlib import Path
from PIL import Image
mode,prior,bodies,hairs,out=sys.argv[1:]
prior,bodies,hairs,out=map(Path,(prior,bodies,hairs,out));out.mkdir(parents=True,exist_ok=True)
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
refs={}
for f in bodies.glob('*/integration.json'):
    for m in json.loads(f.read_text())['models']:
        p=f.parent/(m['id']+'.glb')
        if sha(p)!=m['sha256']:raise ValueError('body hash mismatch '+m['id'])
        refs[m['id']]=m
expected={f'male_continuous_{i:02d}' for i in range(1,11)}
if set(refs)!=expected:raise ValueError('body source incomplete')
def verify(folder,m):
    ident=m['id'];i=int(ident[-2:])
    if ident not in expected or m['bodySHA256']!=refs[ident]['sha256']:raise ValueError('wrong body')
    if m['sourceHair']!=f'male_hair_{i:02d}_lod0.glb' or sha(hairs/m['sourceHair'])!=m['sourceHairSHA256']:raise ValueError('wrong hair')
    if m['G0Measured'] is not True or m['G1FitCandidate'] is not True:raise ValueError('missing G0/G1')
    if any(m[k] is not False for k in ('G2MaterialApproval','G3CollisionApproval','G4MobileApproval','G5VisualApproval')):raise ValueError('unexpected approval')
    p=folder/(ident+'_wig.glb');b=p.read_bytes()
    if len(b)<20 or struct.unpack_from('<III',b)!=(0x46546c67,2,len(b)) or sha(p)!=m['sha256']:raise ValueError('invalid GLB')
    files=[p]
    for state in ('bald','fit','wig'):
        for view in ('front','left','right','rear','crown'):
            p=folder/f'{ident}_{state}_{view}.png'
            with Image.open(p) as im:im.verify()
            files.append(p)
    return files
valid={};errors=[]
# Prior reports can be incomplete following a native crash. Validate each completed
# record independently and never copy partial images as a completed candidate.
for f in sorted(prior.glob('*/wig-fit-report.json')):
    try:
        for m in json.loads(f.read_text())['models']:
            try:
                files=verify(f.parent,m);i=m['id']
                if i in valid:raise ValueError('duplicate candidate '+i)
                if f.parent!=out:
                    for p in files:shutil.copy2(p,out/p.name)
                valid[i]=m
            except Exception as e:errors.append(str(e))
    except Exception as e:errors.append(str(e))
shutil.copy2(hairs/'ATTRIBUTION.md',out/'ATTRIBUTION.md')
missing=sorted(expected-set(valid))
(out/'wig-fit-report.json').write_text(json.dumps({'models':list(valid.values()),'missing':missing,'errors':errors,'visualApproved':0,'classification':'G0/G1 candidates only'},indent=2))
if mode=='prepare':
    (out/'missing.txt').write_text('\n'.join(str(int(i[-2:])) for i in missing)+('\n' if missing else ''))
else:
    # Revalidate the final collected outputs after copying, no approval promotion.
    for m in valid.values():verify(out,m)
    if missing or errors:raise SystemExit('Incomplete: '+str(missing)+' '+str(errors))
print('Verified',len(valid),'of 10 wig candidates; missing',missing)
