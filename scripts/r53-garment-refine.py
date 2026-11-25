"""Second pass on the eight actual exported R53 garments, not a new primitive outfit.
Anatomical cross-section rays plus seam-welded constrained local correction.
Keep the body, UVs, materials, bind weights and previous artifacts intact.
Signed nearest normals and sampled poses are diagnostics, not visual approval.
"""
import bpy,numpy as np,sys,json,hashlib,math
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
args=sys.argv[sys.argv.index('--')+1:]
root,prior,out=map(lambda x:Path(x).resolve(),args[:3]);out.mkdir(parents=True,exist_ok=True)
ident,style=args[3:5]
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
records={}
for f in root.rglob('body-candidates.json'):
    for m in json.loads(f.read_text())['models']:records[m['id']]=(f.parent,m)
folder,rec=records[ident];bodyfile=folder/(ident+'.glb')
if sha(bodyfile)!=rec['sha256']:raise RuntimeError('body SHA mismatch')
report=json.loads((prior/'garment-report.json').read_text())
gfile=prior/(ident+'_'+style+'_garment.glb')
if report['id']!=ident or report['style']!=style or report['bodySHA256']!=rec['sha256'] or sha(gfile)!=report['sha256']:raise RuntimeError('prior garment provenance mismatch')
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(bodyfile));bpy.context.view_layer.update()
def skinned(o):return o.type=='MESH' and any(m.type=='ARMATURE' and m.object for m in o.modifiers)
def rigof(o):return next(m.object for m in o.modifiers if m.type=='ARMATURE' and m.object)
bodylist=[o for o in bpy.context.scene.objects if skinned(o)]
if len(bodylist)!=1:raise RuntimeError('body mesh ambiguous')
body=bodylist[0];rig=rigof(body)
def points(o):return np.array([o.matrix_world@v.co for v in o.data.vertices],np.float64)
def tri(o):
    o.data.calc_loop_triangles()
    return np.array([tuple(t.vertices) for t in o.data.loop_triangles],np.int32)
def bvh(P,T):
    if not len(T) or T.min()<0 or T.max()>=len(P) or not np.isfinite(P).all():raise RuntimeError('invalid BVH input')
    return BVHTree.FromPolygons([Vector(tuple(float(x) for x in p)) for p in P],[tuple(int(v) for v in t) for t in T],all_triangles=True)
def evaluated(o):
    e=o.evaluated_get(bpy.context.evaluated_depsgraph_get());m=e.to_mesh()
    try:return np.array([e.matrix_world@v.co for v in m.vertices],np.float64)
    finally:e.to_mesh_clear()
P=points(body);T=tri(body);tree=bvh(P,T);height=float(np.ptp(P[:,2]))
def pos(n):return np.array(rig.matrix_world@rig.data.bones[n].head_local)
def weights(o):
    names=[g.name for g in o.vertex_groups]
    return [{names[g.group]:float(g.weight) for g in v.groups if g.weight>1e-6} for v in o.data.vertices]
bw=weights(body)
torso=np.array([sum(v for n,v in w.items() if n.lower().startswith(('spine','pelvis','breast','clavicle','root'))) for w in bw])
# Surface regions avoid the adjacent arms/other leg when tracing cross sections.
region={}
for side in ('L','R'):
    arr=np.array([sum(v for n,v in w.items() if n.endswith('.'+side) and n.lower().startswith(('upperleg','lowerleg','foot','pelvis'))) for w in bw])
    mask=np.mean(arr[T],axis=1)>.45
    if mask.sum()<30:raise RuntimeError('leg region too small '+side)
    region[side]=bvh(P,T[mask])
mask=np.mean(torso[T],axis=1)>.45
if mask.sum()<100:raise RuntimeError('torso region too small')
region['torso']=bvh(P,T[mask])
hips=(pos('upperleg01.L')+pos('upperleg01.R'))/2
spine=sorted([pos('spine%02d'%i) for i in range(1,6)],key=lambda p:p[2])
axis=np.array([hips]+spine+[pos('neck01')]);axis=axis[np.argsort(axis[:,2])]
def trunkcenter(z):
    return np.array([np.interp(z,axis[:,2],axis[:,i]) for i in (0,1)]+[z])
