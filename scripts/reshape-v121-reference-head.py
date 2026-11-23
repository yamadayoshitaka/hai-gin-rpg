#!/usr/bin/env python3
"""Sculpt the *actual* female v121 head mesh to the four-view bald reference.

This is a new upstream geometry pass, not a slider preset or colour overlay.
Operates on the 13,455-vertex skin POSITION buffer and regenerates normals;
retains indices, UVs, rig IDs and all source v119/v120/male meshes.
The reference is a rendered four-view sheet, not a photographic 3D scan:
the proportions are artist-guided and require visual review.
"""
import argparse
import json
import math
import pathlib
import struct

def gauss(x,c,w):
    return math.exp(-.5*((x-c)/w)**2)

def smooth(v,lo,hi):
    t=max(0.,min(1.,(v-lo)/(hi-lo)))
    return t*t*(3.-2.*t)

def read(path):
    raw=path.read_bytes()
    if raw[:4]!=b'glTF' or struct.unpack_from('<II',raw,4)!=(2,len(raw)):
        raise ValueError('Invalid source v121 GLB')
    size=struct.unpack_from('<I',raw,12)[0]
    graph=json.loads(raw[20:20+size])
    start=20+size
    if raw[start+4:start+8]!=b'BIN\0':
        raise ValueError('No BIN chunk')
    return graph,bytearray(raw[start+8:])

def accessor(g,b,idx):
    a=g['accessors'][idx]
    view=g['bufferViews'][a['bufferView']]
    size={'VEC3':3,'SCALAR':1}[a['type']]
    typ={5126:'f',5125:'I',5123:'H'}[a['componentType']]
    off=view.get('byteOffset',0)+a.get('byteOffset',0)
    stride=view.get('byteStride',struct.calcsize(typ)*size)
    return [struct.unpack_from('<'+typ*size,b,off+i*stride)
            for i in range(a['count'])]

def append_vec3(g,b,rows):
    while len(b)%4:b.append(0)
    start=len(b)
    for xyz in rows:b.extend(struct.pack('<fff',*xyz))
    view=len(g['bufferViews'])
    g['bufferViews'].append({'buffer':0,'byteOffset':start,
                             'byteLength':len(rows)*12})
    index=len(g['accessors'])
    g['accessors'].append({'bufferView':view,'componentType':5126,
      'count':len(rows),'type':'VEC3',
      'min':[min(p[i] for p in rows) for i in range(3)],
      'max':[max(p[i] for p in rows) for i in range(3)]})
    return index

def vertex_normal(v):
    mag=math.sqrt(sum(a*a for a in v))
    return tuple(a/mag for a in v) if mag>1e-12 else (0.,0.,1.)

def new_normals(xyz,tri):
    accum=[[0.,0.,0.] for _ in xyz]
    for j in range(0,len(tri),3):
        a,c,d=tri[j:j+3]
        u=[xyz[c][k]-xyz[a][k] for k in range(3)]
        v=[xyz[d][k]-xyz[a][k] for k in range(3)]
        face=(u[1]*v[2]-u[2]*v[1],
              u[2]*v[0]-u[0]*v[2],
              u[0]*v[1]-u[1]*v[0])
        for i in (a,c,d):
            for k in range(3):accum[i][k]+=face[k]
    return [vertex_normal(v) for v in accum]

def sculpt(p):
    x,y,z=p
    ax=abs(x)
    front=smooth(z,.004,.118)
    side=smooth(z,-.045,.065)
    # Forehead and temporal contour narrower / softer toward brows without
    # flattening the bald cranial dome or narrowing the ears.
    temple=gauss(y,.345,.066)*gauss(ax,.107,.028)*side
    frontal=gauss(y,.392,.064)*gauss(ax,.095,.045)*side
    # Reference has fuller under-eyes but smooth cheeks in side view,
    # *not* the old prominent cheekbone shelf.
    malar=gauss(y,.267,.038)*gauss(ax,.078,.034)*front
    under_eye=gauss(y,.285,.017)*gauss(ax,.053,.028)*front
    # Narrow lower cheeks flowing seamlessly into a petite ovoid jaw.
    lower_cheek=gauss(y,.217,.057)*gauss(ax,.088,.040)*side
    jaw=gauss(y,.157,.049)*gauss(ax,.084,.053)*side
    chin=gauss(y,.135,.033)*gauss(ax,.030,.038)*front
    chin_corners=gauss(y,.152,.032)*gauss(ax,.057,.027)*front
    # Narrow nasal bridge + alar footprint and soften an oversized tip
    # for both 45deg and profile. Avoid modifying nostril openings globally.
    bridge=gauss(y,.285,.038)*gauss(ax,.022,.015)*front
    ala=gauss(y,.248,.018)*gauss(ax,.031,.013)*front
    tip=gauss(y,.251,.015)*gauss(x,0,.021)*smooth(z,.118,.158)
    # Shape true upper/lower vermilion in the mesh, preserving the existing
    # closed seam. Each lip occupies its own narrow topology band.
    lips_f=smooth(z,.090,.141)
    lip_width=gauss(x,0,.039)
    upper=gauss(y,.209,.008)*lip_width*lips_f
    lower=gauss(y,.183,.010)*lip_width*lips_f
    cupid=gauss(y,.218,.006)*gauss(ax,.011,.007)*lips_f
    corners=gauss(y,.197,.012)*gauss(ax,.042,.014)*lips_f
    nx=(x*(1-.023*temple-.022*frontal-.035*lower_cheek
             -.085*jaw-.065*chin_corners-.055*ala-.028*bridge))
    ny=y+.0017*chin-.00045*frontal+.0006*under_eye
    nz=(z-.0042*malar+.0015*under_eye
        -.0025*lower_cheek+.0004*jaw
        -.0024*tip-.0012*ala-.0008*bridge
        +.0031*upper+.0044*lower+.0009*cupid
        -.0009*corners+.00065*chin)
    return (nx,ny,nz),{
      'temple':temple,'malar':malar,'jaw':jaw,'tip':tip,
      'upperLip':upper,'lowerLip':lower,'underEye':under_eye}

