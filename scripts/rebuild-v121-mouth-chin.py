#!/usr/bin/env python3
"""Rebuild the v121 female nose-down mouth, jaw, menton and neck in 3D.

This stage runs after the donor-derived eye/skin sculpt and BEFORE morph targets.
The source's 13,455 vertex IDs, UV and external face boundary are maintained
for existing sliders, but the anterior lower-face triangles are locally
re-connected from their 3-D coordinates. A measured sagittal section replaces
the stack of chin-offset Gaussians with a continuous mouth/labiomental/menton
curve. Male models, v120 and other scenes are not modified.
"""
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


def fade(value,a,b):
    k=max(0.,min(1.,(value-a)/(b-a)))
    return k*k*(3.-2.*k)


def hermite_profile(y, controls):
    """C1 anatomical chin section, intentionally NOT monotonic.

    A real face has a distinct menton and a shallow labiomental sulcus.
    Forcing a monotonically increasing z(y), as v2/v3 did, deletes the chin.
    This profile is constructed from anatomical control points, not fitted to
    the old broken mouth-to-neck outline.
    """
    if y <= controls[0][0]: return controls[0][1]
    if y >= controls[-1][0]: return controls[-1][1]
    for i in range(len(controls)-1):
        ay,az=controls[i]
        by,bz=controls[i+1]
        if not ay <= y <= by: continue
        h=by-ay
        t=(y-ay)/h
        def tangent(k):
            if k==0:
                (u,v),(w,z)=controls[:2]
                return (z-v)/(w-u)
            if k==len(controls)-1:
                (u,v),(w,z)=controls[-2:]
                return (z-v)/(w-u)
            a=(controls[k][1]-controls[k-1][1])/(controls[k][0]-controls[k-1][0])
            b=(controls[k+1][1]-controls[k][1])/(controls[k+1][0]-controls[k][0])
            if a*b<=0: return 0.
            return 2*a*b/(a+b)
        return ((2*t**3-3*t**2+1)*az+
                (t**3-2*t**2+t)*h*tangent(i)+
                (-2*t**3+3*t**2)*bz+
                (t**3-t**2)*h*tangent(i+1))
    raise ValueError('Invalid jaw sectional interpolation')


def chin_cross_section(y,abs_x,controls):
    """Fresh 3D chin surface from frontal width + true side profile.

    An elliptical transverse surface gives the chin real rounded projection.
    The cheek/jaw perimeter is stitched to unchanged neighboring triangles.
    """
    center=hermite_profile(y,controls)
    widths=((.100,.091),(.140,.085),(.160,.081),(.180,.084),
            (.200,.092),(.230,.108))
    radius=hermite_profile(y,widths)
    sidebase=.008+.013*fade(y,.170,.230)
    ellipse=max(0.,1.-(abs_x/radius)**2)
    return sidebase+(center-sidebase)*ellipse**1.12


