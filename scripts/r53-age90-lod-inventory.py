import json,sys,hashlib
from pathlib import Path
src,out=map(Path,sys.argv[1:]);out.mkdir(parents=True,exist_ok=True)
models={};errors=[]
for p in src.glob('*/lod-inventory.json'):
    data=json.loads(p.read_text());errors.extend(data['failures'])
    for m in data['models']:
        i=m['id']
        try:
            if i in models:raise ValueError('duplicate')
            for l in m['levels']:
                path=p.parent/(i+'_'+l['name']+'.glb')
                if hashlib.sha256(path.read_bytes()).hexdigest()!=l['sha256']:raise ValueError('hash mismatch')
            measurements=json.loads((p.parent/(i+'-measurements.json')).read_text())
            if measurements['source_sha256']!=m['sourceSHA256']:raise ValueError('measurement mismatch')
            models[i]=m
        except Exception as e:errors.append({'id':i,'error':str(e)})
expected={f'{s}_{a}_{b}' for s in ('female','male') for a in ('under10','teens','20s','30s','40s','50s','60s','70s','80plus') for b in ('slim','normal','muscular','chubby','obese')}
report={'target':90,'verified':len(models),'lodGenerated':sum(len(m['levels']) for m in models.values()),'missing':sorted(expected-set(models)),'errors':errors,'visualApproved':0,'finalCharacterApproved':0,'models':list(models.values())}
(out/'summary.json').write_text(json.dumps(report,indent=2))
print('R53 base body LOD verified',report['verified'],'of 90')
if set(models)!=expected or errors:raise SystemExit(1)
