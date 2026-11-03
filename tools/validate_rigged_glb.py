"""Validate rigged GLB structure before accepting a Blender export.
Usage: python3 tools/validate_rigged_glb.py output.glb
This is structural validation, NOT visual fit approval.
"""
import json,struct,sys,pathlib
def check(path):
    b=pathlib.Path(path).read_bytes()
    if len(b)<20 or b[:4]!=b'glTF' or struct.unpack_from('<I',b,4)[0]!=2:
        raise ValueError('Invalid GLB v2')
    total=struct.unpack_from('<I',b,8)[0]
    if total!=len(b): raise ValueError('GLB length mismatch')
    n,typ=struct.unpack_from('<I4s',b,12)
    if typ!=b'JSON': raise ValueError('Missing GLB JSON chunk')
    d=json.loads(b[20:20+n])
    skins=d.get('skins',[])
    nodes=d.get('nodes',[])
    meshes=d.get('meshes',[])
    skinned=[node for node in nodes if 'mesh' in node and 'skin' in node]
    if not skins or not skinned: raise ValueError('No skinned mesh in exported GLB')
    for node in skinned:
        if node['skin']>=len(skins) or node['mesh']>=len(meshes):
            raise ValueError('Invalid skin/mesh index')
        primitives=meshes[node['mesh']].get('primitives',[])
        if not primitives or any('JOINTS_0' not in p.get('attributes',{}) or
                                 'WEIGHTS_0' not in p.get('attributes',{}) for p in primitives):
            raise ValueError('Skinned mesh missing joint/weight attributes')
    for skin in skins:
        if not skin.get('joints'): raise ValueError('Skin has no joints')
    return {'file':str(path),'skins':len(skins),'skinnedNodes':len(skinned),'structuralStatus':'pass','visualFit':'unverified'}
if __name__=='__main__':
    for path in sys.argv[1:]:
        try: print(json.dumps(check(path),ensure_ascii=False))
        except Exception as e: raise SystemExit(f'{path}: {e}')
