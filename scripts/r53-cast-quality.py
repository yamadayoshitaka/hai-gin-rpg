"""R53 role palette and bounded local hair/garment fit candidate."""
import bpy,numpy as np,math,sys,json,hashlib
from pathlib import Path
from mathutils import Vector,Matrix
from mathutils.bvhtree import BVHTree
args=sys.argv[sys.argv.index('--')+1:]
src,plan,out=map(lambda x:Path(x).resolve(),args[:3]);ident=args[3];out.mkdir(parents=True,exist_ok=True)
profile=next(x for x in json.loads(plan.read_text())['models'] if x['id']==ident)
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
kind=profile['sourceKind']
if kind=='age':rp=src/'age-geometry-report.json';p=src/'garan_age_candidate.glb'
elif kind=='fifth':rp=src/'fifth-report.json';p=src/(ident+'_fifth_candidate.glb')
else:src=src/'assembly';rp=src/'assembly-report.json';p=src/(ident+'_assembled.glb')
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
scene=bpy.context.scene;scene.render.engine='BLENDER_WORKBENCH';scene.render.resolution_x=540;scene.render.resolution_y=720;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';sh=scene.display.shading;sh.light='STUDIO';sh.color_type='TEXTURE';sh.show_cavity=True
bpy.ops.object.camera_add();cam=bpy.context.object;cam.data.type='ORTHO';scene.camera=cam
def render(tag,d,c=center,size=H*1.35):
    cam.data.ortho_scale=size;cam.location=c+Vector(d).normalized()*H*3;cam.rotation_euler=(c-cam.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath=str(out/(tag+'.png'));bpy.ops.render.render(write_still=True)
render('before_front',(0,-1,0));render('before_face',(0,-1,0),fc,hh*3.9)

# Local corrections derived from actual body. Preserve seams and all
# weights, topology, protected facial and beard expression meshes.
affected=hair+cloth;skin=tree([body])
def normal(Q,T):
    a=Q[T];return np.cross(a[:,1]-a[:,0],a[:,2]-a[:,0])
def put(o,Q):
    inv=o.matrix_world.inverted()
    for v,q in zip(o.data.vertices,Q):v.co=inv@Vector(q)
    o.data.update()
deltas={}
for o in affected:
    Q=original[o.name];TT=tri(o);lim=.006 if o in hair else .010
    D=np.zeros_like(Q)
    for i,p0 in enumerate(Q):
        q,n,_,d=skin.find_nearest(Vector(p0));s=(Vector(p0)-q).dot(n)
        if s<-.002 and d<.045:D[i]=np.array(n)*min(lim,.003-s)
    _,w=np.unique(np.round(Q,6),axis=0,return_inverse=True);cnt=np.bincount(w)
    E=np.unique(np.sort(np.concatenate((w[TT[:,[0,1]]],w[TT[:,[1,2]]],w[TT[:,[2,0]]])),axis=1),axis=0)
    E=E[E[:,0]!=E[:,1]];U=np.column_stack([np.bincount(w,weights=D[:,k])/cnt for k in range(3)])
    if len(E):
        deg=np.bincount(E.ravel(),minlength=len(U));S=np.zeros_like(U)
        np.add.at(S,E[:,0],U[E[:,1]]);np.add.at(S,E[:,1],U[E[:,0]])
        U=.8*U+.2*S/np.maximum(deg,1)[:,None]
    D=U[w];D*=np.minimum(1,lim/np.maximum(np.linalg.norm(D,axis=1),1e-12))[:,None]
    N=normal(Q,TT);A=np.linalg.norm(N,axis=1);valid=A>1e-12
    for f in (1.,.5,.25,.0):
        NN=normal(Q+D*f,TT)
        if not np.any(((np.sum(N*NN,axis=1)<0)|(np.linalg.norm(NN,axis=1)<A*.05))&valid):break
    deltas[o.name]=D*f
def sample():
    rows=[]
    for n,act in selected.items():
        reset();ad.action=act;lo,hi=map(float,act.frame_range)
        for k,f in enumerate(np.linspace(lo,hi,3)):
            scene.frame_set(math.floor(f),subframe=float(f%1));bpy.context.view_layer.update()
            bt=tree([body],True)
            rows.append({'clip':n,'frame':float(f),'parts':{o.name:metrics(pts(o,True),bt) for o in affected}})
    reset();return rows
def vec(rows,n):
    return np.array([[r['parts'][n]['penetrationProxy'],r['parts'][n]['deepPenetrationProxy']] for r in rows])
baseline=sample();base={o.name:vec(baseline,o.name) for o in affected};chosen={o.name:0. for o in affected};best={k:float((v*[1,2]).mean()) for k,v in base.items()}
for factor in (.5,1.):
    for o in affected:put(o,original[o.name]+factor*deltas[o.name])
    bpy.context.view_layer.update();rows=sample()
    for o in affected:
        v=vec(rows,o.name);b=base[o.name];s=float((v*[1,2]).mean())
        if np.all(v<=b+.001) and s<best[o.name]-1e-7:chosen[o.name]=factor;best[o.name]=s
for o in affected:put(o,original[o.name]+chosen[o.name]*deltas[o.name])
bpy.context.view_layer.update();final=sample()
for o in affected:
    if np.any(vec(final,o.name)>base[o.name]+.00101):raise RuntimeError('pose regression '+o.name)
# Hair-clothing interference separately reported (not certified clear).
hc=[]
for n,act in selected.items():
    reset();ad.action=act;lo,hi=map(float,act.frame_range);f=(lo+hi)/2
    scene.frame_set(math.floor(f),subframe=float(f%1));bpy.context.view_layer.update();ct=tree(cloth,True)
    hc.append({'clip':n,'parts':{o.name:metrics(pts(o,True),ct) for o in hair}})
reset()
# Tint only actual hair/wardrobe material, copy textures at full resolution
# and leave alpha, normal and roughness maps alone.
tints=[]
def tint(objs,color,kind):
    cache={};imgs={}
    for o in objs:
        for i,m in enumerate(o.data.materials):
            if not m:continue
            if m.name in cache:o.data.materials[i]=cache[m.name];continue
            mc=m.copy();mc.name=ident+'_'+kind+'_'+m.name;cache[m.name]=mc;o.data.materials[i]=mc
            mc.diffuse_color=(*color,mc.diffuse_color[3])
            if not mc.use_nodes:
                tints.append({'kind':kind,'material':mc.name,'method':'diffuse color'});continue
            bs=next((n for n in mc.node_tree.nodes if n.type=='BSDF_PRINCIPLED'),None)
            if not bs:continue
            sock=bs.inputs['Base Color'];links=list(sock.links)
            if not links:
                old=list(sock.default_value);rgb=np.array(color) if kind=='hair' else np.array(old[:3])*.35+np.array(color)*.65
                sock.default_value=(*rgb,old[3]);tints.append({'kind':kind,'material':mc.name,'method':'factor'});continue
            node=links[0].from_node
            if node.type!='TEX_IMAGE' or node.image is None:continue
            old=node.image
            if old.name not in imgs:
                im=old.copy();im.name=ident+'_'+kind+'_'+old.name
                a=np.empty(len(im.pixels),np.float32);im.pixels.foreach_get(a);a=a.reshape(-1,4);alpha=a[:,3].copy()
                lum=a[:,:3]@np.array([.2126,.7152,.0722]);v=a[:,3]>.05
                lo,hi=np.quantile(lum[v] if v.any() else lum,[.05,.95]);detail=np.clip((lum-lo)/max(float(hi-lo),.005),0,1)
                colored=(.45+detail[:,None])*np.array(color)
                a[:,:3]=np.clip(colored if kind=='hair' else .48*a[:,:3]+.52*colored,0,1)
                if not np.array_equal(a[:,3],alpha):raise RuntimeError('alpha changed')
                im.pixels.foreach_set(a.ravel());im.update();im.pack();imgs[old.name]=im
                tints.append({'kind':kind,'material':mc.name,'method':'texture tint','pixels':list(im.size),'alphaPreserved':True})
            node.image=imgs[old.name];sock.default_value=(1,1,1,1)
if profile['hairColor'] is not None:
    tint(hair,profile['hairColor'],'hair');tint(cloth,profile['clothColor'],'cloth')
for o in parts:
    if o not in affected and not np.array_equal(pts(o),original[o.name]):raise RuntimeError('protected geometry changed')
for o in [body]+beards:
    for n in names:
        if not np.array_equal(np.array([o.matrix_world@v.co for v in o.data.shape_keys.key_blocks[n].data]),morphs[(o.name,n)]):raise RuntimeError('morph changed')
for tag,d in [('front',(0,-1,0)),('left',(-1,0,0)),('right',(1,0,0)),('rear',(0,1,0)),('threequarter',(1,-1,0))]:render('after_'+tag,d)
render('after_face',(0,-1,0),fc,hh*3.9);render('after_crown',(0,-.05,1),fc,hh*3.9)
for n,act in selected.items():
    t=ad.nla_tracks.new();t.name='R53_'+n;t.strips.new('R53_'+n,1,act)
bpy.ops.object.select_all(action='DESELECT')
for o in parts+[rig]:o.select_set(True)
bpy.context.view_layer.objects.active=body
dest=out/(ident+'_assembled.glb')
opts=dict(filepath=str(dest),export_format='GLB',use_selection=True,export_skins=True,export_animations=True,export_morph=True)
prop=bpy.ops.export_scene.gltf.get_rna_type().properties
if 'export_animation_mode' in prop and 'NLA_TRACKS' in prop['export_animation_mode'].enum_items.keys():opts['export_animation_mode']='NLA_TRACKS'
elif 'export_nla_strips' in prop:opts['export_nla_strips']=True
else:raise RuntimeError('NLA export unavailable')
bpy.ops.export_scene.gltf(**opts)
raw=dest.read_bytes();g=json.loads(raw[20:20+int.from_bytes(raw[12:16],'little')])
if len(g.get('skins',[]))!=1 or not all(any(n.lower() in a.get('name','').lower() for a in g.get('animations',[])) for n in clips):raise RuntimeError('export rig/actions')
count=len(parts);morphCount=1+len(beards)
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(dest));bpy.context.view_layer.update()
rt=[o for o in bpy.context.scene.objects if o.type=='MESH' and rigof(o)]
if len(rt)!=count or len({rigof(o) for o in rt})!=1 or len([o for o in rt if o.data.shape_keys and all(n in o.data.shape_keys.key_blocks for n in names)])!=morphCount:raise RuntimeError('roundtrip inventory')
result={'id':ident,'sourceSHA256':rec['sha256'],'sha256':sha(dest),'profile':profile,'meshCount':count,'rigCount':1,'morphs':names,'clips':clips,'morphMeshCount':morphCount,'roundTrip':True,'protectedGeometryPreserved':True,'sampleCount':len(final),'before':baseline,'after':final,'fitFactors':chosen,'hairClothingDiagnostics':hc,'paletteChanges':tints,'visualApproved':False,'collisionApproved':False,'productionApproved':False,'protectedR6Used':False}
(out/'assembly-report.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));print('R53 CAST QUALITY',ident,'improved',sum(v>0 for v in chosen.values()),'palette changes',len(tints),flush=True)
