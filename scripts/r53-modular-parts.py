"""Lossless modular GLB extraction; preserve skin, UVs, morphs, rest transforms."""
import json,struct,hashlib,copy,sys,re,math
from pathlib import Path
import numpy as np
src=Path(sys.argv[1]);out=Path(sys.argv[2]);out.mkdir(parents=True,exist_ok=True)
raw=src.read_bytes()
if raw[:4]!=b'glTF' or struct.unpack_from('<I',raw,4)[0]!=2:raise ValueError('GLB v2 required')
n=struct.unpack_from('<I',raw,12)[0];g=json.loads(raw[20:20+n]);B=raw[28+n:]
assert len(g['skins'])==1 and len(g['buffers'])==1
def sha(x):return hashlib.sha256(x).hexdigest()
def write(path,d,b):
    j=json.dumps(d,separators=(',',':'),ensure_ascii=False).encode();j+=b' '*((-len(j))%4);b+=b'\0'*((-len(b))%4)
    path.write_bytes(struct.pack('<III',0x46546c67,2,28+len(j)+len(b))+struct.pack('<II',len(j),0x4e4f534a)+j+struct.pack('<II',len(b),0x004e4942)+b)
def canonical(x):return json.dumps(x,sort_keys=True,separators=(',',':')).encode()
nodes=g['nodes'];skin=g['skins'][0];joints=skin['joints'];parents={c:i for i,n in enumerate(nodes) for c in n.get('children',[])}
def local(n):
    if 'matrix' in n:return np.array(n['matrix'],float).reshape(4,4,order='F')
    x,y,z,w=n.get('rotation',[0,0,0,1]);R=np.array([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]])
    A=np.eye(4);A[:3,:3]=R@np.diag(n.get('scale',[1,1,1]));A[:3,3]=n.get('translation',[0,0,0]);return A
world={}
def W(i):
    if i not in world:world[i]=(W(parents[i]) if i in parents else np.eye(4))@local(nodes[i])
    return world[i]
def decode_accessor(doc,blob,k):
    a=doc['accessors'][k];dtype={5120:'i1',5121:'u1',5122:'<i2',5123:'<u2',5125:'<u4',5126:'<f4'}[a['componentType']];width={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}[a['type']];dt=np.dtype(dtype)
    def read(v,count,w,t,offset=0):
        v=doc['bufferViews'][v];t=np.dtype(t)
        return np.ndarray((count,w),dtype=t,buffer=blob,offset=v.get('byteOffset',0)+offset,strides=(v.get('byteStride',t.itemsize*w),t.itemsize))
    A=read(a['bufferView'],a['count'],width,dt,a.get('byteOffset',0)).copy() if 'bufferView' in a else np.zeros((a['count'],width),dtype=dt)
    if 'sparse' in a:
        sp=a['sparse'];ix=sp['indices'];va=sp['values'];it={5121:'u1',5123:'<u2',5125:'<u4'}[ix['componentType']]
        ids=read(ix['bufferView'],sp['count'],1,it,ix.get('byteOffset',0)).ravel()
        A[ids]=read(va['bufferView'],sp['count'],width,dt,va.get('byteOffset',0))
    return A
def accessor(k):return decode_accessor(g,B,k)
rigSignature=sha(canonical([(nodes[i].get('name'),nodes[i].get('translation'),nodes[i].get('rotation'),nodes[i].get('scale'),nodes[i].get('matrix'),nodes[parents[i]].get('name') if i in parents else None) for i in joints])+accessor(skin['inverseBindMatrices']).tobytes())
def slots(i):
    n=nodes[i]['name'];k=n.lower()
    if 'continuousskin' in k:return 'body'
    if 'hair' in k or 'wig' in k:return 'hair'
    if 'armor' in k or 'legplate' in k:return 'armor'
    if 'clothing' in k:return 'clothing'
    return 'face'
def measure(i):
    P=[];tot={}
    for p in g['meshes'][nodes[i]['mesh']]['primitives']:
        a=p['attributes'];q=accessor(a['POSITION']);M=W(i);P.append(q@M[:3,:3].T+M[:3,3])
        if 'JOINTS_0' in a and 'WEIGHTS_0' in a:
            jj=accessor(a['JOINTS_0']);ww=accessor(a['WEIGHTS_0'])
            for j,w in zip(jj.ravel(),ww.ravel()):
                tot[int(j)]=tot.get(int(j),0)+float(w)
    A=np.concatenate(P);order=sorted(tot,key=tot.get,reverse=True);total=sum(tot.values())
    return {'boundsMinM':A.min(0).tolist(),'boundsMaxM':A.max(0).tolist(),'sizeCm':(np.ptp(A,axis=0)*100).round(3).tolist(),'dominantBones':[{'bone':nodes[joints[j]]['name'],'weightFraction':round(tot[j]/total,4)} for j in order[:6]]}
