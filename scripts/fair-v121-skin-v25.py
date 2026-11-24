#!/usr/bin/env python3
"""v25: broad continuous cheek/jaw contour and bounded oral-surface fairing."""
import collections,math,json,pathlib,runpy,struct,sys
V=runpy.run_path(str(pathlib.Path(__file__).with_name('fair-v121-skin-v24.py')))
S=V['S'];H=V['H'];fade=V['fade'];bell=V['bell'];unit=V['unit']

def fields(p):
    x,y,z=p;a=abs(x)
    w=fade(a,.032,.055)*(1-fade(a,.103,.128))*fade(y,.155,.230)*(1-fade(y,.282,.300))*fade(z,.035,.084)*(1-fade(y,.286,.292))
    # Smooth broad cheek-volume reduction rather than a second isolated
    # dimple below the zygoma. Mouth and eye landmarks are hard protected.
    w*=1-fade(y,.223,.230)*(1-fade(a,.036,.045))
    body=w*bell(y,.248,.052)*bell(a,.070,.039)
    crest=w*bell(y,.274,.018)*bell(a,.075,.020)
    jaw=fade(a,.017,.033)*(1-fade(a,.077,.105))*fade(y,.115,.160)*(1-fade(y,.192,.213))*fade(z,.025,.074)*bell(y,.175,.031)
    ala=fade(a,.013,.022)*(1-fade(a,.037,.051))*fade(y,.260,.268)*(1-fade(y,.281,.291))*fade(z,.106,.138)
    return body,crest,jaw,ala

def contour(p):
    x,y,z=p;body,crest,jaw,ala=fields(p)
    return (x-math.copysign(.0028*body+.0015*crest+.0024*jaw+.0018*ala,x),
            y,z-.0028*body-.0018*crest-.0009*jaw-.0005*ala)

def oral_weight(p):
    x,y,z=p;a=abs(x)
    if a<.039 and y>=.223:return 0.
    return S['weight'](p)*(1-fade(y,.245,.258))

def lip_weight(p):
    x,y,z=p;a=abs(x)
    _,u,l=H['vermilion_outline'](x,y,z)
    if not (.235<y<u-.0008 and a<.026 and z>.125):return 0.
    return .42*fade(y,.235,.238)*fade(u-y,.0008,.0025)*(1-fade(a,.019,.026))

def repair_grooves(old,xyz,near,faces):
    # XYZ changes to x have already been applied. Recompute true front-ray
    # barycentric samples on that geometry. Apply an absolute depth target,
    # not only a relative improvement from a visibly imperfect baseline.
    constraints=S['groove_constraints'](xyz,faces)
    base=[p[2] for p in xyz]; z=list(base)
    active={i:w for i,(w,r,q) in near.items() if S['region'](old[i])==0}
    groups=collections.defaultdict(list)
    for i,v in enumerate(old):groups[v].append(i)
    for _ in range(28):
        for coeff,relative in constraints:
            target=min(.00010,relative*.75)
            depth=sum(z[i]*w for i,w in coeff.items())
            if depth<=target:continue
            den=sum(w*w*active.get(i,0.) for i,w in coeff.items())
            if den<1e-10:continue
            err=depth-target
            for i,w in coeff.items():
                if i not in active:continue
                z[i]=max(base[i]-.0009,min(base[i]+.0009,z[i]-.85*err*w*active[i]/den))
        for ids in groups.values():
            if len(ids)>1:
                avg=sum(z[i] for i in ids)/len(ids)
                for i in ids:z[i]=avg
    return [(x,y,z[i]) for i,(x,y,_) in enumerate(xyz)]

def apply(path):
    g,b=H['read_glb'](path);m=g['meshes'][0];p=m['primitives'][0]
    old=[tuple(v) for v in H['accessor'](g,b,p['attributes']['POSITION'])]
    n=[tuple(v) for v in H['accessor'](g,b,p['attributes']['NORMAL'])]
    idx=[v[0] for v in H['accessor'](g,b,p['indices'])]
    faces=[tuple(idx[i:i+3]) for i in range(0,len(idx),3)]
    if len(old)!=13455 or m['extras']['version']!=121:raise ValueError('Wrong source')
    near0=S['neighborhoods'](old)
    near={i:(max(oral_weight(old[i]),lip_weight(old[i])),r,q) for i,(_,r,q) in near0.items() if max(oral_weight(old[i]),lip_weight(old[i]))>.015}
    skinnear={i:(w,r,q) for i,(w,r,q) in near.items() if oral_weight(old[i])>.015}
    xyz=list(old)
    for _ in range(8):
        nxt=list(xyz)
        for i,(w,r,q) in near.items():
            c=S['fit'](xyz,i,q)
            if c is None:continue
            x,y,z=xyz[i]
            lim=.00030 if lip_weight(old[i])>0 else .0012
            d=max(-.00025,min(.00025,.52*w*c[0]))
            nxt[i]=(x,y,max(old[i][2]-lim,min(old[i][2]+lim,z+d)))
        xyz=nxt
    # Lip boundary, seam, philtrum, nose bridge, and eye geometry are not
    # overwritten by this broad cheek field. Nasal wings narrow separately.
    xyz=[tuple(a+b-c for a,b,c in zip(v,contour(old[i]),old[i])) for i,v in enumerate(xyz)]
    # Refit the actual skin grooves after broad contour displacement.
    xyz=repair_grooves(old,xyz,skinnear,faces)
    active={i:(max(*fields(v),oral_weight(v),lip_weight(v)),.01,[]) for i,v in enumerate(old) if max(*fields(v),oral_weight(v),lip_weight(v))>.015}
    newnorm=S['regularize_normals'](old,xyz,n,faces,active)
    p['attributes']['POSITION']=H['add_vec3'](g,b,xyz)
    p['attributes']['NORMAL']=H['add_vec3'](g,b,newnorm)
    p['attributes']['COLOR_0']=H['add_vec3'](g,b,[H['neutral_color'](*v) for v in xyz])
    m['extras']['mouthChinRebuild']['v25ContinuousContour']={'version':'v25','movedVertices':sum(a!=b for a,b in zip(old,xyz)),'absoluteGrooveTargetMeters':.00010,'cheekAndJawRealXYZ':True,'lipSurfaceOnlyFairing':True,'eyeGeometryLocked':True}
    g['buffers'][0]['byteLength']=len(b)
    raw=json.dumps(g,ensure_ascii=False,separators=(',',':')).encode()
    raw+=b' '*((-len(raw))%4);b+=b'\0'*((-len(b))%4)
    path.write_bytes(struct.pack('<4sII',b'glTF',2,28+len(raw)+len(b))+struct.pack('<I4s',len(raw),b'JSON')+raw+struct.pack('<I4s',len(b),b'BIN\0')+b)
    print('v25',m['extras']['mouthChinRebuild']['v25ContinuousContour'])
if __name__=='__main__':apply(pathlib.Path(sys.argv[1]))
