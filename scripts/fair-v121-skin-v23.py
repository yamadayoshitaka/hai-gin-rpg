#!/usr/bin/env python3
"""v23: local MLS surface fairing of real XYZ, with independent lip/skin masks."""
import collections
import json
import math
import pathlib
import runpy
import struct
import sys

H=runpy.run_path(str(pathlib.Path(__file__).with_name('finish-v121-natural-folds.py')))
fade=H['fade']

def weight(p):
    x,y,z=p
    a=abs(x)
    # Preserve nose, eyes, silhouette, and philtrum. Crucially the seam
    # exclusion is LOCAL to the true lips, not a horizontal strip on cheeks.
    w=fade(y,.150,.174)*(1-fade(y,.255,.266))*fade(z,.082,.113)*(1-fade(a,.078,.102))
    philtrum=(1-fade(a,.013,.023))*fade(y,.247,.252)
    w*=1-philtrum
    if a<.038 and .229<y<.2355:
        return 0.
    lip,upper,lower=H['vermilion_outline'](x,y,z)
    if a<.034 and lower<y<upper:
        # Smooth vertical comb-like noise inside both lips, not the outline.
        rim=fade(min(y-lower,upper-y),.0006,.003)
        return w*.28*rim*(1-fade(a,.017,.032))
    if a<.034 and min(abs(y-upper),abs(y-lower))<.0015:
        return 0.
    return w

def region(p):
    x,y,z=p
    _,u,l=H['vermilion_outline'](x,y,z)
    if abs(x)<.034 and l<y<u:
        return 1 if y>.232 else 2
    return 0

def solve(a,b):
    m=[list(row)+[v] for row,v in zip(a,b)]
    for k in range(len(b)):
        j=max(range(k,len(b)),key=lambda i:abs(m[i][k]))
        if abs(m[j][k])<1e-9:return None
        m[k],m[j]=m[j],m[k]
        d=m[k][k];m[k]=[v/d for v in m[k]]
        for i in range(len(b)):
            if i==k:continue
            d=m[i][k]
            m[i]=[x-d*y for x,y in zip(m[i],m[k])]
    return [row[-1] for row in m]

def neighborhoods(points):
    cell=.010
    grid=collections.defaultdict(list)
    for i,(x,y,z) in enumerate(points):
        if abs(x)<.115 and .133<y<.280 and z>.075:
            grid[math.floor(x/cell),math.floor(y/cell)].append(i)
    result={}
    for i,p in enumerate(points):
        w=weight(p)
        if w<.015:continue
        x,y,z=p; tag=region(p)
        radius=.0048 if tag else .010
        gx,gy=math.floor(x/cell),math.floor(y/cell)
        q=[];seen=set()
        for dx in (-1,0,1):
            for dy in (-1,0,1):
                for j in grid.get((gx+dx,gy+dy),()):
                    a,b,c=points[j]
                    if j==i or region(points[j])!=tag:continue
                    if abs(c-z)>.010:continue
                    if points[j] in seen:continue
                    u,v=(a-x)/radius,(b-y)/radius
                    r=u*u+v*v
                    if r<1e-8 or r>1:continue
                    seen.add(points[j])
                    q.append((j,(1.,u,v,u*u,u*v,v*v),(1-r)**2))
        if len(q)>=9:result[i]=(w,radius,q)
    return result

def fit(points,i,q):
    mat=[[0.]*6 for _ in range(6)]; rhs=[0.]*6
    z=points[i][2]
    for j,v,w in q:
        dz=points[j][2]-z
        for k in range(6):
            rhs[k]+=w*v[k]*dz
            for l in range(k,6):mat[k][l]+=w*v[k]*v[l]
    for k in range(6):
        for l in range(k):mat[k][l]=mat[l][k]
        if k>=3:mat[k][k]+=.0005
    return solve(mat,rhs)

def rms(points,near):
    values=[]
    for i,(w,r,q) in near.items():
        c=fit(points,i,q)
        if c is not None:values.append(c[0]**2)
    return math.sqrt(sum(values)/max(1,len(values)))

def unit(v):
    d=math.sqrt(sum(x*x for x in v))
    return tuple(x/d for x in v) if d>1e-12 else (0.,0.,1.)