meshNodes=[i for i,n in enumerate(nodes) if 'mesh' in n]
def compact(selected,withMotion=False):
    # Preserve node/joint indices and all joint transforms; disable other
    # mesh nodes. Prune unused accessors, materials, textures, images and
    # binary views, while preserving exact bytes of retained data.
    d=copy.deepcopy(g);sel=set(selected)
    for i,n in enumerate(d['nodes']):
        if 'mesh' in n and i not in sel:
            for k in ('mesh','skin','weights'):n.pop(k,None)
    if not withMotion:d.pop('animations',None)
    def remap(arr,used):
        ids=sorted(used);return [arr[i] for i in ids],{v:i for i,v in enumerate(ids)}
    d['meshes'],mm=remap(d['meshes'],{nodes[i]['mesh'] for i in sel})
    for i in sel:d['nodes'][i]['mesh']=mm[d['nodes'][i]['mesh']]
    prim=[p for m in d['meshes'] for p in m['primitives']]
    A={d['skins'][0]['inverseBindMatrices']};M=set()
    for p in prim:
        A.update(p['attributes'].values())
        if 'indices' in p:A.add(p['indices'])
        if 'material' in p:M.add(p['material'])
        for t in p.get('targets',[]):A.update(t.values())
    for a in d.get('animations',[]):
        for s in a['samplers']:A.update((s['input'],s['output']))
    d['accessors'],am=remap(d['accessors'],A);d['skins'][0]['inverseBindMatrices']=am[d['skins'][0]['inverseBindMatrices']]
    for p in prim:
        p['attributes']={k:am[v] for k,v in p['attributes'].items()}
        if 'indices' in p:p['indices']=am[p['indices']]
        for t in p.get('targets',[]):
            for k in t:t[k]=am[t[k]]
    for a in d.get('animations',[]):
        for s in a['samplers']:
            for k in ('input','output'):s[k]=am[s[k]]
    d['materials'],mat=remap(d.get('materials',[]),M)
    for p in prim:
        if 'material' in p:p['material']=mat[p['material']]
    texrefs=[]
    def walk(obj):
        if isinstance(obj,dict):
            for k,v in obj.items():
                if k.lower().endswith('texture') and isinstance(v,dict) and 'index' in v:texrefs.append(v)
                else:walk(v)
        elif isinstance(obj,list):
            for v in obj:walk(v)
    walk(d['materials'])
    d['textures'],tm=remap(d.get('textures',[]),{x['index'] for x in texrefs})
    for x in texrefs:x['index']=tm[x['index']]
    d['images'],im=remap(d.get('images',[]),{x['source'] for x in d['textures'] if 'source' in x})
    d['samplers'],sm=remap(d.get('samplers',[]),{x['sampler'] for x in d['textures'] if 'sampler' in x})
    for t in d['textures']:
        if 'source' in t:t['source']=im[t['source']]
        if 'sampler' in t:t['sampler']=sm[t['sampler']]
    views=set()
    for a in d['accessors']:
        if 'bufferView' in a:views.add(a['bufferView'])
        if 'sparse' in a:
            views.update(a['sparse'][k]['bufferView'] for k in ('indices','values'))
    for x in d['images']:
        if 'bufferView' in x:views.add(x['bufferView'])
    d['bufferViews'],vm=remap(d['bufferViews'],views)
    for a in d['accessors']+d['images']:
        if 'bufferView' in a:a['bufferView']=vm[a['bufferView']]
        if 'sparse' in a:
            for k in ('indices','values'):a['sparse'][k]['bufferView']=vm[a['sparse'][k]['bufferView']]
    b=bytearray()
    for v in d['bufferViews']:
        assert v.get('buffer',0)==0
        st=v.get('byteOffset',0);length=v['byteLength'];b.extend(b'\0'*((-len(b))%4));v['byteOffset']=len(b);b.extend(B[st:st+length])
    d['buffers']=[{'byteLength':len(b)}]
    for k in ('textures','images','samplers','materials'):
        if not d[k]:d.pop(k)
    d['asset']['extras']={'rigSignature':rigSignature,'sourceSHA256':sha(raw),'reviewOnly':True}
    return d,bytes(b)
