#!/usr/bin/env python3
"""v27: small mouth, smooth perioral skin, rounded oblique cheek/jaw.
Apply after the native mouth seal is split: transform skin, seal and oral
parts consistently; never reclassify the seal triangles."""
import collections,json,math,pathlib,runpy,statistics,struct,sys
H=runpy.run_path(str(pathlib.Path(__file__).with_name('finish-v121-natural-folds.py')))
S=runpy.run_path(str(pathlib.Path(__file__).with_name('fair-v121-skin-v23.py')))
fade=H['fade'];bell=H['bell'];unit=S['unit']
def warp(p):
    x,y,z=p;a=abs(x)
    w=(1-fade(a,.038,.078))*fade(y,.193,.216)*(1-fade(y,.247,.253))*fade(z,.086,.115)
    return (x*(1-.12*w),.232+(y-.232)*(1-.10*w),z)
def fair_weight(p):
    x,y,z=p;a=abs(x)
    front=fade(z,.065,.108)
    # Do not modify the actual lip/seal or the philtrum.
    outside=max(fade(a,.029,.038),1-fade(y,.216,.222))
    oral=outside*(1-fade(a,.065,.085))*fade(y,.188,.203)*(1-fade(y,.244,.253))*front
    cheek=fade(a,.043,.058)*(1-fade(a,.105,.125))*fade(y,.185,.220)*(1-fade(y,.271,.286))*fade(z,.045,.085)
    jaw=fade(a,.025,.043)*(1-fade(a,.090,.112))*fade(y,.124,.158)*(1-fade(y,.195,.215))*fade(z,.028,.075)
    return max(oral,cheek*.75,jaw*.70)
def round_contour(p):
    x,y,z=p;a=abs(x)
    cheek=fade(a,.044,.058)*(1-fade(a,.097,.121))*fade(y,.195,.229)*(1-fade(y,.268,.286))*fade(z,.050,.095)
    jaw=fade(a,.027,.041)*(1-fade(a,.086,.111))*fade(y,.125,.155)*(1-fade(y,.193,.215))*fade(z,.030,.070)
    # A wide support field rather than carving a second cheek crease.
    return (x-math.copysign(.0011*cheek+.0007*jaw,x),y,z-.0008*cheek-.00055*jaw)
def fair(old,xyz):
    base=[round_contour(v) for v in xyz]
    grid=collections.defaultdict(list);cell=.012
    for i,(x,y,z) in enumerate(base):
        if z>.045 and .12<y<.29 and abs(x)<.13:grid[math.floor(x/cell),math.floor(y/cell)].append(i)
    active={}
    for i,(x,y,z) in enumerate(base):
        w=fair_weight(old[i])
        if w<.025:continue
        gx,gy=math.floor(x/cell),math.floor(y/cell);q=[];seen=set()
        for dx in (-1,0,1):
            for dy in (-1,0,1):
                for j in grid.get((gx+dx,gy+dy),()):
                    a,b,c=base[j]
                    if j==i or base[j] in seen or abs(c-z)>.008 or fair_weight(old[j])<.015:continue
                    u,v=(a-x)/cell,(b-y)/cell;r=u*u+v*v
                    if not 1e-8<r<1:continue
                    seen.add(base[j]);q.append((j,(1.,u,v,u*u,u*v,v*v),(1-r)**2))
        if len(q)>=9:active[i]=(w,cell,q)
    out=list(base)
    for _ in range(6):
        nxt=list(out)
        for i,(w,r,q) in active.items():
            fit=S['fit'](out,i,q)
            if fit is None:continue
            x,y,z=out[i];d=max(-.00022,min(.00022,.50*w*fit[0]))
            nxt[i]=(x,y,max(base[i][2]-.0011,min(base[i][2]+.0011,z+d)))
        out=nxt
    return out,active
def warp_normal(p,n):
    # Inverse transpose Jacobian using central differences of the warp.
    eps=1e-6;cols=[]
    for k in range(3):
        a=list(p);b=list(p);a[k]+=eps;b[k]-=eps
        cols.append(tuple((x-y)/(2*eps) for x,y in zip(warp(a),warp(b))))
    v=S['solve']([list(c) for c in cols],list(n))
    return unit(v) if v else n
def replace_vec3(g,b,index,values):
    """Update a dedicated float accessor in place, preserving exact v27
    geometry while avoiding shipping unused v26 position/morph copies."""
    a=g['accessors'][index];vi=a['bufferView'];v=g['bufferViews'][vi]
    if a['componentType']!=5126 or a['type']!='VEC3' or a['count']!=len(values):
        raise ValueError('Unexpected v27 accessor format')
    if a.get('sparse') or a.get('byteOffset',0)!=0 or v.get('byteStride',12)!=12 or v['byteLength']!=12*len(values):
        raise ValueError('Expected dedicated tightly packed VEC3')
    if sum(t.get('bufferView')==vi for t in g['accessors'])!=1:
        raise ValueError('Cannot overwrite shared accessor buffer view')
    # Check primitive and animation references too, not only buffer views.
    refs=0
    for mesh in g['meshes']:
        for prim in mesh['primitives']:
            refs+=sum(i==index for i in prim['attributes'].values())
            refs+=int(prim.get('indices')==index)
            refs+=sum(i==index for target in prim.get('targets',[]) for i in target.values())
    for animation in g.get('animations',[]):
        for sampler in animation['samplers']:
            refs+=int(sampler['input']==index)+int(sampler['output']==index)
    if refs!=1:raise ValueError('Cannot overwrite shared mesh accessor')
    content=b''.join(struct.pack('<fff',*q) for q in values)
    offset=v.get('byteOffset',0)
    b[offset:offset+len(content)]=content
    a['min']=[min(q[k] for q in values) for k in range(3)]
    a['max']=[max(q[k] for q in values) for k in range(3)]
    return index

