import json,hashlib,shutil,sys
from pathlib import Path
from PIL import Image
root,out=map(Path,sys.argv[1:3]);out.mkdir(parents=True,exist_ok=True)
CURRENT=45762954201;PREVIOUS=45759294848;ORIGINAL=45746728837
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def copyimg(src,dest):
    with Image.open(src) as im:im.verify()
    dest.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(src,dest)
def copyglb(src,dest,h):
    if not h or sha(src)!=h:raise RuntimeError('GLB hash '+str(src))
    raw=src.read_bytes()
    if raw[:4]!=b'glTF':raise RuntimeError('GLB header')
    g=json.loads(raw[20:20+int.from_bytes(raw[12:16],'little')])
    if not g.get('skins') or not g.get('meshes'):raise RuntimeError('GLB inventory '+str(src))
    shutil.copyfile(src,dest);return {'path':dest.relative_to(out).as_posix(),'sha256':h}
models={};names=None
for i in ('commander-male','commander-female'):
    a=root/'new'/('r53-hero-master-head-'+i);p=root/'previous'/('r53-hero-master-head-'+i);b=root/'old'/('r53-hero-anatomy-'+i)
    d=out/'assets'/i;d.mkdir(parents=True,exist_ok=True)
    nr=json.loads((a/'master-head-report.json').read_text());pr=json.loads((p/'master-head-report.json').read_text());orr=json.loads((b/'anatomy-report.json').read_text())
    for r in (nr,pr):
        if r['id']!=i or orr['id']!=i or r['sourceSHA256']!=orr['sha256'] or not r['roundTrip'] or not orr['roundTrip'] or r['productionApproved']:raise RuntimeError('provenance '+i)
    if set(nr.get('irisSurfaceFit',{}))!={'L','R'} or any(v['visibleIrisSamples']<5 for v in nr['irisSurfaceFit'].values()):raise RuntimeError('iris visibility '+i)
    centers=nr['targetEyeCenters_m']
    if any(len(centers[k])!=3 for k in ('L','R')):raise RuntimeError('eye landmarks')
    def gltf(q):return [q[0],q[2],-q[1]]
    x=models[i]={'eyeCenters':{k:gltf(centers[k]) for k in ('L','R')},'irisVisible':{k:v['visibleIrisSamples'] for k,v in nr['irisSurfaceFit'].items()}}
    ns=[v['name'] for v in nr['morphs']]
    if len(ns)!=13 or (names is not None and names!=ns):raise RuntimeError('morph inventory')
    names=ns
    for v,src,h in [('old',b/(i+'_anatomy_candidate.glb'),orr['sha256']),('previous',p/(i+'_master_head.glb'),pr['sha256']),('new',a/(i+'_master_head.glb'),nr['sha256'])]:
        x[v]=copyglb(src,d/(v+'.glb'),h)
    for ver,folder,rep in [('previous',p,pr),('latest',a,nr)]:
        for fn in ('master','original','with_old_hair'):
            for view in ('front','left','right','rear','crown'):
                copyimg(folder/(fn+'_'+view+'.png'),d/ver/(fn+'_'+view+'.png'))
        for name in names:copyimg(folder/('expression_'+name+'.png'),d/ver/('expression_'+name+'.png'))
        hr=json.loads((folder/'fitted-hair-study'/'fitted-hair-report.json').read_text())
        if hr['id']!=i or hr['productionApproved']:raise RuntimeError('hair provenance')
        for view in ('front','left','right','rear','crown'):
            copyimg(folder/'fitted-hair-study'/('fitted_hair_'+view+'.png'),d/ver/('hair_'+view+'.png'))
        ar=json.loads((folder/'continuous-neck-study'/'continuous-neck-report.json').read_text())
        if not ar.get('continuousNeckCandidate') or not ar.get('exportInventoryVerified') or ar['productionApproved'] or ar['seamBadEdges'] or any(ar['morphBridgeDefects'].values()):raise RuntimeError('neck validation '+i+' '+ver)
        for fn in ('full_front','full_side','neck_front','neck_side','neck_rear'):
            copyimg(folder/'continuous-neck-study'/(fn+'.png'),d/ver/(fn+'.png'))
        if rep.get('studioReview',{}).get('status')!='rendered':raise RuntimeError('studio unavailable')
        for fn in ('studio_front','studio_threequarter'):copyimg(folder/'studio-review'/(fn+'.png'),d/ver/(fn+'.png'))
        if ver=='latest':
            x['hair']=copyglb(folder/'fitted-hair-study'/(i+'_fitted_hair_head.glb'),d/'hair.glb',hr['sha256'])
            x['full']=copyglb(folder/'continuous-neck-study'/(i+'_continuous_neck.glb'),d/'full.glb',ar['sha256'])
            # Preserve the existing public verification path.
            copyimg(folder/'master_front.png',d/'master_front.png')
            x['neck']={'triangles':ar['bridgeTriangles'],'badEdges':ar['seamBadEdges']}
    x['clips']=nr['clips']
(out/'manifest.json').write_text(json.dumps({'sourceRun':CURRENT,'previousRun':PREVIOUS,'originalRun':ORIGINAL,'models':models,'morphs':names,'productionApproved':False},ensure_ascii=False,indent=2))
for f in ('index.html','viewer.mjs'):shutil.copyfile(Path('review-tools/r53-hero-online')/f,out/f)
print('R53 latest comparison: 10 actual GLBs, paired source renders, iris and seam evidence, review only')
