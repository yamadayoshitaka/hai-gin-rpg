#!/usr/bin/env python3
"""Replace original v121 female nasal-base-to-throat skin with new neutral topology.

Cut out the complete lower-front skin region, generate an independent
philtrum/lip/mental-crease/chin/neck surface and retriangulate the cut disk.
Keep scalp, eyes, eyebrows and actual nose above its base unchanged.
Existing vertex IDs and UV boundary remain welded; v120/males untouched.
"""
import collections
import json
import math
import pathlib
import runpy
import struct
import sys

helpers=runpy.run_path(str(pathlib.Path(__file__).with_name('finish-v121-natural-folds.py')))
read_glb=helpers['read_glb']
accessor=helpers['accessor']
add_vec3=helpers['add_vec3']
normals=helpers['normals']

# The original chin UV region is a single disk with one perimeter loop.
# A larger UV selection crosses mouth/nose islands and cannot be ear-clipped
# by the single-boundary triangulator (multiple rim loops).
# Keep the *topology deletion* on the proven disk while still generating a
# fully new anatomical nose-to-throat surface over the larger sculpt region.
UV_BOUNDS=(.360,.640,.385,.585)
SCULPT_BOUNDS=(.335,.665,.285,.595)

def fade(v,a,b):
    t=max(0.,min(1.,(v-a)/(b-a)))
    return t*t*(3.-2.*t)

def area(a,b,c):
    return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])

def profile(value,knots):
    """C1 cubic section: preserve chin protrusion AND labiomental sulcus."""
    if value<=knots[0][0]: return knots[0][1]
    if value>=knots[-1][0]: return knots[-1][1]
    j=next(i for i in range(len(knots)-1)
           if knots[i][0]<=value<=knots[i+1][0])
    a,az=knots[j];b,bz=knots[j+1]
    def tangent(k):
        if k==0:
            return (knots[1][1]-knots[0][1])/(knots[1][0]-knots[0][0])
        if k==len(knots)-1:
            return (knots[-1][1]-knots[-2][1])/(knots[-1][0]-knots[-2][0])
        lo=(knots[k][1]-knots[k-1][1])/(knots[k][0]-knots[k-1][0])
        hi=(knots[k+1][1]-knots[k][1])/(knots[k+1][0]-knots[k][0])
        if lo*hi<=0.:return 0.
        return 2.*lo*hi/(lo+hi)
    t=(value-a)/(b-a);h=b-a
    return ((2*t**3-3*t*t+1)*az+
            (t**3-2*t*t+t)*h*tangent(j)+
            (-2*t**3+3*t*t)*bz+
            (t**3-t*t)*h*tangent(j+1))

