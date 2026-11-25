"""Verify actual story-art bytes and produce annotated source crops.
All landmarks are approximate image-space observations, never true depth.
"""
from pathlib import Path
from PIL import Image, ImageDraw
import hashlib,json,math,sys
root=Path('.');out=Path(sys.argv[1]);out.mkdir(parents=True,exist_ok=True)
reg=json.loads((root/'data/r53-cast-reference-map.json').read_text())
records=[]
for r in reg['references']:
    p=root/r['path'];b=p.read_bytes()
    assert hashlib.sha1(('blob '+str(len(b))+'\0').encode()+b).hexdigest()==r['blob'],r['id']
    im=Image.open(p).convert('RGB')
    assert list(im.size)==r['size'],(r['id'],im.size,r['size'])
    x0,y0,x1,y1=r['crop']
    assert 0<=x0<x1<=im.width and 0<=y0<y1<=im.height
    crop=im.crop((x0,y0,x1,y1))
    crop.save(out/(r['id']+'-source.png'))
    annotated=crop.copy();d=ImageDraw.Draw(annotated)
    points=r['points']
    for name,(x,y) in points.items():
        assert x0<=x<x1 and y0<=y<y1,(r['id'],name)
        x-=x0;y-=y0;d.ellipse((x-3,y-3,x+3,y+3),fill=(255,60,80),outline=(255,255,255))
        d.text((x+4,y-10),name,fill=(255,255,255),stroke_width=2,stroke_fill=(10,10,10))
    annotated.save(out/(r['id']+'-landmarks.png'))
    pairs=[('nose_tip','mouth_center'),('mouth_center','chin'),('eye_near','nose_tip'),('eye_near','eye_far')]
    distances={a+'__'+b:math.dist(points[a],points[b]) for a,b in pairs if a in points and b in points}
    records.append(dict(id=r['id'],slot=r['slot'],sourceSHA256=hashlib.sha256(p.read_bytes()).hexdigest(),measurements_px=distances,
      projection='unrectified perspective illustration',absolute_mm=None,depth=None,visualApproved=False,meshApplied=False))
assert len({r['id'] for r in records})==len(records)
(out/'image-measurements.json').write_text(json.dumps(dict(revision=reg['revision'],records=records),indent=2))
print('Actual character artwork bytes and landmark crops verified:',len(records))
