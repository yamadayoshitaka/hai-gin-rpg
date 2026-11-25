"""R53 G3 local wig correction on actual integrated body meshes.
Keep source UV/material/topology; welded displacement only. Signed nearest
surface is a proxy (open surfaces and roots can be ambiguous), not proof of
no collisions, scalp coverage, or appearance approval.
"""
import bpy,numpy as np,sys,json,hashlib,math
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
args=sys.argv[sys.argv.index('--')+1:]
bodies,prior,out=map(lambda x:Path(x).resolve(),args[:3]);out.mkdir(parents=True,exist_ok=True)
i=int(args[3]);ident=f'male_continuous_{i:02d}'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def pts(o):return np.array([o.matrix_world@v.co for v in o.data.vertices],np.float64)
def tri(o):
    o.data.calc_loop_triangles()
    return np.array([tuple(t.vertices) for t in o.data.loop_triangles],np.int32)
def normals(P,T):
    q=P[T];return np.cross(q[:,1]-q[:,0],q[:,2]-q[:,0])
def surface(P,T):
    return BVHTree.FromPolygons([Vector(p) for p in P],[tuple(t) for t in T],all_triangles=True)
def distances(tree,P):
    d=[];n=[];absd=[]
    for p in P:
        q,v,idx,dist=tree.find_nearest(Vector(p))
        if q is None:raise RuntimeError('missing closest body point')
        d.append((Vector(p)-q).dot(v));n.append(tuple(v));absd.append(dist)
    return np.asarray(d),np.asarray(n),np.asarray(absd)
def metrics(d,dist,root):
    return dict(penetrationProxy=float(np.mean(d<-.003)),deepPenetrationProxy=float(np.mean(d<-.010)),gapProxy=float(np.mean(d>.035)),
        rootGapProxy=float(np.mean(d[root]>.025)) if root.any() else None,
        medianAbsoluteDistance_m=float(np.median(np.abs(d))),worstSigned_m=float(d.min()),
        closePenetrationProxy=float(np.mean((d<-.003)&(dist<.035))))
def export(wig,p):
    bpy.ops.object.select_all(action='DESELECT')
    for o in wig:o.select_set(True)
    bpy.context.view_layer.objects.active=wig[0]
    bpy.ops.export_scene.gltf(filepath=str(p),export_format='GLB',use_selection=True,export_skins=False,export_animations=False)
def snapshot(o):
    return ([u.name for u in o.data.uv_layers],[(m.name if m else None) for m in o.data.materials],len(o.data.vertices),len(o.data.polygons))
records={}
for f in bodies.glob('*/integration.json'):
    for m in json.loads(f.read_text())['models']:records[m['id']]=(f.parent,m)
folder,rec=records[ident];p=folder/(ident+'.glb')
if sha(p)!=rec['sha256']:raise RuntimeError('body hash mismatch')
wr={m['id']:m for m in json.loads((prior/'wig-fit-report.json').read_text())['models']}[ident]
wfile=prior/(ident+'_wig.glb')
if sha(wfile)!=wr['sha256'] or wr['bodySHA256']!=rec['sha256']:raise RuntimeError('wig provenance mismatch')
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(p));bpy.context.view_layer.update()
bodylist=[o for o in bpy.context.scene.objects if o.type=='MESH' and any(m.type=='ARMATURE' and m.object for m in o.modifiers)]
if len(bodylist)!=1:raise RuntimeError('body mesh ambiguous')
body=bodylist[0];rig=next(m.object for m in body.modifiers if m.type=='ARMATURE')
P=pts(body);T=tri(body);top=P[:,2].max()
# Match the previous diagnostic head region and also examine whole-body proximity.
headT=T[np.min(P[T,2],axis=1)>top-.27]
tree=surface(P,headT);full=surface(P,T)
before=set(bpy.context.scene.objects)
bpy.ops.import_scene.gltf(filepath=str(wfile));bpy.context.view_layer.update()
wig=[o for o in bpy.context.scene.objects if o not in before and o.type=='MESH']
if not wig:raise RuntimeError('no source wig mesh')
orig=[pts(o) for o in wig];S=np.concatenate(orig)
offset=0;ts=[]
for o,Q in zip(wig,orig):
    ts.append(tri(o)+offset);offset+=len(Q)
