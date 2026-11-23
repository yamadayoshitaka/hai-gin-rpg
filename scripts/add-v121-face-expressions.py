#!/usr/bin/env python3
"""Bake v121-only facial expression morph targets and self-contained GLB clips.

Preserves the original 13,455 indexed skin vertices, UVs, PBR, and neutral
pose. Expression controls are true glTF morph target POSITION deltas.
"""
import argparse
import json
import math
import pathlib
import struct

NAMES=['blink','smile','laugh','angry','sad','mouthOpen',
       'vowelA','vowelI','vowelU','vowelE','vowelO']


def bell(v,c,w):
    return math.exp(-.5*((v-c)/w)**2)


def fade(v,a,b):
    t=max(0.,min(1.,(v-a)/(b-a)))
    return t*t*(3.-2.*t)


def open_glb(path):
    raw=path.read_bytes()
    if raw[:4]!=b'glTF' or struct.unpack_from('<II',raw,4)!=(2,len(raw)):
        raise ValueError('Invalid GLB header')
    j=struct.unpack_from('<I',raw,12)[0]
    g=json.loads(raw[20:20+j])
    if raw[24+j:28+j]!=b'BIN\0':
        raise ValueError('Missing BIN chunk')
    return g,bytearray(raw[28+j:])


def vertices(g,b,accessor):
    a=g['accessors'][accessor]
    view=g['bufferViews'][a['bufferView']]
    if a['componentType']!=5126 or a['type']!='VEC3':
        raise ValueError('Expected float VEC3 positions')
    offset=view.get('byteOffset',0)+a.get('byteOffset',0)
    stride=view.get('byteStride',12)
    return [struct.unpack_from('<fff',b,offset+i*stride)
            for i in range(a['count'])]


def add_float(g,b,rows,shape='VEC3'):
    if shape=='VEC3':
        content=b''.join(struct.pack('<fff',*v) for v in rows)
        count=len(rows)
    elif shape=='VEC2':
        content=b''.join(struct.pack('<ff',*v) for v in rows)
        count=len(rows)
    else:
        content=b''.join(struct.pack('<f',v) for v in rows)
        count=len(rows)
    while len(b)%4:b.append(0)
    off=len(b)
    b.extend(content)
    vi=len(g['bufferViews'])
    g['bufferViews'].append({'buffer':0,'byteOffset':off,
                             'byteLength':len(content)})
    ai=len(g['accessors'])
    a={'bufferView':vi,'componentType':5126,'count':count,'type':shape}
    if shape=='VEC3' and rows:
        a['min']=[min(v[k] for v in rows) for k in range(3)]
        a['max']=[max(v[k] for v in rows) for k in range(3)]
    g['accessors'].append(a)
    return ai


def deformation(name,x,y,z,part):
    """Facial action units with separate lips, corners, brows and cheeks.

    Original v121 phonemes pulled the entire mandibular region downward
    because lower lip was gated by a broad gaussian. The mouth now uses
    narrow vermilion bands and independent lateral/vertical movements.
    Chin and neck vertices below y=.160 must remain practically stationary.
    The oral cavity preview is handled as separate geometry by WebGL.
    """
    ax=abs(x)
    sign=1. if x>=0 else -1.
    front=fade(z,.055,.121) if part=='skin' else 1.
    mouth_front=fade(z,.105,.136) if part=='skin' else 1.
    eye=bell(ax,.043,.027)*bell(y,.308,.028)*front
    brow=bell(ax,.039,.032)*bell(y,.342,.022)*front
    inner_brow=bell(ax,.025,.015)*bell(y,.342,.020)*front
    cheek=bell(ax,.066,.039)*bell(y,.260,.035)*front
    # Actual lip bands rather than a whole-jaw deformation.
    lip_span=bell(x,0,.035)*mouth_front
    upper=bell(y,.2400,.008)*lip_span
    lower=bell(y,.2235,.009)*lip_span
    corner=bell(ax,.043,.013)*bell(y,.232,.014)*mouth_front
    top_lid=bell(y,.320,.008)*eye
    lower_lid=bell(y,.296,.008)*eye
    if name=='blink':
        return (0.,-.0140*top_lid+.0070*lower_lid,.0016*top_lid)
    if name=='smile':
        return (sign*.0066*corner,
                .0122*corner+.0037*cheek+.0015*upper,
                .0025*cheek+.0009*corner)
    if name=='laugh':
        return (sign*.0074*corner,
                .0090*corner+.0032*cheek+.0044*upper-.0105*lower,
                .0032*cheek+.0010*corner)
    if name=='angry':
        return (0.,-.0080*inner_brow+.0012*(brow-inner_brow)-.0010*eye,
                .0006*inner_brow)
    if name=='sad':
        return (-sign*.0025*corner,
                .0082*inner_brow-.0012*brow-.0062*corner,
                -.0007*corner)
    # Recess the central mouth surface while the upper and lower lip rings
    # separate. Chin and cervical tissue remain motionless.
    center=bell(x,0,.027)*bell(y,.232,.008)*mouth_front if part=='skin' else 0.
    if name=='mouthOpen':
        return (sign*.0027*corner,.0052*upper-.0108*lower,
                -.0145*center-.0007*lower)
    if name=='vowelA':
        return (sign*.0032*corner,.0065*upper-.0140*lower,
                -.0170*center-.0008*lower)
    if name=='vowelI':
        return (sign*.0065*corner,.0017*upper-.0027*lower,
                -.0040*center+.0004*corner)
    if name=='vowelU':
        return (-sign*.0053*corner,.0032*upper-.0068*lower,
                -.0090*center+.0022*(upper+lower))
    if name=='vowelE':
        return (sign*.0052*corner,.0038*upper-.0072*lower,
                -.0080*center-.0005*lower)
    if name=='vowelO':
        return (-sign*.0048*corner,.0047*upper-.0112*lower,
                -.0130*center+.0015*(upper+lower))
    raise ValueError(name)


