#!/usr/bin/env python3
"""Create original neutral V120 head from public-domain source anatomy.

Preserves connected skin, actual nostrils/eyelids/lips, eyes and source UVs.
One deterministic midpoint subdivision creates 13,455 skin vertices and
25,920 connected triangles. The original donor GLB is never overwritten.
Expressions/hair are intentionally not created here.
"""
import argparse
import json
import math
import pathlib
import struct

SOURCE=pathlib.Path('assets/master-sources/blender/realistic-head-animation.glb')
OUT=pathlib.Path('assets/generated/neutral-face-v120.glb')

def read_glb(path):
    data=path.read_bytes()
    magic,version,size=struct.unpack_from('<4sII',data)
    if magic!=b'glTF' or version!=2 or size!=len(data):
        raise ValueError('Expected valid GLB version 2')
    at=12;gltf=None;bin_chunk=None
    while at<len(data):
        length,kind=struct.unpack_from('<I4s',data,at);at+=8
        payload=data[at:at+length];at+=length
        if kind==b'JSON':gltf=json.loads(payload)
        if kind==b'BIN\0':bin_chunk=bytearray(payload)
    if gltf is None or bin_chunk is None:raise ValueError('GLB missing chunks')
    return gltf,bin_chunk

def accessor(gltf,buf,ref):
    ac=gltf['accessors'][ref]
    n={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[ac['type']]
    char={5121:'B',5123:'H',5125:'I',5126:'f'}[ac['componentType']]
    width=struct.calcsize('<'+char)*n
    view=gltf['bufferViews'][ac['bufferView']]
    offset=view.get('byteOffset',0)+ac.get('byteOffset',0)
    stride=view.get('byteStride',width)
    return [tuple(struct.unpack_from('<'+char*n,buf,offset+i*stride)) if n>1
            else struct.unpack_from('<'+char,buf,offset+i*stride)[0]
            for i in range(ac['count'])]

def gauss(x,c,w):return math.exp(-.5*((x-c)/w)**2)
def smooth(v,lo,hi):
    t=max(0.,min(1.,(v-lo)/(hi-lo)))
    return t*t*(3-2*t)

def sculpt(point):
    x,y,z=point
    front=smooth(z,-.03,.11)
    jaw=gauss(y,.172,.085)*gauss(abs(x),.078,.055)*front
    outx=x-x*.087*jaw
    cheek=(gauss(x,-.074,.032)+gauss(x,.074,.032))*gauss(y,.247,.066)*front
    outx+=x*.030*cheek
    dz=.011*cheek
    brow=(gauss(x,-.041,.035)+gauss(x,.041,.035))*gauss(y,.319,.025)*front
    dz-=.003*brow
    dz-=.004*gauss(x,0,.020)*gauss(y,.250,.042)*front
    wings=(gauss(x,-.029,.011)+gauss(x,.029,.011))*gauss(y,.251,.021)*front
    outx-=x*.035*wings
    dz+=.002*gauss(x,0,.041)*gauss(y,.133,.033)*front
    dz+=.001*gauss(x,0,.049)*gauss(y,.195,.027)*front
    return (outx,y,z+dz)

def subdivide(vertices,uv,faces):
    vertices=list(vertices);uv=list(uv);edge_ids={};new_faces=[]
    def edge(a,b):
        key=tuple(sorted((a,b)))
        if key not in edge_ids:
            pa,pb=vertices[a],vertices[b]
            ta,tb=uv[a],uv[b]
            edge_ids[key]=len(vertices)
            vertices.append(tuple((pa[i]+pb[i])/2 for i in range(3)))
            uv.append(tuple((ta[i]+tb[i])/2 for i in range(2)))
        return edge_ids[key]
    for a,b,c in faces:
        ab,bc,ca=edge(a,b),edge(b,c),edge(c,a)
        new_faces.extend(((a,ab,ca),(ab,b,bc),(ca,bc,c),(ab,bc,ca)))
    return vertices,uv,new_faces

def normals(points,faces):
    values=[[0.,0.,0.] for _ in points]
    for a,b,c in faces:
        p,q,r=points[a],points[b],points[c]
        u=[q[i]-p[i] for i in range(3)]
        v=[r[i]-p[i] for i in range(3)]
        n=(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0])
        for k in (a,b,c):
            for j in range(3):values[k][j]+=n[j]
    out=[]
    for x,y,z in values:
        norm=math.sqrt(x*x+y*y+z*z)
        out.append((x/norm,y/norm,z/norm) if norm>1e-12 else (0,0,1))
    return out

