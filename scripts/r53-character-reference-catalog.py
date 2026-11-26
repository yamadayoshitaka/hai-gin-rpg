"""Build review-only character catalog from pinned actual GLBs and renders."""
import sys,json,hashlib,html,base64,struct
from pathlib import Path
import numpy as np
from PIL import Image
from io import BytesIO
reg=Path(sys.argv[1]);site=Path(sys.argv[2]);evidence=Path(sys.argv[3]);hero=Path(sys.argv[4]);out=Path(sys.argv[5]);out.mkdir(parents=True,exist_ok=True)
catalog=json.loads(reg.read_text());rows=catalog['characters']
assert len(rows)==42 and len({r['id'] for r in rows})==42
def glb(path):
    raw=path.read_bytes()
    if raw[:4]!=b'glTF':raise ValueError('GLB header '+str(path))
    size=struct.unpack_from('<I',raw,12)[0];g=json.loads(raw[20:20+size]);bin0=raw[28+size:]
    return g,bin0,hashlib.sha256(raw).hexdigest()
def measure(path):
    g,b,sha=glb(path);nodes=g['nodes'];world={}
    def matrix(n):
        if 'matrix' in n:return np.array(n['matrix']).reshape(4,4,order='F')
        x,y,z,w=n.get('rotation',[0,0,0,1]);R=np.array([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]])
        A=np.eye(4);A[:3,:3]=R@np.diag(n.get('scale',[1,1,1]));A[:3,3]=n.get('translation',[0,0,0]);return A
    def visit(i,M):
        A=M@matrix(nodes[i]);world[i]=A
        for j in nodes[i].get('children',[]):visit(j,A)
    for i in g['scenes'][g.get('scene',0)]['nodes']:visit(i,np.eye(4))
    def positions(k):
        a=g['accessors'][k];v=g['bufferViews'][a['bufferView']]
        if a['componentType']!=5126 or a['type']!='VEC3' or a.get('sparse') or v.get('buffer',0)!=0:raise ValueError('unsupported position accessor')
        return np.ndarray((a['count'],3),dtype='<f4',buffer=b,offset=v.get('byteOffset',0)+a.get('byteOffset',0),strides=(v.get('byteStride',12),4)).astype(float)
    parts=[];body=[];hair=[];clothes=[];allp=[]
    def bounds(A):return {'minCm':(A.min(0)*100).round(3).tolist(),'maxCm':(A.max(0)*100).round(3).tolist(),'widthHeightDepthCm':(np.ptp(A,axis=0)*100).round(2).tolist()}
    for i,n in enumerate(nodes):
        if 'mesh' not in n or i not in world:continue
        m=g['meshes'][n['mesh']];P=np.concatenate([positions(p['attributes']['POSITION']) for p in m['primitives']]);A=world[i];P=P@A[:3,:3].T+A[:3,3]
        if not np.isfinite(P).all():raise ValueError('invalid vertices')
        name=n.get('name',m.get('name',''));key=name.lower()
        kind='other'
        if 'hair' in key or 'wig' in key:kind='hair';hair.append(P)
        elif any(x in key for x in ('cloth','armor','garment','plate','outfit','boot','belt')):kind='clothing';clothes.append(P)
        elif 'continuousskin' in key or ('body' in key and not any(x in key for x in ('armor','clothing','belt','outfit'))) or 'humanbase' in key:kind='body';body.append(P)
        allp.append(P);parts.append({'name':name,'kind':kind,**bounds(P)})
    if not allp:raise ValueError('no mesh '+str(path))
    bones={n.get('name'):world[i][:3,3] for i,n in enumerate(nodes) if i in world and n.get('name')}
    def dist(a,b):
        return round(float(np.linalg.norm(bones[a]-bones[b])*100),2) if a in bones and b in bones else None
    joint={key:dist(a,b) for key,a,b in [('shoulderJointSpan','upperarm01.L','upperarm01.R'),('hipJointSpan','upperleg01.L','upperleg01.R'),('upperArmL','upperarm01.L','lowerarm01.L'),('forearmL','lowerarm01.L','wrist.L'),('thighL','upperleg01.L','lowerleg01.L'),('shinL','lowerleg01.L','foot.L'),('eyeCenterDistance','eye.L','eye.R')]}
    return {'sourceSHA256':sha,'axis':'glTF +Y up; exported base vertex geometry and rest node transforms, not posed deformation','unit':'cm','overall':bounds(np.concatenate(allp)),'body':bounds(np.concatenate(body)) if body else None,'hair':bounds(np.concatenate(hair)) if hair else None,'clothing':bounds(np.concatenate(clothes)) if clothes else None,'jointDistancesCm':joint,'parts':parts,'limitations':['body/garment identification by object name; ambiguous meshes are other','pose width is not anatomical shoulder width','joint centers not skin circumference','unavailable values remain null']}