def append_oral_parts(g,b,head_xyz):
    """Real PBR 3D oral cavity, teeth, tongue: neutral hidden; visemes visible."""
    front=[p for p in head_xyz if abs(p[0])<.056 and .209<p[1]<.259 and p[2]>.09]
    if len(front)<50:raise ValueError('Cannot locate lip surface for mouth cavity')
    def surface(x,y):
        nearest=sorted(front,key=lambda p:(p[0]-x)**2+(p[1]-y)**2)[:6]
        return max(p[2] for p in nearest)
    # Anatomical mouth width is materially smaller than the full lower
    # face.  Previous preview used a 60-mm-wide flat ellipse resembling a
    # painted cartoon disc. Width and height below are half-extents in GLB
    # LOCAL head space; the teeth/tongue sit behind lip skin, not in front.
    styles={'smile':(.025,.0030),'laugh':(.024,.010),
       'mouthOpen':(.021,.010),'vowelA':(.019,.012),'vowelI':(.026,.0030),
       'vowelU':(.012,.007),'vowelE':(.024,.0055),'vowelO':(.014,.0095)}
    def pack_indices(seq):
        raw=b''.join(struct.pack('<I',v) for v in seq)
        while len(b)%4:b.append(0)
        off=len(b);b.extend(raw)
        v=len(g['bufferViews'])
        g['bufferViews'].append({'buffer':0,'byteOffset':off,
                                 'byteLength':len(raw),'target':34963})
        a=len(g['accessors'])
        g['accessors'].append({'bufferView':v,'componentType':5125,
          'count':len(seq),'type':'SCALAR','min':[min(seq)],'max':[max(seq)]})
        return a
    nodes=[]
    for kind,color in (
      ('V121_ORAL_CAVITY',[.115,.03,.044,1.]),
      ('V121_ORAL_UPPER_TEETH',[.90,.85,.76,1.]),
      ('V121_ORAL_TONGUE',[.56,.19,.23,1.])):
        if kind.endswith('CAVITY'):
            # Taper the aperture at both lip corners (not a circular disc).
            poly=[(math.cos(j*math.tau/32),
                   math.sin(j*math.tau/32)*
                   (1.-.48*abs(math.cos(j*math.tau/32))))
                  for j in range(32)]
            inds=[q for j in range(1,31) for q in (0,j,j+1)]
        elif kind.endswith('TEETH'):
            # Six distinct small off-white teeth, avoiding the former single
            # uninterrupted rectangular bar across the mouth.
            poly=[];inds=[]
            for tooth in range(6):
                left=-.93+tooth*.31
                right=left+.275
                start=len(poly)
                poly.extend(((left,-1.),(right,-1.),(right,.65),(left,.65)))
                inds.extend((start,start+1,start+2,
                             start,start+2,start+3))
        else:
            # Rounded tongue patch recessed into the lower cavity.
            poly=[(.75*math.cos(j*math.tau/20),
                   -.50+.36*math.sin(j*math.tau/20))
                  for j in range(20)]
            inds=[q for j in range(1,19) for q in (0,j,j+1)]
        rest=[(xx*.0002,.232+yy*.00008,surface(0,.232)-.028)
              for xx,yy in poly]
        mat=len(g['materials'])
        g['materials'].append({'name':kind+'_PBR','doubleSided':True,
          'pbrMetallicRoughness':{'baseColorFactor':color,'metallicFactor':0.,
          'roughnessFactor':.76}})
        targets=[]
        for name in NAMES:
            wh=styles.get(name)
            if wh is None:
                targets.append({'POSITION':add_float(g,b,[(0.,0.,0.)]*len(poly))})
                continue
            width,height=wh
            dst=[]
            for xx,yy in poly:
                if kind.endswith('CAVITY'):
                    x=xx*width;y=.232+yy*height
                    # Dark cavity recessed behind separated lip edges.
                    dz=-.0105-.0010*abs(yy)
                elif kind.endswith('TEETH'):
                    x=xx*width*.69;y=.232+height*(.47+.12*yy)
                    dz=-.0058
                else:
                    x=xx*width*.55;y=.232-height*(.53-.13*yy)
                    dz=-.0050
                z=surface(x,y)+dz
                dst.append((x,y,z))
            targets.append({'POSITION':add_float(g,b,[
                tuple(dst[j][k]-rest[j][k] for k in range(3))
                for j in range(len(rest))])})
        mesh_id=len(g['meshes'])
        g['meshes'].append({'name':kind,
            'primitives':[{'attributes':{'POSITION':add_float(g,b,rest),
             'NORMAL':add_float(g,b,[(0.,0.,1.)]*len(rest))},
             'indices':pack_indices(inds),'material':mat,'targets':targets}],
            'weights':[0.]*len(NAMES),
            'extras':{'targetNames':list(NAMES),'v121OralPart':True}})
        node_id=len(g['nodes'])
        # Coordinates above are in the native head mesh's LOCAL space.
        # The original head node is translated by about -0.207 in Y and
        # scaled to 0.9. Without copying its transform, teeth and tongue
        # float above the face instead of showing inside its opening.
        head_node=next(n for n in g['nodes'] if n.get('mesh')==0)
        placement={key:head_node[key] for key in
                   ('translation','rotation','scale','matrix') if key in head_node}
        g['nodes'].append({'name':kind,'mesh':mesh_id,**placement})
        nodes.append(node_id)
    g['scenes'][g.get('scene',0)].setdefault('nodes',[]).extend(nodes)
    return nodes



