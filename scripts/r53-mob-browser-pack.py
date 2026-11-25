import sys,json,hashlib,shutil
from pathlib import Path
src,lods,plan,out=map(Path,sys.argv[1:])
out.mkdir(parents=True,exist_ok=True);data=out/'assets';data.mkdir(exist_ok=True)
expected={r['id']:r for r in json.loads(plan.read_text())['mobs']}
rows=[]
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
for i,profile in sorted(expected.items()):
    a=src/('r53-mob-assembled-'+i);l=lods/('r53-mob-lod-'+i)
    ar=json.loads((a/'assembly-report.json').read_text());lr=json.loads((l/'mob-lod-report.json').read_text())
    if ar['id']!=i or lr['id']!=i or ar['sha256']!=lr['sourceSHA256']:raise ValueError('source mismatch '+i)
    items=[('lod0',a/(i+'_assembled.glb'),ar['sha256'],lr['lod0']['triangles'])]
    items += [(m['level'],l/(i+'_'+m['level']+'.glb'),m['sha256'],m['triangles']) for m in lr['levels']]
    if len(items)!=3 or not items[0][3]>items[1][3]>items[2][3]>0:raise ValueError('LOD count mismatch')
    files={}
    for level,p,h,t in items:
        if sha(p)!=h:raise ValueError('SHA mismatch '+str(p))
        dest=data/(i+'_'+level+'.glb');shutil.copyfile(p,dest)
        files[level]={'path':'assets/'+dest.name,'sha256':h,'triangles':t,'bytes':dest.stat().st_size}
    rows.append({'id':i,'label':profile['label'],'sex':profile['sex'],'age':profile['age'],'build':profile['build'],'levels':files,'morphs':ar['morphs'],'clips':ar['clips']})
if len(rows)!=20:raise ValueError('incomplete inventory')
shutil.copyfile(src/('r53-mob-assembled-'+rows[0]['id'])/'ATTRIBUTION.md',out/'ATTRIBUTION.md')
(out/'manifest.json').write_text(json.dumps({'classification':'review candidates, not production approved','models':rows},ensure_ascii=False,indent=2))
print('Packed',len(rows),'models and',sum(len(x['levels']) for x in rows),'GLBs')