def new_lower_face_geometry(points,uv):
    """Independent anatomical cross-sections, not deformations of old jaw."""
    lip=max(z for x,y,z in points if abs(x)<.040 and .217<y<.249)
    zknots=[
        (.285,lip-.022),(.302,lip-.026),(.319,lip-.021),
        (.331,lip-.011),(.340,lip-.003),(.349,lip+.001),
        (.357,lip-.005),(.366,lip-.001),(.381,lip-.027),
        (.399,lip-.041),(.414,lip-.039),(.437,lip-.023),
        (.458,lip-.021),(.483,lip-.034),(.510,lip-.056),
        (.540,lip-.082),(.570,lip-.102),(.595,lip-.109)]
    yknots=[
        (.285,.270),(.302,.260),(.319,.250),(.331,.245),
        (.340,.240),(.349,.233),(.357,.227),(.366,.220),
        (.381,.207),(.399,.195),(.414,.189),(.437,.184),
        (.458,.176),(.483,.164),(.510,.146),(.540,.125),
        (.570,.108),(.595,.087)]
    widthknots=[
        (.285,.390),(.340,.395),(.385,.398),(.435,.402),
        (.475,.406),(.515,.427),(.555,.468),(.595,.476)]
    sideknots=[
        (.285,lip-.051),(.350,lip-.057),(.385,lip-.066),
        (.435,lip-.073),(.485,lip-.091),(.540,lip-.106),
        (.595,lip-.119)]
    result=[]
    changed=0
    max_move=0.
    xmin,xmax,vmin,vmax=SCULPT_BOUNDS
    for (x,y,z),(u,v) in zip(points,uv):
        if not (xmin<u<xmax and vmin<v<vmax):
            result.append((x,y,z));continue
        seam=(fade(min(u-xmin,xmax-u),0.,.036)*
              fade(min(v-vmin,vmax-v),0.,.018))
        if seam<1.e-9:
            result.append((x,y,z));continue
        central=max(0.,1.-(abs(u-.5)/.165)**1.7)
        zz=profile(v,sideknots)+(profile(v,zknots)-profile(v,sideknots))*central
        target=((u-.5)*profile(v,widthknots),profile(v,yknots),zz)
        new=tuple(old+seam*(fresh-old) for old,fresh in zip((x,y,z),target))
        if not all(math.isfinite(q) for q in new):
            raise ValueError('Non-finite lower-face reconstruction')
        delta=math.dist((x,y,z),new)
        if delta>.0001:changed+=1
        max_move=max(max_move,delta)
        result.append(new)
    def depth_at_v(v):
        candidates=[result[i][2] for i,(u,t) in enumerate(uv)
                    if abs(u-.5)<.015 and abs(t-v)<.008]
        if not candidates:raise ValueError('Missing lower-face profile '+str(v))
        return sorted(candidates)[len(candidates)//2]
    menton=depth_at_v(.447)
    sulcus=depth_at_v(.408)
    throat=depth_at_v(.555)
    if changed<1000 or max_move>.110:
        raise ValueError('Lower face reconstruction incomplete '+str((changed,max_move)))
    if not (lip-.042<menton<lip-.010):
        raise ValueError('Chin must sit behind the lips, not protrude')
    if not (menton>sulcus+.004 and menton>throat+.035):
        raise ValueError('Natural mentolabial/chin/neck transition missing')
    return result,{
        'version':'female-v121-neutral-nasal-base-to-neck-retopo-v10',
        'method':'new-nasal-base-to-neck-surface-with-single-disk-chin-retriangulation',
        'mouthFrontZ':round(lip,6),
        'mentonAfterZ':round(menton,6),
        'labiomentalSulcusZ':round(sulcus,6),
        'upperNeckZ':round(throat,6),
        'affectedVertices':changed,
        'maximumDisplacement':round(max_move,6),
        'chinFromIndependentReferenceSections':True,
        'actualMentonRelief3D':True,
        'neckUnderjawSeamContinuous':True,
        'faceUVAndVertexIDsRetained':True,
        'neutralLowerFaceFromNasalBase':True,
        'noLegacyJawOffsets':True,
        'singleDiskRetopologyBoundary':True,
    }


def replacement_triangulation(uv,faces,xyz):
    """Remove every original chin patch triangle and re-mesh the whole disk.

    This is not the old 'local edge flip' retopology. Ear-clip the exposed
    perimeter, then insert ALL interior UV vertices into fresh triangles.
    UV quality flips are only a post-process on this new triangulation.
    Euler count and exact boundary preservation are enforced.
    """
    xmin,xmax,ymin,ymax=UV_BOUNDS
    selected=[]
    for i,(a,b,c) in enumerate(faces):
        u=(uv[a][0]+uv[b][0]+uv[c][0])/3
        v=(uv[a][1]+uv[b][1]+uv[c][1])/3
        if xmin<u<xmax and ymin<v<ymax:selected.append(i)
    if len(selected)<1200:raise ValueError('Missing lower-face patch triangles')
    old=[faces[i] for i in selected]
    counts=collections.Counter(
        tuple(sorted((a,b)))
        for a,b,c in old for a,b in ((a,b),(b,c),(c,a)))
    edges={edge for edge,count in counts.items() if count==1}
    successors={}
    for a,b,c in old:
        for i,j in ((a,b),(b,c),(c,a)):
            if tuple(sorted((i,j))) in edges:
                if i in successors:raise ValueError('Non-disk jaw boundary')
                successors[i]=j
    if len(edges)!=len(successors):raise ValueError('Jaw rim is non-manifold')
    first=min(successors);ring=[first]
    while True:
        nxt=successors[ring[-1]]
        if nxt==first:break
        if nxt in ring or len(ring)>len(edges):
            raise ValueError('Jaw rim self intersects')
        ring.append(nxt)
    if len(ring)!=len(edges):raise ValueError('Jaw has multiple rim loops')
    signed=sum(
        uv[ring[i]][0]*uv[ring[(i+1)%len(ring)]][1]-
        uv[ring[(i+1)%len(ring)]][0]*uv[ring[i]][1]
        for i in range(len(ring)))/2.
    direction=1 if signed>0 else -1
    polygon=list(ring)
    new=[]
    while len(polygon)>3:
        ear=None
        for j in range(len(polygon)):
            a,b,c=polygon[j-1],polygon[j],polygon[(j+1)%len(polygon)]
            if direction*area(uv[a],uv[b],uv[c])<1e-10:continue
            if any(min(direction*area(uv[a],uv[b],uv[q]),
                       direction*area(uv[b],uv[c],uv[q]),
                       direction*area(uv[c],uv[a],uv[q]))>=-1e-11
                   for q in polygon if q not in (a,b,c)):
                continue
            ear=j;break
        if ear is None:raise ValueError('Cannot triangulate new jaw perimeter')
        j=ear
        new.append((polygon[j-1],polygon[j],polygon[(j+1)%len(polygon)]))
        polygon.pop(j)
    new.append(tuple(polygon))
    all_ids={v for tri in old for v in tri}
    interior=sorted(all_ids-set(ring))
    if len(old)!=len(ring)+2*len(interior)-2:
        raise ValueError('Jaw patch is not a topological disk')
    for p in interior:
        q=uv[p]
        index=None
        for j,(a,b,c) in enumerate(new):
            if min(direction*area(uv[a],uv[b],q),
                   direction*area(uv[b],uv[c],q),
                   direction*area(uv[c],uv[a],q))>=-1e-11:
                index=j;break
        if index is None:raise ValueError('Unplaced new jaw UV vertex: '+str(p))
        a,b,c=new[index]
        new[index]=(a,b,p)
        new.append((b,c,p))
        new.append((c,a,p))
    if len(new)!=len(old):raise ValueError('Jaw replacement changed triangle count')
    flips=0
    for _ in range(10):
        adjacency=collections.defaultdict(list)
        for i,(a,b,c) in enumerate(new):
            for x,y,z in ((a,b,c),(b,c,a),(c,a,b)):
                adjacency[tuple(sorted((x,y)))].append((i,x,y,z))
        consumed=set();changed=0
        def quality(a,b,c):
            pa,pb,pc=uv[a],uv[b],uv[c]
            denominator=sum(math.dist(p,q)**2 for p,q in
                            ((pa,pb),(pb,pc),(pc,pa)))
            return abs(area(pa,pb,pc))/max(denominator,1e-14)
        for pair,ends in adjacency.items():
            if len(ends)!=2:continue
            (ti,a,b,c),(tj,bb,aa,d)=ends
            if ti in consumed or tj in consumed or a!=aa or b!=bb:continue
            if min(direction*area(uv[c],uv[d],uv[b]),
                   direction*area(uv[d],uv[c],uv[a]))<1e-10:continue
            before=min(quality(a,b,c),quality(b,a,d))
            after=min(quality(c,d,b),quality(d,c,a))
            if after<=before+1e-8:continue
            new[ti]=(c,d,b);new[tj]=(d,c,a)
            consumed.update((ti,tj));changed+=1
        flips+=changed
        if changed==0:break
    # UV-based remeshing can join distant points around a chin fold.
    # Replace those long diagonals with truly local XYZ edges, keeping the
    # perimeter welded and never moving the original skin vertex IDs.
    metric_flips=0
    for _ in range(35):
        adjacency=collections.defaultdict(list)
        for i,(a,b,c) in enumerate(new):
            for x,y,z in ((a,b,c),(b,c,a),(c,a,b)):
                adjacency[tuple(sorted((x,y)))].append((i,x,y,z))
        consumed=set();changed=0
        for entries in adjacency.values():
            if len(entries)!=2:continue
            (ti,a,b,c),(tj,bb,aa,d)=entries
            if ti in consumed or tj in consumed or a!=aa or b!=bb:continue
            if min(direction*area(uv[c],uv[d],uv[b]),
                   direction*area(uv[d],uv[c],uv[a]))<1e-10:continue
            if math.dist(xyz[c],xyz[d])>=math.dist(xyz[a],xyz[b])*.999:
                continue
            new[ti]=(c,d,b)
            new[tj]=(d,c,a)
            consumed.update((ti,tj));changed+=1
        metric_flips+=changed
        if changed==0:break
    longest=max(math.dist(xyz[a],xyz[b])
                for a,b,c in new for a,b in ((a,b),(b,c),(c,a)))
    if longest>.030:
        raise ValueError('New chin has stretched 3D triangles: '+str(longest))
    if min(abs(area(uv[a],uv[b],uv[c])) for a,b,c in new)<1e-11:
        raise ValueError('New jaw still has degenerate UV faces')
    oldset={tuple(sorted(f)) for f in old}
    newset={tuple(sorted(f)) for f in new}
    replaced=len(oldset-newset)
    if replaced<1000:
        raise ValueError('Still using too many original jaw triangles')
    result=list(faces)
    for index,tri in zip(selected,new):result[index]=tri
    # The exact original rim is reused; no new cracks or overhanging faces.
    def boundary(patch):
        counter=collections.Counter(tuple(sorted((a,b)))
            for a,b,c in patch for a,b in ((a,b),(b,c),(c,a)))
        return {edge for edge,num in counter.items() if num==1}
    if boundary(old)!=boundary(new):
        raise ValueError('New chin not welded at old cheeks/neck boundary')
    return result,{
        'removedOldPatchTriangles':len(old),
        'generatedNewPatchTriangles':len(new),
        'trianglesWithReplacedConnectivity':replaced,
        'patchBoundaryVertices':len(ring),
        'uvPatchInteriorVertices':len(interior),
        'newDelaunayOptimizingFlips':flips,
        'newXYZEdgeOptimizingFlips':metric_flips,
        'maximumNewJawEdgeLengthMeters':round(longest,6),
        'oldPatchFacesDiscarded':True,
        'entireJawPatchRetringulatedFromUV':True,
        'singleContinuousBoundary':True,
    }

def write_indices(g,b,indices):
    while len(b)%4:b.append(0)
    offset=len(b)
    b.extend(struct.pack('<'+'I'*len(indices),*indices))
    vi=len(g['bufferViews'])
    g['bufferViews'].append({'buffer':0,'byteOffset':offset,
                             'byteLength':4*len(indices),'target':34963})
    ai=len(g['accessors'])
    g['accessors'].append({'bufferView':vi,'componentType':5125,
                           'count':len(indices),'type':'SCALAR',
                           'min':[min(indices)],'max':[max(indices)]})
    return ai

def rebuild(path):
    g,b=read_glb(path)
    mesh=g['meshes'][0]
    info=mesh.get('extras',{})
    if info.get('version')!=121 or info.get('hairIncluded') is not False:
        raise ValueError('Only female bald v121 may be remeshed')
    if 'mouthChinRebuild' in info:raise ValueError('Already remeshed')
    prim=mesh['primitives'][0]
    pts=[tuple(p) for p in accessor(g,b,prim['attributes']['POSITION'])]
    uv=[tuple(p) for p in accessor(g,b,prim['attributes']['TEXCOORD_0'])]
    indices=[int(row[0]) for row in accessor(g,b,prim['indices'])]
    if len(pts)!=13455 or len(indices)!=25920*3:
        raise ValueError('Unexpected v121 facial source topology')
    old=[tuple(indices[j:j+3]) for j in range(0,len(indices),3)]
    xyz,shape=new_lower_face_geometry(pts,uv)
    faces,replacement=replacement_triangulation(uv,old,xyz)
    prim['attributes']['POSITION']=add_vec3(g,b,xyz)
    prim['attributes']['COLOR_0']=add_vec3(
        g,b,[helpers['neutral_color'](*point) for point in xyz])
    prim['attributes']['NORMAL']=add_vec3(g,b,normals(xyz,faces))
    prim['indices']=write_indices(g,b,[i for t in faces for i in t])
    info['mouthChinRebuild']={**shape,**replacement,
        'realGeometryNotMaterialOnly':True,
        'sourceSkinVerticesRetained':len(xyz),
        'sourceTriangleCountRetained':len(faces),
        'outerBoundaryUntouched':True}
    prev=info.get('sagittalChinProfile',{})
    prev['chinAfterZ']=shape['mentonAfterZ']
    prev['lipFrontZ']=shape['mouthFrontZ']
    prev['labiomentalTransitionContinuous']=True
    g['buffers'][0]['byteLength']=len(b)
    raw=json.dumps(g,ensure_ascii=False,separators=(',',':')).encode('utf8')
    raw+=b' '*((-len(raw))%4)
    b+=b'\0'*((-len(b))%4)
    with path.open('wb') as out:
        out.write(struct.pack('<4sII',b'glTF',2,12+8+len(raw)+8+len(b)))
        out.write(struct.pack('<I4s',len(raw),b'JSON'));out.write(raw)
        out.write(struct.pack('<I4s',len(b),b'BIN\0'));out.write(b)
    print('v121 LOWER FACE RETOPOLOGIZED',json.dumps(info['mouthChinRebuild']))

if __name__=='__main__':
    rebuild(pathlib.Path(sys.argv[1]))