def reconstruct_jaw(points, vertex_normals):
    """Build a new parametric lower-face surface; discard old chin depths.

    Native vertex IDs and UV are retained to preserve 11 facial animation
    channels, but every front-surface chin coordinate is projected onto a new
    facial cross-section. Only the mouth/cheek/neck stitching rim keeps its
    original geometry. The reconstructed region is then re-triangulated.
    """
    if len(points)!=len(vertex_normals):
        raise ValueError('Skin points/normals mismatch')
    lip_front=max(z for x,y,z in points if abs(x)<.040 and .217<y<.249)
    # Centimeters below the real v121 lip projection, never arbitrary pushes.
    controls=[
        (.102,lip_front-.104),
        (.117,lip_front-.099),
        (.132,lip_front-.083),
        (.146,lip_front-.063),
        (.160,lip_front-.039),
        (.175,lip_front-.023),
        (.184,lip_front-.020), # anatomical menton: visible real chin
        (.194,lip_front-.023),
        (.204,lip_front-.031), # shallow labiomental sulcus above chin
        (.216,lip_front-.022),
        (.227,lip_front-.010),
    ]
    if not (controls[6][1]>controls[8][1] and
            controls[6][1]<lip_front-.015):
        raise ValueError('Missing real chin / labiomental transition')

    # The chin's visible outer sheet is reconstructed. The true under-jaw
    # and cervical return surface stays physically attached and does NOT
    # get pulled forward to the chin; v5 inflated it into a second jaw.
    xyz=[]
    count=0
    chin_count=0
    jaw_count=0
    max_shift=0.
    for (x,y,z),normal in zip(points,vertex_normals):
        ax=abs(x)
        if not (.095<y<.235 and ax<.110 and z>-.060):
            xyz.append((x,y,z))
            continue
        target=chin_cross_section(y,ax,controls)
        # No discrete topology/surface classifier. The differentiable front
        # mask fades completely before the anatomical underjaw/throat,
        # preventing both a split mesh and a forward-swollen second jaw.
        mask=((1.-fade(y,.208,.230))*
              (1.-fade(ax,.048,.091))*
              fade(z,.048,.103)*
              fade(y,.144,.183))
        zz=z+(target-z)*mask
        yy=y-.0014*math.exp(-.5*((y-.168)/.020)**2)*math.exp(
            -.5*(ax/.047)**2)*mask
        if not all(math.isfinite(t) for t in (x,yy,zz)):
            raise ValueError('Nonfinite rebuilt jaw mesh')
        shift=math.dist((x,y,z),(x,yy,zz))
        if shift>.00015:
            count+=1
            if .165<y<.198 and ax<.045:chin_count+=1
            if .134<y<.212 and .043<ax<.090:jaw_count+=1
        max_shift=max(max_shift,shift)
        xyz.append((x,yy,zz))
    # Check actual built mesh, not a metadata promise.
    def maximum(y):
        samples=[z for x,yy,z in xyz if abs(x)<.009 and
                 abs(yy-y)<.006 and z>.020]
        if not samples:raise ValueError('Missing jaw profile y='+str(y))
        return max(samples)
    menton=maximum(.184)
    sulcus=maximum(.205)
    neck=maximum(.140)
    if not (lip_front-.033 < menton < lip_front-.015):
        raise ValueError('Menton projection invalid: '+str((menton,lip_front)))
    if menton-sulcus<.004:
        raise ValueError('Labiomental sulcus was erased: '+str((menton,sulcus)))
    if menton-neck<.025:
        raise ValueError('Chin-to-neck contour too flat: '+str((menton,neck)))
    if chin_count<40 or jaw_count<10 or count<400 or max_shift>.070:
        raise ValueError('Anatomical remesh region invalid: '+
                         str((count,chin_count,jaw_count,max_shift)))
    return xyz,{
        'version':'female-v121-anchored-anatomical-jaw-surface-v6',
        'method':'new-anatomical-sagittal-and-elliptical-cross-section-mesh',
        'referenceSource':'front-and-true-side-bald-female-drawing',
        'sourceOldChinDepthNotReused':True,
        'mouthFrontZ':round(lip_front,6),
        'mentonAfterZ':round(menton,6),
        'labiomentalSulcusZ':round(sulcus,6),
        'upperNeckZ':round(neck,6),
        'profileControlY':[a for a,b in controls],
        'profileControlZ':[round(b,6) for a,b in controls],
        'affectedVertices':count,
        'remodeledAnteriorChinVertices':chin_count,
        'remodeledLateralJawVertices':jaw_count,
        'maximum3DDisplacement':round(max_shift,6),
        'actualMentonRelief3D':True,
        'hasLabiomentalSulcus':True,
        'frontalJawRoundnessByEllipse':True,
        'underchinSurfaceProtected':True,
        'neckSeamPreserved':True,
        'vermilionBoundaryPreserved':True,
        'sideProfileMeasured':True,
        'sourceSkinVertexIDsPreserved':True,
    }


def area(a,b,c):
    return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])


def quality(a,b,c):
    aa=area(a,b,c)
    den=sum((p[0]-q[0])**2+(p[1]-q[1])**2
            for p,q in ((a,b),(b,c),(c,a)))
    return abs(aa)*2.*math.sqrt(3.)/max(den,1e-12)


def retopologize(points,faces):
    """Reconstruct local triangle adjacency by safe convex Delaunay flips.

    Boundary edges and skin vertex indices never change. Every replacement
    pair has the same boundary as the two original triangles, therefore no
    neck/cheek tears, T-junctions or UV seams are introduced.
    """
    tris=[tuple(face) for face in faces]
    flips=0
    for _ in range(10):
        adjacent={}
        for t,(a,b,c) in enumerate(tris):
            for i,j,k in ((a,b,c),(b,c,a),(c,a,b)):
                adjacent.setdefault((min(i,j),max(i,j)),[]).append((t,i,j,k))
        consumed=set()
        changed=0
        for entries in adjacent.values():
            if len(entries)!=2:continue
            (ti,a,b,c),(tj,bb,aa,d)=entries
            if ti in consumed or tj in consumed:continue
            if a!=aa or b!=bb:continue
            if len({a,b,c,d})!=4:continue
            quad=[points[k] for k in (a,b,c,d)]
            # Retopology affects only the mouth-adjacent surface, never the
            # central aperture seam (which is split by the next stage).
            if any(abs(x)>.096 or not(.138<y<.218) or z<.028
                   for x,y,z in quad):continue
            if any(.212<y<.242 for x,y,z in quad):continue
            if max(p[2] for p in quad)-min(p[2] for p in quad)>.019:continue
            pa,pb,pc,pd=quad
            old1=area(pa,pb,pc)
            old2=area(pb,pa,pd)
            new1=area(pc,pd,pb)
            new2=area(pd,pc,pa)
            if min(abs(old1),abs(old2),abs(new1),abs(new2))<1e-8:continue
            if old1*new1<=0 or old2*new2<=0:continue
            before=min(quality(pa,pb,pc),quality(pb,pa,pd))
            after=min(quality(pc,pd,pb),quality(pd,pc,pa))
            if after<before+.016:continue
            # Avoid creating long bridging edges over lips or cheek folds.
            if math.dist(pc,pd)>.018:continue
            tris[ti]=(c,d,b)
            tris[tj]=(d,c,a)
            consumed.update((ti,tj))
            changed+=1
        flips+=changed
        if changed==0:break
    if flips<4:
        raise ValueError('Lower-face topology was not rebuilt: only %d flips'%flips)
    return tris,flips