def groove_constraints(points,faces):
    """Actual front surface rays, with fixed XY barycentric coefficients."""
    def ray(x,y):
        hits=[]
        for ia,ib,ic in faces:
            a,b,c=points[ia],points[ib],points[ic]
            if not min(a[0],b[0],c[0])<=x<=max(a[0],b[0],c[0]):continue
            if not min(a[1],b[1],c[1])<=y<=max(a[1],b[1],c[1]):continue
            ux,uy=b[0]-a[0],b[1]-a[1]
            vx,vy=c[0]-a[0],c[1]-a[1]
            det=ux*vy-uy*vx
            if abs(det)<1e-12:continue
            dx,dy=x-a[0],y-a[1]
            u,v=(dx*vy-dy*vx)/det,(ux*dy-uy*dx)/det
            if min(u,v,1-u-v)>=-1e-7:
                hits.append(((ia,1-u-v),(ib,u),(ic,v)))
        if not hits:raise ValueError('Missing skin ray')
        return max(hits,key=lambda q:sum(points[i][2]*w for i,w in q))
    samples=[]
    for sign in (-1,1):
        for y in (.224,.232,.240):
            for x in (.042,.050,.058):
                samples.append([(sign*(x+d),y) for d in (-.003,0,.003)])
    for x in (-.015,0.,.015):
        for y in (.210,.215,.220):
            samples.append([(x,y+d) for d in (-.002,0,.002)])
    out=[]
    for a,b,c in samples:
        coeff=collections.defaultdict(float)
        for p,k in ((a,.5),(b,-1.),(c,.5)):
            for i,w in ray(*p):coeff[i]+=k*w
        depth=sum(points[i][2]*w for i,w in coeff.items())
        out.append((dict(coeff),max(0.,depth)*.55))
    return out

def regularize_displacement(old,xyz,near,faces,groups):
    """Constrain genuine skin trenches without introducing a second ridge."""
    constraints=groove_constraints(old,faces)
    base=[p[2] for p in old]
    z=[p[2] for p in xyz]
    # Keep Cupid, seam and central vermilion fixed while filling skin pits.
    active={i:w for i,(w,r,q) in near.items() if region(old[i])==0}
    for _ in range(18):
        for coeff,target in constraints:
            depth=sum(z[i]*w for i,w in coeff.items())
            if depth<=target:continue
            den=sum(w*w*active.get(i,0.) for i,w in coeff.items())
            if den<1e-10:continue
            err=depth-target
            for i,w in coeff.items():
                if i not in active:continue
                d=-.8*err*w*active[i]/den
                z[i]=max(base[i]-.0025,min(base[i]+.0025,z[i]+d))
        for ids in groups.values():
            if len(ids)>1:
                avg=sum(z[i] for i in ids)/len(ids)
                for i in ids:z[i]=avg
    return [(x,y,z[i]) for i,(x,y,_) in enumerate(old)]

def regularize_normals(old,xyz,original,faces,near):
    """Use differential geometric normals, then diffuse the angular field
    along short exterior mesh edges; reject any increase in angular energy."""
    n0=H['normals'](old,faces); n1=H['normals'](xyz,faces)
    adj=[set() for _ in old]
    for a,b,c in faces:
        for i,j in ((a,b),(b,c),(c,a)):
            if i==j or math.dist(old[i],old[j])>=.008:continue
            if region(old[i])!=region(old[j]):continue
            if old[i][2]<.09 or old[j][2]<.09:continue
            adj[i].add(j);adj[j].add(i)
    # Baseline and current audit use identical edge selection.
    def energy(v,p):
        e=[math.acos(max(-1.,min(1.,sum(a*b for a,b in zip(v[i],v[j])))))**2
           for i,q in enumerate(adj) for j in q if i<j
           and weight(p[i])>.5 and weight(p[j])>.5
           and region(p[i])==region(p[j])==0 and math.dist(p[i],p[j])<.008]
        return math.sqrt(sum(e)/max(1,len(e)))
    out=list(original)
    for i,(w,r,q) in near.items():
        # Apply the real geometric normal change to the existing outward
        # normal field, without fitting an unstable slope at a thin triangle.
        delta=tuple(b-a for a,b in zip(n0[i],n1[i]))
        out[i]=unit(tuple(a+max(-.12,min(.12,d))*w*.5 for a,d in zip(original[i],delta)))
    best=list(out);best_score=energy(best,xyz)
    for _ in range(24):
        nxt=list(out)
        for i,(w,r,q) in near.items():
            ns=[j for j in adj[i] if sum(a*b for a,b in zip(out[i],out[j]))>.35]
            if len(ns)<2:continue
            mean=unit(tuple(sum(out[j][k] for j in ns) for k in range(3)))
            blend=.48*w
            nxt[i]=unit(tuple(a*(1-blend)+b*blend for a,b in zip(out[i],mean)))
        out=nxt
        score=energy(out,xyz)
        if score<best_score:best,best_score=list(out),score
    print('v23 normal angular energy',energy(original,old),'->',best_score)
    return best

