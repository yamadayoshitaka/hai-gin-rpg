#!/usr/bin/env python3
"""v26: reduce actual upper vermilion height; remove dark sublabial shading."""
import math, pathlib, runpy, json, struct, sys, statistics
H=runpy.run_path(str(pathlib.Path(__file__).with_name('finish-v121-natural-folds.py')))
S=runpy.run_path(str(pathlib.Path(__file__).with_name('fair-v121-skin-v23.py')))
fade=H['fade'];bell=H['bell'];unit=S['unit']

def borders(x):
    a=abs(x); c=1-fade(a,.014,.034)
    return .232+(.2422+.0022*bell(a,.0095,.005)-.00055*bell(a,0.,.0038)-.232)*c,.232+(.2235-.232)*c

def upper_weight(p):
    x,y,z=p
    return (1-fade(abs(x),.018,.038))*fade(z,.119,.139)*fade(y,.2345,.2375)*(1-fade(y,.246,.253))

def below_weight(p):
    x,y,z=p
    return (1-fade(abs(x),.024,.046))*fade(z,.095,.125)*fade(y,.182,.201)*(1-fade(y,.219,.225))

def sculpt(p):
    x,y,z=p
    w=upper_weight(p)
    # Compress the actual upper-lip boundary vertically, leaving the mouth
    # seal, lower rim, nasal base and eyes untouched.
    shift=min(.0038,.30*max(0.,y-.2345))*w
    # Strictly preserve the aperture classifier used by the expression baker.
    # No vertex above the seam can cross its .2345 upper boundary.
    # Lift only the broad sublabial skin, avoiding a second narrow ridge.
    support=.00065*below_weight(p)*bell(y,.208,.010)
    if .2308<y<.2345:return p
    return (x,y-shift,z+support)

def lip_amount(x,y,z):
    u,l=borders(x)
    if abs(x)>=.047 or z<=.119 or y<.219 or y>.252 or u-l<=.001:return 0.
    mask=fade(y,l-.0005,l+.0015)*(1-fade(y,u-.0012,u+.0004))
    mask*=(1-fade(abs(x),.024,.036))*bell(x,0.,.029)*fade(z,.127,.144)
    return H['clamp']((1.03*bell(y,.2375,.0053)+.86*bell(y,.227,.0065))*mask)

def color(x,y,z):
    c=H['neutral_color'](x,y,z)
    old=H['clamp']((1.03*bell(y,.239,.0068)+.86*bell(y,.227,.0065))*H['vermilion_outline'](x,y,z)[0])
    delta=old-lip_amount(x,y,z)
    return tuple(H['clamp'](v+k*delta) for v,k in zip(c,(.007,.205,.232)))

def apply(path):
    g,b=H['read_glb'](path); m=g['meshes'][0];p=m['primitives'][0]
    old=[tuple(v) for v in H['accessor'](g,b,p['attributes']['POSITION'])]
    n=[tuple(v) for v in H['accessor'](g,b,p['attributes']['NORMAL'])]
    idx=[v[0] for v in H['accessor'](g,b,p['indices'])]
    faces=[tuple(idx[i:i+3]) for i in range(0,len(idx),3)]
    xyz=[sculpt(v) for v in old]
    inside=lambda v:abs(v[0])<.024 and .2308<v[1]<.2345 and v[2]>.115
    if any(inside(a)!=inside(b0) for a,b0 in zip(old,xyz)):
        raise ValueError('v26 changed the expression seam membership')
    active={i:(max(upper_weight(v),below_weight(v)),.01,[]) for i,v in enumerate(old) if max(upper_weight(v),below_weight(v))>.015}
    out=S['regularize_normals'](old,xyz,n,faces,active)
    # Exterior skin only. The dark oral aperture remains a thin seam.
    for i,v in enumerate(old):
        w=below_weight(v)
        if w<.015:continue
        nx,ny,nz=out[i]
        target=unit((nx*.55,ny*.45,max(.86,nz)))
        blend=.86*w
        out[i]=unit(tuple((1-blend)*a+blend*b0 for a,b0 in zip(out[i],target)))
    p['attributes']['POSITION']=H['add_vec3'](g,b,xyz)
    p['attributes']['NORMAL']=H['add_vec3'](g,b,out)
    p['attributes']['COLOR_0']=H['add_vec3'](g,b,[color(*v) for v in xyz])
    upper=[a[1]-b0[1] for a,b0 in zip(old,xyz) if abs(a[0])<.020 and .239<a[1]<.247 and a[2]>.139]
    if len(upper)<10 or statistics.median(upper)<.001:raise ValueError('Upper lip geometry did not shrink')
    m['extras']['mouthChinRebuild']['v26LipAndUnderlip']={'version':'v26','medianUpperRetractionMeters':statistics.median(upper),'movedVertices':sum(a!=b0 for a,b0 in zip(old,xyz))}
    g['buffers'][0]['byteLength']=len(b)
    raw=json.dumps(g,ensure_ascii=False,separators=(',',':')).encode()
    raw+=b' '*((-len(raw))%4);b+=b'\0'*((-len(b))%4)
    path.write_bytes(struct.pack('<4sII',b'glTF',2,28+len(raw)+len(b))+struct.pack('<I4s',len(raw),b'JSON')+raw+struct.pack('<I4s',len(b),b'BIN\0')+b)
    print('v26',m['extras']['mouthChinRebuild']['v26LipAndUnderlip'])
if __name__=='__main__':apply(pathlib.Path(sys.argv[1]))
