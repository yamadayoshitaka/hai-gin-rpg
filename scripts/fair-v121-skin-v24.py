#!/usr/bin/env python3
"""v24: rounded malar contour and second oral-skin pass, before morph baking."""
import collections,math,json,pathlib,runpy,struct,sys
S=runpy.run_path(str(pathlib.Path(__file__).with_name('fair-v121-skin-v23.py')))
H=S['H']; fade=S['fade']; unit=S['unit']
def bell(x,c,w):return math.exp(-.5*((x-c)/w)**2)
def cheek_weight(p):
    x,y,z=p;a=abs(x)
    return fade(a,.040,.058)*(1-fade(a,.102,.120))*fade(y,.220,.245)*(1-fade(y,.278,.292))*fade(z,.065,.100)
def cheek_sculpt(p):
    x,y,z=p;a=abs(x);w=cheek_weight(p)
    # Reduce the high malar crest in BOTH projection axes. Support the
    # lower cheek instead of carving an angular hollow under the crest.
    crest=w*bell(y,.269,.022)*bell(a,.078,.022)
    support=w*bell(y,.239,.017)*bell(a,.075,.025)
    return (x-math.copysign(.0028*crest,x),y,z-.0042*crest+.0016*support)
def mouth_weight(p):
    x,y,z=p;a=abs(x)
    # central lips, seal and philtrum remain exactly as in v23.
    if a<.039 and y>=.223:return 0.
    return S['weight'](p)*(1-fade(y,.245,.258))
def apply(path):
    g,b=H['read_glb'](path);m=g['meshes'][0];p=m['primitives'][0]
    old=[tuple(v) for v in H['accessor'](g,b,p['attributes']['POSITION'])]
    n=[tuple(v) for v in H['accessor'](g,b,p['attributes']['NORMAL'])]
    idx=[v[0] for v in H['accessor'](g,b,p['indices'])]
    faces=[tuple(idx[i:i+3]) for i in range(0,len(idx),3)]
    if len(old)!=13455 or m['extras']['version']!=121:raise ValueError('Wrong source')
    near={i:(w*mouth_weight(old[i]),r,q) for i,(w,r,q) in S['neighborhoods'](old).items() if mouth_weight(old[i])>.015}
    xyz=list(old)
    groups=collections.defaultdict(list)
    for i,v in enumerate(old):groups[v].append(i)
    for _ in range(6):
        nxt=list(xyz)
        for i,(w,r,q) in near.items():
            c=S['fit'](xyz,i,q)
            if c is None:continue
            x,y,z=xyz[i];dz=max(-.0003,min(.0003,.55*w*c[0]))
            nxt[i]=(x,y,max(old[i][2]-.0012,min(old[i][2]+.0012,z+dz)))
        xyz=nxt
    xyz=S['regularize_displacement'](old,xyz,near,faces,groups)
    xyz=[(x,y,max(old[i][2]-.0015,min(old[i][2]+.0015,z))) for i,(x,y,z) in enumerate(xyz)]
    # Add a broad C1 malar correction after mouth-only fairing.
    xyz=[tuple(a+b-c for a,b,c in zip(v,cheek_sculpt(old[i]),old[i])) for i,v in enumerate(xyz)]
    # Smooth normals in a wider anatomical cheek region using true mesh
    # differential normals and short connected edges; no flat front normals.
    active={i:(max(mouth_weight(v),cheek_weight(v)),.01,[]) for i,v in enumerate(old) if max(mouth_weight(v),cheek_weight(v))>.015}
    newnorm=S['regularize_normals'](old,xyz,n,faces,active)
    # Upper lip surface normals only: regularize comb artefacts while
    # retaining geometric border and mouth seam. Do not touch central shape.
    adj=[set() for _ in old]
    for a,b0,c in faces:
        for i,j in ((a,b0),(b0,c),(c,a)):
            if S['region'](old[i])==S['region'](old[j])==1 and math.dist(old[i],old[j])<.004:
                adj[i].add(j);adj[j].add(i)
    for _ in range(5):
        nxt=list(newnorm)
        for i,ns in enumerate(adj):
            x,y,z=old[i]
            if len(ns)<2 or not (.238<y<.246 and abs(x)<.025 and z>.125):continue
            w=.24*bell(x,0,.023)*fade(y,.238,.240)*(1-fade(y,.244,.246))
            mean=unit(tuple(sum(newnorm[j][k] for j in ns) for k in range(3)))
            nxt[i]=unit(tuple((1-w)*a+w*b for a,b in zip(newnorm[i],mean)))
        newnorm=nxt
    p['attributes']['POSITION']=H['add_vec3'](g,b,xyz)
    p['attributes']['NORMAL']=H['add_vec3'](g,b,newnorm)
    p['attributes']['COLOR_0']=H['add_vec3'](g,b,[H['neutral_color'](*v) for v in xyz])
    m['extras']['mouthChinRebuild']['v24CheekContour']={'version':'v24','cheekVertices':sum(cheek_weight(v)>.015 for v in old),'movedVertices':sum(a!=b for a,b in zip(old,xyz)),'mouthRmsBefore':S['rms'](old,near),'mouthRmsAfter':S['rms'](xyz,near)}
    g['buffers'][0]['byteLength']=len(b)
    raw=json.dumps(g,ensure_ascii=False,separators=(',',':')).encode()
    raw+=b' '*((-len(raw))%4);b+=b'\0'*((-len(b))%4)
    path.write_bytes(struct.pack('<4sII',b'glTF',2,28+len(raw)+len(b))+struct.pack('<I4s',len(raw),b'JSON')+raw+struct.pack('<I4s',len(b),b'BIN\0')+b)
    print('v24',m['extras']['mouthChinRebuild']['v24CheekContour'])
if __name__=='__main__':apply(pathlib.Path(sys.argv[1]))
