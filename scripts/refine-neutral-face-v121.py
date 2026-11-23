#!/usr/bin/env python3
"""v121-only genuine GLB geometry / PBR / ocular UV refinement.

Runs after the legacy v121 baker. Changes the actual binary glTF positions,
normals, eye meshes and embedded textures, without touching v119/v120 or males.
Face vertex IDs, triangle indices, UV and future-rig region IDs remain stable.
"""
import argparse
import io
import json
import math
import pathlib
import struct
from PIL import Image, ImageDraw

RES=2048

def load(path):
    blob=path.read_bytes()
    if blob[:4]!=b'glTF' or struct.unpack_from('<I',blob,8)[0]!=len(blob):
        raise ValueError('Invalid original v121 GLB')
    length=struct.unpack_from('<I',blob,12)[0]
    gltf=json.loads(blob[20:20+length])
    ptr=20+length
    if blob[ptr+4:ptr+8]!=b'BIN\0':
        raise ValueError('No binary GLB chunk')
    return gltf,bytearray(blob[ptr+8:])

def unpack(g,b,i):
    a=g['accessors'][i]
    width={'SCALAR':1,'VEC2':2,'VEC3':3}[a['type']]
    char={5123:'H',5125:'I',5126:'f'}[a['componentType']]
    v=g['bufferViews'][a['bufferView']]
    at=v.get('byteOffset',0)+a.get('byteOffset',0)
    stride=v.get('byteStride',struct.calcsize(char)*width)
    return [struct.unpack_from('<'+char*width,b,at+k*stride)
            for k in range(a['count'])]

def append(g,b,raw,typ=None,shape=None,count=None):
    while len(b)%4:b.append(0)
    offset=len(b)
    b.extend(raw)
    v=len(g['bufferViews'])
    g['bufferViews'].append({'buffer':0,'byteOffset':offset,'byteLength':len(raw)})
    if typ is None:return v
    i=len(g['accessors'])
    g['accessors'].append({'bufferView':v,'componentType':typ,
                           'count':count,'type':shape})
    return i

def floats(g,b,points,shape='VEC3'):
    raw=b''.join(struct.pack('<'+'f'*len(v),*v) for v in points)
    i=append(g,b,raw,5126,shape,len(points))
    if shape=='VEC3':
        g['accessors'][i]['min']=[min(v[k] for v in points) for k in range(3)]
        g['accessors'][i]['max']=[max(v[k] for v in points) for k in range(3)]
    return i

def indices(g,b,values):
    return append(g,b,b''.join(struct.pack('<I',v) for v in values),
                  5125,'SCALAR',len(values))

def gauss(v,c,w):
    return math.exp(-.5*((v-c)/w)**2)

def smooth(v,lo,hi):
    t=max(0.,min(1.,(v-lo)/(hi-lo)))
    return t*t*(3-2*t)

def resculpt(p):
    x,y,z=p
    ax=abs(x)
    front=smooth(z,-.015,.120)
    jaw=gauss(y,.176,.075)*gauss(ax,.080,.055)*front
    temple=gauss(y,.340,.060)*gauss(ax,.10,.029)*front
    malar=gauss(y,.263,.049)*(gauss(x,-.074,.039)+gauss(x,.074,.039))*front
    cheek=gauss(y,.224,.060)*(gauss(x,-.073,.041)+gauss(x,.073,.041))*front
    chin=gauss(y,.126,.034)*gauss(x,0,.044)*front
    bridge=gauss(x,0,.020)*gauss(y,.292,.051)*front
    nasal_tip=gauss(x,0,.017)*gauss(y,.245,.021)*front
    wings=(gauss(x,-.030,.012)+gauss(x,.030,.012))*gauss(y,.247,.020)*front
    upper=gauss(y,.210,.010)*gauss(x,0,.038)*front
    lower=gauss(y,.184,.012)*gauss(x,0,.041)*front
    cupid=gauss(y,.216,.009)*(gauss(x,-.012,.006)+gauss(x,.012,.006))*front
    philtrum=gauss(y,.231,.013)*gauss(x,0,.014)*front
    brow=gauss(y,.324,.017)*(gauss(x,-.042,.028)+gauss(x,.042,.028))*front
    tear=gauss(y,.288,.014)*(gauss(x,-.043,.026)+gauss(x,.043,.026))*front
    ear=gauss(ax,.137,.017)*gauss(y,.270,.052)
    nx=x*(1-.110*jaw-.033*chin-.014*temple+.018*malar-.027*wings)
    ny=y+.0014*chin
    nz=(z+.0080*cheek+.0041*malar+.0022*chin+.0013*temple
        -.0030*bridge-.0042*nasal_tip-.0012*wings
        +.0021*upper+.0031*lower+.0011*cupid-.0010*philtrum
        -.0014*brow+.0010*tear
        +.0012*ear*(gauss(y,.291,.017)-.25*gauss(y,.256,.024)))
    return (nx,ny,nz)

