import sys,json,hashlib
from pathlib import Path
from PIL import Image,ImageDraw
src,out=map(Path,sys.argv[1:]);out.mkdir(parents=True,exist_ok=True)
expected={f'male_continuous_{i:02d}' for i in range(1,11)}
models={};errors=[]
for p in src.glob('*/report.json'):
    try:
        m=json.loads(p.read_text());i=m['id']
        if i not in expected or i in models:raise ValueError('invalid or duplicate identity')
        b=(p.parent/(i+'_wig.glb')).read_bytes()
        if hashlib.sha256(b).hexdigest()!=m['sha256'] or b[:4]!=b'glTF' or int.from_bytes(b[8:12],'little')!=len(b):raise ValueError('GLB failed')
        if m['newFaceFlips'] or m['collapsed'] or m['G5VisualApproval'] or m['G3CollisionApproval']:raise ValueError('geometry/approval failed')
        if m['after']['penetrationProxy']>m['before']['penetrationProxy']+1e-9:raise ValueError('penetration regression')
        for state in ('before','after','wig'):
            for angle in ('front','left','right','rear','crown'):
                with Image.open(p.parent/f'{i}_{state}_{angle}.png') as im:im.verify()
        models[i]=(m,p.parent)
    except Exception as e:errors.append({'file':str(p),'error':str(e)})
for angle in ('front','left','right','rear','crown'):
    canvas=Image.new('RGB',(4*240,5*262),(28,32,40));d=ImageDraw.Draw(canvas)
    for n,i in enumerate(sorted(expected)):
        x=(n%2)*480;y=(n//2)*262
        if i not in models:d.text((x+8,y+100),i+' MISSING',fill=(255,100,100));continue
        for j,state in enumerate(('before','after')):
            im=Image.open(models[i][1]/f'{i}_{state}_{angle}.png').convert('RGB');im.thumbnail((240,240))
            canvas.paste(im,(x+j*240,y));d.text((x+j*240+8,y+243),i[-2:]+' '+state,fill=(235,235,235))
    canvas.save(out/(angle+'_comparison.jpg'),quality=90)
rows=[m for m,p in models.values()]
report={'target':10,'verified':len(rows),'improved':sum(m['geometryImproved'] for m in rows),'missing':sorted(expected-set(models)),'errors':errors,'visualApproved':0,'collisionApproved':0,'models':rows}
(out/'summary.json').write_text(json.dumps(report,indent=2))
print('R53 local wig verified',len(rows),'improved',report['improved'],'of 10')
if set(models)!=expected or errors:raise SystemExit(1)
