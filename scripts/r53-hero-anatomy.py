"""R53 anatomical opening audit and measured eye/lash study. Fail closed on absent openings."""
import bpy,numpy as np,math,sys,json,hashlib
from pathlib import Path
from mathutils import Vector,Matrix
from mathutils.bvhtree import BVHTree
args=sys.argv[sys.argv.index('--')+1:]
src,out=map(lambda x:Path(x).resolve(),args[:2]);ident=args[2];out.mkdir(parents=True,exist_ok=True)
if ident not in ('commander-male','commander-female'):raise RuntimeError('identity')
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
rp=src/'hero-pbr-report.json';p=src/(ident+'_hero_pbr.glb')
rec=json.loads(rp.read_text())
if rec['id']!=ident or sha(p)!=rec['sha256']:raise RuntimeError('source provenance')
for n in ('ATTRIBUTION.md','ARMOR-LICENSE.txt'):
    if (src/n).is_file():(out/n).write_bytes((src/n).read_bytes())
if not (out/'ATTRIBUTION.md').is_file():raise RuntimeError('missing hair credit')
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
hair=[o for o in parts if o.name.startswith('R53_Hair_')]
if not hair or not cloth or len(beards)!=(1 if ident=='garan' else 0):raise RuntimeError('source part inventory')
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


# Work from actual source mesh, with welded UV seams. Inspect real boundary
# loops before creating eye or mouth detail; do not paint an opening.
mesh=body.data;T=tri(body)
_,w=np.unique(np.round(P,6),axis=0,return_inverse=True);cnt=np.bincount(w)
U=np.column_stack([np.bincount(w,weights=P[:,k])/cnt for k in range(3)])
E=np.sort(np.concatenate((w[T[:,[0,1]]],w[T[:,[1,2]]],w[T[:,[2,0]]])),axis=1);E=E[E[:,0]!=E[:,1]]
edges,counts=np.unique(E,axis=0,return_counts=True);boundary=edges[counts==1];adj={}
for a,b in boundary:
    adj.setdefault(int(a),set()).add(int(b));adj.setdefault(int(b),set()).add(int(a))
loops=[];seen=set()
for k in adj:
    if k in seen:continue
    stack=[k];g=[]
    while stack:
        i=stack.pop()
        if i in seen:continue
        seen.add(i);g.append(i);stack.extend(adj[i]-seen)
    G=np.array(g,dtype=int);Q=U[G];lo=Q.min(0);hi=Q.max(0)
    loops.append({'indices':G,'center':Q.mean(0),'lo':lo,'hi':hi,'closed':all(len(adj[int(v)])==2 for v in G)})
def brief(l):
    return {'vertices':len(l['indices']),'center_m':l['center'].tolist(),'bounds_m':[l['lo'].tolist(),l['hi'].tolist()],'closed':l['closed']}
print('R53 HERO openings',json.dumps([brief(l) for l in loops]),flush=True)
eyeRims={}
for side in ('L','R'):
    e=bone('eye.'+side);c=[]
    for l in loops:
        ext=l['hi']-l['lo']
        if l['closed'] and len(l['indices'])>=8 and .009<ext[0]<.045 and .003<ext[2]<.027 and np.linalg.norm((l['center']-e)[[0,2]])<.014 and l['center'][1]<e[1]+.008:
            c.append(l)
    if len(c)==1:eyeRims[side]=c[0]
if len(eyeRims)==2 and eyeRims['L'] is eyeRims['R']:eyeRims={}
mouth=bone('oris01');mouthRims=[]
for l in loops:
    ext=l['hi']-l['lo']
    if l['closed'] and len(l['indices'])>=8 and .019<ext[0]<.085 and ext[2]<.035 and np.linalg.norm((l['center']-mouth)[[0,2]])<.025:mouthRims.append(l)
# Preserve the actual original skin, morphs and UV. Realistic Blender Studio
# head and MakeHuman eyes are independently audited as anatomy sources.
assets=Path(args[3]).resolve()
def gitsha(p):
    b=p.read_bytes();return hashlib.sha1(('blob '+str(len(b))+'\0').encode()+b).hexdigest()
