"""Sample actual exported R53 action clips on the fitted garments.
Conservative non-destructive triangle mask evidence only, never remove the
source mesh or claim collision-free clothing. For obese builds, use same-sex
normal-body motion as a stress test only, with bind compatibility checked.
"""
import bpy,numpy as np,sys,json,hashlib,math
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
args=sys.argv[sys.argv.index('--')+1:]
root,garment,actions,out=map(lambda x:Path(x).resolve(),args[:4]);out.mkdir(parents=True,exist_ok=True)
ident,style=args[4:6];sex=ident.split('_')[0]
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
records={}
for f in root.rglob('body-candidates.json'):
    for m in json.loads(f.read_text())['models']:records[m['id']]=(f.parent,m)
folder,rec=records[ident];p=folder/(ident+'.glb')
gr=json.loads((garment/'garment-third-report.json').read_text());gp=garment/(ident+'_'+style+'_garment.glb')
mr=json.loads((actions/'motion-report.json').read_text());mp=actions/(mr['id']+'_motion.glb')
if sha(p)!=rec['sha256'] or sha(gp)!=gr['sha256'] or gr['bodySHA256']!=rec['sha256'] or sha(mp)!=mr['sha256'] or mr['id']!=sex+'_30s_normal':raise RuntimeError('asset provenance mismatch')
bpy.ops.wm.read_factory_settings(use_empty=True)
def load(path):
    before=set(bpy.context.scene.objects);bpy.ops.import_scene.gltf(filepath=str(path));bpy.context.view_layer.update()
    return [o for o in bpy.context.scene.objects if o not in before]
def rigof(o):return next((m.object for m in o.modifiers if m.type=='ARMATURE' and m.object),None)
def skinned(o):return o.type=='MESH' and rigof(o) is not None
def points(o):
    e=o.evaluated_get(bpy.context.evaluated_depsgraph_get());m=e.to_mesh()
    try:return np.array([e.matrix_world@v.co for v in m.vertices],np.float64)
    finally:e.to_mesh_clear()
def triangles(o):
    o.data.calc_loop_triangles()
    return np.array([tuple(t.vertices) for t in o.data.loop_triangles],np.int32)
def bvh(P,T):
    if not len(T) or T.min()<0 or T.max()>=len(P) or not np.isfinite(P).all():raise RuntimeError('invalid BVH')
    return BVHTree.FromPolygons([Vector(tuple(float(x) for x in p)) for p in P],[tuple(int(v) for v in t) for t in T],all_triangles=True)
def verify_bind(a,b):
    if set(a.data.bones.keys())!=set(b.data.bones.keys()):raise RuntimeError('bone inventory mismatch')
    for n in a.data.bones.keys():
        x=np.asarray(a.matrix_world@a.data.bones[n].matrix_local);y=np.asarray(b.matrix_world@b.data.bones[n].matrix_local)
        if np.max(np.abs(x-y))>.002:raise RuntimeError('bind mismatch '+n)
bs=[o for o in load(p) if skinned(o)]
if len(bs)!=1:raise RuntimeError('ambiguous body')
body=bs[0];rig=rigof(body);T=triangles(body);neutral=points(body)
gs=load(gp);garments=[o for o in gs if skinned(o)]
if len(garments)!=len(gr['parts']):raise RuntimeError('garment count mismatch')
for o in garments:
    verify_bind(rigof(o),rig);M=o.matrix_world.copy();o.parent=None;o.matrix_world=M
    for mod in o.modifiers:
        if mod.type=='ARMATURE':mod.object=rig
for o in gs:
    if o not in garments and o.name in bpy.data.objects:bpy.data.objects.remove(o,do_unlink=True)
gt={o.name:triangles(o) for o in garments}
ms=load(mp);motionbody=[o for o in ms if skinned(o)]
if len(motionbody)!=1:raise RuntimeError('motion rig ambiguous')
source=rigof(motionbody[0]);verify_bind(source,rig)
ad=source.animation_data
if ad is None:raise RuntimeError('missing motion animation data')
acts={}
if ad.action:acts[ad.action.name]=ad.action
for tr in ad.nla_tracks:
    for st in tr.strips:
        if st.action:acts[st.action.name]=st.action
    tr.mute=True
def pick(name):
    q=[a for n,a in acts.items() if name.lower() in n.lower()]
    if len(q)!=1:raise RuntimeError('ambiguous exported clip '+name+' '+str(list(acts)))
    return q[0]
clips=['Idle_Loop','Walk_Loop','Sprint_Loop','Sword_Attack']
for name in clips:pick(name)
for o in ms:
    if o.type=='MESH':o.hide_render=True
# Protect head, neck, hands and feet; only sample triangles whose three
# vertices are predominantly influenced by torso or upper/lower leg bones.
names=[g.name for g in body.vertex_groups]
eligible=[]
for v in body.data.vertices:
    safe=sum(w.weight for w in v.groups if names[w.group].lower().startswith(('spine','pelvis','breast','upperleg','lowerleg')))
    protected=sum(w.weight for w in v.groups if names[w.group].lower().startswith(('head','neck','jaw','wrist','finger','foot','toe')))
    eligible.append(safe>.9 and protected<.001)