def bake(source,destination):
    gltf,chunk=read_glb(source)
    mesh=gltf['meshes'][0]
    primitive=mesh['primitives'][0]
    xyz=[sculpt(x) for x in accessor(gltf,chunk,primitive['attributes']['POSITION'])]
    uv=accessor(gltf,chunk,primitive['attributes']['TEXCOORD_0'])
    raw=accessor(gltf,chunk,primitive['indices'])
    faces=[tuple(raw[i:i+3]) for i in range(0,len(raw),3)]
    if len(xyz)!=3490 or len(faces)!=6480:
        raise ValueError('Input topology changed; reject unsafe remesh')
    xyz,uv,faces=subdivide(xyz,uv,faces)
    normal=normals(xyz,faces)
    flat_indices=[k for f in faces for k in f]
    def append(data,typ,kind):
        n={'SCALAR':1,'VEC2':2,'VEC3':3}[kind]
        fmt={5125:'I',5126:'f'}[typ]
        while len(chunk)%4:chunk.append(0)
        start=len(chunk)
        for row in data:
            values=(row,) if kind=='SCALAR' else row
            chunk.extend(struct.pack('<'+fmt*n,*values))
        view_id=len(gltf['bufferViews'])
        gltf['bufferViews'].append({'buffer':0,'byteOffset':start,'byteLength':len(chunk)-start})
        acc_id=len(gltf['accessors'])
        acc={'bufferView':view_id,'componentType':typ,'count':len(data),'type':kind}
        if kind=='VEC3':
            acc['min']=[min(p[k] for p in data) for k in range(3)]
            acc['max']=[max(p[k] for p in data) for k in range(3)]
        gltf['accessors'].append(acc)
        return acc_id
    pos=append(xyz,5126,'VEC3')
    norm=append(normal,5126,'VEC3')
    tex=append(uv,5126,'VEC2')
    idx=append(flat_indices,5125,'SCALAR')
    primitive['attributes']={'POSITION':pos,'NORMAL':norm,'TEXCOORD_0':tex}
    primitive['indices']=idx
    primitive.pop('targets',None)
    mesh.pop('weights',None)
    mesh['name']='V120_ANATOMICAL_NEUTRAL_SKIN_CC0_RETOPO'
    for node in gltf['nodes']:node.pop('weights',None)
    gltf.pop('animations',None)
    skin=gltf['materials'][0]
    skin['name']='V120_NEUTRAL_SKIN_UNPAINTED'
    skin['pbrMetallicRoughness']={'baseColorFactor':[.83,.66,.62,1],
                                  'metallicFactor':0,'roughnessFactor':.82}
    skin['doubleSided']=True
    regions={}
    specs=(('leftEye',-.041,.310,.037,.035),
           ('rightEye',.041,.310,.037,.035),
           ('mouth',0,.199,.059,.037),
           ('nose',0,.257,.042,.055),
           ('leftCheek',-.080,.250,.045,.063),
           ('rightCheek',.080,.250,.045,.063))
    for name,cx,cy,rx,ry in specs:
        regions[name]=[i for i,(x,y,z) in enumerate(xyz)
                       if z>.035 and ((x-cx)/rx)**2+((y-cy)/ry)**2<2]
    mesh['extras']={'version':120,'neutralOnly':True,'source':'CC0 anatomical head',
                    'topology':{'vertices':len(xyz),'triangles':len(faces),
                                'uv':True,'stableIndexedGeometry':True},
                    'futureRigZones':regions,
                    'futureExpressions':['blinkLeft','blinkRight','jawOpen','smile','browRaise'],
                    'futureExpressionsImplemented':False,'hairIncluded':False}
    gltf['asset']['generator']='V120_ANATOMICAL_NEUTRAL_RESCULPT (Python stdlib)'
    gltf['buffers'][0]['byteLength']=len(chunk)
    j=json.dumps(gltf,separators=(',',':'),ensure_ascii=False).encode('utf-8')
    j+=b' '*((-len(j))%4)
    chunk+=b'\0'*((-len(chunk))%4)
    length=12+8+len(j)+8+len(chunk)
    destination.parent.mkdir(parents=True,exist_ok=True)
    with destination.open('wb') as out:
        out.write(struct.pack('<4sII',b'glTF',2,length))
        out.write(struct.pack('<I4s',len(j),b'JSON'));out.write(j)
        out.write(struct.pack('<I4s',len(chunk),b'BIN\0'));out.write(chunk)
    print('Face v120 neutral: '+str(len(xyz))+' skin vertices, '+
          str(len(faces))+' triangles; '+str(destination))

if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--source',type=pathlib.Path,default=SOURCE)
    parser.add_argument('--out',type=pathlib.Path,default=OUT)
    args=parser.parse_args()
    bake(args.source,args.out)