def apply(path):
    g,b=H['read_glb'](path);head=g['meshes'][0]
    original_bin_size=len(b)
    for mi,m in enumerate(g['meshes']):
        if mi!=0 and not m['name'].startswith('V121_ORAL_'):continue
        for pi,p in enumerate(m['primitives']):
            attrs=p['attributes']
            old=[tuple(v) for v in H['accessor'](g,b,attrs['POSITION'])]
            norm=[tuple(v) for v in H['accessor'](g,b,attrs['NORMAL'])]
            warped=[warp(v) for v in old];new=warped
            wn=[warp_normal(v,n) if v!=q else n for v,q,n in zip(old,warped,norm)]
            if mi==0:
                idx=[v[0] for v in H['accessor'](g,b,p['indices'])]
                faces=[tuple(idx[i:i+3]) for i in range(0,len(idx),3)]
                new,active=fair(old,warped)
                n0=H['normals'](warped,faces);n1=H['normals'](new,faces)
                out=list(wn)
                for i,(a,c) in enumerate(zip(warped,new)):
                    w=fair_weight(old[i])
                    if w<.015:continue
                    d=tuple(y-x for x,y in zip(n0[i],n1[i]))
                    out[i]=unit(tuple(x+max(-.23,min(.23,y)) for x,y in zip(wn[i],d)))
                # Smooth only skin normals along short same-surface edges,
                # not across the true vermilion or interior mouth.
                adj=[set() for _ in old]
                for a,c,d in faces:
                    for i,j in ((a,c),(c,d),(d,a)):
                        if i!=j and math.dist(new[i],new[j])<.008 and min(fair_weight(old[i]),fair_weight(old[j]))>.015:
                            adj[i].add(j);adj[j].add(i)
                for _ in range(6):
                    nxt=list(out)
                    for i,ns in enumerate(adj):
                        if len(ns)<2:continue
                        good=[j for j in ns if sum(a*c for a,c in zip(out[i],out[j]))>.40]
                        if len(good)<2:continue
                        mean=unit(tuple(sum(out[j][k] for j in good) for k in range(3)))
                        w=.35*fair_weight(old[i]);nxt[i]=unit(tuple((1-w)*a+w*c for a,c in zip(out[i],mean)))
                    out=nxt
                wn=out
                # Weld coincident skin vertices without changing connectivity.
                groups=collections.defaultdict(list)
                for i,v in enumerate(old):groups[v].append(i)
                for ids in groups.values():
                    if len(ids)>1 and fair_weight(old[ids[0]])>.015:
                        mean=tuple(sum(new[i][k] for i in ids)/len(ids) for k in range(3))
                        nn=unit(tuple(sum(wn[i][k] for i in ids) for k in range(3)))
                        for i in ids:new[i]=mean;wn[i]=nn
                head['extras']['mouthChinRebuild']['v27CompactMouth']={'version':'v27','widthScale':.88,'heightScale':.90,'skinFairingVertices':len(active),'mouthSealTopologyPreserved':True}
            attrs['POSITION']=replace_vec3(g,b,attrs['POSITION'],new)
            attrs['NORMAL']=replace_vec3(g,b,attrs['NORMAL'],wn)
            # Keep existing neutral pigment attached to the deformed surface.
            # Transform actual morph displacement vectors consistently.
            for target in p.get('targets',[]):
                if 'POSITION' not in target:continue
                delta=H['accessor'](g,b,target['POSITION'])
                vals=[]
                for v,w,d in zip(old,warped,delta):
                    dst=warp(tuple(a+c for a,c in zip(v,d)))
                    vals.append(tuple(a-c for a,c in zip(dst,w)))
                target['POSITION']=replace_vec3(g,b,target['POSITION'],vals)
    if len(b)!=original_bin_size:raise ValueError('v27 introduced duplicate binary data')
    print('v27 binary size unchanged:',len(b))
    g['buffers'][0]['byteLength']=len(b)
    raw=json.dumps(g,ensure_ascii=False,separators=(',',':')).encode()
    raw+=b' '*((-len(raw))%4);b+=b'\0'*((-len(b))%4)
    path.write_bytes(struct.pack('<4sII',b'glTF',2,28+len(raw)+len(b))+struct.pack('<I4s',len(raw),b'JSON')+raw+struct.pack('<I4s',len(b),b'BIN\0')+b)
    print('v27',head['extras']['mouthChinRebuild']['v27CompactMouth'])
if __name__=='__main__':apply(pathlib.Path(sys.argv[1]))
