import sys,json,hashlib
from pathlib import Path
from PIL import Image
refs,src,plan,out=map(Path,sys.argv[1:]);out.mkdir(parents=True,exist_ok=True)
p=json.loads(plan.read_text());r=json.loads((refs/'reference-inventory.json').read_text())
if r['verifiedSourceFiles']!=22 or r['independentTurnaroundComplete']!=0:raise ValueError('reference inventory')
expected={m['id']:m for m in p['models']};rows={}
for f in src.glob('*/cast-study-report.json'):
    m=json.loads(f.read_text());i=m['id']
    if i not in expected or i in rows or m['bodySource']!=expected[i]['bodySource']:raise ValueError('study identity')
    if hashlib.sha256((f.parent/(i+'.glb')).read_bytes()).hexdigest()!=m['sha256'] or not m['roundTrip'] or m['newFaceFlips'] or m['collapsed'] or m['finalIdentity'] or m['visualApproved']:raise ValueError('invalid study')
    if len(m['renderHashes'])!=11:raise ValueError('render count')
    for tag,h in m['renderHashes'].items():
        q=f.parent/(tag+'.png')
        if hashlib.sha256(q.read_bytes()).hexdigest()!=h:raise ValueError('render sha')
        with Image.open(q) as im:im.verify()
    rows[i]=m
if set(rows)!=set(expected) or len({m['headDisplacementSHA256'] for m in rows.values()})!=len(rows):raise ValueError('missing or duplicate study')
(out/'summary.json').write_text(json.dumps({'castTarget':22,'verifiedSourceFiles':22,'provisionalMaleStudies':len(rows),'finalIdentityApproved':0,'femaleR6Replaced':False,'models':list(rows.values()),'remaining':[x for x in p['cast'] if x['id'] not in rows]},ensure_ascii=False,indent=2))
print('R53 cast provisional studies',len(rows),'of 22; no final identity approvals')