def read_indices(g,b,index):
    a=g['accessors'][index]
    view=g['bufferViews'][a['bufferView']]
    if a['type']!='SCALAR' or a['componentType'] not in (5123,5125):
        raise ValueError('Unexpected v121 skin index format')
    fmt='H' if a['componentType']==5123 else 'I'
    width=struct.calcsize(fmt)
    off=view.get('byteOffset',0)+a.get('byteOffset',0)
    step=view.get('byteStride',width)
    return [struct.unpack_from('<'+fmt,b,off+i*step)[0]
            for i in range(a['count'])]


def read_uv(g,b,index):
    a=g['accessors'][index]
    view=g['bufferViews'][a['bufferView']]
    if a['componentType']!=5126 or a['type']!='VEC2':
        raise ValueError('Expected v121 float UV coordinates')
    off=view.get('byteOffset',0)+a.get('byteOffset',0)
    step=view.get('byteStride',8)
    return [struct.unpack_from('<ff',b,off+i*step)
            for i in range(a['count'])]


def store_indices(g,b,indices):
    while len(b)%4:b.append(0)
    off=len(b)
    b.extend(b''.join(struct.pack('<I',v) for v in indices))
    view=len(g['bufferViews'])
    g['bufferViews'].append({'buffer':0,'byteOffset':off,
                             'byteLength':len(indices)*4,'target':34963})
    index=len(g['accessors'])
    g['accessors'].append({'bufferView':view,'componentType':5125,
                           'count':len(indices),'type':'SCALAR',
                           'min':[min(indices)],'max':[max(indices)]})
    return index


