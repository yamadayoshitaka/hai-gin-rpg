#!/usr/bin/env python3
"""Final female v121 GLB stage: clean cosmetic band/chin tint, sculpt soft folds.

This edits real skin POSITION, NORMAL and COLOR_0 attributes and saves a GLB.
The 13,455 indexed face vertex IDs, UVs, geometry index buffer, eye/pupil UV,
eyelashes, brows, rig zones and older game models are not changed.
"""
import argparse
import json
import math
import pathlib
import struct


def bell(x, center, width):
    return math.exp(-.5*((x-center)/width)**2)


def clamp(x, low=0., high=1.):
    return max(low, min(high, x))


def fade(x, low, high):
    t=clamp((x-low)/(high-low))
    return t*t*(3-2*t)


def read_glb(path):
    data=path.read_bytes()
    if data[:4]!=b'glTF' or struct.unpack_from('<II',data,4)!=(2,len(data)):
        raise ValueError('Expected complete GLB 2.0')
    json_length=struct.unpack_from('<I',data,12)[0]
    graph=json.loads(data[20:20+json_length])
    offset=20+json_length
    if data[offset+4:offset+8]!=b'BIN\0':
        raise ValueError('GLB missing binary chunk')
    return graph,bytearray(data[offset+8:])


def accessor(g,b,i):
    a=g['accessors'][i]
    c={'SCALAR':1,'VEC2':2,'VEC3':3}[a['type']]
    fmt={5123:'H',5125:'I',5126:'f'}[a['componentType']]
    view=g['bufferViews'][a['bufferView']]
    start=view.get('byteOffset',0)+a.get('byteOffset',0)
    stride=view.get('byteStride',c*struct.calcsize(fmt))
    return [struct.unpack_from('<'+fmt*c,b,start+j*stride)
            for j in range(a['count'])]


def add_vec3(g,b,values):
    while len(b)%4:b.append(0)
    offset=len(b)
    for v in values:
        b.extend(struct.pack('<fff',*v))
    view=len(g['bufferViews'])
    g['bufferViews'].append({'buffer':0,'byteOffset':offset,
                             'byteLength':12*len(values)})
    ai=len(g['accessors'])
    g['accessors'].append({
        'bufferView':view,'componentType':5126,'type':'VEC3',
        'count':len(values),
        'min':[min(v[k] for v in values) for k in range(3)],
        'max':[max(v[k] for v in values) for k in range(3)]})
    return ai


def normalise(v):
    d=math.sqrt(sum(t*t for t in v))
    return tuple(t/d for t in v) if d>1e-12 else (0.,0.,1.)


def normals(points,triangles):
    out=[[0.,0.,0.] for _ in points]
    for a,b,c in triangles:
        p,q,r=points[a],points[b],points[c]
        u=[q[k]-p[k] for k in range(3)]
        v=[r[k]-p[k] for k in range(3)]
        face=(u[1]*v[2]-u[2]*v[1],
              u[2]*v[0]-u[0]*v[2],
              u[0]*v[1]-u[1]*v[0])
        for i in (a,b,c):
            for k in range(3):
                out[i][k]+=face[k]
    return [normalise(t) for t in out]


def fold_displacement(x,y,z):
    """A recessed nasolabial valley with an adjacent *lifted* cheek volume.

    The path runs from the nose wing to near the mouth corner, and fades
    toward both ends. No dark floating stroke or pasted-on wrinkle geometry.
    """
    ax=abs(x)
    front=fade(z,.078,.124)
    t=(.251-y)/.063
    if t<=0 or t>=1:
        nasolabial=0.
    else:
        # Curving path from alar base (0.033) toward mouth corner (0.046).
        path=.033+.0135*t+.0021*math.sin(math.pi*t)
        env=math.sin(math.pi*t)**.72
        valley=-.0020*bell(ax,path,.0044)
        cheek_lift=.00080*bell(ax,path+.009,.0072)
        nasolabial=(valley+cheek_lift)*env*front
    # Delicate infraorbital creases, intentionally below the lower lashes.
    eye_mask=fade(ax,.023,.033)*(1-fade(ax,.062,.072))
    lower_eye=-.00036*bell(y,.286,.0034)*eye_mask*front
    # Natural very subtle mouth-corner and marionette start, not aged grooves.
    corner=-.00036*bell(ax,.047,.005)*bell(y,.191,.008)*front
    return nasolabial+lower_eye+corner


def neutral_color(x,y,z):
    """Remove the baked eyelid-to-brow brown stripe and chin pink patch.

    A neutral base with bounded, soft blush and colour only on actual lips.
    Eyebrow hair, eyeliner and crease are separately sculpted native meshes.
    """
    front=fade(z,.077,.122)
    ax=abs(x)
    cheek=(bell(x,-.075,.041)+bell(x,.075,.041))*bell(y,.256,.039)*front
    lips=bell(x,0,.036)*bell(y,.198,.014)*fade(z,.096,.135)
    outer_eye=(bell(x,-.043,.023)+bell(x,.043,.023))*bell(y,.287,.013)*front
    # No dark horizontal vertex-colour bands near y 0.322..0.349,
    # and no blush/lip colour leakage into the chin (y < 0.17).
    return (clamp(.995-.009*lips),
            clamp(.994-.016*cheek-.102*lips-.005*outer_eye),
            clamp(.992-.022*cheek-.091*lips-.006*outer_eye))


