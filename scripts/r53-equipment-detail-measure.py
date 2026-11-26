"""Detailed actual-mesh measurement and equipment ledger; no fabricated semantics."""
import sys,json,hashlib,zipfile,struct,math,html
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw
src,reg,out=map(Path,sys.argv[1:4]);out.mkdir(parents=True,exist_ok=True)
for x in ('measurements','images'):(out/x).mkdir(exist_ok=True)
catalog=json.loads(reg.read_text());manifest=json.loads((src/'parts-manifest.json').read_text())
def decode(g,b,k):
    a=g['accessors'][k];dt=np.dtype({5121:'u1',5123:'<u2',5125:'<u4',5126:'<f4'}[a['componentType']]);w={'SCALAR':1,'VEC3':3}[a['type']]
    if 'sparse' in a:raise ValueError('sparse base positions/indices')
    v=g['bufferViews'][a['bufferView']]
    return np.ndarray((a['count'],w),dtype=dt,buffer=b,offset=v.get('byteOffset',0)+a.get('byteOffset',0),strides=(v.get('byteStride',dt.itemsize*w),dt.itemsize)).copy()
def load(path):
    raw=path.read_bytes();assert raw[:4]==b'glTF';n=struct.unpack_from('<I',raw,12)[0];g=json.loads(raw[20:20+n]);b=raw[28+n:]
    world={}
    def visit(i,M):
        x=g['nodes'][i]
        if 'matrix' in x:A=np.array(x['matrix']).reshape(4,4,order='F')
        else:
            a,c,d,w=x.get('rotation',[0,0,0,1]);R=np.array([[1-2*(c*c+d*d),2*(a*c-d*w),2*(a*d+c*w)],[2*(a*c+d*w),1-2*(a*a+d*d),2*(c*d-a*w)],[2*(a*d-c*w),2*(c*d+a*w),1-2*(a*a+c*c)]])
            A=np.eye(4);A[:3,:3]=R@np.diag(x.get('scale',[1,1,1]));A[:3,3]=x.get('translation',[0,0,0])
        world[i]=M@A
        for j in x.get('children',[]):visit(j,world[i])
    for i in g['scenes'][g.get('scene',0)]['nodes']:visit(i,np.eye(4))
    prim=[];mat=g.get('materials',[])
    for i,x in enumerate(g['nodes']):
        if 'mesh' not in x or i not in world:continue
        for j,p in enumerate(g['meshes'][x['mesh']]['primitives']):
            if p.get('mode',4)!=4:raise ValueError('nontriangular primitive')
            P=decode(g,b,p['attributes']['POSITION']).astype(float);M=world[i];P=(P@M[:3,:3].T+M[:3,3])*1000
            T=decode(g,b,p['indices']).ravel().reshape(-1,3) if 'indices' in p else np.arange(len(P)).reshape(-1,3)
            assert np.isfinite(P).all() and T.max()<len(P)
            mt=mat[p['material']] if 'material' in p else {}
            prim.append((x['name'],j,P,T,mt))
    bones={g['nodes'][i]['name']:(world[i][:3,3]*1000).round(4).tolist() for i in set(j for skin in g.get('skins',[]) for j in skin['joints'])}
    return prim,bones,hashlib.sha256(raw).hexdigest()
def arr(a):return np.asarray(a).round(4).tolist()
def bounds(P):return {'min':arr(P.min(0)),'max':arr(P.max(0)),'size':arr(np.ptp(P,axis=0))}
def outline(P):
    a=np.linspace(0,2*np.pi,64,endpoint=False);D=np.column_stack([np.cos(a),np.sin(a)]);ix=np.argmax(P@D.T,axis=0)
    return arr(P[ix])
def sections(P,T):
    tri=P[T];result={}
    for axis in range(3):
        other=[k for k in range(3) if k!=axis];lo,hi=P[:,axis].min(),P[:,axis].max();rows=[]
        for ratio in np.linspace(.025,.975,21):
            z=lo+(hi-lo)*ratio
            S=[]
            for a,b in ((0,1),(1,2),(2,0)):
                A=tri[:,a];B=tri[:,b];d=A[:,axis]-z;e=B[:,axis]-z;sel=(d*e<0)
                if sel.any():
                    q=A[sel]+(B[sel]-A[sel])*(d[sel]/(d[sel]-e[sel]))[:,None];S.append(q[:,other])
            if S:
                q=np.concatenate(S);rows.append({'positionMm':round(float(z),4),'spanMm':arr(np.ptp(q,axis=0)),'contourSupportMm':outline(q),'intersections':len(q)})
            else:rows.append({'positionMm':round(float(z),4),'spanMm':None,'contourSupportMm':None,'intersections':0})
        result['XYZ'[axis]]={'planeAxes':['XYZ'[k] for k in other],'samples':rows}
    return result