def split_native_mouth_seal(g,b,head):
    """Create a genuine opening with a closed-rest skin seal.

    A mouth painted over the unbroken facial surface can never display a
    cavity.  Only the small central oral face triangles become separately
    morphable skin, with matching POSITION/NORMAL/UV/COLOR and skin material.
    The main vertex IDs and index count stay stable (replaced triangles are
    degenerate and cannot render).  The rest seal occupies the precise
    original faces: opening is invisible at neutral, but the seal retreats
    behind the oral cavity on phonemes, exposing the real aperture.
    """
    p=head['primitives'][0]
    xyz=vertices(g,b,p['attributes']['POSITION'])
    normal=vertices(g,b,p['attributes']['NORMAL'])
    color=vertices(g,b,p['attributes']['COLOR_0'])
    uv=read_uv(g,b,p['attributes']['TEXCOORD_0'])
    indices=read_indices(g,b,p['indices'])
    if len(xyz)!=13455 or len(indices)!=25920*3:
        raise ValueError('Only fixed female v121 skin can be split')
    triangles=[indices[i:i+3] for i in range(0,len(indices),3)]
    # Only split the lip-to-lip seam, not the actual upper/lower
    # vermilion ridges or the cheek-adjacent skin.
    inside=lambda v:(abs(v[0])<.032 and .2308<v[1]<.2345
                      and v[2]>.115)
    to_split=[i for i,t in enumerate(triangles)
              if all(inside(xyz[k]) for k in t)]
    if not 8<=len(to_split)<=600:
        raise ValueError('Unsafe aperture topology: %d face triangles'%
                         len(to_split))
    mouth_ids=sorted({k for i in to_split for k in triangles[i]})
    local={k:i for i,k in enumerate(mouth_ids)}
    skin_indices=list(indices)
    seal_indices=[]
    for i in to_split:
        tri=triangles[i]
        seal_indices.extend(local[k] for k in tri)
        # Preserve index-buffer length and all original vertex identifiers.
        skin_indices[3*i:3*i+3]=[tri[0]]*3
    p['indices']=store_indices(g,b,skin_indices)
    base=[xyz[k] for k in mouth_ids]
    targets=[]
    for name in NAMES:
        result=[]
        amplitude={
            'mouthOpen':.042,'vowelA':.048,'vowelI':.019,
            'vowelU':.031,'vowelE':.028,'vowelO':.041,
            'laugh':.031,'smile':.011
        }.get(name,0.)
        for x,y,z in base:
            dx,dy,dz=deformation(name,x,y,z,'skin')
            # Keep skin in place at the outer aperture rim; the original
            # broader seal recession exposed jagged triangles beside lips.
            taper=(1.-fade(abs(x),.016,.024))*(
                fade(y,.228,.231)*(1.-fade(y,.234,.237)))
            result.append((dx,dy,dz-amplitude*taper))
        targets.append({'POSITION':add_float(g,b,result)})
    seal_prim={
        'attributes':{
            'POSITION':add_float(g,b,base),
            'NORMAL':add_float(g,b,[normal[k] for k in mouth_ids]),
            'TEXCOORD_0':add_float(g,b,[uv[k] for k in mouth_ids],'VEC2'),
            'COLOR_0':add_float(g,b,[color[k] for k in mouth_ids])},
        'indices':store_indices(g,b,seal_indices),
        'material':p['material'],
        'targets':targets
    }
    # Attaching the skin seal to an existing oral node means the 11 meshes,
    # 9 animated nodes, original controls and 2 baked clips remain compatible.
    cavity=next(m for m in g['meshes'] if m['name']=='V121_ORAL_CAVITY')
    cavity['primitives'].append(seal_prim)
    return {
        'version':'female-v121-split-lip-seal-v4',
        'detachedSkinTriangles':len(to_split),
        'sealVertices':len(mouth_ids),
        'sealAttachedTo':'V121_ORAL_CAVITY',
        'neutralAppearanceIdentical':True,
        'skinVertexIdsPreserved':13455,
        'skinIndexCountPreserved':len(skin_indices),
        'openingFromRealTopology':True,
        'noChinOrNeckTrianglesDetached':True
    }


def animation(g,b,name,times,frames,nodes):
    assert len(times)==len(frames)
    inp=add_float(g,b,times,'SCALAR')
    values=[]
    for frame in frames:
        values.extend(float(frame.get(n,0.)) for n in NAMES)
    output=add_float(g,b,values,'SCALAR')
    return {
        'name':name,
        'samplers':[{'input':inp,'output':output,'interpolation':'LINEAR'}],
        'channels':[{'sampler':0,'target':{'node':node,'path':'weights'}}
                    for node in nodes]}