def legcenter(p,side):
    a,b,c=pos('upperleg01.'+side),pos('lowerleg01.'+side),pos('foot.'+side)
    options=[]
    for x,y in [(a,b),(b,c)]:
        d=y-x;f=np.clip(np.dot(p-x,d)/max(np.dot(d,d),1e-12),0,1);q=x+f*d
        options.append((np.linalg.norm(p-q),q,d/np.linalg.norm(d)))
    _,q,d=min(options,key=lambda x:x[0]);return q,d
def measure(q,side,part):
    if part=='torso':
        if q[2]<axis[0,2]-.10 or q[2]>axis[-1,2]-.025:return None
        center=trunkcenter(q[2]);v=q-center;v[2]=0;key='torso'
    else:
        center,d=legcenter(q,side);v=q-center;v-=np.dot(v,d)*d;key=side
    radius=float(np.linalg.norm(v))
    if radius<.008:return None
    direction=v/radius
    # Cast inward from outside the anatomical region, take its outer surface.
    # Ray direction is radial relative to the measured skeleton, not global scale.
    start=center+direction*.38
    hit,n,idx,dist=region[key].ray_cast(Vector(start),Vector(-direction),.38)
    if hit is None:return None
    hit=np.array(hit);r=float(np.dot(hit-center,direction))
    if not .008<r<.32:return None
    return direction,r,radius
def distances(Q,tree):
    d=[];n=[];a=[]
    for p in Q:
        q,v,idx,dist=tree.find_nearest(Vector(p))
        if q is None:raise RuntimeError('missing closest surface')
        d.append((Vector(p)-q).dot(v));n.append(tuple(v));a.append(dist)
    return np.asarray(d),np.asarray(n),np.asarray(a)
def metrics(Q,tree):
    d,_,a=distances(Q,tree)
    return {'penetrationProxy':float(np.mean(d<-.003)),'deepPenetrationProxy':float(np.mean(d<-.015)),'medianClearance_m':float(np.median(d)),'maxDepth_m':float(d.min()),'gapProxy':float(np.mean(d>.075))}
def score(m):return m['penetrationProxy']+2*m['deepPenetrationProxy']
def acceptable(m,old):
    return m['penetrationProxy']<=old['penetrationProxy']+1e-9 and m['deepPenetrationProxy']<=old['deepPenetrationProxy']+1e-9 and m['gapProxy']<=old['gapProxy']+.025
def normals(Q,T):
    q=Q[T];return np.cross(q[:,1]-q[:,0],q[:,2]-q[:,0])
before=set(bpy.context.scene.objects)
bpy.ops.import_scene.gltf(filepath=str(gfile));bpy.context.view_layer.update()
new=[o for o in bpy.context.scene.objects if o not in before]
garments=[o for o in new if skinned(o)]
names={p['part'] for p in report['parts']}
if {o.name for o in garments}!=names or len(garments)!=len(names):raise RuntimeError('unexpected prior garment parts '+str([o.name for o in garments]))
def snapshot(o):
    return (len(o.data.vertices),len(o.data.polygons),[u.name for u in o.data.uv_layers],[m.name if m else None for m in o.data.materials],weights(o))
original={};snap={}
for o in garments:
    src=rigof(o)
    # A detached garment contains a copy of the body rig. Verify matching
    # bone names and rest matrices before assigning the actual target rig.
    for n in {n for row in weights(o) for n in row}:
        a=src.data.bones.get(n);b=rig.data.bones.get(n)
        if a is None or b is None:raise RuntimeError('missing shared bone '+n)
        delta=np.asarray(src.matrix_world@a.matrix_local)-np.asarray(rig.matrix_world@b.matrix_local)
        if np.max(np.abs(delta))>.002:raise RuntimeError('bind rest mismatch '+n)
    M=o.matrix_world.copy();o.parent=None;o.matrix_world=M
    for mod in o.modifiers:
        if mod.type=='ARMATURE':mod.object=rig
    original[o.name]=points(o);snap[o.name]=snapshot(o)
for o in new:
    if o not in garments and o.name in bpy.data.objects:bpy.data.objects.remove(o,do_unlink=True)
bpy.context.view_layer.update()
def apply(o,Q):
    inv=o.matrix_world.inverted()
    for v,q in zip(o.data.vertices,Q):v.co=inv@Vector(q)
    o.data.update()
