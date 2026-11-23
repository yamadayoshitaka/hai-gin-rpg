#!/usr/bin/env python3
"""Build v121: bald, neutral, anatomical female bust with reference-guided PBR skin.

The supplied 2D front/profile+skin swatches guide *art direction*, not a claim
of photogrammetric reconstruction. Preserve v120's 13455 skin vertex IDs,
UVs, indexed triangles, iris/sclera meshes, and future expression regions.
Everything is embedded inside a self-contained GLB; no external PNG files.
"""
import argparse
import io
import json
import math
import pathlib
import struct
import subprocess
import sys
from PIL import Image, ImageFilter

SOURCE=pathlib.Path('assets/generated/neutral-face-v120.glb')
DEST=pathlib.Path('assets/generated/neutral-face-v121.glb')
PIXELS=1024

def read_glb(path):
    data=path.read_bytes()
    magic,version,length=struct.unpack_from('<4sII',data)
    if (magic,version,length)!=(b'glTF',2,len(data)):
        raise ValueError('Source must be GLB 2.0')
    ptr=12;gltf=None;buffer=None
    while ptr<len(data):
        size,kind=struct.unpack_from('<I4s',data,ptr)
        ptr+=8
        body=data[ptr:ptr+size]
        ptr+=size
        if kind==b'JSON':gltf=json.loads(body)
        if kind==b'BIN\0':buffer=bytearray(body)
    if gltf is None or buffer is None:raise ValueError('Invalid GLB chunks')
    return gltf,buffer

