"""Verify the generated age studies and preserve partial results."""
from pathlib import Path
from PIL import Image,ImageDraw
import json,hashlib,sys
root,out=map(Path,sys.argv[1:]);out.mkdir(parents=True,exist_ok=True)
ages=('under10','teens','20s','30s','40s','50s','60s','70s','80plus')
builds=('slim','normal','muscular','chubby','obese')
sexes=('female','male')
expected={f'{s}_{a}_{b}' for s in sexes for a in ages for b in builds}
valid={};errors=[]
for p in root.glob('*/body-candidates.json'):
    data=json.loads(p.read_text())
    errors.extend(data.get('failures',[]))
    for m in data['models']:
        i=m['id']
        try:
            assert i in expected and i not in valid
            assert hashlib.sha256((p.parent/(i+'.glb')).read_bytes()).hexdigest()==m['sha256']
            assert m['new_face_flips']==0 and m['collapsed']==0
            assert m['visualApproved'] is False and m['skeletalAgeApproved'] is False
            for v in ('front','side','45'):
                with Image.open(p.parent/(i+'_'+v+'.png')) as im: im.verify()
            valid[i]=(m,p.parent)
        except Exception as e: errors.append({'id':i,'error':str(e) or 'failed verification'})
for sex in sexes:
    for view in ('front','side','45'):
        canvas=Image.new('RGB',(1250,9*210),(25,29,36));d=ImageDraw.Draw(canvas)
        for y,a in enumerate(ages):
            for x,b in enumerate(builds):
                i=f'{sex}_{a}_{b}';ox=x*250;oy=y*210
                if i in valid:
                    im=Image.open(valid[i][1]/(i+'_'+view+'.png')).convert('RGB');im.thumbnail((245,185))
                    canvas.paste(im,(ox+(250-im.width)//2,oy))
                else:d.text((ox+8,oy+80),'MISSING',fill=(255,100,100))
                d.text((ox+8,oy+190),f'{a} / {b}',fill=(235,235,235))
        canvas.save(out/f'{sex}_{view}_matrix.jpg',quality=92)
report={'target':90,'verified':len(valid),'missing':sorted(expected-valid.keys()),'errors':errors,'visualApproved':0,'classification':'body candidates, not final characters','models':[v[0] for v in valid.values()]}
(out/'inventory.json').write_text(json.dumps(report,indent=2))
print('Verified',len(valid),'of 90 candidate body studies')
if len(valid)!=90 or errors:raise SystemExit(1)
