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
    """Natural muscle-inspired, neutral-relative shape deformation.

    Volumes fade out from each facial region. Hair, brow, liner and eyelash
    morph with the skin, preventing obvious detached expression parts.
    """
    ax=abs(x)
    sign=1. if x>=0 else -1.
    front=fade(z,.055,.121)
    if part!='skin':
        front=1.
    eye=bell(ax,.043,.027)*bell(y,.308,.028)*front
    outer=bell(ax,.048,.022)*bell(y,.308,.026)*front
    brow=bell(ax,.039,.032)*bell(y,.342,.022)*front
    inner_brow=bell(ax,.025,.015)*bell(y,.342,.020)*front
    cheek=bell(ax,.067,.038)*bell(y,.260,.040)*front
    corner=bell(ax,.042,.015)*bell(y,.196,.021)*front
    lip=bell(x,0,.044)*bell(y,.195,.029)*front
    upper=bell(y,.211,.013)*lip
    lower=bell(y,.184,.013)*lip
    top_lid=bell(y,.320,.008)*eye
    lower_lid=bell(y,.296,.008)*eye
    if name=='blink':
        # Eyelids/lashes close together; true geometry, not opacity flash.
        return (0.,-.0140*top_lid+.0070*lower_lid, .0016*top_lid)
    if name=='smile':
        return (sign*.0028*corner, .0072*corner+.0011*cheek,
                .0019*cheek+.0006*corner)
    if name=='laugh':
        return (sign*.0035*corner,
                .0090*corner+.0020*cheek+.0033*upper-.007*lower,
                .0027*cheek+.0012*corner)
    if name=='angry':
        return (0.,-.0080*inner_brow+.0012*(brow-inner_brow)-.0010*eye,
                .0006*inner_brow)
    if name=='sad':
        return (-sign*.0017*corner,
                .0082*inner_brow-.0012*brow-.0055*corner,
                -.0007*corner)
    if name=='mouthOpen':
        return (0.,.0037*upper-.0120*lower,-.0020*lip)
    if name=='vowelA':
        return (0.,.0027*upper-.0150*lower,-.0020*lip)
    if name=='vowelI':
        return (sign*.0045*corner,.0015*upper-.0030*lower,-.0008*lip)
    if name=='vowelU':
        return (-sign*.0060*corner,.0017*upper-.0065*lower,.0020*lip)
    if name=='vowelE':
        return (sign*.0038*corner,.0028*upper-.0070*lower,-.0010*lip)
    if name=='vowelO':
        return (-sign*.0050*corner,.0032*upper-.0110*lower,.0019*lip)
    raise ValueError(name)


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
        'eyeGlobesRemainIndependent':True}
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
