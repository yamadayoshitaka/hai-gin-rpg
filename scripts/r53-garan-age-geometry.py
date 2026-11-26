"""R53 fifth cast candidate: articulated hand/foot plate overlays and localized skin age material.
Pose comparisons and geometry checks are evidence, not final visual/collision approval.
"""
import bpy,numpy as np,math,sys,json,hashlib
from pathlib import Path
from mathutils import Vector,Matrix
from mathutils.bvhtree import BVHTree
args=sys.argv[sys.argv.index('--')+1:]
src,out=map(lambda x:Path(x).resolve(),args[:2]);ident='garan';out.mkdir(parents=True,exist_ok=True)
if ident not in ('commander-male','garan'):raise RuntimeError('identity')
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
rec=json.loads((src/'fifth-report.json').read_text());p=src/(ident+'_fifth_candidate.glb')
if rec['id']!=ident or sha(p)!=rec['sha256']:raise RuntimeError('source provenance')
for n in ('ATTRIBUTION.md','ARMOR-LICENSE.txt'):(out/n).write_bytes((src/n).read_bytes())
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(p));bpy.context.view_layer.update()
def rigof(o):return next((m.object for m in o.modifiers if m.type=='ARMATURE' and m.object),None)
def pts(o,pose=False):
    if not pose:return np.array([o.matrix_world@v.co for v in o.data.vertices],np.float64)
    e=o.evaluated_get(bpy.context.evaluated_depsgraph_get());m=e.to_mesh()
    try:return np.array([e.matrix_world@v.co for v in m.vertices],np.float64)
    finally:e.to_mesh_clear()
def tri(o):
    o.data.calc_loop_triangles();return np.array([tuple(t.vertices) for t in o.data.loop_triangles],np.int32)
def tree(objs,pose=False):
    vs=[];ts=[];n=0
    for o in objs:
        P=pts(o,pose);T=tri(o);vs.append(P);ts.append(T+n);n+=len(P)
    return BVHTree.FromPolygons([Vector(tuple(float(v) for v in q)) for q in np.concatenate(vs)],[tuple(int(v) for v in t) for t in np.concatenate(ts)],all_triangles=True)
def signed(Q,t):
    ds=[]
    for p in Q:
        q,n,i,d=t.find_nearest(Vector(p))
        if q is None:raise RuntimeError('missing surface')
        ds.append((Vector(p)-q).dot(n))
    return np.array(ds)
def metrics(Q,t):
    a=signed(Q,t);return {'penetrationProxy':float(np.mean(a<-.003)),'deepPenetrationProxy':float(np.mean(a<-.015)),'minSigned_m':float(a.min())}
def score(m):return m['penetrationProxy']+2*m['deepPenetrationProxy']
parts=[o for o in bpy.context.scene.objects if o.type=='MESH' and rigof(o)]
names=rec['morphs'];clips=rec['clips'];bs=[o for o in parts if not o.name.startswith('R53_Beard') and o.data.shape_keys and all(n in o.data.shape_keys.key_blocks for n in names)]
if len(bs)!=1 or len({rigof(o) for o in parts})!=1:raise RuntimeError('source mesh inventory')
body=bs[0];rig=rigof(body);beards=[o for o in parts if o.name.startswith('R53_Beard')]
cloth=[o for o in parts if o.name.startswith('R53_Clothing_')]
plates=[o for o in parts if o.name.startswith(('R53_Armor_','R53_LegPlate_'))]
if len(plates)!=15 or not cloth or len(beards)!=(1 if ident=='garan' else 0):raise RuntimeError('source part inventory')
ad=rig.animation_data;acts={}
if ad.action:acts[ad.action.name]=ad.action
for t in ad.nla_tracks:
    for st in t.strips:
        if st.action:acts[st.action.name]=st.action
    t.mute=True
selected={}
for n in clips:
    a=[v for k,v in acts.items() if n.lower() in k.lower()]
    if len(a)!=1:raise RuntimeError('clip '+n)
    selected[n]=a[0];a[0].use_fake_user=True
ad.action=None
for t in list(ad.nla_tracks):ad.nla_tracks.remove(t)
def reset():
    ad.action=None
    for b in rig.pose.bones:b.matrix_basis=Matrix.Identity(4)
    for o in [body]+beards:
        for n in names:o.data.shape_keys.key_blocks[n].value=0
    bpy.context.view_layer.update()
