from pathlib import Path
from PIL import Image,ImageDraw
import json,hashlib,sys
out=Path(sys.argv[1]);out.mkdir(parents=True,exist_ok=True)
data=json.loads(Path('data/r53-cast-reference-map.json').read_text())
rows=data['castRoster']
assert len(rows)==22 and len({r['id'] for r in rows})==22
assert all(r['sourceVisualInspected'] and not r['allowFinalMeshFit'] for r in rows)
assert all(r.get('sourceConflict') for r in rows if r['sourceVisualStatus']=='identity-conflict-hold')
canvas=Image.new('RGB',(1320,((len(rows)+5)//6)*270),(24,30,38));d=ImageDraw.Draw(canvas)
for i,r in enumerate(rows):
 p=Path(r['referencePath']);raw=p.read_bytes()
 assert hashlib.sha1(('blob '+str(len(raw))+'\0').encode()+raw).hexdigest()==r['referenceGitBlob'],r['id']
 im=Image.open(p).convert('RGB');im.thumbnail((210,238))
 x=i%6*220;y=i//6*270
 canvas.paste(im,(x+(220-im.width)//2,y))
 d.text((x+8,y+242),r['id'],fill=(245,245,245))
 r['referenceSHA256']=hashlib.sha256(raw).hexdigest()
canvas.save(out/'all-22-original-references.jpg',quality=94)
(out/'cast-roster-audit.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2))
(out/'source-conflicts.json').write_text(json.dumps(data['sourceConflicts'],ensure_ascii=False,indent=2))
print('Verified 22 actor reference files; source visual conflicts held, '+str(len(data['references']))+' annotated; final mesh approval remains separate.')