def check(path,ids):
    raw2=path.read_bytes();n=struct.unpack_from('<I',raw2,12)[0];d=json.loads(raw2[20:20+n]);assert {i for i,n in enumerate(d['nodes']) if 'mesh' in n}==set(ids)
    assert d['skins'][0]['joints']==joints
    for j in joints:assert d['nodes'][j]==nodes[j]
    assert d['asset']['extras']['rigSignature']==rigSignature
    # Exact geometry attributes and inverse bind bytes, not merely names.
    b=raw2[28+n:]
    def read2(k):return decode_accessor(d,b,k)
    assert np.array_equal(read2(d['skins'][0]['inverseBindMatrices']),accessor(skin['inverseBindMatrices']))
    for i in ids:
        p0=g['meshes'][nodes[i]['mesh']]['primitives'];p1=d['meshes'][d['nodes'][i]['mesh']]['primitives']
        assert len(p0)==len(p1)
        for a,c in zip(p0,p1):
            for k in a['attributes']:assert np.array_equal(accessor(a['attributes'][k]),read2(c['attributes'][k]))
            if 'indices' in a:assert np.array_equal(accessor(a['indices']),read2(c['indices']))
            for x,y in zip(a.get('targets',[]),c.get('targets',[])):
                for k in x:assert np.array_equal(accessor(x[k]),read2(y[k]))
    return sha(raw2)
rows=[]
groups=[('body_core',[i for i in meshNodes if slots(i) in ('body','face')])]
groups += [(nodes[i]['name'],[i]) for i in meshNodes if slots(i) not in ('body','face')]
for name,ids in groups:
    path=out/(name+'.glb');d,b=compact(ids,name=='body_core');write(path,d,b);h=check(path,ids)
    rows.append({'id':name,'kind':'core' if name=='body_core' else slots(ids[0]),'file':path.name,'sha256':h,'nodeNames':[nodes[i]['name'] for i in ids],'geometry':[{'name':nodes[i]['name'],**measure(i)} for i in ids],'rigSignature':rigSignature,'attachment':'shared-skin','refitRequiredForOtherRig':True})
# Bone-local socket origins and orientation: use exact bind matrices;
# hand grip offset/orientation is intentionally not assumed from wrist.
socketDefs={'hair':'head','headwear':'head','ear_left':'head','ear_right':'head','neck':'neck01','chest':'spine02','back':'spine02','waist':'spine05','shoulder_left':'shoulder01.L','shoulder_right':'shoulder01.R','forearm_left':'lowerarm01.L','forearm_right':'lowerarm01.R','weapon_right':'wrist.R','shield_left':'wrist.L','foot_left':'foot.L','foot_right':'foot.R'}
boneIdx={nodes[i]['name']:i for i in joints};sockets={}
for k,b in socketDefs.items():
    i=boneIdx[b];sockets[k]={'bone':b,'boneRestWorldMatrixColumnMajor':W(i).flatten(order='F').tolist(),'localOffsetM':[0,0,0],'localRotationQuaternion':[0,0,0,1],'status':'bone anchor only; item-specific grip/ear offset requires fit'}
assert sorted(i for _,ids in groups for i in ids)==sorted(meshNodes)
# Reassembly proof: every original node is present exactly once with
# byte-identical geometry. Runtime must rebind each skin to canonical rig.
manifest={'schema':'r53-modular-character-v1','sourceSHA256':sha(raw),'rigSignature':rigSignature,'sourceMeshCount':len(meshNodes),'partCount':len(rows),'parts':rows,'sockets':sockets,'units':'metres; glTF Y up','runtimeContract':'single canonical body_core skeleton; remap by name AND inverse bind matrix; reject signature mismatch; preserve relative node world transform; never stack independent armatures','bodyPolicy':'continuous skin core remains intact; optional regional replacement/hide masks not authored yet','weaponAccessoryPolicy':'bone sockets only; actual weapon and accessory meshes not produced by this extraction','approval':False,'tests':{'exactMeshCoverage':True,'geometryAndBindRoundTrip':True,'animationRetainedInCore':True,'visualReassemblyTested':False,'crossBodyFitTested':False}}
(out/'parts-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
print('R53 modular',len(rows),'parts',len(meshNodes),'meshes',len(sockets),'sockets; exact geometry check passed')
