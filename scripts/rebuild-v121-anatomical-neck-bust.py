#!/usr/bin/env python3
"""REPLACE old lower-face lips, chin, jaw, neck and shoulder geometry in female v121.

The entire donor surface from the mouth/nose-base section downward is removed.
The new visible surface has independently generated 3D vertices, triangles,
normals and facial-expression morphs from a single contiguous parametric body.
Only the boundary ring at the retained upper face is reused, strictly as a
weld seam. No old chin/neck/shoulder triangles are rendered. No overlay shell.
"""
import collections
import json
import math
import pathlib
import runpy
import struct
import sys

H=runpy.run_path(str(pathlib.Path(__file__).with_name('rebuild-v121-mouth-chin.py')))
R=runpy.run_path(str(pathlib.Path(__file__).with_name('add-v121-face-expressions.py')))
read_glb,accessor,add_vec3=H['read_glb'],H['accessor'],H['add_vec3']
write_indices,normals=H['write_indices'],H['normals']
add_float=R['add_float']
deformation=R['deformation']
NAMES=R['NAMES']
CUTS=(.247,.245,.250,.242,.240,.253,.238)

def fade(x,a,b):
    t=max(0.,min(1.,(x-a)/(b-a)))
    return t*t*(3.-2.*t)

def gauss(x,center,width):
    return math.exp(-.5*((x-center)/width)**2)

def append_uv(g,b,values):
    while len(b)%4: b.append(0)
    start=len(b)
    for u,v in values:b.extend(struct.pack('<ff',u,v))
    vi=len(g['bufferViews'])
    g['bufferViews'].append({'buffer':0,'byteOffset':start,
                            'byteLength':8*len(values),'target':34962})
    ai=len(g['accessors'])
    g['accessors'].append({'bufferView':vi,'componentType':5126,
                           'count':len(values),'type':'VEC2'})
    return ai

def rim_from_cut(xyz,faces,cut):
    kept=[];removed=[]
    for f in faces:
        if len(set(f))<3:continue
        if min(xyz[i][1] for i in f)<cut:
            removed.append(f)
        else:kept.append(f)
    def edges(fs):
        return collections.Counter(tuple(sorted((a,b)))
               for x,y,z in fs for a,b in ((x,y),(y,z),(z,x)))
    outer=edges(kept)
    inner=edges(removed)
    edge_ids={e for e in outer if inner[e]>0}
    # The donor's UV split around the nape must be merged geometrically.
    canonical={}
    members=collections.defaultdict(list)
    for i in {v for e in edge_ids for v in e}:
        key=tuple(round(t,5) for t in xyz[i])
        canonical[i]=key
        members[key].append(i)
    adjacency=collections.defaultdict(set)
    for a,b in edge_ids:
        aa,bb=canonical[a],canonical[b]
        if aa==bb: continue
        adjacency[aa].add(bb);adjacency[bb].add(aa)
    deg=collections.Counter(len(n) for n in adjacency.values())
    if not adjacency or set(deg)!={2}:
        raise ValueError('Cut %f does not have a single closed rim: %s'%(cut,deg))
    # The primary outer skin section and a smaller inner nasal-cavity section
    # are two distinct closed loops. The donor skin creates BOTH at nose-base
    # cut height. Retopologize each rather than leaving the hidden nasal hole.
    remaining=set(adjacency)
    all_rings=[]
    while remaining:
        start=min(remaining)
        cycle=[start]
        before=None
        while True:
            options=sorted(adjacency[cycle[-1]]-({before} if before is not None else set()))
            if not options:raise ValueError('Open loop at '+str(cut))
            nxt=options[0]
            if nxt==start:break
            if nxt in cycle:raise ValueError('Cut seam repeats itself')
            before=cycle[-1]
            cycle.append(nxt)
            if len(cycle)>len(adjacency):raise ValueError('Loop overflow')
        if len(cycle)<12:raise ValueError('Unusable small boundary cycle')
        remaining-=set(cycle)
        all_rings.append([min(members[v]) for v in cycle])
    all_rings.sort(key=len,reverse=True)
    ids=all_rings[0]
    if len(ids)<80 or len(ids)>300:
        raise ValueError('Wrong outer rim size: '+str(len(ids)))
    if max(xyz[i][2] for i in ids)<.085 or min(xyz[i][2] for i in ids)>-.04:
        raise ValueError('Cut rim does not span entire cranial skin')
    if len(all_rings)>3 or sum(len(r) for r in all_rings[1:])>130:
        raise ValueError('Too many hidden nasal boundary holes')
    print('LOWER_FACE_DISCARD_BOUNDARIES',json.dumps({
       'cut':cut,'loops':[len(r) for r in all_rings],
       'outerSkinTriangles':len(removed)}))
    return ids,removed,len(edge_ids),all_rings[1:]