WT=np.concatenate(ts);snap=[snapshot(o) for o in wig]
N=normals(S,WT);areas=np.linalg.norm(N,axis=1);valid=areas>1e-12
_,w=np.unique(np.round(S,6),axis=0,return_inverse=True);count=np.bincount(w);nv=len(count)
W=np.column_stack([np.bincount(w,weights=S[:,k])/count for k in range(3)])
edges=np.unique(np.sort(np.concatenate((w[WT[:,[0,1]]],w[WT[:,[1,2]]],w[WT[:,[2,0]]])),axis=1),axis=0)
edges=edges[edges[:,0]!=edges[:,1]]
e0=np.concatenate((edges[:,0],edges[:,1]));e1=np.concatenate((edges[:,1],edges[:,0]))
degree=np.maximum(1,np.bincount(e0,minlength=nv))
def blur(A):
    return np.column_stack([np.bincount(e0,weights=A[e1,k],minlength=nv)/degree for k in range(3)])
def safe(Q):
    nn=normals(Q,WT)
    return int(np.sum((np.einsum('ij,ij->i',N,nn)<0)&valid)),int(np.sum((np.linalg.norm(nn,axis=1)<areas*.04)&valid))
root=(S[:,2]>=top-.10)&(S[:,2]<=top+.015)
d0,_,a0=distances(tree,S);old=metrics(d0,a0,root)
fd0,_,fa0=distances(full,S);oldfull=metrics(fd0,fa0,root)
# Local correction in the measured surface normal field; no global resize.
# Restrict to near-surface penetrations, avoid pulling intended free hair ends
# toward the head. Preserve UV seam positions by sharing displacement.
D=np.zeros_like(W);best=D.copy();bestscore=old['penetrationProxy']+old['deepPenetrationProxy']*2
history=[]
for it in range(12):
    Q=S+D[w];dd,nn,aa=distances(tree,W+D)
    # Deep points outside the local reliability radius remain explicitly flagged.
    active=(dd<-.0015)&(aa<.040)&((W+D)[:,2]>top-.24)
    A=np.zeros_like(D)
    A[active]=nn[active]*np.minimum(.005,np.maximum(0,.0015-dd[active]))[:,None]
    A=.72*A+.28*blur(A)
    for _ in range(2):A=.80*A+.20*blur(A)
    if not np.any(active):break
    accepted=False
    for factor in (1,.65,.4,.2,.1):
        cand=D+A*factor
        length=np.linalg.norm(cand,axis=1)
        cand*=np.minimum(1,.018/np.maximum(length,1e-12))[:,None]
        G=S+cand[w];fl,co=safe(G)
        if fl or co:continue
        gd,_,ga=distances(tree,G);m=metrics(gd,ga,root)
        score=m['penetrationProxy']+2*m['deepPenetrationProxy']
        if score<bestscore-1e-7 and m['gapProxy']<=old['gapProxy']+.015 and (m['rootGapProxy'] or 0)<=(old['rootGapProxy'] or 0)+.02:
            D=cand;best=cand.copy();bestscore=score;accepted=True
            history.append({'iteration':it,'factor':factor,**m});break
    if not accepted:break
F=S+best[w];fl,co=safe(F)
if fl or co:raise RuntimeError('new face inversion/collapse')
d,_,a=distances(tree,F);new=metrics(d,a,root)
fd,_,fa=distances(full,F);newfull=metrics(fd,fa,root)
# Whole-body proximity is a separate regression diagnostic. Revert if worse.
if newfull['penetrationProxy']>oldfull['penetrationProxy']+.002:
    F=S.copy();best[:]=0;new=old.copy();newfull=oldfull.copy();history.append({'reverted':'whole-body proximity regression'})