def calculate_normals(points,faces):
    normals=[[0.,0.,0.] for _ in points]
    for a,b,c in faces:
        p,q,r=points[a],points[b],points[c]
        u=[q[j]-p[j] for j in range(3)]
        v=[r[j]-p[j] for j in range(3)]
        n=(u[1]*v[2]-u[2]*v[1],
           u[2]*v[0]-u[0]*v[2],
           u[0]*v[1]-u[1]*v[0])
        for k in (a,b,c):
            for j in range(3):normals[k][j]+=n[j]
    return [unit(v) for v in normals]

def unit(v):
    d=math.sqrt(sum(x*x for x in v))
    return tuple(x/d for x in v) if d>1e-12 else (0.,0.,1.)

def png(img):
    o=io.BytesIO()
    img.save(o,format='PNG',optimize=True,compress_level=6)
    return o.getvalue()

def skin_maps():
    # Coherent micro-variation, no high-amplitude pixel bumps or acne pits.
    n=RES
    albedo=Image.new('RGB',(n,n))
    orm=Image.new('RGB',(n,n))
    normal=Image.new('RGB',(n,n),(128,128,255))
    da=ImageDraw.Draw(albedo)
    dr=ImageDraw.Draw(orm)
    for y in range(n):
        t=math.sin(y*.011)*.7+math.sin(y*.004)*1.0
        da.line((0,y,n,y),fill=(int(233+t),int(208+t*.8),int(201+t*.75)))
        rough=int(181+3*math.sin(y*.006))
        dr.line((0,y,n,y),fill=(250,rough,0))
    # Rare subpixel pore grain, visually invisible at gameplay viewing range.
    for k in range(8500):
        x=(k*104729+173)%n
        y=(k*13007+127)%n
        c=(232+(k%3),207+(k%3),200+(k%3))
        da.point((x,y),fill=c)
    return png(albedo),png(orm),png(normal)