def img(path):
    with Image.open(path) as im:
        im=im.convert('RGB');im.thumbnail((900,1100));q=BytesIO();im.save(q,'JPEG',quality=88)
    return 'data:image/jpeg;base64,'+base64.b64encode(q.getvalue()).decode()
def e(v):return html.escape(str(v))
cards=[]
for r in rows:
    ref=r['modelReference'];isHero=r['id']=='commander-female';root=hero if isHero else evidence;gpath=(hero if isHero else site)/ref['glb'];r['measurements']=measure(gpath)
    if isHero and r['measurements']['sourceSHA256']!=ref['sha256']:raise ValueError('hero SHA')
    if not isHero:
        manifest=json.loads((site/'manifest.json').read_text());expected=next(x for x in manifest['models'] if x['id']==r['id'])['levels']['lod0']['sha256']
        if r['measurements']['sourceSHA256']!=expected:raise ValueError('all42 SHA '+r['id'])
    imgs=[]
    for label,k in [('全身正面','front'),('側面','side'),('背面','rear'),('斜め','threequarter'),('顔','face')]:
        if ref.get(k):imgs.append('<figure><img loading="lazy" src="'+img(root/ref[k])+'"><figcaption>'+label+'</figcaption></figure>')
    d=r['measurements'];b=d['body'];j=d['jointDistancesCm'];table='<table><tr><th>全体幅・高さ・奥行(cm)</th><td>'+e(d['overall']['widthHeightDepthCm'])+'</td></tr><tr><th>素体寸法(cm)</th><td>'+e(b['widthHeightDepthCm'] if b else '未同定')+'</td></tr>'
    for k,v in j.items():table+='<tr><th>'+e(k)+'</th><td>'+e(v if v is not None else '未計測')+'</td></tr>'
    table+='</table>';cards.append('<article data-group="'+e(r['group'])+'" data-search="'+e(r['name']+' '+r['id']+' '+r['role'])+'"><h2>'+e(r['name'])+'</h2><p>'+e(r['role'])+' · '+e(r['id'])+' / 未承認</p><div class="images">'+''.join(imgs)+'</div><details><summary>採寸</summary>'+table+'</details><p>Source run '+e(ref['runId'])+'</p></article>')
(out/'character-catalog.json').write_text(json.dumps(catalog,ensure_ascii=False,indent=2))
(out/'index.html').write_text('''<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>灰銀｜キャラクター基準台帳</title><style>body{font:15px system-ui;background:#eef1f6;color:#243041;margin:0}main{max-width:1100px;margin:auto;padding:16px}article{background:#fff;border:1px solid #cfd8e3;border-radius:10px;padding:12px;margin:10px 0}h2{font-size:18px}.images{display:flex;flex-wrap:wrap;gap:8px}figure{margin:0;max-width:220px;flex:1 1 145px}img{width:100%;height:auto}td,th{padding:6px;border-bottom:1px solid #ddd;text-align:left}input,select{font:inherit;padding:8px}small{color:#54667a}</style><main><h1>灰銀のレゾナンス｜42体 キャラクター基準台帳</h1><p>実3Dモデル・採寸の記録。全て確認用候補。漫画・イベントの正式基準は外観承認後。</p><input id="q" placeholder="名前・ID・役割"><select id="g"><option value="">全員</option><option value="cast">主要人物</option><option value="mob">モブ</option></select>'''+''.join(cards)+'''<p><a href="character-catalog.json">全採寸JSON</a></p></main><script>const q=document.querySelector('#q'),g=document.querySelector('#g');function f(){for(const a of document.querySelectorAll('article'))a.hidden=!(a.dataset.search.includes(q.value)&&(!g.value||a.dataset.group===g.value))}q.oninput=g.onchange=f;</script></html>''',encoding='utf8')
print('R53 catalog registered actual reference images and measured exported geometry',len(rows))