scene=bpy.context.scene;scene.render.engine='BLENDER_WORKBENCH'
scene.render.resolution_x=480;scene.render.resolution_y=480;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';sh=scene.display.shading;sh.light='STUDIO';sh.color_type='MATERIAL';sh.show_shadows=True;sh.show_cavity=True;sh.cavity_type='BOTH'
bpy.ops.object.camera_add();cam=bpy.context.object;cam.data.type='ORTHO';cam.data.ortho_scale=.44;scene.camera=cam
scalp=P[(P[:,2]>=top-.105)&(P[:,2]<=top-.032)];lo,hi=np.quantile(scalp,[.04,.96],axis=0)
center=Vector(((lo[0]+hi[0])/2,(lo[1]+hi[1])/2,top-.10))
dirs={'front':(0,-1,0),'left':(-1,0,0),'right':(1,0,0),'rear':(0,1,0),'crown':(0,0,1)}
def renders(state):
    for tag,direction in dirs.items():
        cam.location=center+Vector(direction)*.85
        cam.rotation_euler=(center-cam.location).to_track_quat('-Z','X' if tag=='crown' else 'Y').to_euler()
        scene.render.filepath=str(out/(ident+'_'+state+'_'+tag+'.png'))
        bpy.ops.render.render(write_still=True)
renders('before')
offset=0
for o,Q in zip(wig,orig):
    inv=o.matrix_world.inverted()
    for v,q in zip(o.data.vertices,F[offset:offset+len(Q)]):v.co=inv@Vector(q)
    offset+=len(Q);o.data.update()
bpy.context.view_layer.update()
if [snapshot(o) for o in wig]!=snap:raise RuntimeError('UV/material/topology changed')
if not np.array_equal(pts(body),P):raise RuntimeError('body modified')
renders('after')
body.hide_render=True;renders('wig');body.hide_render=False
dest=out/(ident+'_wig.glb');export(wig,dest)
# Head-follow diagnostic: rotate the wig with the actual head bone matrix.
# Not a production rig or an authored animation. Evaluate whole-body nearest
# surface at 4 static poses and retain the metrics without passing collision.
head=next((b for b in rig.pose.bones if b.name.lower()=='head'),None)
pose=[]
if head:
    neutral=rig.matrix_world@head.matrix.copy()
    head.rotation_mode='XYZ'
    for axis,degs in [(0,15),(0,-15),(2,20),(2,-20)]:
        head.rotation_euler=(0,0,0);head.rotation_euler[axis]=math.radians(degs)
        bpy.context.view_layer.update()
        trans=(rig.matrix_world@head.matrix)@neutral.inverted()
        dep=bpy.context.evaluated_depsgraph_get();o=body.evaluated_get(dep);mesh=o.to_mesh()
        try:
            posed=np.array([o.matrix_world@v.co for v in mesh.vertices])
            if len(posed)!=len(P):raise RuntimeError('evaluated topology changed')
            B=surface(posed,T);Q=np.array([trans@Vector(x) for x in F])
            sd,_,ad=distances(B,Q)
            pose.append({'axis':axis,'degrees':degs,**metrics(sd,ad,root)})
        finally:o.to_mesh_clear()
    head.rotation_euler=(0,0,0);bpy.context.view_layer.update()
report={'id':ident,'bodySHA256':rec['sha256'],'priorWigSHA256':wr['sha256'],'sourceHair':wr['sourceHair'],
 'sourceHairSHA256':wr['sourceHairSHA256'],'license':wr['license'],'sha256':sha(dest),'vertices':len(S),'triangles':len(WT),
 'before':old,'after':new,'wholeBodyBefore':oldfull,'wholeBodyAfter':newfull,'iterations':history,
 'maxDisplacement_m':float(np.max(np.linalg.norm(F-S,axis=1))),'newFaceFlips':fl,'collapsed':co,
 'poseProbes':pose,'headBone':head.name if head else None,'geometryImproved':bool(new['penetrationProxy']<old['penetrationProxy']),
 'G3CollisionApproval':False,'G5VisualApproval':False,'scalpCoverageApproved':False,'classification':'local fit candidate; nearest normal diagnostics only'}
(out/'report.json').write_text(json.dumps(report,indent=2))
print('R53 WIG LOCAL',json.dumps(report),flush=True)
