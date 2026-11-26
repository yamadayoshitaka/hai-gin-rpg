import sys,json,hashlib
from pathlib import Path
root,plan,out=map(Path,sys.argv[1:4]);i=sys.argv[4]
row=next(x for x in json.loads(plan.read_text())['models'] if x['id']==i);a=row['sourceRecord'];p=root/a['path'];raw=p.read_bytes()
if hashlib.sha1(('blob '+str(len(raw))+'\0').encode()+raw).hexdigest()!=a['blob']:raise ValueError('reference Git hash')
out.mkdir(parents=True,exist_ok=True)
(out/'reference.json').write_text(json.dumps({'id':i,'sourceSHA256':hashlib.sha256(raw).hexdigest(),'sourceRecord':a,'referenceUsedForFaceFit':False,'protectedR6Used':False,'finalFitAllowed':False,'independentTurnaroundComplete':False,'sexIsDesignEstimate':row['sexIsDesignEstimate'],'ageIsDesignEstimate':True},ensure_ascii=False,indent=2))
print('R53 source recorded, NOT used as face fit',i)