def run(path):
    g,b=read(path)
    head=g['meshes'][0]
    meta=head.get('extras',{})
    if meta.get('version')!=121 or meta.get('hairIncluded') is not False:
        raise ValueError('Only female bald face v121 can be reference-sculpted')
    prim=head['primitives'][0]
    before=accessor(g,b,prim['attributes']['POSITION'])
    triangles=[v[0] for v in accessor(g,b,prim['indices'])]
    if len(before)!=13455 or len(triangles)!=25920*3:
        raise ValueError('Unexpected source topology')
    old_index=prim['indices']
    old_uv=prim['attributes']['TEXCOORD_0']
    transformed=[sculpt(p) for p in before]
    after=[p for p,m in transformed]
    flags=[m for p,m in transformed]
    if any(not all(math.isfinite(v) for v in p) for p in after):
        raise ValueError('Nonfinite sculpt vertex')
    shifts=[math.dist(a,b) for a,b in zip(after,before)]
    changed=sum(d>.00045 for d in shifts)
    counters={k:sum(v[k]>.12 for v in flags)
              for k in ('temple','malar','jaw','tip','upperLip','lowerLip','underEye')}
    if changed<900 or counters['malar']<70 or counters['jaw']<50:
        raise ValueError('Sculpt not applied to sufficient real mesh vertices')
    if max(shifts)>.018:
        raise ValueError('Excessive displacement; possible broken topology')
    prim['attributes']['POSITION']=append_vec3(g,b,after)
    prim['attributes']['NORMAL']=append_vec3(g,b,new_normals(after,triangles))
    if prim['indices']!=old_index or prim['attributes']['TEXCOORD_0']!=old_uv:
        raise ValueError('Original UV/index topology was modified')
    meta['referenceMeshResculpt']={
      'version':'four-view-skinhead-female-v121-20261123',
      'method':'actual indexed skin geometry POSITION + regenerated NORMAL',
      'sourceReferenceViews':['front','front45','profile','rear'],
      'baseVertices':13455,
      'triangleCount':25920,
      'changedVerticesAbove045mm':changed,
      'largestWorldSpaceDisplacement':round(max(shifts),7),
      'resculptedRegionVertexCounts':counters,
      'referenceImageIsNot3DScan':True,
      'protectedVersions':['v119','v120','male','combat'],
      'skinheadPreserved':True,
      'uvAndTriangleIndicesPreserved':True}
    g['asset']['generator']='HaiGin v121 four-view real mesh resculpt + PBR'
    g['buffers'][0]['byteLength']=len(b)
    j=json.dumps(g,separators=(',',':'),ensure_ascii=False).encode('utf8')
    j+=b' '*((-len(j))%4)
    b+=b'\0'*((-len(b))%4)
    length=12+8+len(j)+8+len(b)
    with path.open('wb') as out:
        out.write(struct.pack('<4sII',b'glTF',2,length))
        out.write(struct.pack('<I4s',len(j),b'JSON'));out.write(j)
        out.write(struct.pack('<I4s',len(b),b'BIN\0'));out.write(b)
    print('v121 four-view head vertices sculpted',changed,'of 13455',
          'max displacement',max(shifts),'regions',counters)

if __name__=='__main__':
    ap=argparse.ArgumentParser()
    ap.add_argument('glb',type=pathlib.Path)
    run(ap.parse_args().glb)
