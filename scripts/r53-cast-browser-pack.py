import sys,json,hashlib,shutil
from pathlib import Path
fifth,age,out=map(Path,sys.argv[1:]);out.mkdir(parents=True,exist_ok=True);(out/'assets').mkdir(exist_ok=True)
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def copy_model(i,level,src,rec):
    if sha(src)!=rec['sha256']:raise ValueError('hash mismatch '+str(src))
    raw=src.read_bytes();g=json.loads(raw[20:20+int.from_bytes(raw[12:16],'little')])
    if len(g.get('skins',[]))!=1:raise ValueError('rig')
    triangles=sum(g['accessors'][p['indices']]['count']//3 if 'indices' in p else g['accessors'][p['attributes']['POSITION']]['count']//3 for m in g['meshes'] for p in m['primitives'] if p.get('mode',4)==4)
    d=out/'assets'/(i+'_'+level+'.glb');shutil.copyfile(src,d)
    return {'path':'assets/'+d.name,'sha256':rec['sha256'],'triangles':triangles,'bytes':d.stat().st_size}
rows=[]
for i,label,yrs,build in [('commander-male','男性主人公','20s','normal'),('garan','ガラン','70s','muscular')]:
    folder=fifth/('r53-cast-fifth-'+i);rec=json.loads((folder/'fifth-report.json').read_text())
    if rec['id']!=i or not rec['roundTrip']:raise ValueError('identity')
    old=copy_model(i,'fifth',folder/(i+'_fifth_candidate.glb'),rec)
    levels={'lod0':old,'fifth':old}
    if i=='garan':
        a=json.loads((age/'age-geometry-report.json').read_text())
        if a['sourceSHA256']!=rec['sha256'] or not a['ageGeometryApplied'] or not a['roundTrip']:raise ValueError('age provenance')
        levels['lod0']=copy_model(i,'age',age/'garan_age_candidate.glb',a)
    rows.append({'id':i,'label':label,'age':yrs,'build':build,'levels':levels,'morphs':rec['morphs'],'clips':rec['clips']})
for name in ('ATTRIBUTION.md','ARMOR-LICENSE.txt'):shutil.copyfile(fifth/'r53-cast-fifth-commander-male'/name,out/name)
(out/'manifest.json').write_text(json.dumps({'classification':'cast review only','models':rows},ensure_ascii=False,indent=2))
print('R53 packed named cast review',len(rows))
