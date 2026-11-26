import sys,json,hashlib
from pathlib import Path
from PIL import Image
root,plan,out=map(Path,sys.argv[1:4]);i=sys.argv[4]
row=next(x for x in json.loads(plan.read_text())['models'] if x['id']==i);a=row['reference'];p=root/a['path'];raw=p.read_bytes()
if hashlib.sha1(('blob '+str(len(raw))+'\0').encode()+raw).hexdigest()!=a['blob']:raise ValueError('reference Git hash')
im=Image.open(p)
if list(im.size)!=a['size']:raise ValueError('reference size')
out.mkdir(parents=True,exist_ok=True)
im.convert('RGB').save(out/'source.png')
(out/'reference.json').write_text(json.dumps({'id':i,'sourceSHA256':hashlib.sha256(raw).hexdigest(),'annotation':a,'observedPixelsApproximate':a['points'],'independentTurnaroundComplete':False,'ageAndDepthEstimated':True,'protectedR6Used':False,'finalFitAllowed':False},ensure_ascii=False,indent=2))
print('R53 female original source verified',i)