def eye_map():
    n=RES
    center=n//2
    radius=int(n*.235)
    pupil=int(n*.083)
    im=Image.new('RGB',(n,n),(241,236,232))
    d=ImageDraw.Draw(im)
    # Pigment fully baked into eye UV image; no independent iris/pupil parts.
    d.ellipse((center-radius-4,center-radius-4,
               center+radius+4,center+radius+4),fill=(43,34,29))
    for radius2 in range(radius,0,-1):
        t=radius2/radius
        d.ellipse((center-radius2,center-radius2,center+radius2,center+radius2),
                  fill=(int(99+40*(1-t)),int(77+39*(1-t)),int(54+28*(1-t))))
    for k in range(1400):
        a=math.tau*k/1400
        h=(k*1103515245+12345)&0xffffffff
        r0=pupil+8+h%38
        r1=radius-12-(h>>9)%28
        if r1<=r0:continue
        warm=(h>>15)%47
        col=(103+warm,72+warm//2,43+warm//4)
        d.line((center+math.cos(a)*r0,center+math.sin(a)*r0,
                center+math.cos(a)*r1,center+math.sin(a)*r1),
               fill=col,width=1+(h%2))
    d.ellipse((center-pupil-5,center-pupil-5,center+pupil+5,center+pupil+5),
              fill=(46,30,22))
    d.ellipse((center-pupil,center-pupil,center+pupil,center+pupil),
              fill=(11,9,10))
    return png(im)

def embed(g,b,name,content,sampler):
    imgid=len(g['images'])
    g['images'].append({'name':name,'mimeType':'image/png',
                        'bufferView':append(g,b,content)})
    texid=len(g['textures'])
    g['textures'].append({'source':imgid,'sampler':sampler})
    return texid

def refine(path):
    g,b=load(path)
    head=g['meshes'][0]
    skin=head['primitives'][0]
    info=head.get('extras',{})
    if info.get('version')!=121 or info['topology']['vertices']!=13455:
        raise ValueError('Refusing to modify any version other than female neutral v121')
    old_xyz=unpack(g,b,skin['attributes']['POSITION'])
    old_tri=unpack(g,b,skin['indices'])
    if len(old_xyz)!=13455 or len(old_tri)!=25920*3:
        raise ValueError('Unexpected 13455 vertex topology')
    faces=[tuple(v[0] for v in old_tri[k:k+3]) for k in range(0,len(old_tri),3)]
    xyz=[resculpt(v) for v in old_xyz]
    skin['attributes']['POSITION']=floats(g,b,xyz)
    skin['attributes']['NORMAL']=floats(g,b,calculate_normals(xyz,faces))
    # The inherited COLOR_0 provides subtle blush, lip tone and brow tint.
    # Old v121 texture bytes remain unreferenced but are not displayed.
    g['images']=[]
    g['textures']=[]
    g['samplers']=[{'magFilter':9729,'minFilter':9987,'wrapS':33071,'wrapT':33071}]
    albedo,orm,normal=skin_maps()
    a=embed(g,b,'V121_SkinAlbedo_2048',albedo,0)
    r=embed(g,b,'V121_SkinORM_2048',orm,0)
    n=embed(g,b,'V121_SkinNormal_2048',normal,0)
    eye=embed(g,b,'V121_EyeIrisPupilOnGlobe_2048',eye_map(),0)
    material=g['materials'][0]
    material['name']='V121_ANATOMICAL_SKIN_PBR_2048'
    material['pbrMetallicRoughness']={
        'baseColorFactor':[1,1,1,1],
        'baseColorTexture':{'index':a},
        'metallicFactor':0,'roughnessFactor':1,
        'metallicRoughnessTexture':{'index':r}}
    material['occlusionTexture']={'index':r,'strength':.40}
    material['normalTexture']={'index':n,'scale':.10}
    material['doubleSided']=False
    # Existing sclera globes are donor mesh 3/4. Refine their real geometry,
    # build UVs from object-space front projection, remove disc nodes/meshes.
    original_globes=[g['meshes'][3],g['meshes'][4]]
    original_nodes=[g['nodes'][0],g['nodes'][3],g['nodes'][4]]
    eye_counts=[]
    for side,globe in enumerate(original_globes):
        primitive=globe['primitives'][0]
        verts=list(unpack(g,b,primitive['attributes']['POSITION']))
        raw=unpack(g,b,primitive['indices'])
        triangles=[tuple(v[0] for v in raw[k:k+3]) for k in range(0,len(raw),3)]
        cache={}
        def midpoint(a,b):
            key=(min(a,b),max(a,b))
            if key not in cache:
                p=tuple((verts[a][i]+verts[b][i])*.5 for i in range(3))
                verts.append(tuple(.01880*t for t in unit(p)))
                cache[key]=len(verts)-1
            return cache[key]
        out=[]
        for a,b,c in triangles:
            ab,bc,ca=midpoint(a,b),midpoint(b,c),midpoint(c,a)
            out.extend(((a,ab,ca),(ab,b,bc),(ca,bc,c),(ab,bc,ca)))
        # No overlaid pupil/iris geometry: color moves with the curved globe.
        uvs=[(.5+v[0]/(.0188*2),.5-v[1]/(.0188*2)) for v in verts]
        primitive['attributes']={
            'POSITION':floats(g,b,verts),
            'NORMAL':floats(g,b,[unit(v) for v in verts]),
            'TEXCOORD_0':floats(g,b,uvs,'VEC2')}
        primitive['indices']=indices(g,b,[i for face in out for i in face])
        primitive['material']=1
        globe['name']='V121_EYE_GLOBE_UV_'+('L' if side==0 else 'R')
        original_nodes[side+1]['mesh']=side+1
        original_nodes[side+1]['translation'][2]-=.0007
        eye_counts.append(len(verts))
    eye_mat={
        'name':'V121_GLOBE_IRIS_PUPIL_UV_PBR',
        'pbrMetallicRoughness':{
            'baseColorFactor':[1,1,1,1],
            'baseColorTexture':{'index':eye},
            'metallicFactor':0,'roughnessFactor':.23},
        'extensions':{'KHR_materials_clearcoat':{
            'clearcoatFactor':.35,'clearcoatRoughnessFactor':.13}}}
    g.setdefault('extensionsUsed',[])
    if 'KHR_materials_clearcoat' not in g['extensionsUsed']:
        g['extensionsUsed'].append('KHR_materials_clearcoat')
    g['materials']=[material,eye_mat]
    g['meshes']=[head,*original_globes]
    g['nodes']=original_nodes
    g['scenes'][0]['nodes']=[0,1,2]
    info['eyeConstruction']={
        'mode':'sclera_iris_pupil_single_UV_on_curved_globe',
        'irisAndPupilSeparateMeshes':False,
        'resolution':RES,'globeVertices':eye_counts,
        'independentGazeNodes':True}
    info['pbr']={'albedoResolution':RES,'roughnessResolution':RES,
                 'normalResolution':RES,'eyeColorResolution':RES,
                 'embeddedImages':4,'ormOcclusion':True,'metallic':0}
    info['refinement']='real geometric cheek/jaw/nose/lip sculpt and eye sphere subdivision'
    g['asset']['generator']='HaiGin v121 UV Eyes and Anatomical Master 2026-11-23'
    g['buffers'][0]['byteLength']=len(b)
    j=json.dumps(g,ensure_ascii=False,separators=(',',':')).encode('utf-8')
    j+=b' '*((-len(j))%4)
    b+=b'\0'*((-len(b))%4)
    length=12+8+len(j)+8+len(b)
    with path.open('wb') as f:
        f.write(struct.pack('<4sII',b'glTF',2,length))
        f.write(struct.pack('<I4s',len(j),b'JSON'))
        f.write(j)
        f.write(struct.pack('<I4s',len(b),b'BIN\0'))
        f.write(b)
    print('v121 refreshed GLB',path.stat().st_size,'bytes',
          'skin vertices',len(xyz),'globe vertices',eye_counts,'PBR',RES)

if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('file',type=pathlib.Path)
    refine(parser.parse_args().file)
