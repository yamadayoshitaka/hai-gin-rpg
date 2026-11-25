import json,sys,hashlib,shutil
from pathlib import Path
from PIL import Image,ImageDraw
old,new,out=map(Path,sys.argv[1:]);out.mkdir(parents=True,exist_ok=True)
ids=range(1,11);target={1,2,5,7};rows=[];errors=[]
for i in ids:
    ident=f'male_continuous_{i:02d}'
    try:
        p=old/f'r53-local-wig-{i}';m=json.loads((p/'report.json').read_text())
        def verify(folder,rec):
            if rec['id']!=ident or rec['newFaceFlips'] or rec['collapsed'] or rec['G5VisualApproval'] or rec['G3CollisionApproval']:raise ValueError('invalid record')
            glb=folder/(ident+'_wig.glb');b=glb.read_bytes()
            if b[:4]!=b'glTF' or int.from_bytes(b[8:12],'little')!=len(b) or hashlib.sha256(b).hexdigest()!=rec['sha256']:raise ValueError('GLB integrity')
            for state in ('before','after','wig'):
                for view in ('front','left','right','rear','crown'):
                    with Image.open(folder/f'{ident}_{state}_{view}.png') as im:im.verify()
        verify(p,m);chosen=p;final=m;decision='retain previous'
        if i in target:
            q=new/f'r53-wig-refine-{i}';n=json.loads((q/'report.json').read_text());verify(q,n)
            if n['priorWigSHA256']!=m['sha256'] or n['bodySHA256']!=m['bodySHA256']:raise ValueError('source mismatch')
            if n['geometryImproved'] and n['after']['penetrationProxy']<n['before']['penetrationProxy'] and n['after']['deepPenetrationProxy']<=n['before']['deepPenetrationProxy']:
                chosen=q;final=n;decision='second-pass candidate'
        dest=out/ident;dest.mkdir(exist_ok=True)
        for f in chosen.iterdir():
            if f.suffix in ('.glb','.png','.json','.md'):shutil.copy2(f,dest/f.name)
        rows.append({'id':ident,'decision':decision,'firstPass':m['after'],'final':final['after'],'sha256':final['sha256'],'visualApproved':False})
    except Exception as e:errors.append({'id':ident,'error':str(e)})
(out/'inventory.json').write_text(json.dumps({'models':rows,'errors':errors,'visualApproved':0,'secondPassAdopted':sum(r['decision']=='second-pass candidate' for r in rows)},indent=2))
print('Selected',len(rows),'of 10', 'second pass adopted',sum(r['decision']=='second-pass candidate' for r in rows))
if errors or len(rows)!=10:raise SystemExit(1)