def apply(path):
    g,b=H['read_glb'](path)
    mesh=g['meshes'][0];p=mesh['primitives'][0]
    old=[tuple(v) for v in H['accessor'](g,b,p['attributes']['POSITION'])]
    normals=[tuple(v) for v in H['accessor'](g,b,p['attributes']['NORMAL'])]
    idx=[v[0] for v in H['accessor'](g,b,p['indices'])]
    faces=[tuple(idx[k:k+3]) for k in range(0,len(idx),3)]
    if len(old)!=13455 or mesh['extras']['version']!=121:raise ValueError('Unexpected face source')
    near=neighborhoods(old)
    if len(near)<100:raise ValueError('Insufficient actual face samples')
    initial=rms(old,near)
    xyz=list(old)
    # Fit a quadratic surface instead of shrinking all vertices to neighbor
    # means. Iterative bounded correction removes narrow ridges and trenches.
    for _ in range(6):
        out=list(xyz)
        for i,(w,r,q) in near.items():
            c=fit(xyz,i,q)
            if c is None:continue
            x,y,z=xyz[i]
            lim=.00030 if region(old[i]) else .0025
            dz=max(-.0006,min(.0006,.72*w*c[0]))
            out[i]=(x,y,max(old[i][2]-lim,min(old[i][2]+lim,z+dz)))
        xyz=out
    # Coincident source vertices retain identical positions; preserve UV seams.
    groups=collections.defaultdict(list)
    for i,v in enumerate(old):groups[v].append(i)
    for ids in groups.values():
        if len(ids)>1:
            z=sum(xyz[i][2] for i in ids)/len(ids)
            for i in ids:xyz[i]=(old[i][0],old[i][1],z)
    xyz=regularize_displacement(old,xyz,near,faces,groups)
    final=rms(xyz,near)
    if not final<initial:raise ValueError('v23 surface residual did not improve')
    out=regularize_normals(old,xyz,normals,faces,near)
    p['attributes']['POSITION']=H['add_vec3'](g,b,xyz)
    p['attributes']['NORMAL']=H['add_vec3'](g,b,out)
    p['attributes']['COLOR_0']=H['add_vec3'](g,b,[H['neutral_color'](*v) for v in xyz])
    skin=g['materials'][p['material']]
    skin['normalTexture']['scale']=.035
    # Keep natural matte PBR response, not plastic-like specular.
    skin['pbrMetallicRoughness']['roughnessFactor']=.88
    report={'version':'v23','samples':len(near),'rmsBefore':initial,'rmsAfter':final,
            'moved':sum(a!=d for a,d in zip(old,xyz)),
            'maxDisplacement':max(math.dist(a,d) for a,d in zip(old,xyz)),
            'duplicatePositionGroups':sum(len(v)>1 for v in groups.values()),
            'preSplitRepeatedIndexFaces':sum(len(set(t))<3 for t in faces)}
    mesh['extras']['mouthChinRebuild']['v23SkinFairing']=report
    g['buffers'][0]['byteLength']=len(b)
    raw=json.dumps(g,ensure_ascii=False,separators=(',',':')).encode()
    raw+=b' '*((-len(raw))%4); b+=b'\0'*((-len(b))%4)
    path.write_bytes(struct.pack('<4sII',b'glTF',2,28+len(raw)+len(b))+
        struct.pack('<I4s',len(raw),b'JSON')+raw+struct.pack('<I4s',len(b),b'BIN\0')+b)
    print('v23 real skin fairing:',json.dumps(report))

if __name__=='__main__':apply(pathlib.Path(sys.argv[1]))