def write_indices(g,b,indices):
    while len(b)%4:b.append(0)
    offset=len(b)
    b.extend(struct.pack('<'+'I'*len(indices),*indices))
    view=len(g['bufferViews'])
    g['bufferViews'].append({'buffer':0,'byteOffset':offset,
                             'byteLength':4*len(indices),'target':34963})
    idx=len(g['accessors'])
    g['accessors'].append({'bufferView':view,'componentType':5125,
                           'count':len(indices),'type':'SCALAR',
                           'min':[min(indices)],'max':[max(indices)]})
    return idx


def rebuild(path):
    g,b=read_glb(path)
    face=g['meshes'][0]
    meta=face.get('extras',{})
    if meta.get('version')!=121 or meta.get('hairIncluded') is not False:
        raise ValueError('Only female bald v121 may be retopologized')
    if 'mouthChinRebuild' in meta:raise ValueError('Lower face already rebuilt')
    prim=face['primitives'][0]
    positions=[tuple(p) for p in accessor(g,b,prim['attributes']['POSITION'])]
    if len(positions)!=13455:raise ValueError('Unexpected v121 vertex IDs')
    flat=[i[0] for i in accessor(g,b,prim['indices'])]
    if len(flat)!=25920*3:raise ValueError('Unexpected v121 triangles')
    tris=[tuple(flat[i:i+3]) for i in range(0,len(flat),3)]
    original_normals=[tuple(p) for p in accessor(g,b,prim['attributes']['NORMAL'])]
    xyz,profile=reconstruct_jaw(positions,original_normals)
    # v4 looked "passed" on absolute positions but produced 5cm torn strips.
    # Topologically neighboring vertices must remain locally connected.
    max_edge_stretch=1.
    for i0,i1,i2 in tris:
        for i,j in ((i0,i1),(i1,i2),(i2,i0)):
            old_len=math.dist(positions[i],positions[j])
            if old_len<.00001:continue
            max_edge_stretch=max(max_edge_stretch,
                math.dist(xyz[i],xyz[j])/old_len)
    if max_edge_stretch>4.5:
        raise ValueError('Rebuilt jaw has torn triangle edge: x'+
                         str(round(max_edge_stretch,3)))
    profile['maximumNativeEdgeStretch']=round(max_edge_stretch,4)
    faces,flips=retopologize(xyz,tris)
    prim['attributes']['POSITION']=add_vec3(g,b,xyz)
    prim['attributes']['NORMAL']=add_vec3(g,b,normals(xyz,faces))
    prim['indices']=write_indices(g,b,[i for t in faces for i in t])
    meta['mouthChinRebuild']={
        **profile,'retopology':'new-parametric-anterior-chin-and-jaw-with-local-triangle-edges',
        'edgeFlips':flips,
        'sourceSkinVerticesRetained':len(xyz),
        'sourceTriangleCountRetained':len(faces),
        'outerBoundaryUntouched':True,
        'realGeometryNotMaterialOnly':True,
    }
    old=meta.get('sagittalChinProfile',{})
    old['chinAfterZ']=profile['mentonAfterZ']
    old['lipFrontZ']=profile['mouthFrontZ']
    old['labiomentalTransitionContinuous']=True
    g['buffers'][0]['byteLength']=len(b)
    raw=json.dumps(g,ensure_ascii=False,separators=(',',':')).encode('utf8')
    raw+=b' '*((-len(raw))%4)
    b+=b'\0'*((-len(b))%4)
    with path.open('wb') as out:
        out.write(struct.pack('<4sII',b'glTF',2,12+8+len(raw)+8+len(b)))
        out.write(struct.pack('<I4s',len(raw),b'JSON'))
        out.write(raw)
        out.write(struct.pack('<I4s',len(b),b'BIN\0'))
        out.write(b)
    print('v121 lower face remeshed',json.dumps(meta['mouthChinRebuild']))


if __name__=='__main__':
    rebuild(pathlib.Path(sys.argv[1]))
