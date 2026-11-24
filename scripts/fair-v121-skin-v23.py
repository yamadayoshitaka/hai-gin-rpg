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
    final=rms(xyz,near)
    if not final<initial:raise ValueError('v23 surface residual did not improve')
    # Recalculate local area-weighted normals, then use fitted geometric
    # tangents to regularize thin triangles and duplicated UV boundary normals.
    calculated=H['normals'](xyz,faces)
    out=list(normals)
    for i,(w,r,q) in near.items():
        c=fit(xyz,i,q)
        if c is None:continue
        tangent=unit((-c[1]/r,-c[2]/r,1.))
        # Do not blend from the rear oral surface into exposed skin.
        n=calculated[i]
        if n[2]<0:n=tangent
        target=unit(tuple(.30*a+.70*d for a,d in zip(n,tangent)))
        blend=min(1.,w*1.7)
        out[i]=unit(tuple((1-blend)*a+blend*d for a,d in zip(normals[i],target)))
    for ids in groups.values():
        active=[i for i in ids if i in near]
        if len(active)>1:
            n=unit(tuple(sum(out[i][k] for i in active) for k in range(3)))
            for i in active:out[i]=n
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
