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
    # Recession is not an open mouth: a visible contiguous oral lining
    # must be observed by raycasts through the exterior skin.
    for n in ('jawOpen','viseme_A','laugh'):
        m=r.get('mouthSurfaceDiagnostics',{}).get(n,{})
        if m.get('visibleLiningSamples',0)-m.get('neutralVisibleLiningSamples',0)<12 or m.get('centerOpeningHeight_m',0)<.0015:
            issues.append('actual oral opening not established: '+n)
    if r.get('studioReview',{}).get('status')!='rendered':issues.append('PBR render')
    hair=json.loads((a/'fitted-hair-study'/'fitted-hair-report.json').read_text())
    if hair.get('deepPenetrationProxy',1)>.005:issues.append('hair penetration')
    if i=='commander-female' and not any(x.get('status')=='beveled' for x in seam.get('armorStudy',[])):issues.append('armor refinement')
    for f in ('studio-review/studio_front.png','studio-review/studio_threequarter.png','continuous-neck-study/full_front.png','continuous-neck-study/full_side.png'):
        with Image.open(a/f) as im:im.verify()
    # Visible original illustration and explicit annotated evidence.
    ref=json.loads((a/'portrait-landmark-report.json').read_text())
    if ref['pixelLandmarks']<50 or not ref['approximate'] or ref['orthographicFit']:issues.append('portrait provenance')
    from PIL import ImageDraw
    with Image.open(a/'portrait-reference.webp') as im:
        annotated=im.convert('RGB');draw=ImageDraw.Draw(annotated)
        points=json.loads(Path('data/r53-female-portrait-landmarks.json').read_text())['points']
        for idx,(key,(x,y)) in enumerate(points.items(),1):
            draw.ellipse((x-3,y-3,x+3,y+3),fill=(0,220,255),outline=(0,0,0))
            draw.text((x+4,y-7),str(idx),fill=(255,255,255),stroke_width=1,stroke_fill=(0,0,0))
        annotated.save(out/'portrait-annotated.png')
        (out/'portrait-landmark-labels.json').write_text(json.dumps([{'n':idx,'name':k,'xy':v} for idx,(k,v) in enumerate(points.items(),1)],indent=2))
    r['portraitFit']=ref
    nv=json.loads((a/'nine-view-fit-report.json').read_text())
    if nv.get('pointCount',0)<100 or len(nv.get('views',[]))!=9:issues.append('nine-view reference inventory')
    if nv.get('postFitMidlineRms_m',1)>nv.get('preFitMidlineRms_m',0):issues.append('nine-view midline fit regression')
    for v in nv['views']:
        with Image.open(a/'nine-view-review'/(v+'.png')) as im:im.verify()
    r['nineViewFit']=nv
    de=json.loads((a/'detail-face-report.json').read_text())
    if de['pointCount']<250 or len(de.get('actualEyeOpening',{}))!=2 or len(de.get('actualBrowRoots',{}))!=2:issues.append('detail face evidence incomplete')
    r['detailFaceFit']=de
    r['completionGate']={'technicalCandidate':not issues,'blockers':issues,'visualApproved':False,'readyForUserAcceptance':False}
    rows.append(r)
(out/'summary.json').write_text(json.dumps({'headCandidates':rows,'productionApproved':0,'allTechnicalCandidates':all(r['completionGate']['technicalCandidate'] for r in rows)},indent=2))
print('R53 master head candidate inventory verified',len(rows))

for r in rows:print('R53 COMPLETION GATE',r['id'],json.dumps(r['completionGate'],ensure_ascii=False))