def pose_metrics():
    result={}
    for joint,axis_id,degs in [('upperarm01.L',0,25),('lowerleg01.R',0,25)]:
        b=rig.pose.bones[joint];b.rotation_mode='XYZ';b.rotation_euler[axis_id]=math.radians(degs);bpy.context.view_layer.update()
        B=evaluated(body);bt=bvh(B,T)
        result[joint]={o.name:metrics(evaluated(o),bt) for o in garments}
        b.rotation_euler=(0,0,0);bpy.context.view_layer.update()
    return result
baseline_pose=pose_metrics()
scene=bpy.context.scene;scene.render.engine='BLENDER_WORKBENCH';scene.render.resolution_x=480;scene.render.resolution_y=640;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';sh=scene.display.shading;sh.light='STUDIO';sh.color_type='TEXTURE';sh.show_cavity=True
bpy.ops.object.camera_add();cam=bpy.context.object;cam.data.type='ORTHO';cam.data.ortho_scale=height*1.4;scene.camera=cam
center=Vector((P.min(0)+P.max(0))/2)
def render(tag,d):
    cam.location=center+Vector(d)*height*3;cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath=str(out/(tag+'.png'));bpy.ops.render.render(write_still=True)
views=[('front',(0,-1,0)),('side',(1,0,0)),('rear',(0,1,0)),('threequarter',(1,-1,0))]
for tag,d in views:render('before_'+tag,d)
rows={}
for o in garments:
    S=original[o.name];TT=tri(o);N=normals(S,TT);area=np.linalg.norm(N,axis=1);valid=area>1e-12
    old=metrics(S,tree);best=old;history=[]
    _,w=np.unique(np.round(S,6),axis=0,return_inverse=True);cnt=np.bincount(w);nv=len(cnt)
    W=np.column_stack([np.bincount(w,weights=S[:,k])/cnt for k in range(3)])
    edges=np.unique(np.sort(np.concatenate((w[TT[:,[0,1]]],w[TT[:,[1,2]]],w[TT[:,[2,0]]])),axis=1),axis=0);edges=edges[edges[:,0]!=edges[:,1]]
    e0=np.r_[edges[:,0],edges[:,1]];e1=np.r_[edges[:,1],edges[:,0]];degree=np.maximum(1,np.bincount(e0,minlength=nv))
    def blur(A):return np.column_stack([np.bincount(e0,weights=A[e1,k],minlength=nv)/degree for k in range(3)])
    def bad(Q):
        nn=normals(Q,TT)
        return ((np.einsum('ij,ij->i',N,nn)<0)|(np.linalg.norm(nn,axis=1)<area*.04))&valid
    D=np.zeros_like(W);n=o.name.lower();part='torso' if '_body' in n else 'leg' if '_legs' in n else None
    # For the torso and trousers only, derive an expansion field from actual
    # body cross-section rays, then preserve the original cloth folds.
    ray_count=0;depths=[]
    if part and old['penetrationProxy']>.01:
        A=np.zeros_like(W)
        for j,p in enumerate(W):
            m=measure(p,'L' if p[0]>hips[0] else 'R',part)
            if part=='leg':
                # Choose nearest actual anatomical leg, independent of axis convention.
                side=min(('L','R'),key=lambda side:np.linalg.norm(p-legcenter(p,side)[0]))
                m=measure(p,side,part)
            if m is None:continue
            direction,r,r0=m;ray_count+=1;depths.append(r-r0)
            clearance=.009 if 'belt' in n else .012
            A[j]=direction*np.clip(r+clearance-r0,0,.11)
        for _ in range(5):A=.55*A+.45*blur(A)
        for factor in (1,.8,.6,.4,.2,.1):
            G=S+(A*factor)[w]
            if bad(G).any():continue
            m=metrics(G,tree)
            if acceptable(m,old) and score(m)<score(best)-1e-7:
                D=A*factor;best=m;history.append({'stage':'measured radial expansion','factor':factor,**m})
    # Refine locally; attenuate only vertices incident to invalid triangles.
    for it in range(30):
        dd,nn,aa=distances(W+D,tree);active=(dd<.003)&(aa<.12)
        if not active.any():break
        A=np.zeros_like(W);A[active]=nn[active]*np.minimum(.006,.004-dd[active])[:,None]
        A=.55*A+.45*blur(A)
        for _ in range(3):A=.7*A+.3*blur(A)
        ok=False
        for fac in (1,.5,.25,.1,.05):
            alpha=np.ones(nv)
            for repair in range(25):
                C=D+A*fac*alpha[:,None];C*=np.minimum(1,.13/np.maximum(np.linalg.norm(C,axis=1),1e-12))[:,None]
                Q=S+C[w];b=bad(Q)
                if not b.any():break
                seeds=np.unique(w[TT[b]]);target=alpha.copy();target[seeds]*=.35
                avg=np.bincount(e0,weights=target[e1],minlength=nv)/degree
                alpha=np.minimum(alpha,.8*target+.2*avg)
            if b.any():continue
            m=metrics(Q,tree)
            if acceptable(m,old) and score(m)<score(best)-1e-7:
                D=C;best=m;ok=True;history.append({'stage':'local','iteration':it,'factor':fac,'repairIterations':repair,**m});break
        if not ok:break
    Q=S+D[w]
    if bad(Q).any():raise RuntimeError('new inversion/collapse '+o.name)
    apply(o,Q);bpy.context.view_layer.update()
    rows[o.name]={'part':o.name,'vertices':len(S),'before':old,'after':best,'raySamples':ray_count,'radialDeficitMedian_m':float(np.median(depths)) if depths else None,'history':history,'maxDisplacement_m':float(np.max(np.linalg.norm(D,axis=1))),'reverted':False}
    print('R53 garment refine part',o.name,old,best,flush=True)