views={'front':([1,0,0],[0,1,0]),'rear':([-1,0,0],[0,1,0]),'left':([0,0,1],[0,1,0]),'right':([0,0,-1],[0,1,0]),'top':([1,0,0],[0,0,-1]),'bottom':([1,0,0],[0,0,1]),'front_left_45':([.70710678,0,.70710678],[0,1,0]),'front_right_45':([.70710678,0,-.70710678],[0,1,0]),'rear_left_45':([-.70710678,0,.70710678],[0,1,0])}
def analyze(P,T):
    c=P[T];n=np.cross(c[:,1]-c[:,0],c[:,2]-c[:,0]);a=np.linalg.norm(n,axis=1)/2;valid=a>1e-10
    if not valid.any():raise ValueError('no triangle area')
    unit=n[valid]/(2*a[valid,None]);angs=np.degrees(np.arccos(np.clip(np.abs(unit),0,1)))
    ang=[{'axis':'XYZ'[k],'areaWeightedMeanDeg':round(float(np.average(angs[:,k],weights=a[valid])),3),'minDeg':round(float(angs[:,k].min()),3),'maxDeg':round(float(angs[:,k].max()),3)} for k in range(3)]
    return {'boundsMm':bounds(P),'vertices':len(P),'triangles':len(T),'surfaceAreaMm2':round(float(a.sum()),3),'surfaceNormalAngles':ang,'sections':sections(P,T),'projectedOuterSupportMm':{k:outline(P@np.array(v).T) for k,v in views.items()}}
def render(P,T,path):
    canvas=Image.new('RGB',(900,960),'#20252c');draw=ImageDraw.Draw(canvas);scale=max(np.ptp(P,axis=0))*1.12
    for i,(label,v) in enumerate(views.items()):
        x=(i%3)*300;y=(i//3)*320;q=P@np.array(v).T;center=(q.min(0)+q.max(0))/2
        qq=(q-center)*260/scale;qq[:,0]+=x+150;qq[:,1]=y+170-qq[:,1]
        draw.rectangle((x+2,y+2,x+297,y+317),fill='#d9e0e5');draw.text((x+9,y+7),label,fill='#20252c')
        # Solid projected triangle coverage, no fabricated material or lighting.
        for t in T:draw.polygon([tuple(p) for p in qq[t]],fill='#53677e')
        ss=outline(q)
        for p in np.asarray(ss):
            u=(p-center)*260/scale;cx=x+150+u[0];cy=y+170-u[1];draw.ellipse((cx-1.7,cy-1.7,cx+1.7,cy+1.7),fill='#ffab43')
    canvas.save(path)
rows=[];refs=manifest['parts']+manifest['rigidItems']
for ref in refs:
    id=ref['id'];prim,bones,h=load(src/ref['file']);assert h==ref['sha256']
    P=np.concatenate([x[2] for x in prim]);ts=[];n=0;details=[]
    for name,j,Q,F,mat in prim:
        ts.append(F+n);n+=len(Q)
        details.append({'node':name,'primitive':j,'material':mat.get('name'),'materialFactors':mat.get('pbrMetallicRoughness',{}),'measurements':analyze(Q,F)})
    T=np.concatenate(ts);d={'id':id,'sourceSHA256':h,'unit':'mm','meshSpace':'GLB world rest positions','measurements':analyze(P,T),'primitives':details,'jointCentersMm':bones if id=='body_core' else {},'attachment':ref.get('attachment'),'dominantBones':ref.get('geometry'),'socket':ref.get('socket'),'localTransform':ref.get('localTransform'),'semanticTargetsStatus':'unmeasured unless explicit approved design annotations exist','limitations':['contours are directional support samples, not complete concave outlines','section span is outside extent, not wall thickness','normal angles are relative to global axes, not named anatomical angles','pose collisions and grip fit not tested','images are orthographic geometry silhouettes, not approved 2D designs']}
    (out/'measurements'/(id+'.json')).write_text(json.dumps(d,ensure_ascii=False,separators=(',',':')))
    render(P,T,out/'images'/(id+'.png'));rows.append({'id':id,'kind':ref.get('kind','weapon' if id=='Sword_Bronze' else 'armor' if id=='Shield_Wooden' else 'accessory'),'sizeMm':d['measurements']['boundsMm']['size'],'vertices':len(P),'triangles':len(T),'sectionPlanes':63,'projectedSamples':576,'sourceSHA256':h,'measurementReport':'measurements/'+id+'.json','image':'images/'+id+'.png','fitApproved':False})
assert len(rows)==20 and len({r['id'] for r in rows})==20
catalog['measuredParts']=rows;catalog['actualMeshMeasurementsComplete']=True;catalog['semanticDesignMeasurementsComplete']=False;catalog['sockets']=manifest['sockets']
(out/'equipment-ledger.json').write_text(json.dumps(catalog,ensure_ascii=False,indent=2))
cards=[]
for r in rows:
    id=html.escape(r['id']);cards.append('<article><h2>'+id+'</h2><p>'+html.escape(r['kind'])+' / XYZ mm: '+str(r['sizeMm'])+'</p><img loading="lazy" src="'+r['image']+'"><p><a href="'+r['measurementReport']+'">断面・輪郭・角度・材質 JSON</a></p></article>')
(out/'index.html').write_text('<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>灰銀 装備採寸台帳</title><style>body{font:15px system-ui;background:#eef1f6;color:#25303c;margin:auto;max-width:1000px;padding:12px}article{background:white;padding:14px;margin:12px 0;border-radius:9px}h2{font-size:18px}img{width:100%;max-width:660px}a{color:#1e5ca3}</style><h1>装備・素体 詳細採寸台帳</h1><p>20 GLBの実メッシュ。断面・輪郭は幾何計測、未採寸の意匠や装着角度とは区別。<a href="equipment-ledger.json">台帳 JSON</a></p>'+''.join(cards),encoding='utf8')
print('R53 detailed actual geometry verified',len(rows),'parts; semantic design fitting remains unapproved')
