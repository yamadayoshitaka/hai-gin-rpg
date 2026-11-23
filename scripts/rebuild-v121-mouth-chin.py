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


def frontal_depth(points,y):
    # This is the actual finished surface, not the original v120 coordinates.
    for radius in (.004,.008,.016,.026):
        zs=[z for x,yy,z in points
            if abs(x)<.023 and abs(y-yy)<radius and z>.034]
        if len(zs)>=3:
            return max(zs)
    raise ValueError('No lower-face skin at sagittal section %.3f'%y)


def contour(points):
    """Remodel the REAL lower-face skin in 3 axes, from lip to neck.

    Front: raise and round the previously elongated V-shaped menton and
    distribute the chin's width without widening the cheeks.
    Profile: tuck the anterior jaw behind the lips with ONE smooth contour,
    then feather the submental fold into the anterior neck. All displacements
    are continuous, finite and vanish at the untouched mouth/cheek/neck seams.
    This is deliberately not a material edit or a camera-space correction.
    """
    lip_front=max(z for x,y,z in points
                  if abs(x)<.040 and .217<y<.249)
    old_chin=max(z for x,y,z in points
                 if abs(x)<.055 and .160<y<.204)
    section_y=(.111,.125,.143,.160,.177,.192,.205,.219,.236)
    source=[frontal_depth(points,y) for y in section_y]
    # Keep the original neck and lip anchors. Remove the old chin bulge,
    # particularly 0.17-0.21m, without extending the lip or jaw forward.
    target=[
        source[0],
        source[1],
        lip_front-.081,
        lip_front-.068,
        lip_front-.053,
        lip_front-.043,
        lip_front-.032,
        lip_front-.014,
        max(source[-1],lip_front-.011),
    ]
    target[-1]=max(target[-2]+.0005,target[-1])
    if not all(b>a for a,b in zip(target,target[1:])):
        raise ValueError('Lower-face reference anchors out of order: '+str(target))

    def curve(y,values):
        if y<=section_y[0]:return values[0]
        if y>=section_y[-1]:return values[-1]
        i=next(j for j in range(len(section_y)-1)
               if section_y[j]<=y<=section_y[j+1])
        a,b=section_y[i:i+2]
        t=(y-a)/(b-a)
        slopes=[(values[k+1]-values[k])/(section_y[k+1]-section_y[k])
                for k in range(len(values)-1)]
        def tangent(k):
            if k==0:return slopes[0]
            if k==len(values)-1:return slopes[-1]
            left,right=slopes[k-1:k+1]
            if left*right<=0:return 0.
            return math.copysign(min(2.*min(abs(left),abs(right)),
                                     (abs(left)+abs(right))*.5),left)
        h=b-a
        return ((2*t**3-3*t*t+1)*values[i]+
                (t**3-2*t*t+t)*h*tangent(i)+
                (-2*t**3+3*t*t)*values[i+1]+
                (t**3-t*t)*h*tangent(i+1))

    def bell(v,c,w):
        return math.exp(-.5*((v-c)/w)**2)

    remodeled=[]
    shifted=0
    center_chin=0
    neck_blended=0
    max_move=0.
    for x,y,z in points:
        ax=abs(x)
        # 3D region grows from the nasal/labial boundary across the anterior
        # mandible and fades on the lateral jaw. The surface MUST stay joined
        # to the scalp, lips, cheeks and upper-chest vertex boundary.
        lateral=1.-fade(ax,.046,.119)
        anterior=fade(z,.018,.101)
        vertical=fade(y,.100,.140)*(1.-fade(y,.215,.242))
        depth=(curve(y,target)-curve(y,source))*lateral*anterior*vertical

        # Eliminate the submental shelf that reads as a second jaw in
        # three-quarter view. Transition is broad and weak at the neckline.
        submental=-.0030*bell(y,.129,.019)*bell(ax,0.,.070)*anterior

        # The original silhouette has a long, sharply pointed V chin.
        # Lift its anterior underside by 6mm, tapering to zero at the lips
        # and neck. Slight lateral spread makes the frontal tip rounded.
        chin_mask=bell(y,.159,.025)*bell(ax,0.,.060)*anterior
        shorten=.0060*chin_mask*(1.-fade(y,.196,.225))
        widen=x*.060*bell(y,.170,.031)*bell(ax,.034,.048)*anterior
        xx=x+widen
        yy=y+shorten
        zz=z+depth+submental
        if not all(math.isfinite(v) for v in (xx,yy,zz)):
            raise ValueError('Non-finite jaw remesh coordinate')
        change=math.dist((x,y,z),(xx,yy,zz))
        if change>.00015:shifted+=1
        if .147<y<.191 and ax<.055 and change>.0001:center_chin+=1
        if .112<y<.150 and ax<.100 and change>.0001:neck_blended+=1
        max_move=max(max_move,change)
        remodeled.append((xx,yy,zz))

    new_chin=max(z for x,y,z in remodeled
                 if abs(x)<.055 and .160<y<.204)
    if shifted<60 or center_chin<12 or neck_blended<8:
        raise ValueError('Chin/neck geometry was not actually remodeled: '+
                         str((shifted,center_chin,neck_blended)))
    if new_chin>lip_front-.016:
        raise ValueError('Rebuilt side profile still has a protruding chin')
    if max_move>.045:
        raise ValueError('Jaw reconstruction exceeds safe local displacement')
    return remodeled,{
        'version':'female-v121-front-profile-jaw-neck-remodel-v3',
        'mouthFrontZ':round(lip_front,6),
        'mentonBeforeZ':round(old_chin,6),
        'mentonAfterZ':round(new_chin,6),
        'profileControlY':section_y,
        'profileControlZ':[round(v,6) for v in target],
        'affectedVertices':shifted,
        'remodeledAnteriorChinVertices':center_chin,
        'blendedSubmentalNeckVertices':neck_blended,
        'maximum3DDisplacement':round(max_move,6),
        'chinVerticalShorteningMeters':.006,
        'chinTipRoundness3D':True,
        'frontalJawWidthBlending':True,
        'sideProfileMeasured':True,
        'noMentonLengthening':True,
        'monotoneNoDoubleChin':True,
        'submentalToNeckBlend':True,
        'legacyChinBridgeDisabled':True,
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
    for _ in range(6):
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
            if any(abs(x)>.116 or not(.142<y<.264) or z<.065
                   for x,y,z in quad):continue
            if any(.229<y<.238 for x,y,z in quad):continue
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
            if after<before+.035:continue
            # Avoid creating long bridging edges over lips or cheek folds.
            if math.dist(pc,pd)>.020:continue
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
    xyz,profile=contour(positions)
    faces,flips=retopologize(xyz,tris)
    prim['attributes']['POSITION']=add_vec3(g,b,xyz)
    prim['attributes']['NORMAL']=add_vec3(g,b,normals(xyz,faces))
    prim['indices']=write_indices(g,b,[i for t in faces for i in t])
    meta['mouthChinRebuild']={
        **profile,'retopology':'lip-menton-anterior-jaw-reconnected-convex-edges',
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