# Per-part pose regression guard. Reject a candidate if the two measured poses
# exhibit worse penetration/deep penetration (small numerical tolerance only).
candidate_pose=pose_metrics()
for o in garments:
    name=o.name
    if any(candidate_pose[j][name][k]>baseline_pose[j][name][k]+.003 for j in baseline_pose for k in ('penetrationProxy','deepPenetrationProxy')):
        apply(o,original[name]);rows[name]['after']=rows[name]['before'];rows[name]['reverted']=True;rows[name]['maxDisplacement_m']=0
bpy.context.view_layer.update()
final_pose=pose_metrics()
for o in garments:
    if snapshot(o)!=snap[o.name]:raise RuntimeError('garment topology/UV/weights changed '+o.name)
    if not acceptable(metrics(points(o),tree),rows[o.name]['before']):raise RuntimeError('rest regression '+o.name)
if not np.array_equal(points(body),P):raise RuntimeError('body modified')
for tag,d in views:render('after_'+tag,d)
for j in final_pose:
    b=rig.pose.bones[j];b.rotation_euler[0]=math.radians(25);bpy.context.view_layer.update();render('pose_'+j.replace('.','_'),(1,-1,0));b.rotation_euler=(0,0,0);bpy.context.view_layer.update()
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True)
for o in garments:o.select_set(True)
bpy.context.view_layer.objects.active=garments[0]
dest=out/(ident+'_'+style+'_garment.glb');bpy.ops.export_scene.gltf(filepath=str(dest),export_format='GLB',use_selection=True,export_skins=True,export_animations=False)
raw=dest.read_bytes();n=int.from_bytes(raw[12:16],'little');g=json.loads(raw[20:20+n])
if not g.get('skins') or not all('JOINTS_0' in p['attributes'] and 'WEIGHTS_0' in p['attributes'] for m in g['meshes'] for p in m['primitives']):raise RuntimeError('skin export invalid')
result={'id':ident,'style':style,'bodySHA256':rec['sha256'],'priorGarmentSHA256':report['sha256'],'sha256':sha(dest),'sourceFilesSHA256':report['sourceFilesSHA256'],'parts':list(rows.values()),'poseBefore':baseline_pose,'poseAfter':final_pose,'bodyModified':False,'bodyMaskApplied':False,'collisionApproved':False,'visualApproved':False,'classification':'second-pass candidate; no exact collision or visual approval'}
(out/'garment-refine-report.json').write_text(json.dumps(result,indent=2));print('R53 GARMENT REFINE',json.dumps(result),flush=True)