def smooth_chin(points,faces):
    """One bounded pass across the old jagged chin shading, not the lips."""
    adjacency=[set() for _ in points]
    for a,b,c in faces:
        adjacency[a].update((b,c))
        adjacency[b].update((a,c))
        adjacency[c].update((a,b))
    result=list(points)
    smoothed=0
    for i,(x,y,z) in enumerate(points):
        if not (.098<y<.177 and abs(x)<.082 and z>.055):
            continue
        weight=(fade(y,.109,.133)*(1-fade(y,.153,.172))*
                (1-fade(abs(x),.058,.080))*fade(z,.068,.110))
        if weight<.015 or not adjacency[i]:
            continue
        mean=sum(points[j][2] for j in adjacency[i])/len(adjacency[i])
        value=clamp(mean-z,-.003,.003)*.32*weight
        result[i]=(x,y,z+value)
        if abs(value)>1e-7:smoothed+=1
    return result,smoothed


def finish(path):
    g,b=read_glb(path)
    face=g['meshes'][0]
    meta=face.get('extras',{})
    if meta.get('version')!=121 or meta.get('hairIncluded') is not False:
        raise ValueError('Only the female bald v121 face may be changed')
    if meta.get('naturalFoldCleanup'):
        raise ValueError('Skin was already cleaned')
    if len(g['meshes'])!=8 or len(g['nodes'])!=8:
        raise ValueError('Expected v121 with actual eyeliner/lash/brow meshes')
    p=face['primitives'][0]
    pos=[tuple(q) for q in accessor(g,b,p['attributes']['POSITION'])]
    if len(pos)!=13455:
        raise ValueError('Must preserve original 13455 skin vertices')
    flat=[t[0] for t in accessor(g,b,p['indices'])]
    if len(flat)!=25920*3:
        raise ValueError('Must preserve all 25920 skin triangles')
    faces=[tuple(flat[i:i+3]) for i in range(0,len(flat),3)]
    xyz,chin_count=smooth_chin(pos,faces)
    folds_left=[]
    folds_right=[]
    updated=[]
    for i,(x,y,z) in enumerate(xyz):
        dz=fold_displacement(x,y,z)
        updated.append((x,y,z+dz))
        if dz<-.00012 and .190<y<.251 and .023<abs(x)<.066:
            (folds_left if x<0 else folds_right).append(i)
    # Keep the original POSITION vertex order, immutable UVs and triangles.
    p['attributes']['POSITION']=add_vec3(g,b,updated)
    p['attributes']['NORMAL']=add_vec3(g,b,normals(updated,faces))
    colors=[neutral_color(x,y,z) for x,y,z in updated]
    p['attributes']['COLOR_0']=add_vec3(g,b,colors)
    if len(folds_left)<10 or len(folds_right)<10:
        raise ValueError('Both genuine nasolabial skin regions are required')
    # Reduce the separate eyelid-crease ribbon tint: no hard pink mask.
    for material in g['materials']:
        if material['name']=='V121_NATURAL_UPPER_LID_CREASE_PBR':
            material['pbrMetallicRoughness']['baseColorFactor']=[
                .79,.65,.62,1.]
            material['pbrMetallicRoughness']['roughnessFactor']=.92
    meta['naturalFoldCleanup']={
        'version':'v121-folds-20261123',
        'technique':'native indexed skin vertex sculpt and corrected neutral vertex colors',
        'removedLegacyBrowLidBand':True,
        'removedChinTintLeakage':True,
        'chinVerticesSmoothed':chin_count,
        'nasolabialLeftVertexIds':folds_left,
        'nasolabialRightVertexIds':folds_right,
        'additionalFoldRegions':['infraorbital','mouth-corners'],
        'surfaceDeformationOnly':True,
        'expressionAnimationImplemented':False}
    g['asset']['generator']='HaiGin v121 natural nasolabial folds + eye/chin colour cleanup'
    g['buffers'][0]['byteLength']=len(b)
    json_bytes=json.dumps(g,ensure_ascii=False,separators=(',',':')).encode('utf8')
    json_bytes+=b' '*((-len(json_bytes))%4)
    b+=b'\0'*((-len(b))%4)
    length=12+8+len(json_bytes)+8+len(b)
    with path.open('wb') as f:
        f.write(struct.pack('<4sII',b'glTF',2,length))
        f.write(struct.pack('<I4s',len(json_bytes),b'JSON'))
        f.write(json_bytes)
        f.write(struct.pack('<I4s',len(b),b'BIN\0'))
        f.write(b)
    print('v121 skin cleanup complete',json.dumps({
        'vertices':len(updated),'chinSmoothed':chin_count,
        'nasolabialLeft':len(folds_left),'nasolabialRight':len(folds_right),
        'byteLength':length}))


if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('glb',type=pathlib.Path)
    finish(parser.parse_args().glb)
