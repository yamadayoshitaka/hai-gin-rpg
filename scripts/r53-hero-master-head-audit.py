import sys,json,hashlib
from pathlib import Path
from PIL import Image
root,out=map(Path,sys.argv[1:3]);out.mkdir(parents=True,exist_ok=True);rows=[]
ids=sys.argv[3:] or ['commander-male','commander-female']
for i in ids:
    a=root/('r53-hero-master-head-'+i);p=a/(i+'_master_head.glb');r=json.loads((a/'master-head-report.json').read_text())
    if r['id']!=i or r['sha256']!=hashlib.sha256(p.read_bytes()).hexdigest() or not r['roundTrip'] or r['productionApproved'] or r['protectedR6Used']:raise ValueError('source/approval')
    if r['eyeMeshes']!=4 or len(r['morphs'])!=13 or len(r['clips'])!=10 or any(m['newDefects'] for m in r['morphs']):raise ValueError('inventory')
    imgs=list(a.glob('*.png'))
    if len(imgs)!=28:raise ValueError('render count')
    for f in imgs:
        with Image.open(f) as im:im.verify()
    # Keep numerical and visual approval separate. CI inventory success
    # cannot be interpreted as a visually finished character.
    issues=[]
    seam=r.get('continuousNeckStudy',{})
    if not seam.get('continuousNeckCandidate') or not seam.get('exportInventoryVerified') or seam.get('seamBadEdges')!=0 or any(seam.get('morphBridgeDefects',{}).values()):issues.append('neck/body assembly')
    if any(x.get('visibleIrisSamples',0)<20 for x in r.get('irisSurfaceFit',{}).values()) or len(r.get('irisSurfaceFit',{}))!=2:issues.append('iris visibility')
    for n in ('jawOpen','viseme_A','laugh'):
        if r.get('mouthSurfaceDiagnostics',{}).get(n,{}).get('recessedSamples',0)<15:issues.append('insufficient measured mouth opening: '+n)
    if r.get('studioReview',{}).get('status')!='rendered':issues.append('PBR render')
    hair=json.loads((a/'fitted-hair-study'/'fitted-hair-report.json').read_text())
    if hair.get('deepPenetrationProxy',1)>.005:issues.append('hair penetration')
    if i=='commander-female' and not any(x.get('status')=='beveled' for x in seam.get('armorStudy',[])):issues.append('armor refinement')
    for f in ('studio-review/studio_front.png','studio-review/studio_threequarter.png','continuous-neck-study/full_front.png','continuous-neck-study/full_side.png'):
        with Image.open(a/f) as im:im.verify()
    r['completionGate']={'technicalCandidate':not issues,'blockers':issues,'visualApproved':False,'readyForUserAcceptance':False}
    rows.append(r)
(out/'summary.json').write_text(json.dumps({'headCandidates':rows,'productionApproved':0,'allTechnicalCandidates':all(r['completionGate']['technicalCandidate'] for r in rows)},indent=2))
print('R53 master head candidate inventory verified',len(rows))

for r in rows:print('R53 COMPLETION GATE',r['id'],json.dumps(r['completionGate'],ensure_ascii=False))