# Measured 3D profile, not adjustments to the previous jaw or body mesh.
# Axial Y increases upwards; front side is +Z, all dimensions in metres.
# The curves deliberately contain one anatomically rounded menton, without
# a forward lower-jaw shelf or an extra protrusion under the chin.
STATIONS=[
 (.246,.070,.139,-.057),
 (.242,.070,.141,-.058), # upper vermilion
 (.238,.070,.140,-.058),
 (.234,.070,.135,-.058), # mouth seal
 (.230,.071,.136,-.058),
 (.226,.071,.140,-.059),
 (.222,.072,.143,-.060), # lower vermilion
 (.218,.073,.139,-.060),
 (.214,.073,.135,-.061),
 (.209,.073,.129,-.061),
 (.204,.071,.123,-.062),
 (.198,.068,.120,-.062), # shallow labiomental sulcus
 (.191,.066,.121,-.063),
 (.185,.064,.123,-.063), # single rounded menton
 (.179,.063,.121,-.064),
 (.173,.063,.116,-.065),
 (.164,.064,.107,-.066),
 (.155,.064,.097,-.068),
 (.145,.062,.085,-.069),
 (.134,.061,.075,-.071),
 (.122,.060,.068,-.073),
 (.109,.061,.066,-.074),
 (.094,.064,.068,-.076),
 (.080,.078,.072,-.078),
 (.065,.114,.079,-.084),
 (.048,.155,.091,-.093),
 (.030,.182,.105,-.104),
 (.012,.196,.121,-.109),
 (-.022,.196,.142,-.118),
 (-.075,.195,.144,-.124)
]

def section(y):
    """C1 Hermite interpolation without the stacked zero-slope banding.

    The former smoothstep interpolation forced zero slope at *every* level,
    producing severe horizontal convex rings and a duplicated chin shelf.
    """
    if y>=STATIONS[0][0]:return STATIONS[0][1:]
    if y<=STATIONS[-1][0]:return STATIONS[-1][1:]
    def derivative(i,k):
        if i==0:
            return (STATIONS[1][k]-STATIONS[0][k])/(STATIONS[1][0]-STATIONS[0][0])
        if i==len(STATIONS)-1:
            return (STATIONS[i][k]-STATIONS[i-1][k])/(STATIONS[i][0]-STATIONS[i-1][0])
        lo=(STATIONS[i][k]-STATIONS[i-1][k])/(STATIONS[i][0]-STATIONS[i-1][0])
        hi=(STATIONS[i+1][k]-STATIONS[i][k])/(STATIONS[i+1][0]-STATIONS[i][0])
        if lo*hi<=0:return 0.
        return 2.*lo*hi/(lo+hi)
    for i,(hi,lo) in enumerate(zip(STATIONS,STATIONS[1:])):
        if hi[0]>=y>=lo[0]:
            h=lo[0]-hi[0]
            t=(y-hi[0])/h
            return tuple((2*t**3-3*t*t+1)*hi[k]+
                    (t**3-2*t*t+t)*h*derivative(i,k)+
                    (-2*t**3+3*t*t)*lo[k]+
                    (t**3-t*t)*h*derivative(i+1,k)
                   for k in (1,2,3))
    raise ValueError('Failed anatomical interpolation')