def build(path):
    g,b=open_glb(path)
    head=g['meshes'][0]
    meta=head.get('extras',{})
    if meta.get('version')!=121 or meta.get('hairIncluded') is not False:
        raise ValueError('Only female bald face v121 is supported')
    if len(g['meshes'])!=8 or len(g['nodes'])!=8:
        raise ValueError('Unexpected original GLB topology')
    if head.get('primitives',[{}])[0].get('targets'):
        raise ValueError('Do not apply morph targets twice')
    nodes=[]
    count={}
    for i,mesh in enumerate(g['meshes']):
        if i in (1,2):continue  # eye globes stay separate for gaze animation
        prim=mesh['primitives'][0]
        xyz=vertices(g,b,prim['attributes']['POSITION'])
        if i==0 and len(xyz)!=13455:
            raise ValueError('Skin topology changed unexpectedly')
        part='skin' if i==0 else 'accessory'
        targets=[]
        for name in NAMES:
            deltas=[deformation(name,*v,part) for v in xyz]
            targets.append({'POSITION':add_float(g,b,deltas)})
        prim['targets']=targets
        mesh['weights']=[0.]*len(NAMES)
        mesh.setdefault('extras',{})['targetNames']=list(NAMES)
        count[mesh.get('name','mesh-'+str(i))]=len(xyz)
        nodes.extend(j for j,node in enumerate(g['nodes']) if node.get('mesh')==i)
    if len(nodes)!=6:raise ValueError('Expected skin and five cosmetic morph nodes')
    nodes.extend(append_oral_parts(g,b,vertices(g,b,head['primitives'][0]['attributes']['POSITION'])))
    aperture=split_native_mouth_seal(g,b,head)
    base={}
    blink=[
        (0.00,{}),(.12,{'blink':.3}),(.20,{'blink':1.}),
        (.30,{'blink':.65}),(.43,{}),(2.50,{})]
    showcase=[
        (0.,{}),(.4,{'smile':.3}),(1.25,{'smile':1.}),
        (2.0,{'laugh':.85}),(2.6,{}),(3.3,{'angry':1.}),
        (4.0,{}),(4.7,{'sad':1.}),(5.3,{}),
        (5.8,{'mouthOpen':1.}),(6.2,{'vowelA':1.}),
        (6.55,{'vowelI':1.}),(6.85,{'vowelU':1.}),
        (7.15,{'vowelE':1.}),(7.5,{'vowelO':1.}),(8.,{})]
    g['animations']=[
        animation(g,b,'V121_BlinkLoop',[v[0] for v in blink],[v[1] for v in blink],nodes),
        animation(g,b,'V121_ExpressionShowcase',[v[0] for v in showcase],
                  [v[1] for v in showcase],nodes)]
    meta['futureExpressionsImplemented']=True
    meta['facialExpressionRig']={
        'version':'v121-real-morph-20261123',
        'channels':NAMES,
        'neutralMorphWeights':[0.]*len(NAMES),
        'animatedMeshes':len(nodes),
        'animationNames':[clip['name'] for clip in g['animations']],
        'preservesSkinVertexIDs':13455,
        'eyeGlobesRemainIndependent':True,
        'oralCavityMeshNames':['V121_ORAL_CAVITY','V121_ORAL_UPPER_TEETH','V121_ORAL_TONGUE'],
        'mouthShapeVersion':'independent_vermilion_real_aperture_v4',
         'skinMouthCenterInwardOnOpening':True,
        'jawNeckStationary':True,
        'oralCavityPreview':'native_glb_morphed_oral_cavity_teeth_tongue',
        'oralPartsInSkinLocalSpace':True,
        'mouthCenterLocalY':.232,
        'splitMouthSeal':aperture}
    if 'referenceFeatureSculpt' in meta:
        meta['referenceFeatureSculpt']['facialExpressionAnimations']=True
    if 'naturalFoldCleanup' in meta:
        meta['naturalFoldCleanup']['expressionAnimationImplemented']=True
    g['asset']['generator']='HaiGin v121 PBR Makeup & 11 Real Facial Morph Targets'
    g['buffers'][0]['byteLength']=len(b)
    blob=json.dumps(g,ensure_ascii=False,separators=(',',':')).encode('utf8')
    blob+=b' '*((-len(blob))%4)
    b+=b'\0'*((-len(b))%4)
    length=12+8+len(blob)+8+len(b)
    with path.open('wb') as f:
        f.write(struct.pack('<4sII',b'glTF',2,length))
        f.write(struct.pack('<I4s',len(blob),b'JSON'));f.write(blob)
        f.write(struct.pack('<I4s',len(b),b'BIN\0'));f.write(b)
    print('v121 3D morphs and GLB animation clips',json.dumps({
        'channels':NAMES,'meshVertices':count,'animations':len(g['animations']),
        'bytes':length}))


if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('glb',type=pathlib.Path)
    build(parser.parse_args().glb)