def unpack(gltf,buffer,index):
    a=gltf['accessors'][index]
    kind=a['componentType']
    fmt={5123:'H',5125:'I',5126:'f'}[kind]
    cols={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[a['type']]
    view=gltf['bufferViews'][a['bufferView']]
    base=view.get('byteOffset',0)+a.get('byteOffset',0)
    width=cols*struct.calcsize(fmt)
    return [tuple(struct.unpack_from('<'+fmt*cols,buffer,base+i*view.get('byteStride',width)))
            for i in range(a['count'])]

def clamp(v,a=0,b=1):return max(a,min(b,v))
def bell(v,c,w):return math.exp(-.5*((v-c)/w)**2)
def ramp(v,a,b):
    t=clamp((v-a)/(b-a))
    return t*t*(3-2*t)

def sculpt(v):
    x,y,z=v
    front=ramp(z,.012,.115)
    ax=abs(x)
    # Preserve the neutral eyelid loop and the lips by not pushing their
    # actual junction vertices independently from their contiguous surfaces.
    lower=bell(y,.171,.076)*bell(ax,.073,.049)*front
    chin=bell(y,.127,.037)*bell(x,0,.050)*front
    midface=bell(y,.254,.068)*(bell(x,-.063,.034)+bell(x,.063,.034))*front
    cheek=bell(y,.241,.057)*(bell(x,-.076,.031)+bell(x,.076,.031))*front
    nose=bell(x,0,.019)*bell(y,.252,.037)*front
    wings=(bell(x,-.029,.012)+bell(x,.029,.012))*bell(y,.245,.023)*front
    brow=bell(y,.321,.023)*(bell(x,-.042,.026)+bell(x,.042,.026))*front
    # Softer, narrower oval jaw, connected cheek volume, delicate nasal tip.
    nx=x*(1-.168*lower-.052*chin-.041*wings+.014*midface)
    nz=z+.0058*cheek+.0028*midface-.0048*nose-.0024*brow+.003*chin
    # Keep a natural female side profile, without an exaggerated protrusion.
    lip=bell(x,0,.039)*bell(y,.194,.029)*front
    nz-=.0015*lip
    return (nx,y,nz)

def color(v):
    x,y,z=v
    front=ramp(z,.045,.115)
    cheek=(bell(x,-.078,.040)+bell(x,.078,.040))*bell(y,.252,.052)*front
    lips=bell(x,0,.039)*bell(y,.194,.016)*front
    lid=(bell(x,-.043,.031)+bell(x,.043,.031))*bell(y,.312,.014)*front
    brow=(bell(x,-.044,.034)+bell(x,.044,.034))*bell(y,.353,.012)*front
    brow_line=(bell(x,-.044,.023)+bell(x,.044,.023))*bell(y,.337,.0043)*front
    ear=bell(abs(x),.135,.024)*bell(y,.267,.065)
    # 3D vertex-color makeup and light natural eyebrows, no painted shell.
    r=1.0-.025*lid-.022*brow-.38*brow_line-.055*lips
    g=1.0-.085*cheek-.045*ear-.44*lips-.045*lid-.065*brow-.54*brow_line
    b=1.0-.088*cheek-.048*ear-.36*lips-.045*lid-.075*brow-.59*brow_line
    return (clamp(r,.66,1),clamp(g,.58,1),clamp(b,.62,1))

def texture_images():
    """Deterministic ultra-subtle diffuse pore pattern and PBR maps (1024²)."""
    n=PIXELS
    albedo=bytearray(n*n*3)
    orm=bytearray(n*n*3)
    normals=bytearray(n*n*3)
    # A tiny fine-scale neutral pattern rather than photographic baked shadows.
    for y in range(n):
        for x in range(n):
            h=(x*374761393+y*668265263+0x121abc) & 0xffffffff
            h=(h^(h>>13))*1274126177 & 0xffffffff
            h^=h>>16
            value=(h%17)-8
            pore=(h%131)==0
            p=(y*n+x)*3
            bump=-3 if pore else 0
            albedo[p:p+3]=bytes((
                int(clamp(232+value*.25+bump,0,255)),
                int(clamp(207+value*.29+bump,0,255)),
                int(clamp(199+value*.27+bump,0,255))))
            rough=int(clamp(187+value*.75+(4 if pore else 0),0,255))
            orm[p:p+3]=bytes((255,rough,0))
            normals[p:p+3]=bytes((128+int(value*.42),128-int(value*.32),255))
    def png(raw):
        image=Image.frombytes('RGB',(n,n),bytes(raw))
        out=io.BytesIO()
        image.save(out,format='PNG',optimize=True,compress_level=8)
        return out.getvalue()
    return (png(albedo),png(orm),png(normals))

def build(source,destination):
    gltf,buffer=read_glb(source)
    mesh=gltf['meshes'][0];p=mesh['primitives'][0]
    positions=unpack(gltf,buffer,p['attributes']['POSITION'])
    if len(positions)!=13455 or gltf['meshes'][0].get('extras',{}).get('version')!=120:
        raise ValueError('Expected verified v120 anatomical source and rest vertex IDs')
    indexes=unpack(gltf,buffer,p['indices'])
    if len(indexes)!=25920*3:raise ValueError('Unexpected base triangle count')
    # Retain face/eye/lip rest topology for later animation; move only points.
    positions=[sculpt(v) for v in positions]
    colors=[color(v) for v in positions]
    def put(raw):
        while len(buffer)%4:buffer.append(0)
        start=len(buffer)
        buffer.extend(raw)
        index=len(gltf['bufferViews'])
        gltf['bufferViews'].append({'buffer':0,'byteOffset':start,'byteLength':len(raw)})
        return index
    def floats(rows,shape):
        count={'VEC3':3}[shape]
        payload=b''.join(struct.pack('<'+'f'*count,*row) for row in rows)
        view=put(payload)
        ac={'bufferView':view,'componentType':5126,'count':len(rows),'type':shape}
        ac['min']=[min(row[j] for row in rows) for j in range(count)]
        ac['max']=[max(row[j] for row in rows) for j in range(count)]
        index=len(gltf['accessors']);gltf['accessors'].append(ac)
        return index
    p['attributes']['POSITION']=floats(positions,'VEC3')
    p['attributes']['COLOR_0']=floats(colors,'VEC3')
    # The displaced head needs recomputed normals, *not* old v120 normals.
    norms=[[0.,0.,0.] for _ in positions]
    for i in range(0,len(indexes),3):
        a,b,c=(indexes[j][0] for j in (i,i+1,i+2))
        u=[positions[b][j]-positions[a][j] for j in range(3)]
        v=[positions[c][j]-positions[a][j] for j in range(3)]
        n=(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0])
        for k in (a,b,c):
            for j in range(3):norms[k][j]+=n[j]
    normal=[]
    for x,y,z in norms:
        length=math.sqrt(x*x+y*y+z*z)
        normal.append((x/length,y/length,z/length) if length>1e-12 else (0.,0.,1.))
    p['attributes']['NORMAL']=floats(normal,'VEC3')
    albedo,roughness,normalTex=texture_images()
    gltf.setdefault('images',[])
    gltf.setdefault('textures',[])
    gltf.setdefault('samplers',[])
    sampler=len(gltf['samplers'])
    gltf['samplers'].append({'magFilter':9729,'minFilter':9987,'wrapS':10497,'wrapT':10497})
    indices=[]
    for name,blob in [('SkinAlbedo',albedo),('SkinRoughness',roughness),('SkinMicroNormal',normalTex)]:
        image_id=len(gltf['images'])
        gltf['images'].append({'name':'V121_'+name,'mimeType':'image/png',
                               'bufferView':put(blob)})
        texture_id=len(gltf['textures'])
        gltf['textures'].append({'source':image_id,'sampler':sampler})
        indices.append(texture_id)
    skin=gltf['materials'][0]
    skin['name']='V121_PORCELAIN_SKIN_PBR'
    skin['pbrMetallicRoughness']={
        'baseColorFactor':[1,1,1,1],
        'baseColorTexture':{'index':indices[0]},
        'metallicFactor':0,
        'roughnessFactor':1,
        'metallicRoughnessTexture':{'index':indices[1]}}
    skin['normalTexture']={'index':indices[2],'scale':.18}
    skin['doubleSided']=True
    # Real iris rings: the CC0 donor has a tiny hole in its iris center,
    # through which the white sclera was incorrectly visible. Add a true,
    # dark pupil disc at that center, and pigment the ring vertices.
    gltf['materials'][1]['name']='V121_HAZEL_BROWN_IRIS'
    gltf['materials'][1]['pbrMetallicRoughness']={
        'baseColorFactor':[1,1,1,1],'metallicFactor':0,'roughnessFactor':.29}
    gltf['materials'][1]['doubleSided']=True
    for iris_index in [1,2]:
        ip=gltf['meshes'][iris_index]['primitives'][0]
        iris_xyz=unpack(gltf,buffer,ip['attributes']['POSITION'])
        iris_color=[]
        for xx,yy,zz in iris_xyz:
            r=math.hypot(xx,yy)
            if r<.0038:
                tint=(.19,.115,.074)
            elif r<.0075:
                tint=(.51,.315,.185)
            else:
                tint=(.14,.09,.062)
            iris_color.append(tint)
        ip['attributes']['COLOR_0']=floats(iris_color,'VEC3')
    iris_nodes=[]
    for node in gltf['nodes']:
        if 'iris.' in node.get('name','').lower():
            if 'translation' in node:
                node['translation'][2]+=0.0045
            elif 'matrix' in node:
                node['matrix'][14]+=0.0045
            iris_nodes.append(node)
    if len(iris_nodes)!=2:
        raise ValueError('Expected exactly two source iris node transforms')
    # One shared, low-poly pupil mesh, two nodes inheriting each iris's matrix.
    pupil_xyz=[(0.,0.,.0165)]
    pupil_xyz.extend((math.cos(i*math.tau/40)*.0034,
                      math.sin(i*math.tau/40)*.0034,.0165) for i in range(40))
    pupil_pos=floats(pupil_xyz,'VEC3')
    pupil_nor=floats([(0.,0.,1.)]*len(pupil_xyz),'VEC3')
    pupil_faces=[]
    for i in range(40):
        pupil_faces.extend((0,i+1,(i+1)%40+1))
    view=put(b''.join(struct.pack('<I',j) for j in pupil_faces))
    pup_indices=len(gltf['accessors'])
    gltf['accessors'].append({
        'bufferView':view,'componentType':5125,'count':len(pupil_faces),'type':'SCALAR'})
    matid=len(gltf['materials'])
    gltf['materials'].append({
        'name':'V121_DARK_BROWN_PUPIL','doubleSided':True,
        'pbrMetallicRoughness':{'baseColorFactor':[.042,.026,.021,1],
                               'metallicFactor':0,'roughnessFactor':.22}})
    meshid=len(gltf['meshes'])
    gltf['meshes'].append({
        'name':'V121_PUPIL_DISC_SAFELY_SEPARATE',
        'primitives':[{'attributes':{'POSITION':pupil_pos,'NORMAL':pupil_nor},
                       'indices':pup_indices,'material':matid}]})
    for j,node in enumerate(iris_nodes):
        pupil_node={'name':'V121_PUPIL_'+('L' if j==0 else 'R'),'mesh':meshid}
        if 'matrix' in node:pupil_node['matrix']=list(node['matrix'])
        else:
            for field in ('translation','rotation','scale'):
                if field in node:pupil_node[field]=list(node[field])
        nid=len(gltf['nodes'])
        gltf['nodes'].append(pupil_node)
        gltf['scenes'][0]['nodes'].append(nid)
    gltf['materials'][2]['name']='V121_NATURAL_IVORY_SCLERA'
    gltf['materials'][2]['pbrMetallicRoughness']={
        'baseColorFactor':[.94,.91,.87,1],'metallicFactor':0,'roughnessFactor':.3}
    mesh['name']='V121_BALD_FEMALE_NEUTRAL_SKIN'
    meta=mesh.setdefault('extras',{})
    meta.update({
        'version':121,'hairIncluded':False,'neutralOnly':True,
        'reference':'User-provided front/profile and skin-detail reference render',
        'referenceMethod':'hand-tuned 3D facial proportions / procedural PBR, not a 3D scan',
        'futureExpressionsImplemented':False,
        'preservedTopology':'v120 source: 13455 vertices, 25920 triangles, UV and vertex IDs',
        'pbr':{'albedoResolution':1024,'roughnessResolution':1024,'normalResolution':1024,
               'embeddedImages':3,'metallic':0}})
    gltf['asset']['generator']='HaiGin V121 Bald Reference-Portrait & PBR Skin'
    gltf['buffers'][0]['byteLength']=len(buffer)
    payload=json.dumps(gltf,ensure_ascii=False,separators=(',',':')).encode('utf-8')
    payload+=b' '*((-len(payload))%4)
    buffer+=b'\0'*((-len(buffer))%4)
    full=12+8+len(payload)+8+len(buffer)
    destination.parent.mkdir(parents=True,exist_ok=True)
    with destination.open('wb') as out:
        out.write(struct.pack('<4sII',b'glTF',2,full))
        out.write(struct.pack('<I4s',len(payload),b'JSON'));out.write(payload)
        out.write(struct.pack('<I4s',len(buffer),b'BIN\0'));out.write(buffer)
    print(f'v121 bald female: {len(positions)} vertices, {len(indexes)//3} triangles, '
          f'3 PBR textures; {destination.stat().st_size} bytes')

if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--source',type=pathlib.Path,default=SOURCE)
    parser.add_argument('--out',type=pathlib.Path,default=DEST)
    args=parser.parse_args()
    build(args.source,args.out)
    subprocess.run([sys.executable,'scripts/refine-neutral-face-v121.py',str(args.out)],check=True)
