"""Check exported outfit GLB has actual skin influences and a plausible skeleton."""
import json,struct,sys,pathlib
def chunks(path):
    raw=pathlib.Path(path).read_bytes()
    if raw[:4]!=b'glTF' or len(raw)<20: raise ValueError('not a GLB')
    version,total=struct.unpack_from('<II',raw,4)
    if version!=2 or total!=len(raw): raise ValueError('bad header')
    pos=12;out=[]
    while pos+8<=len(raw):
        length,kind=struct.unpack_from('<I4s',raw,pos);pos+=8
        if pos+length>len(raw): raise ValueError('bad chunk length')
        out.append((kind,raw[pos:pos+length]));pos+=length
    if pos!=len(raw): raise ValueError('trailing bytes')
    return out
def validate(path):
    parts=chunks(path)
    data=json.loads(next(v for k,v in parts if k==b'JSON'))
    skins=data.get('skins',[])
    if not skins: raise ValueError('no skins')
    nodes=data.get('nodes',[])
    if any(not s.get('joints') or any(j>=len(nodes) for j in s['joints']) for s in skins):
        raise ValueError('skin has invalid joints')
    meshes=data.get('meshes',[])
    skinned=[n for n in nodes if 'skin' in n and 'mesh' in n]
    if not skinned: raise ValueError('no skinned mesh nodes')
    for n in skinned:
        if n['skin']>=len(skins) or n['mesh']>=len(meshes):
            raise ValueError('invalid mesh/skin reference')
        for p in meshes[n['mesh']].get('primitives',[]):
            attrs=p.get('attributes',{})
            if 'JOINTS_0' not in attrs or 'WEIGHTS_0' not in attrs:
                raise ValueError('skinned mesh lacks joint/weight attributes')
            accessors=data.get('accessors',[])
            if any(attrs[k]>=len(accessors) for k in ('JOINTS_0','WEIGHTS_0')):
                raise ValueError('invalid skin accessor')
            if accessors[attrs['JOINTS_0']]['count']!=accessors[attrs['WEIGHTS_0']]['count']:
                raise ValueError('joint and weight count mismatch')
    return {'skins':len(skins),'skinned_nodes':len(skinned),'joints':sum(len(s['joints']) for s in skins)}
if __name__=='__main__':
    if len(sys.argv)<2: raise SystemExit('Usage: python3 tools/validate-rigged-glb.py file.glb ...')
    for file in sys.argv[1:]:
        print(file,validate(file))