ep=assets/'makehuman/high-poly-eyes.obj';tex=assets/'makehuman/brown_eye.png';master=assets/'blender/realistic-head-animation.glb'
if gitsha(ep)!='01562a9caf4dca9ebb1fd5c24db083c17e724330' or gitsha(tex)!='bda1b4b0d94f4b7b34ca4f58063eab04f05cd2e7' or sha(master)!='cd74b2575785e470e2001ce90103f5f3b3a76d56382296acebabcae3d6c53f59':raise RuntimeError('licensed anatomy source hash')
raw=master.read_bytes();masterg=json.loads(raw[20:20+int.from_bytes(raw[12:16],'little')])
masterNames=[n.get('name','') for n in masterg.get('nodes',[]) if 'mesh' in n]
(out/'ANATOMY-SOURCES.json').write_text(json.dumps({'eye':json.loads((assets/'makehuman/SOURCE.json').read_text()),'head':{'sha256':sha(master),'license':'CC0-1.0','objects':masterNames,'source':'Blender Studio Human Base Meshes v1.4.1','usedAsReplacement':False}},indent=2))
# Read original OBJ directly, preserving original face and UV indexes.
V=[];UV=[];F=[];FU=[]
for line in ep.read_text().splitlines():
    q=line.split()
    if not q:continue
    if q[0]=='v':V.append(tuple(map(float,q[1:4])))
    if q[0]=='vt':UV.append(tuple(map(float,q[1:3])))
    if q[0]=='f':
        ids=[x.split('/') for x in q[1:]];F.append(tuple(int(x[0])-1 for x in ids));FU.append(tuple(int(x[1])-1 for x in ids))
V=np.asarray(V);UV=np.asarray(UV)
if len(V)!=1064 or len(F)!=1020:raise RuntimeError('original eye topology')
# OBJ coordinates are decimetres, Y up and +Z forward. Separate actual
# source components using connected faces, not a generated sphere.
par=list(range(len(V)))
def rr(i):
    while par[i]!=i:par[i]=par[par[i]];i=par[i]
    return i
for f in F:
    a=rr(f[0])
    for k in f[1:]:
        b=rr(k)
        if a!=b:par[b]=a
gs={}
for k in range(len(V)):gs.setdefault(rr(k),[]).append(k)
sourceEyes=sorted([np.array(g) for g in gs.values() if len(g)>100],key=lambda g:V[g,0].mean())
if len(sourceEyes)!=2:raise RuntimeError('original eye components '+str([len(g) for g in gs.values()]))
scene=bpy.context.scene;scene.render.engine='BLENDER_WORKBENCH';scene.render.resolution_x=560;scene.render.resolution_y=700;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG'
sh=scene.display.shading;sh.light='STUDIO';sh.color_type='TEXTURE';sh.show_cavity=True
bpy.ops.object.camera_add();cam=bpy.context.object;cam.data.type='ORTHO';scene.camera=cam
def render(tag,d,c=fc,size=hh*3.6):
    cam.data.ortho_scale=size;cam.location=c+Vector(d).normalized()*H*3;cam.rotation_euler=(c-cam.location).to_track_quat('-Z','Y' if abs(d[2])<.95 else 'X').to_euler()
    scene.render.filepath=str(out/(tag+'.png'));bpy.ops.render.render(write_still=True)
for tag,d in [('front',(0,-1,0)),('left',(-1,0,0)),('right',(1,0,0)),('rear',(0,1,0)),('crown',(0,-.05,1))]:render('before_'+tag,d)
# Small geometric facial polish: smooth only local curvature irregularities
# in cheek/nasal side regions; keep eyes, mouth, hairline, neck untouched.
normal=np.array([(body.matrix_world.to_3x3().inverted().transposed()@v.normal).normalized() for v in mesh.vertices])
A=np.abs(P[:,0]-eye[0])/hh;Z=(P[:,2]-eye[2])/hh;Y=(P[:,1]-eye[1])/hh
region=(A>.16)&(A<.70)&(Z>-.60)&(Z<-.16)&(Y<-.015)&(normal[:,1]<-.2)
# Do not touch any anatomical open edge or its immediate neighbours.
blocked=set(int(k) for k in boundary.ravel());near=blocked.copy()
for a,b in edges:
    if int(a) in blocked or int(b) in blocked:near.update((int(a),int(b)))