def generate(theta,y):
    w,f,b=section(y)
    c,s=math.cos(theta),math.sin(theta)
    x=w*c
    z= (f*s if s>=0 else -b*s)
    front=max(0.,s)
    # Upper/lower vermilion are 3D volume within the same actual skin mesh.
    # Corners taper into cheek skin, never a rectangular disconnected strip.
    mouth=gauss(x,0.,.033)*front*(1.-fade(abs(x),.037,.060))
    if .211<y<.249:
        z+=mouth*(.0030*gauss(y,.240,.0048)+
                  .0038*gauss(y,.225,.0052)-
                  .0018*gauss(y,.233,.0019))
        z+=.0008*front*(gauss(x,-.044,.010)+gauss(x,.044,.010))*gauss(y,.232,.011)
    if y<.09:
        z+=front*(.0033*gauss(y,.057,.015)*gauss(abs(x),.086,.042)
                 +.006*gauss(y,-.010,.036)*gauss(abs(x),.087,.047))
    return (x,y,z)

def skin_color(x,y,z):
    col=[.986,.969,.960]
    front=fade(z,.055,.115)
    if .210<=y<=.249 and abs(x)<.059:
        xfade=gauss(x,0.,.038)*(1.-fade(abs(x),.045,.059))
        v=(.80*gauss(y,.241,.0050)+gauss(y,.224,.0056))*xfade*front
        col[1]-=.18*v;col[2]-=.20*v
    return tuple(max(0.,min(1.,q)) for q in col)

