import sys,json,hashlib,shutil
from pathlib import Path
mode=sys.argv[1];root,castplan,mobplan,out=map(Path,sys.argv[2:])
out.mkdir(parents=True,exist_ok=True);(out/'assets').mkdir(exist_ok=True)
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def read(p):return json.loads(p.read_text())
def tris(p):
    raw=p.read_bytes();g=json.loads(raw[20:20+int.from_bytes(raw[12:16],'little')])
    if len(g.get('skins',[]))!=1:raise ValueError('shared rig '+str(p))
    return sum(g['accessors'][q['indices']]['count']//3 if 'indices' in q else g['accessors'][q['attributes']['POSITION']]['count']//3 for m in g['meshes'] for q in m['primitives'] if q.get('mode',4)==4)
def entry(i,level,p,h,t):
    if sha(p)!=h:raise ValueError('source SHA mismatch '+str(p))
    d=out/'assets'/(i+'_'+level+'.glb');shutil.copyfile(p,d)
    return {'path':'assets/'+d.name,'sha256':h,'triangles':t,'bytes':d.stat().st_size}
rows=[]
for kind,profiles in [('cast',read(castplan)['models']),('mob',read(mobplan)['mobs'])]:
    for x in profiles:
        i=x['id'];lr=None
        if kind=='mob':
            a=root/'mob'/('r53-mob-assembled-'+i);p=a/(i+'_assembled.glb');ar=read(a/'assembly-report.json')
            l=root/'moblod'/('r53-mob-lod-'+i);lr=read(l/'mob-lod-report.json')
        elif mode=='updated':
            a=root/'quality'/('r53-cast-quality-'+i);p=a/(i+'_assembled.glb');ar=read(a/'assembly-report.json')
            l=root/'castlod'/('r53-cast-lod-'+i);lr=read(l/'cast-lod-report.json')
        elif x['sourceKind']=='age':
            a=root/'age';p=a/'garan_age_candidate.glb';ar=read(a/'age-geometry-report.json')
        elif x['sourceKind']=='fifth':
            a=root/'fifth';p=a/(i+'_fifth_candidate.glb');ar=read(a/'fifth-report.json')
        else:
            a=root/x['sourceKind']/('r53-cast-'+x['sourceKind']+'-candidate-'+i)/'assembly';p=a/(i+'_assembled.glb');ar=read(a/'assembly-report.json')
        if ar['id']!=i or not ar['roundTrip'] or len(ar['morphs'])!=13 or len(ar['clips'])!=10:raise ValueError('source identity or inventory '+i)
        if lr is not None and (lr['id']!=i or lr['sourceSHA256']!=ar['sha256']):raise ValueError('LOD provenance '+i)
        levels={'lod0':entry(i,'lod0',p,ar['sha256'],lr['lod0']['triangles'] if lr else tris(p))}
        if lr is not None:
            for m in lr['levels']:
                levels[m['level']]=entry(i,m['level'],l/(i+'_'+m['level']+'.glb'),m['sha256'],m['triangles'])
            if len(levels)!=3 or not 0<levels['lod2']['triangles']<levels['lod1']['triangles']<levels['lod0']['triangles']:raise ValueError('LOD ordering '+i)
        rows.append({'id':i,'label':x['label'],'age':x['age'],'build':x['build'],'group':kind,'levels':levels,'morphs':ar['morphs'],'clips':ar['clips'],'productionApproved':False})
        if i=='commander-male':
            for n in ('ATTRIBUTION.md','ARMOR-LICENSE.txt'):shutil.copyfile(a/n,out/n)
expected=126 if mode=='updated' else 82
if len(rows)!=42 or len({x['id'] for x in rows})!=42 or sum(len(x['levels']) for x in rows)!=expected:raise ValueError('roster')
(out/'manifest.json').write_text(json.dumps({'classification':'all 42 provisional review models, not release approved','mode':mode,'models':rows},ensure_ascii=False,indent=2))
(out/'START.txt').write_text('Extract all files. In this folder run python3 -m http.server 8765, then open http://localhost:8765/ in a browser. No production deployment.\n',encoding='utf8')
print('R53 packed',len(rows),'models',expected,'GLBs')
