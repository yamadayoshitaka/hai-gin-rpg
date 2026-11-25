"""Validate original story assets and create evidence sheets without relabelling crops as new references."""
import sys,json,hashlib,math
from pathlib import Path
from PIL import Image,ImageOps,ImageDraw
root,planfile,out=map(Path,sys.argv[1:]);out.mkdir(parents=True,exist_ok=True)
plan=json.loads(planfile.read_text());source=json.loads((root/'data/r53-cast-reference-map.json').read_text())
annotations={x['id']:x for x in source['references']}
rows=[];thumbs=[]
def sha(b):return hashlib.sha256(b).hexdigest()
for x in plan['cast']:
    i=x['id'];p=root/x['referencePath'];raw=p.read_bytes()
    blob=hashlib.sha1(('blob '+str(len(raw))+'\0').encode()+raw).hexdigest()
    if blob!=x['referenceGitBlob']:raise ValueError('story source changed '+i)
    im=Image.open(p).convert('RGB');im.save(out/(i+'_original.png'))
    a=annotations.get(i);observed={};estimate={};crop=None
    if a:
        crop=a['crop'];w,h=im.size
        if list(im.size)!=a['size'] or not(0<=crop[0]<crop[2]<=w and 0<=crop[1]<crop[3]<=h):raise ValueError('annotation bounds '+i)
        ci=im.crop(tuple(crop));d=ImageDraw.Draw(ci)
        for name,pt in a['points'].items():
            if not (0<=pt[0]<w and 0<=pt[1]<h):raise ValueError('landmark outside source '+i)
            # Garan's chin is explicitly hidden by beard, therefore estimate.
            bucket=estimate if i=='garan' and name=='chin' else observed
            bucket[name]={'xy_px':pt,'confidence':'approximate visual annotation; nonorthographic'}
            xx,yy=pt[0]-crop[0],pt[1]-crop[1]
            col='#ffb44a' if bucket is estimate else '#5dffb2'
            d.ellipse((xx-3,yy-3,xx+3,yy+3),outline=col,width=2)
            d.text((xx+4,yy-7),name,fill=col,stroke_width=1,stroke_fill='black')
        ci.save(out/(i+'_landmarks.png'))
    row={**x,'sourceSHA256':sha(raw),'dimensions_px':list(im.size),'sourceCrop_px':crop,'observedApproximate':observed,'estimated':estimate,'camera':'nonorthographic or uncalibrated','missingIndependentViews':plan['referenceViewsRequired'],'finalMeshFitAllowed':False}
    (out/(i+'_reference.json')).write_text(json.dumps(row,ensure_ascii=False,indent=2))
    rows.append(row)
    thumb=ImageOps.contain(im,(200,235));tile=Image.new('RGB',(220,280),'#202630');tile.paste(thumb,((220-thumb.width)//2,8))
    d=ImageDraw.Draw(tile);d.text((8,249),i,fill='white');d.text((8,263),'HOLD' if x['sourceConflict'] else 'PROVISIONAL',fill='#ffb44a')
    thumbs.append(tile)
sheet=Image.new('RGB',(220*4,280*math.ceil(len(thumbs)/4)),'#141922')
for j,t in enumerate(thumbs):sheet.paste(t,((j%4)*220,(j//4)*280))
sheet.save(out/'cast-source-contact-sheet.png')
(out/'reference-inventory.json').write_text(json.dumps({'target':22,'verifiedSourceFiles':len(rows),'approximateAnnotated':len(annotations),'independentTurnaroundComplete':0,'rows':rows},ensure_ascii=False,indent=2))
if len(rows)!=22:raise ValueError('cast count')
print('R53 original cast source files verified',len(rows),'approximate landmark sets',len(annotations))