def rebuild(path):
    g,b=read_glb(path)
    head=g['meshes'][0]
    if head.get('extras',{}).get('version')!=121 or len(g['meshes'])!=11:
        raise ValueError('Expected pre-rebuild female bald v121 skin')
    skin=head['primitives'][0]
    xyz=[tuple(v) for v in accessor(g,b,skin['attributes']['POSITION'])]
    uv=[tuple(v) for v in accessor(g,b,skin['attributes']['TEXCOORD_0'])]
    old_norm=[tuple(v) for v in accessor(g,b,skin['attributes']['NORMAL'])]
    old_color=[tuple(v) for v in accessor(g,b,skin['attributes']['COLOR_0'])]
    ix=[int(v[0]) for v in accessor(g,b,skin['indices'])]
    if len(xyz)!=13455 or len(ix)!=25920*3 or len(skin.get('targets',[]))!=11:
        raise ValueError('Unexpected source mesh and expression topology')
    tri=[tuple(ix[i:i+3]) for i in range(0,len(ix),3)]
    matches=[]
    for cut in CUTS:
        try:
            ids,removed,count,inner_rings=rim_from_cut(xyz,tri,cut)
            matches.append((cut,ids,removed,count,inner_rings))
            print('CANDIDATE LOWER FACE CUT',cut,'rim',len(ids),'triangles',len(removed))
        except ValueError as e:
            print('REJECT LOWER FACE CUT',str(e))
    if not matches:
        raise ValueError('No safe complete cut above mouth: full replacement unsafe')
    cut,ring,removed,border_edges,nose_rings=matches[0]
    if len(removed)<4000:raise ValueError('Old lower-face surface is still present')
    # Select old faces to discard; preserve upper forehead, eye and nose polygons.
    discard=set(removed)
    retired=0;new_ix=list(ix)
    for j,t in enumerate(tri):
        if t in discard:
            new_ix[j*3:j*3+3]=[t[0]]*3
            retired+=1
    if retired!=len(discard):raise ValueError('Old triangles were not fully retired')
    skin['indices']=write_indices(g,b,new_ix)
    n=len(ring)
    # Genuine geometric weld to upper face, not duplicated imported chin mesh.
    top=[xyz[i] for i in ring]
    olduv=[uv[i] for i in ring]
    oldcolors=[old_color[i] for i in ring]
    thetas=[math.atan2(xyz[i][2],xyz[i][0]) for i in ring]
    # Keep nose bridge at retained top ring, then generate independent cutaneous
    # mouth, cheeks, chin, submental, neck, clavicle and bust by fixed sections.
    ys=[.243,.240,.237,.234,.231,.228,.225,.222,.219,.216,
        .213,.210,.207,.204,.201,.198,.194,.190,.185,.181,.176,
        .171,.166,.160,.154,.148,.142,.135,.127,.118,.109,.100,
        .092,.083,.074,.064,.054,.043,.031,.018,.006,-.021,-.075]
    if cut<=.242:ys=[y for y in ys if y<cut-.005]
    pos=list(top); tex=list(olduv); colors=list(oldcolors)
    for row,y in enumerate(ys):
        weight=fade(row,0.,3.)
        for j,theta in enumerate(thetas):
            v=generate(theta,y)
            # Smooth joining only, without using source body geometry in
            # any independent ring after the lip region begins.
            if row==0:
                # Natural lower-nasal transition: upper ring stays at cut y.
                v=(v[0],v[1],v[2])
            pos.append(v)
            t=fade(row,0.,5.)
            tex.append(tuple(olduv[j][k]*(1-t)+(.78+(theta/math.tau)*.10,.84-y*.10)[k]*t for k in (0,1)))
            color=skin_color(*v)
            colors.append(tuple(oldcolors[j][k]*(1-t)+color[k]*t for k in range(3)))
    # Upper face and new surface have identical seam coordinates; no
    # old jaw/neck shoulder triangles survive the cut.
    orientation=sum(pos[j][0]*pos[(j+1)%n][2]-
                    pos[(j+1)%n][0]*pos[j][2] for j in range(n))
    if abs(orientation)<.0004:raise ValueError('Degenerate head cut')
    faces=[]
    for row in range(len(ys)):
        a,b0=row*n,(row+1)*n
        for j in range(n):
            nxt=(j+1)%n
            # Orientation depends on outer radial angle ordering.
            if orientation>0:
                faces.extend(((a+j,a+nxt,b0+j),(a+nxt,b0+nxt,b0+j)))
            else:
                faces.extend(((a+nxt,a+j,b0+j),(b0+nxt,a+nxt,b0+j)))
    # Bottom cap is far below visible cervical anatomy.
    c=len(pos);pos.append((0.,-.076,0.))
    tex.append((.79,.88));colors.append((.986,.969,.960))
    row=len(ys)*n
    for j in range(n):
        nx=(j+1)%n
        faces.append((row+nx,row+j,c) if orientation>0 else (row+j,row+nx,c))
    # Independently regenerate the inner nasal underside surface as a small
    # recessed cap. This closes the donor's second cut boundary while keeping
    # the original nostril rims above the cut. None of its old triangles survive.
    new_nasal_caps=0
    for original_ring in nose_rings:
        first=len(pos)
        nose_xyz=[xyz[i] for i in original_ring]
        centre=(sum(p[0] for p in nose_xyz)/len(nose_xyz),
                sum(p[1] for p in nose_xyz)/len(nose_xyz),
                sum(p[2] for p in nose_xyz)/len(nose_xyz))
        for i in original_ring:
            pos.append(xyz[i]);tex.append(uv[i]);colors.append(old_color[i])
        ring2=len(pos)
        for i in original_ring:
            x,y,z=xyz[i]
            pos.append((centre[0]+.60*(x-centre[0]),
                        centre[1]-.010+.50*(y-centre[1]),
                        centre[2]-.010+.60*(z-centre[2])))
            tex.append(uv[i]);colors.append(old_color[i])
        end=len(pos)
        pos.append((centre[0],centre[1]-.016,centre[2]-.018))
        tex.append((.50,.48));colors.append((.986,.969,.960))
        for j in range(len(original_ring)):
            k=(j+1)%len(original_ring)
            faces.extend(((first+j,first+k,ring2+j),
                          (first+k,ring2+k,ring2+j),
                          (ring2+j,ring2+k,end)))
        new_nasal_caps+=len(original_ring)*3
    ns=normals(pos,faces)
    for j,src in enumerate(ring):
        ns[j]=old_norm[src]
    for v in pos:
        if not all(math.isfinite(q) for q in v):raise ValueError('Non-finite new geometry')
    if len(pos)<=2000 or len(faces)<=3500:
        raise ValueError('Fresh parametric lower face has insufficient topology')
    # Construct expression deltas on the new face and lips, so mouthOpen,
    # five vowels, smiles, etc move the generated lips rather than dead source.
    targets=[]
    for name in NAMES:
        offsets=[deformation(name,*p,'skin') for p in pos]
        targets.append({'POSITION':add_float(g,b,offsets)})
    new_mesh={
      'name':'V121_NEW_CONTIGUOUS_LOWER_FACE_LIPS_CHIN_NECK_BUST',
      'primitives':[{
        'attributes':{
          'POSITION':add_vec3(g,b,pos),
          'NORMAL':add_vec3(g,b,ns),
          'COLOR_0':add_vec3(g,b,colors),
          'TEXCOORD_0':append_uv(g,b,tex)},
        'indices':write_indices(g,b,[k for f in faces for k in f]),
        'material':skin['material'],
        'targets':targets}],
      'weights':[0.]*len(NAMES),
      'extras':{'targetNames':list(NAMES)}
    }
    meshid=len(g['meshes']);g['meshes'].append(new_mesh)
    oldnode=next(nd for nd in g['nodes'] if nd.get('mesh')==0)
    node={'name':'V121_NEW_LOWER_FACE_NECK_MORPH_NODE','mesh':meshid}
    for key in ('matrix','translation','rotation','scale'):
        if key in oldnode:node[key]=list(oldnode[key])
    node_id=len(g['nodes']);g['nodes'].append(node)
    g['scenes'][0]['nodes'].append(node_id)
    for a in g.get('animations',[]):
        a['channels'].append({'sampler':0,'target':{'node':node_id,'path':'weights'}})
    m=head.setdefault('extras',{})
    m['neckBustRebuild']={
      'version':'female-v121-true-single-new-lower-face-and-bust-v2',
      'replacedFromY':cut,
      'entireOldLowerFaceRemoved':True,
      'oldLowerFaceChinNeckBustTrianglesRetired':retired,
      'freshVisibleSurfaceVertices':len(pos),
      'freshVisibleSurfaceTriangles':len(faces),
      'oldBodyTrianglesUsedInNewMesh':0,
      'upperFaceWeldBoundaryVertices':n,
      'rebuiltInnerNoseCutTriangles':new_nasal_caps,
      'upperFaceWeldBoundaryEdges':border_edges,
      'newSkinMeshMorphChannels':list(NAMES),
      'newMorphedNodesAddedToAnimation':len(g['animations']),
      'oneContiguousGeneratedMouthChinNeckShoulderBust':True,
      'oldV120AndMaleModelsUntouched':True}
    m['facialExpressionRig']['animatedMeshes']+=1
    g['buffers'][0]['byteLength']=len(b)
    raw=json.dumps(g,ensure_ascii=False,separators=(',',':')).encode('utf8')
    raw+=b' '*((-len(raw))%4)
    b+=bytes((-len(b))%4)
    with path.open('wb') as f:
        f.write(struct.pack('<4sII',b'glTF',2,12+8+len(raw)+8+len(b)))
        f.write(struct.pack('<I4s',len(raw),b'JSON'));f.write(raw)
        f.write(struct.pack('<I4s',len(b),b'BIN'+bytes([0])));f.write(b)
    print('V121 TRULY REBUILT ENTIRE LOWER FACE',json.dumps(m['neckBustRebuild']))

if __name__=='__main__':
    rebuild(pathlib.Path(sys.argv[1]))
