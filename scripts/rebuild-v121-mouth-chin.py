#!/usr/bin/env python3
"""v121 lower-face rebuild: safe actual-XYZ sculpt and one-loop chin retopology.

Avoid UV->XYZ projection, preserve real facial landmarks and lips, and discard
the old chin patch triangles before local remeshing. Facial sliders and
expression playback remain disabled in the standalone v121 viewer.
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

# The chin UV disk has a single rim loop. This is ONLY a topological
# selection; all position changes are computed from real XYZ coordinates.
UV_BOUNDS=(.360,.640,.385,.585)

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

def bell(x, center, width):
    return math.exp(-.5*((x-center)/width)**2)


def new_lower_face_geometry(points,uv):
    """Sculpt the real-XYZ lower face; never project UVs into 3D.

    The mouth seal and every original vertex ID are retained. Only the area
    BELOW the nasal base is permitted to move. A smooth sagittal profile
    retracts the swollen lower vermilion, recesses the shallow labiomental
    sulcus, and blends a short rounded chin into the neck without a shelf.
    The subsequent jaw-disk retriangulation preserves the original boundary.
    """
    lip_front=max(z for x,y,z in points if abs(x)<.040 and .217<y<.249)
    result=[]
    changed=0
    max_move=0.
    # Values in metres, ordered from the upper neck to the closed lip.
    # A single C1-continuous contour prevents the prior independent Gaussian
    # bulges from adding a second lip underneath the real lower lip.
    sagittal=(
        (.078, .0000),
        (.102,-.0006),
        (.126,-.0018),
        (.149,-.0032),
        (.173,-.0032),
        (.188,-.0043),
        (.198,-.0037),
        (.204,-.0036),  # subtle, wide skin-only sulcus without a charcoal ledge
        (.211,-.00325), # smooth rise toward the true lower vermilion
        (.218,-.00285),
        (.224,-.00240), # no independent ridge below the lip
        (.228,-.00165),
        (.234,-.0005),  # keep the closed oral seam and entire upper lip
        (.245, .0000),
        (.255, .0000),
    )
    for x,y,z in points:
        # Hard isolation is important: not even a tiny Gaussian displacement
        # may reach nose, nostrils, cheeks above the nasal base or eye meshes.
        if y>=.255 or y<=.078:
            result.append((x,y,z))
            continue
        front=fade(z,.063,.119)
        # Keep sagittal mouth/chin fairing on the FRONT lower face. The
        # old 61-mm falloff bent cheeks as far as the commissures and
        # reinforced a long lateral crease in front/quarter views.
        middle=bell(x,0.,.046)*(1.-fade(abs(x),.053,.078))
        lip_zone=fade(z,.101,.131)*bell(x,0.,.042)
        dz=profile(y,sagittal)*middle*front
        # Narrow the LOWER vermilion by lifting only its bottom boundary.
        # The upper lip and neutral lip seam stay in their current positions.
        lip_bottom=bell(y,.216,.0090)*lip_zone
        chin_zone=bell(y,.145,.041)*middle*front
        # The previous 2 mm narrow vertical bulge created a second ledge
        # directly below the lower lip. Leave only a broad sub-millimetre
        # lift of the actual vermilion boundary, with a continuous chin.
        dy=.0021*chin_zone+.00042*lip_bottom
        # Slightly soften the point of the chin, never pinch mouth corners.
        # Never shift mouth-corner/dimple landmark X coordinates: only the
        # lower chin/jaw region may change width.
        # Taper the lower mandibular outline into a sharper but short V-line.
        # Avoid pushing the menton forward or making it longer. The taper
        # fades out well below the mouth and above the neck; no hard shelf.
        jaw_taper=(bell(y,.151,.034)*bell(abs(x),.048,.043)*
                   fade(y,.097,.126)*(1.-fade(y,.191,.215))*front)
        dx=-x*(.009*bell(y,.153,.043)*middle*front*
               (1.-fade(y,.203,.215))+.087*jaw_taper)
        # Subtle planar support along lateral chin, not a second groove
        # between the lower lip and the chin point.
        side_plane=(bell(y,.150,.036)*bell(abs(x),.054,.025)*
                    fade(y,.105,.133)*(1.-fade(y,.187,.211))*front)
        dz-=.0008*side_plane
        new=(x+dx,y+dy,z+dz)
        if not all(math.isfinite(q) for q in new):
            raise ValueError('Nonfinite real-space lower-face vertex')
        shift=math.dist((x,y,z),new)
        if shift>.0001:changed+=1
        max_move=max(max_move,shift)
        result.append(new)
    if changed<180 or max_move>.014:
        raise ValueError('Unsafe local lower-face reconstruction: '+
                         str((changed,max_move)))
    def forward_depth(lo,hi,width=.055):
        region=[p[2] for p in result
                if lo<=p[1]<=hi and abs(p[0])<width and p[2]>.047]
        return max(region) if region else None
    chin_depth=forward_depth(.142,.194)
    neck_depth=forward_depth(.075,.118)
    return result,{
        'version':'female-v121-realspace-neutral-lower-face-v16',
        'method':'actual-XYZ-sagittal-C1-lip-sulcus-short-chin-and-boundary-welded-remesh',
        'mouthFrontZ':round(lip_front,6),
        'mentonAfterZ':round(chin_depth,6) if chin_depth is not None else None,
        'upperNeckZ':round(neck_depth,6) if neck_depth is not None else None,
        'affectedVertices':changed,
        'maximumDisplacement':round(max_move,6),
        'anatomicalCoordinateSystem':'actual-mesh-XYZ-meters',
        'uvToXYZProjectionRemoved':True,
        'nasalBaseAndEyesUnchanged':True,
        'lipLoopsRetained':True,
        'neckUnderjawSeamContinuous':True,
        'faceUVAndVertexIDsRetained':True,
        'lowerLipDepthRetracted':True,
        'lowerVermilionHeightReduced':True,
        'shallowLabiomentalSulcus':True,
        'shortRoundedChin':True,
        'shortSharperVLineChin':True,
        'jawTaperPeakFraction':.087,
        'lipAndNeckExcludedFromJawTaper':True,
        'secondaryUnderlipRidgeRemoved':True,
        'noNarrowUnderlipVerticalLift':True,
        'noseAndUpperFaceHardLocked':True,
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

def relax_labiomental_shading(points,faces):
    """Fair the single chin skin surface in real XYZ; never erase the lips.

    Retriangulation in UV space can create small zig-zags in 3D vertex
    normals. Diffuse only very short, front-facing edges of the transition
    below the lower vermilion. Mouth seam, actual lips, jaw rim, nasal root,
    eyeballs, eyelids and the cervical base are strictly outside the mask.
    """
    adjacent=[set() for _ in points]
    for a,b,c in faces:
        adjacent[a].update((b,c))
        adjacent[b].update((a,c))
        adjacent[c].update((a,b))
    xyz=list(points)
    moved=set()
    for _ in range(9):
        next_xyz=list(xyz)
        for i,(x,y,z) in enumerate(xyz):
            if not (.173<y<.220 and abs(x)<.078 and z>.097):
                continue
            blend=(.36*fade(y,.173,.185)*(1.-fade(y,.211,.220))*
                   fade(z,.097,.125)*(1.-fade(abs(x),.049,.077)))
            if blend<.001:
                continue
            near=[xyz[j] for j in adjacent[i]
                  if abs(xyz[j][0]-x)<.009 and abs(xyz[j][1]-y)<.010
                  and abs(xyz[j][2]-z)<.008 and xyz[j][2]>.099]
            if len(near)<3:continue
            depth=sum(v[2] for v in near)/len(near)
            # Do not create a bulge from a steep, genuine lip contour.
            dz=max(-.0006,min(.0006,blend*(depth-z)))
            if abs(dz)>1e-8:
                next_xyz[i]=(x,y,z+dz)
                moved.add(i)
        xyz=next_xyz
    return xyz,len(moved)




def fair_exterior_oral_surface(points,uv,faces):
    """Smooth triangular bumps on the *real* exposed lip surface.

    The inherited mouth has dense vertices and UV seams. Constrain each
    neighbor by XY, Z and same UV island, protect the lip seal and Cupid
    peaks, then relax only Z. This avoids vertical comb-like lip shading
    while keeping both vermilion bands and their anatomical outlines.
    """
    adjacent=[set() for _ in points]
    for a,b,c in faces:
        adjacent[a].update((b,c))
        adjacent[b].update((a,c))
        adjacent[c].update((a,b))
    xyz=list(points)
    changed=set()
    for _ in range(6):
        next_xyz=list(xyz)
        for i,(x,y,z) in enumerate(xyz):
            ax=abs(x)
            if not (.211<y<.254 and ax<.054 and z>.123):continue
            # Do not smooth the oral aperture or mix upper and lower lips.
            lip=(bell(y,.241,.009)+.8*bell(y,.222,.009))
            weight=(.30*lip*fade(z,.123,.140)*
                    (1.-fade(ax,.040,.056)))
            weight*=1.-bell(y,.232,.0022)
            weight*=1.-.65*bell(ax,.011,.005)*bell(y,.247,.004)
            if weight<.008:continue
            near=[]
            for j in adjacent[i]:
                px,py,pz=xyz[j]
                if (abs(px-x)<.007 and abs(py-y)<.007 and
                    abs(pz-z)<.006 and pz>.122 and
                    abs(uv[i][0]-uv[j][0])<.024 and
                    abs(uv[i][1]-uv[j][1])<.024):
                    near.append(pz)
            if len(near)<3:continue
            dz=max(-.00035,min(.00035,weight*(sum(near)/len(near)-z)))
            if abs(dz)>1e-7:
                next_xyz[i]=(x,y,z+dz)
                changed.add(i)
        xyz=next_xyz
    return xyz,len(changed)


def sculpt_v21_lip_philtrum(points):
    """Final exterior sculpt in metres, after oral fairing, before normals.

    Use paired lateral skin samples at the SAME height to shape a continuous
    central channel. This avoids measuring the nose tip against the upper lip.
    Preserve the seam, lower lip, nose tip and eye meshes.
    """
    side_samples=[p for p in points if .250<p[1]<.271 and
                  .008<abs(p[0])<.014 and p[2]>.115]
    result=[]
    changed=0
    for x,y,z in points:
        ax=abs(x)
        front=fade(z,.119,.137)
        dz=dy=0.
        if .250<y<.270 and ax<.020 and front>0:
            samples=[]
            for sign in (-1,1):
                band=[q[2] for q in side_samples
                      if sign*q[0]>0 and abs(q[1]-y)<.002]
                if band:
                    samples.append(max(band))
            if len(samples)==2:
                target=sum(samples)/2-.00085
                vertical=fade(y,.250,.254)*(1.-fade(y,.264,.270))
                central=1.-fade(ax,.0035,.010)
                dz-=min(.0065,max(0.,z-target))*vertical*central*front
                dz+=.00065*bell(ax,.010,.0035)*vertical*front
        if .2345<y<.250 and ax<.040:
            taper=(1.-fade(ax,.020,.038))*front
            vertical=fade(y,.2345,.238)*(1.-fade(y,.247,.250))
            dz+=.00115*bell(y,.241,.0045)*vertical*taper
            # Two physical Cupid peaks; central notch is left lower.
            dy+=.00075*bell(ax,.010,.004)*bell(y,.246,.0035)*taper
            dz+=.00040*bell(ax,.010,.004)*bell(y,.246,.0035)*taper
        if abs(dz)+abs(dy)>1e-7:changed+=1
        result.append((x,y+dy,z+dz))
    if changed<50:
        raise ValueError('v21 exterior lip/philtrum sculpt did not reach real vertices')
    return result,changed


def retopologize_upper_vermilion(points,uv,faces):
    """Conservative real-3D upper-lip triangle optimization.

    Only exchange internal diagonals of a front-facing, UV-consistent
    quadrilateral lying fully above the mouth seal. Never move vertex IDs,
    the seal, makeup UVs or the outside rim. This makes the sculpted upper
    vermilion a regular surface rather than one long diagonal/shading wedge.
    """
    mesh=list(faces)
    changes=0
    def inside(i):
        x,y,z=points[i]
        u,v=uv[i]
        return (abs(x)<.045 and .237<y<.2545 and z>.126 and
                .33<u<.67 and .323<v<.61)
    def zcross(a,b,c):
        u=[points[b][k]-points[a][k] for k in range(3)]
        v=[points[c][k]-points[a][k] for k in range(3)]
        return u[0]*v[1]-u[1]*v[0]
    def quality(a,b,c):
        pa,pb,pc=(points[i] for i in (a,b,c))
        u=[pb[k]-pa[k] for k in range(3)]
        v=[pc[k]-pa[k] for k in range(3)]
        cross=(u[1]*v[2]-u[2]*v[1],
               u[2]*v[0]-u[0]*v[2],
               u[0]*v[1]-u[1]*v[0])
        twice_area=math.sqrt(sum(k*k for k in cross))
        length2=sum(math.dist(p,q)**2 for p,q in
                    ((pa,pb),(pb,pc),(pc,pa)))
        return twice_area/max(length2,1e-14)
    for _ in range(8):
        adjacency=collections.defaultdict(list)
        for index,(a,b,c) in enumerate(mesh):
            if not all(inside(v) for v in (a,b,c)):continue
            for x,y,z in ((a,b,c),(b,c,a),(c,a,b)):
                adjacency[tuple(sorted((x,y)))].append((index,x,y,z))
        used=set()
        pass_count=0
        for entries in adjacency.values():
            if len(entries)!=2:continue
            (i,a,b,c),(j,bb,aa,d)=entries
            if i in used or j in used or a!=aa or b!=bb:continue
            if not inside(d) or len({a,b,c,d})!=4:continue
            direction=1 if area(uv[a],uv[b],uv[c])>0 else -1
            if min(direction*area(uv[c],uv[d],uv[b]),
                   direction*area(uv[d],uv[c],uv[a]))<1e-10:
                continue
            # Do not join non-neighboring folds in depth, flip an
            # inverted surface or introduce a long diagonal.
            if zcross(a,b,c)<=0 or zcross(b,a,d)<=0:continue
            if zcross(c,d,b)<=0 or zcross(d,c,a)<=0:continue
            if math.dist(points[c],points[d])>.012:continue
            old=min(quality(a,b,c),quality(b,a,d))
            new=min(quality(c,d,b),quality(d,c,a))
            if new<=old*1.005:continue
            mesh[i]=(c,d,b)
            mesh[j]=(d,c,a)
            used.update((i,j))
            pass_count+=1
        changes+=pass_count
        if not pass_count:break
    return mesh,changes


def repair_outer_lip_normals(xyz, raw):
    """Repair inward-facing front skin normals next to the closed mouth.

    The inherited jaw UV remesh can average back-facing lip/inner-oral
    triangles into the actual front skin (N.z below zero). This rendered a
    wide charcoal bar beneath the lip despite a geometrically soft sulcus.
    Blend only exterior front-facing cheek/lip surface toward an outward
    normal, while preserving the thin actual oral seam and nose/eyes.
    """
    adjusted=[]
    changed=0
    for (x,y,z),(nx,ny,nz) in zip(xyz,raw):
        ax=abs(x)
        if not (.198<y<.254 and ax<.056 and z>.117 and nz<.82):
            adjusted.append((nx,ny,nz))
            continue
        weight=(fade(y,.198,.208)*(1.-fade(y,.247,.254))*
                fade(z,.117,.136)*(1.-fade(ax,.038,.056)))
        # The real mouth seal must remain a single dark LINE, not a filled bar.
        weight*=1.-math.exp(-.5*((y-.232)/.0015)**2)
        blend=.93*weight
        if blend<.015:
            adjusted.append((nx,ny,nz))
            continue
        target=(nx*.35,ny*.45,.86)
        length=math.sqrt(sum(t*t for t in target))
        target=tuple(t/length for t in target)
        new=(nx*(1.-blend)+target[0]*blend,
             ny*(1.-blend)+target[1]*blend,
             nz*(1.-blend)+target[2]*blend)
        length=math.sqrt(sum(t*t for t in new))
        adjusted.append(tuple(t/length for t in new))
        changed+=1
    return adjusted,changed


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
    xyz,fair_count=relax_labiomental_shading(xyz,faces)
    xyz,vermilion_fair_count=fair_exterior_oral_surface(xyz,uv,faces)
    xyz,v21_changed=sculpt_v21_lip_philtrum(xyz)
    faces,upper_lip_flips=retopologize_upper_vermilion(xyz,uv,faces)
    prim['attributes']['POSITION']=add_vec3(g,b,xyz)
    prim['attributes']['COLOR_0']=add_vec3(
        g,b,[helpers['neutral_color'](*point) for point in xyz])
    safe_normals,normal_fix_count=repair_outer_lip_normals(xyz,normals(xyz,faces))
    prim['attributes']['NORMAL']=add_vec3(g,b,safe_normals)
    prim['indices']=write_indices(g,b,[i for t in faces for i in t])
    info['mouthChinRebuild']={**shape,**replacement,
        'labiomentalFairingVertices':fair_count,
        'vermilionSurfaceFairingVertices':vermilion_fair_count,
        'v21ExteriorSculptVertices':v21_changed,
        'upperVermilionLocalEdgeFlips':upper_lip_flips,
        'upperVermilionRetopologyExcludesMouthSeal':True,
        'repairedExteriorLipNormals':normal_fix_count,
        'noBroadInvertedUnderlipNormals':True,
        'noSecondaryUnderlipLine':True,
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