region&=~np.isin(w,list(near))
deg=np.bincount(edges.ravel(),minlength=len(U));S=np.zeros_like(U)
np.add.at(S,edges[:,0],U[edges[:,1]]);np.add.at(S,edges[:,1],U[edges[:,0]])
lap=(S/np.maximum(deg,1)[:,None]-U)[w]
D=normal*np.sum(lap*normal,axis=1)[:,None]*.12
D*=np.minimum(1,.00065/np.maximum(np.linalg.norm(D,axis=1),1e-12))[:,None]
D[~region]=0;D=np.column_stack([np.bincount(w,weights=D[:,k])/cnt for k in range(3)])[w];D[np.isin(w,np.unique(w[~region]))]=0
def norm(Q):
    a=Q[T];return np.cross(a[:,1]-a[:,0],a[:,2]-a[:,0])
bases=[P]+[morphs[(body.name,n)] for n in names]
for a,b in [('smile','blink_L'),('viseme_A','browRaise'),('laugh','blink_R')]:bases.append(morphs[(body.name,a)]+morphs[(body.name,b)]-P)
polish=[]
for fac in (1.,.5,.25,0.):
    q=D*fac;bad=0
    for B in bases:
        N=norm(B);NN=norm(B+q);ar=np.linalg.norm(N,axis=1);bad+=int(np.sum(((np.sum(N*NN,axis=1)<0)|(np.linalg.norm(NN,axis=1)<ar*.05))&(ar>1e-11)))
    polish.append({'factor':fac,'newFlipsOrCollapse':bad})
    if not bad:break
inv=body.matrix_world.inverted()
for key in mesh.shape_keys.key_blocks:
    B=P if key.name=='Basis' else morphs[(body.name,key.name)]
    for v,p0 in zip(key.data,B+q):v.co=inv@Vector(p0)
for v,p0 in zip(mesh.vertices,P+q):v.co=inv@Vector(p0)
mesh.update();bpy.context.view_layer.update()
for n in names:
    Q=np.array([body.matrix_world@v.co for v in mesh.shape_keys.key_blocks[n].data])
    if np.max(np.abs((Q-(P+q))-(morphs[(body.name,n)]-P)))>2e-6:raise RuntimeError('morph delta changed')
# Candidate eyes only where an actual measured opening exists. The atlas
# is original CC0; eye globe rotates with its existing eye bone. Retain
# actual shell geometry and original UVs. Fit depth by sampled surface
# coverage; no overlapping exterior skin is cut or hidden.
new=[];eyeReports=[];lashReports=[]
eyemat=bpy.data.materials.new('R53_original_eye_atlas');eyemat.use_nodes=True;bs=eyemat.node_tree.nodes.get('Principled BSDF');bs.inputs['Roughness'].default_value=.18
im=bpy.data.images.load(str(tex));im.pack();node=eyemat.node_tree.nodes.new('ShaderNodeTexImage');node.image=im;eyemat.node_tree.links.new(node.outputs['Color'],bs.inputs['Base Color'])
lashmat=bpy.data.materials.new('R53_fine_lashes');lashmat.diffuse_color=(.055,.032,.024,1);lashmat.use_nodes=True;bs=lashmat.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=lashmat.diffuse_color;bs.inputs['Roughness'].default_value=.65
def bind(o,bn):
    g=o.vertex_groups.new(name=bn);g.add(list(range(len(o.data.vertices))),1.,'REPLACE');m=o.modifiers.new('shared rig','ARMATURE');m.object=rig