reset()
original={o.name:pts(o) for o in parts}
morphs={(o.name,n):np.array([o.matrix_world@v.co for v in o.data.shape_keys.key_blocks[n].data]) for o in [body]+beards for n in names}
P=original[body.name];H=float(np.ptp(P[:,2]));center=Vector((P.min(0)+P.max(0))/2)
def bone(n):return np.array(rig.matrix_world@rig.data.bones[n].head_local)
def tail(n):return np.array(rig.matrix_world@rig.data.bones[n].tail_local)
gn=[g.name for g in body.vertex_groups]
weights=[{gn[g.group]:float(g.weight) for g in v.groups if gn[g.group] in rig.data.bones and g.weight>1e-6} for v in body.data.vertices]
eye=(bone('eye.L')+bone('eye.R'))/2;top=float(P[:,2].max());hh=top-eye[2];fc=Vector((eye[0],eye[1],top-hh*.95))
scene=bpy.context.scene;scene.render.engine='BLENDER_WORKBENCH';scene.render.resolution_x=540;scene.render.resolution_y=720;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';sh=scene.display.shading;sh.light='STUDIO';sh.color_type='TEXTURE';sh.show_cavity=True
bpy.ops.object.camera_add();cam=bpy.context.object;cam.data.type='ORTHO';scene.camera=cam
def render(tag,d,c=center,size=H*1.35):
    cam.data.ortho_scale=size;cam.location=c+Vector(d).normalized()*H*3;cam.rotation_euler=(c-cam.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath=str(out/(tag+'.png'));bpy.ops.render.render(write_still=True)
render('before_front',(0,-1,0));render('before_face',(0,-1,0),fc,hh*3.9)
# Geometric micro-creases on actual skin surface, not a replacement face.
# Keep all morph displacements and rig/UVs; do not touch lower face/beard.
mesh=body.data;T=tri(body);X=(P[:,0]-eye[0])/hh;Z=(P[:,2]-eye[2])/hh;Y=(P[:,1]-eye[1])/hh
A=np.abs(X);mz=(bone('oris01')[2]-eye[2])/hh
head=(Z>max(mz+.16,-.65))&(Z<.77)&(Y<.02)&(A<.80)
eyeWeight=np.array([sum(w for n,w in a.items() if n.lower().startswith('eye.')) for a in weights])
head&=(eyeWeight<.25)
def smooth(a,b,x):
    t=np.clip((x-a)/(b-a),0,1);return t*t*(3-2*t)
guard=head*smooth(.03,.22,-Y)*smooth(.78,.60,A)
# Broader shallow arcs and lateral eye creases; actual mesh resolution limits detail.
D=np.zeros(len(P))
for k in (.30,.45,.60):
    line=k-.085*(X/.65)**2
    D+=.00085*np.exp(-((Z-line)/.036)**2)*np.exp(-(X/.57)**6)
for k in (-.08,.025,.13):
    line=k-.26*(A-.47)
    D+=.00065*np.exp(-((Z-line)/.038)**2)*np.exp(-((A-.57)/.12)**2)
D+=.00055*np.exp(-((A-(.20-.30*(Z+.32)))/.037)**2)*np.exp(-((Z+.28)/.18)**4)
D*=guard
D[(A<.47)&(np.abs(Z)<.14)]=0
D[(A<.31)&(np.abs(Z-mz)<.20)]=0
# Normal-directed displacement; front vertices only, weld UV seams.
norms=np.array([(body.matrix_world.to_3x3().inverted().transposed()@v.normal).normalized() for v in mesh.vertices])
delta=-norms*D[:,None]
delta[norms[:,1]>-.12]=0
_,w=np.unique(np.round(P,6),axis=0,return_inverse=True);counts=np.bincount(w)
delta=np.column_stack([np.bincount(w,weights=delta[:,k])/counts for k in range(3)])[w]
# A seam on protected region must not move.
protected=~head|((A<.47)&(np.abs(Z)<.14))|((A<.31)&(np.abs(Z-mz)<.20))
blocked=np.unique(w[protected]);delta[np.isin(w,blocked)]=0
def normals(Q):
    a=Q[T];return np.cross(a[:,1]-a[:,0],a[:,2]-a[:,0])
# Test the entire original morph inventory and representative combined expressions.
bases=[P]+[morphs[(body.name,n)] for n in names]
for a,b in [('smile','blink_L'),('viseme_A','browRaise'),('laugh','blink_R')]:
    bases.append(morphs[(body.name,a)]+morphs[(body.name,b)]-P)
checks=[]
for fac in (1.,.75,.5,.25):
    q=delta*fac;bad=0
    for B in bases:
        N=normals(B);NN=normals(B+q);area=np.linalg.norm(N,axis=1);valid=area>1e-11
        bad+=int(np.count_nonzero(((np.sum(N*NN,axis=1)<0)|(np.linalg.norm(NN,axis=1)<area*.05))&valid))
    checks.append({'factor':fac,'newFlipsOrCollapse':bad})
    if bad==0:break
peak=float(np.max(np.linalg.norm(q,axis=1)));moved=int(np.count_nonzero(np.linalg.norm(q,axis=1)>1e-5))
if bad or peak<.0001 or moved<10:raise RuntimeError('ineffective or unsafe age geometry '+str([peak,moved,bad]))
inv=body.matrix_world.inverted()
for key in mesh.shape_keys.key_blocks:
    B=P if key.name=='Basis' else morphs[(body.name,key.name)]
    for v,pt in zip(key.data,B+q):v.co=inv@Vector(pt)
# Explicit base mesh update as well as Basis.
for v,pt in zip(mesh.vertices,P+q):v.co=inv@Vector(pt)
mesh.update();bpy.context.view_layer.update()
for n in names:
    V=np.array([body.matrix_world@v.co for v in mesh.shape_keys.key_blocks[n].data])
    if np.max(np.abs((V-(P+q))-(morphs[(body.name,n)]-P)))>2e-6:raise RuntimeError('expression delta changed')
for o in parts:
    if o!=body and not np.array_equal(pts(o),original[o.name]):raise RuntimeError('unrelated part changed')
if np.max(np.abs(pts(body)[protected]-P[protected]))>2e-6:raise RuntimeError('protected face/body moved')
render('after_face',(0,-1,0),fc,hh*3.9);render('after_side',(1,0,0),fc,hh*3.9)
render('after_threequarter',(1,-2,0),fc,hh*3.9)
render('after_full',(0,-1,0))
for n in ('smile','blink_L','browRaise'):
    body.data.shape_keys.key_blocks[n].value=1
    for o in beards:o.data.shape_keys.key_blocks[n].value=1
    bpy.context.view_layer.update();render('expr_'+n,(0,-1,0),fc,hh*3.9);reset()
for n,act in selected.items():
    t=ad.nla_tracks.new();t.name='R53_'+n;t.strips.new('R53_'+n,1,act)
bpy.ops.object.select_all(action='DESELECT')
for o in parts+[rig]:o.select_set(True)
bpy.context.view_layer.objects.active=body
dest=out/'garan_age_candidate.glb'
opts=dict(filepath=str(dest),export_format='GLB',use_selection=True,export_skins=True,export_animations=True,export_morph=True)
props=bpy.ops.export_scene.gltf.get_rna_type().properties
if 'export_animation_mode' in props and 'NLA_TRACKS' in props['export_animation_mode'].enum_items.keys():opts['export_animation_mode']='NLA_TRACKS'
elif 'export_nla_strips' in props:opts['export_nla_strips']=True
else:raise RuntimeError('NLA export unsupported')
bpy.ops.export_scene.gltf(**opts)
raw=dest.read_bytes();g=json.loads(raw[20:20+int.from_bytes(raw[12:16],'little')])
if len(g.get('skins',[]))!=1 or not all(any(n.lower() in a.get('name','').lower() for a in g.get('animations',[])) for n in clips):raise RuntimeError('rig/animation export')
count=len(parts);bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(dest));bpy.context.view_layer.update()
rt=[o for o in bpy.context.scene.objects if o.type=='MESH' and rigof(o)]
if len(rt)!=count or len({rigof(o) for o in rt})!=1 or len([o for o in rt if o.data.shape_keys and all(n in o.data.shape_keys.key_blocks for n in names)])!=2:raise RuntimeError('roundtrip inventory')
result={'id':'garan','sourceSHA256':rec['sha256'],'sha256':sha(dest),'ageGeometryApplied':True,'peak_m':peak,'verticesMoved':moved,'morphDeltaPreserved':True,'protectedGeometryPreserved':True,'checks':checks,'testedMorphCombinations':len(bases),'morphs':names,'clips':clips,'roundTrip':True,'visualApproved':False,'productionApproved':False,'limitations':['submillimetre crease geometry on existing mesh, not skin microtexture','no visual approval or full age likeness']}
(out/'age-geometry-report.json').write_text(json.dumps(result,indent=2));print('R53 GARAN AGE GEOMETRY',peak,moved,flush=True)
