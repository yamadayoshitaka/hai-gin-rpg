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
    """Real continuous alar-to-commissure depressions in native head topology.

    Previous v121 fold started too high and too far outside the nostrils,
    fading before reaching the mouth. This path starts at each nostril wing
    (~x=0.025,y=0.239), curves to the mouth corner (~x=0.046,y=0.195),
    and is paired with a subtle fuller-cheek ridge.
    """
    ax=abs(x)
    front=fade(z,.064,.120)
    t=(.241-y)/.052
    if 0.<t<1.:
        path=.0245+.0215*t+.0013*math.sin(math.pi*t)
        envelope=fade(t,.005,.18)*(1.-fade(t,.80,.995))
        valley=-.0051*bell(ax,path,.0066)
        cheek_support=.00180*bell(ax,path+.010,.0091)
        nasolabial=(valley+cheek_support)*envelope*front
    else:
        nasolabial=0.
    # A tiny crescent below the nasal wing connects the nostril root to fold.
    alar_transition=-.0012*bell(ax,.028,.007)*bell(y,.233,.008)*front
    eye_mask=fade(ax,.023,.033)*(1-fade(ax,.062,.072))
    under_eye=-.00033*bell(y,.287,.0035)*eye_mask*front
    mouth_corner=-.00056*bell(ax,.045,.006)*bell(y,.193,.008)*front
    return nasolabial+alar_transition+under_eye+mouth_corner


def nose_and_lips(x,y,z):
    """Localized real-mesh sculpt; keep nostril cavity and mouth loop intact.

    Narrow the alar silhouette and soften the front-facing bulbous nasal
    tip without bridging the two nostril openings. Shape a genuine Cupid's
    bow, upper and lower vermilion, philtrum and relaxed closed lip seam.
    """
    ax=abs(x)
    nose_front=fade(z,.093,.141)
    wing=(bell(ax,.028,.017)*bell(y,.243,.024)*fade(z,.084,.127)*
          (1.-fade(ax,.043,.054)))
    nx=x*(1.-.063*wing)
    tip=bell(x,0.,.017)*bell(y,.250,.016)*fade(z,.122,.154)
    ala=bell(ax,.027,.011)*bell(y,.242,.018)*nose_front*(1.-fade(ax,.043,.054))
    nz=z-.0030*tip-.00115*ala
    lip_front=fade(z,.103,.137)
    horizontal=bell(x,0,.038)*(1.-fade(ax,.044,.056))
    upper=bell(y,.2075,.0086)*horizontal*lip_front
    lower=bell(y,.1835,.0103)*horizontal*lip_front
    cupids=bell(ax,.012,.0065)*bell(y,.213,.007)*lip_front
    seam=bell(y,.197,.0028)*horizontal*lip_front
    philtrum=bell(y,.223,.011)*bell(x,0,.0085)*lip_front
    columns=bell(y,.219,.010)*bell(ax,.012,.006)*lip_front
    nz+=(.0028*upper+.0043*lower+.0012*cupids
         -.0008*seam-.0011*philtrum+.00075*columns)
    return (nx,y,nz)


def neutral_color(x,y,z):
    """Remove the baked eyelid-to-brow brown stripe and chin pink patch.

    A neutral base with bounded, soft blush and colour only on actual lips.
    Eyebrow hair, eyeliner and crease are separately sculpted native meshes.
    """
    front=fade(z,.077,.122)
    ax=abs(x)
    cheek=(bell(x,-.075,.041)+bell(x,.075,.041))*bell(y,.256,.039)*front
    lips=(.78*bell(y,.208,.009)+bell(y,.184,.010))*bell(x,0,.036)*fade(z,.109,.137)
    outer_eye=(bell(x,-.043,.023)+bell(x,.043,.023))*bell(y,.287,.013)*front
    # No dark horizontal vertex-colour bands near y 0.322..0.349,
    # and no blush/lip colour leakage into the chin (y < 0.17).
    return (clamp(.995-.009*lips),
            clamp(.994-.016*cheek-.165*lips-.005*outer_eye),
            clamp(.992-.022*cheek-.123*lips-.006*outer_eye))


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
        if not (.098<y<.177 and abs(x)<.082 and z>.005):
            continue
        weight=(fade(y,.109,.133)*(1-fade(y,.153,.172))*
                (1-fade(abs(x),.058,.080))*fade(z,.005,.050))
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
    nasal_vertices=[]
    lip_vertices=[]
    for i,(x,y,z) in enumerate(xyz):
        nx,ny,nz=nose_and_lips(x,y,z)
        dz=fold_displacement(nx,ny,nz)
        updated.append((nx,ny,nz+dz))
        if dz<-.00018 and .190<ny<.251 and .018<abs(nx)<.068:
            (folds_left if nx<0 else folds_right).append(i)
        if abs(nx-x)>.00008 and .225<y<.280:
            nasal_vertices.append(i)
        if abs(nz-z)>.00015 and .172<y<.227 and abs(x)<.058:
            lip_vertices.append(i)
    if len(nasal_vertices)<20 or len(lip_vertices)<30:
        raise ValueError('Nose and vermilion must have actual displaced vertices')
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
    meta['referenceFeatureSculpt']={
        'version':'v121-nose-lips-lower-lashes-20261123',
        'nostrilWingVerticesAdjusted':nasal_vertices,
        'lipVermilionVerticesAdjusted':lip_vertices,
        'nasolabialCurveStart':[.0245,.241],
        'nasolabialCurveEnd':[.046,.189],
        'foldIsActualSkinGeometry':True,
        'preservesEyeAndMouthTopology':True,
        'facialExpressionAnimations':False}
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
        'noseChanged':len(nasal_vertices),'lipsChanged':len(lip_vertices),
        'byteLength':length}))


if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('glb',type=pathlib.Path)
    finish(parser.parse_args().glb)