for side,l in eyeRims.items():
    e=bone('eye.'+side);Q=U[l['indices']];c=Q.mean(0);ext=l['hi']-l['lo'];idx=0 if e[0]<eye[0] else 1;g=sourceEyes[idx];A0=V[g];C=(A0.min(0)+A0.max(0))/2
    A1=(A0-C)[:,[0,2,1]];A1[:,1]*=-1
    diameter=float(np.ptp(A1[:,0]));scale=max(.022,float(ext[0])*1.15)/diameter
    if not .04<scale<.20:continue
    A1*=scale;A1[:,0]+=c[0];A1[:,2]+=c[2]
    # The eye front should meet, not protrude beyond, the actual lid rim.
    A1[:,1]+=float(np.quantile(Q[:,1],.18))-.0005-A1[:,1].min()
    remap={int(x):k for k,x in enumerate(g)};faces=[];uvf=[]
    for fi,ff in enumerate(F):
        if all(k in remap for k in ff):faces.append(tuple(remap[k] for k in ff));uvf.append(FU[fi])
    me=bpy.data.meshes.new('R53_AnatomicalEye_'+side);me.from_pydata(A1.tolist(),[],faces);me.update()
    o=bpy.data.objects.new(me.name,me);bpy.context.collection.objects.link(o);me.materials.append(eyemat);uv=me.uv_layers.new()
    for p0,uf in zip(me.polygons,uvf):
        p0.use_smooth=True
        for k,u in zip(p0.loop_indices,uf):uv.data[k].uv=UV[u]
    # Source rim points should be near the globe. Reject misplaced mesh.
    bt=tree([o]);dist=np.array([bt.find_nearest(Vector(v))[3] for v in Q])
    if np.quantile(dist,.90)>.006:
        bpy.data.objects.remove(o,do_unlink=True);eyeReports.append({'side':side,'applied':False,'reason':'rim clearance','rimP90_m':float(np.quantile(dist,.9))});continue
    bind(o,'eye.'+side);new.append(o);eyeReports.append({'side':side,'applied':True,'vertices':len(g),'rimP90_m':float(np.quantile(dist,.9)),'sourceScale':scale})
    # True tapered mesh lashes rooted on the verified upper rim, with
    # barycentric-like seam vertex transfer of all thirteen morph deltas.
    # Existing lower eyelid and brow untouched.
    vs=[];fs=[];rs=[]
    upper=l['indices'][Q[:,2]>=np.median(Q[:,2])]
    upper=sorted(upper,key=lambda k:U[k,0])
    for k in upper[1:-1]:
        ii=int(np.flatnonzero(w==k)[0]);p0=Vector(P[ii]+q[ii]);length=.0032 if ident=='commander-male' else .0052
        direction=Vector((.12*np.sign(p0.x-eye[0]),-.65,.75)).normalized();u=direction.cross(Vector((1,0,0))).normalized();v=direction.cross(u).normalized()
        at=len(vs)
        for t,rad in ((0,.00020),(.4,.00015),(.75,.00009),(1,.000018)):
            c0=p0+direction*length*t+Vector((0,-.00015-.0004*t*t,.0008*t*t))
            for a in range(5):
                th=2*math.pi*a/5;vs.append(tuple(c0+rad*(u*math.cos(th)+v*math.sin(th))));rs.append(ii)
        for j in range(3):
            for a in range(5):b=(a+1)%5;fs.append((at+j*5+a,at+j*5+b,at+(j+1)*5+b,at+(j+1)*5+a))
    if not vs:continue
    me=bpy.data.meshes.new('R53_Lashes_'+side);me.from_pydata(vs,[],fs);me.update();o=bpy.data.objects.new(me.name,me);bpy.context.collection.objects.link(o);me.materials.append(lashmat)
    groups={n:o.vertex_groups.new(name=n) for n in sorted({n for i in rs for n in weights[i]})}
    for k,i in enumerate(rs):
        total=sum(weights[i].values())
        if total<=0:raise RuntimeError('lash root unweighted')
        for n,value in weights[i].items():groups[n].add([k],value/total,'REPLACE')
    mod=o.modifiers.new('rim skin weights','ARMATURE');mod.object=rig
    o.shape_key_add(name='Basis')
    for n in names:
        key=o.shape_key_add(name=n)
        for k,i in enumerate(rs):key.data[k].co=Vector(vs[k])+Vector(morphs[(body.name,n)][i]-P[i])
    new.append(o);lashReports.append({'side':side,'roots':len(vs)//20,'morphs':names})
# Mouth anatomy is not fabricated behind a closed mesh. Record actual
# opening evidence and whether an independently rigged mouth can be added.
mouthReport={'openingCandidates':[brief(l) for l in mouthRims],'teethApplied':False,'tongueApplied':False,'reason':'requires verified lip/cavity topology and independently measured oral source'}
for o in parts:
    if o!=body and not np.array_equal(pts(o),original[o.name]):raise RuntimeError('protected clothing/hair geometry changed')
allparts=parts+new;bpy.context.view_layer.update()
for tag,d in [('front',(0,-1,0)),('left',(-1,0,0)),('right',(1,0,0)),('rear',(0,1,0)),('crown',(0,-.05,1))]:render('after_'+tag,d)
for n in ('blink_L','blink_R','jawOpen','viseme_A','smile'):
    body.data.shape_keys.key_blocks[n].value=1
    for o in new:
        if o.data.shape_keys:o.data.shape_keys.key_blocks[n].value=1
    bpy.context.view_layer.update();render('expression_'+n,(0,-1,0))
    for o in new:
        if o.data.shape_keys:o.data.shape_keys.key_blocks[n].value=0
    reset()
checks=[]
for n,act in selected.items():
    reset();ad.action=act;lo,hi=map(float,act.frame_range)
    for frame in np.linspace(lo,hi,3):
        scene.frame_set(math.floor(frame),subframe=float(frame%1));bpy.context.view_layer.update();b=tree([body],True)
        checks.append({'clip':n,'frame':float(frame),'newParts':[{'part':o.name,**metrics(pts(o,True),b)} for o in new],'hair':[{'part':o.name,**metrics(pts(o,True),b)} for o in hair]})
reset()
for n,act in selected.items():
    tr=ad.nla_tracks.new();tr.name='R53_'+n;tr.strips.new('R53_'+n,1,act)
bpy.ops.object.select_all(action='DESELECT')
for o in allparts+[rig]:o.select_set(True)
bpy.context.view_layer.objects.active=body
dest=out/(ident+'_anatomy_candidate.glb')
opts=dict(filepath=str(dest),export_format='GLB',use_selection=True,export_skins=True,export_animations=True,export_morph=True)
props=bpy.ops.export_scene.gltf.get_rna_type().properties
if 'export_animation_mode' in props and 'NLA_TRACKS' in props['export_animation_mode'].enum_items.keys():opts['export_animation_mode']='NLA_TRACKS'
elif 'export_nla_strips' in props:opts['export_nla_strips']=True
else:raise RuntimeError('NLA export unsupported')
bpy.ops.export_scene.gltf(**opts)
raw=dest.read_bytes();g=json.loads(raw[20:20+int.from_bytes(raw[12:16],'little')])
if len(g.get('skins',[]))!=1 or not all(any(n.lower() in a.get('name','').lower() for a in g.get('animations',[])) for n in clips):raise RuntimeError('export rig/actions')
count=len(allparts);bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(dest));bpy.context.view_layer.update()
rt=[o for o in bpy.context.scene.objects if o.type=='MESH' and rigof(o)]
if len(rt)!=count or len({rigof(o) for o in rt})!=1 or len([o for o in rt if o.data.shape_keys and all(n in o.data.shape_keys.key_blocks for n in names)])!=1+len(lashReports):raise RuntimeError('roundtrip inventory')
report={'id':ident,'sourceSHA256':rec['sha256'],'sha256':sha(dest),'boundaryLoops':[brief(l) for l in loops],'eyeRims':{k:brief(v) for k,v in eyeRims.items()},'eyes':eyeReports,'lashes':lashReports,'mouth':mouthReport,'facePolish':{'verticesMoved':int(np.sum(np.linalg.norm(q,axis=1)>1e-5)),'peak_m':float(np.linalg.norm(q,axis=1).max()),'checks':polish,'morphDeltaPreserved':True},'meshCount':count,'rigCount':1,'morphs':names,'clips':clips,'poseSamples':checks,'roundTrip':True,'visualApproved':False,'productionApproved':False,'protectedR6Used':False,'limitations':['eye/lash insertion conditional on actual open rim; no synthetic cut or floating eyes','teeth and tongue not inserted','limited cheek curvature polish, not full facial reconstruction','no final visual approval']}
(out/'anatomy-report.json').write_text(json.dumps(report,indent=2));print('R53 HERO ANATOMY',ident,'loops',len(loops),'eye rims',len(eyeRims),'eyes',sum(x['applied'] for x in eyeReports),'lash sets',len(lashReports),'mouth rims',len(mouthRims),'face vertices',report['facePolish']['verticesMoved'],flush=True)