candidate=np.flatnonzero(np.all(np.asarray(eligible)[T],axis=1))
initial=len(candidate);samples=[]
scene=bpy.context.scene
scene.render.engine='BLENDER_WORKBENCH';scene.render.resolution_x=480;scene.render.resolution_y=640;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';sh=scene.display.shading;sh.light='STUDIO';sh.color_type='TEXTURE';sh.show_cavity=True
bpy.ops.object.camera_add();cam=bpy.context.object;cam.data.type='ORTHO';scene.camera=cam
H=float(np.ptp(neutral[:,2]));cam.data.ortho_scale=H*1.55;center=Vector((neutral.min(0)+neutral.max(0))/2)
def render(tag):
    cam.location=center+Vector((1,-2,0))*H*2;cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath=str(out/(tag+'.png'));bpy.ops.render.render(write_still=True)
def covered(B,ids,trees):
    # Each triangle's centroid and three inset samples must encounter the
    # same outward-facing garment surface within 6cm; uncertain rays retain
    # skin. Intersect masks across every sampled pose.
    keep=[]
    for idx in ids:
        a,b,c=B[T[idx]];n=np.cross(b-a,c-a);L=np.linalg.norm(n)
        if L<1e-10:continue
        n/=L;N=Vector(n)
        qs=[(a+b+c)/3,.8*a+.1*b+.1*c,.1*a+.8*b+.1*c,.1*a+.1*b+.8*c]
        common=None
        for q in qs:
            matches=set()
            for name,tree in trees.items():
                hit,normal,face,dist=tree.ray_cast(Vector(q)+N*.001,N,.059)
                if hit is not None and normal.dot(N)>.20 and dist>.001:matches.add(name)
            common=matches if common is None else common&matches
            if not common:break
        if common:keep.append(int(idx))
    return np.array(keep,dtype=np.int64)
def inspect(label,frame):
    global candidate
    B=points(body)
    if len(B)!=len(neutral):raise RuntimeError('body topology changed')
    bt=bvh(B,T);rows=[];trees={}
    for o in garments:
        Q=points(o);trees[o.name]=bvh(Q,gt[o.name]);d=[]
        for v in Q:
            q,n,idx,dist=bt.find_nearest(Vector(v));d.append((Vector(v)-q).dot(n))
        d=np.array(d);rows.append({'part':o.name,'vertices':len(Q),'penetrationProxy':float(np.mean(d<-.003)),'deepPenetrationProxy':float(np.mean(d<-.015)),'maxDepth_m':float(d.min())})
    candidate=covered(B,candidate,trees)
    samples.append({'clip':label,'frame':frame,'parts':rows,'remainingMaskTriangles':len(candidate)})
    print('R53 garment motion sample',label,frame,'mask',len(candidate),flush=True)
inspect('rest',0)
for name in clips:
    act=pick(name);ad.action=act
    lo,hi=map(float,act.frame_range)
    if hi<=lo:raise RuntimeError('static imported action '+name)
    for k,f in enumerate(np.linspace(lo,hi,5)):
        scene.frame_set(math.floor(f),subframe=float(f%1));bpy.context.view_layer.update()
        for b in rig.pose.bones:
            b.matrix_basis=source.pose.bones[b.name].matrix_basis.copy()
        bpy.context.view_layer.update()
        inspect(name,float(f))
        if k in (0,2):render(name+'_'+str(k))
# Store exact triangle vertex triples with source digest and imported
# topology signature. A future runtime must verify this topology before
# using the mask; Blender triangle indices are not GLB primitive indices.
mask={'bodySHA256':rec['sha256'],'importedTriangleOrderSHA256':hashlib.sha256(T.astype('<i4').tobytes()).hexdigest(),'importedTriangleCount':len(T),'eligibleTriangles':initial,'candidateTriangleIndices':candidate.tolist(),'candidateTriangleVertexIndices':T[candidate].tolist(),'sampleCount':len(samples),'runtimeApplied':False,'visualApproved':False,'classification':'conservative sampled coverage candidate; not guaranteed continuous occlusion'}
(out/'skin-mask-candidate.json').write_text(json.dumps(mask))
result={'id':ident,'style':style,'bodySHA256':rec['sha256'],'garmentSHA256':gr['sha256'],'motionSHA256':mr['sha256'],'motionProfile':mr['id'],'sameSexNormalMotionStressTest':ident.endswith('obese'),'samples':samples,'maskSHA256':sha(out/'skin-mask-candidate.json'),'maskTriangles':len(candidate),'bodyModified':False,'maskApplied':False,'continuousCollisionApproved':False,'visualApproved':False}
(out/'motion-garment-report.json').write_text(json.dumps(result,indent=2));print('R53 garment motion audit',ident,style,len(samples),'mask',len(candidate),flush=True)
