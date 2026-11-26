"""R53 cast clothing extension. Actual fitted plate leg parts, folded cape and fur mantle.
Source face/hair/beard/morphs untouched. Pose sampling is diagnostic, not cloth simulation.
"""
import bpy,numpy as np,math,sys,json,hashlib
from pathlib import Path
from mathutils import Vector,Matrix
from mathutils.bvhtree import BVHTree
args=sys.argv[sys.argv.index('--')+1:]
src,armorfile,out=map(lambda x:Path(x).resolve(),args[:3]);ident=args[3];out.mkdir(parents=True,exist_ok=True)
if ident not in ('commander-male','garan'):raise RuntimeError('identity')
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
rec=json.loads((src/'visual-report.json').read_text());p=src/(ident+'_visual_candidate.glb')
raw=armorfile.read_bytes()
if rec['id']!=ident or sha(p)!=rec['sha256'] or hashlib.sha1(('blob '+str(len(raw))+'\0').encode()+raw).hexdigest()!='92393b5785cf67e838603290b23b921e6608b398':raise RuntimeError('provenance')
for f in ('ATTRIBUTION.md','ARMOR-LICENSE.txt'):(out/f).write_bytes((src/f).read_bytes())
bpy.ops.wm.read_factory_settings(use_empty=True)
def load(p):
    before=set(bpy.context.scene.objects);bpy.ops.import_scene.gltf(filepath=str(p));bpy.context.view_layer.update()
    return [o for o in bpy.context.scene.objects if o not in before]
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
    return BVHTree.FromPolygons([Vector(tuple(float(v) for v in p)) for p in np.concatenate(vs)],[tuple(int(v) for v in t) for t in np.concatenate(ts)],all_triangles=True)
def metrics(Q,t):
    ds=[]
    for p in Q:
        q,n,i,d=t.find_nearest(Vector(p))
        if q is None:raise RuntimeError('missing surface')
        ds.append((Vector(p)-q).dot(n))
    a=np.array(ds);return {'penetrationProxy':float(np.mean(a<-.003)),'deepPenetrationProxy':float(np.mean(a<-.015)),'minSigned_m':float(a.min())}
def score(m):return m['penetrationProxy']+2*m['deepPenetrationProxy']
objs=load(p);parts=[o for o in objs if o.type=='MESH' and rigof(o)]
names=rec['morphs'];clips=rec['clips'];bs=[o for o in parts if not o.name.startswith('R53_Beard') and o.data.shape_keys and all(n in o.data.shape_keys.key_blocks for n in names)]
if len(bs)!=1 or len(parts)!=rec['meshCount'] or len({rigof(o) for o in parts})!=1:raise RuntimeError('source mesh inventory')
body=bs[0];rig=rigof(body);beards=[o for o in parts if o.name.startswith('R53_Beard')];cloth=[o for o in parts if o.name.startswith('R53_Clothing_')];oldarmor=[o for o in parts if o.name.startswith('R53_Armor_')]
if len(oldarmor)!=7 or not cloth or len(beards)!=(1 if ident=='garan' else 0):raise RuntimeError('source part missing')
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
sp=sorted(['spine%02d'%i for i in range(1,6)],key=lambda n:bone(n)[2]);hip=(bone('upperleg01.L')+bone('upperleg01.R'))/2
neck=bone('neck01');shoulders=[bone('upperarm01.'+s) for s in ('L','R')]
xmid=float(hip[0]);shoulderW=abs(shoulders[0][0]-shoulders[1][0]);zshoulder=float(np.mean([q[2] for q in shoulders]))
if not .10<shoulderW<.85:raise RuntimeError('shoulder dimensions')
skin=tree([body]);under=tree([body]+cloth);outer=tree([body]+cloth+oldarmor)
def material(name,col,metal=0.,rough=.65):
    m=bpy.data.materials.new(name);m.diffuse_color=(*col,1);m.use_nodes=True
    b=m.node_tree.nodes.get('Principled BSDF');b.inputs['Base Color'].default_value=(*col,1);b.inputs['Metallic'].default_value=metal;b.inputs['Roughness'].default_value=rough;return m
def bind(o,ws):
    o.vertex_groups.clear();gs={n:o.vertex_groups.new(name=n) for n in sorted({n for w in ws for n in w})}
    for i,w in enumerate(ws):
        total=sum(w.values())
        if total<=0:raise RuntimeError('unweighted new part')
        for n,v in w.items():
            if v>0:gs[n].add([i],v/total,'REPLACE')
    mod=o.modifiers.new('R53 cast shared rig','ARMATURE');mod.object=rig
def mesh(name,verts,faces,ws,mats,uvs=None,indices=None):
    me=bpy.data.meshes.new(name);me.from_pydata(verts,[],faces);me.update()
    o=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(o)
    for m in mats:me.materials.append(m)
    if indices is not None:
        for f,i in zip(me.polygons,indices):f.material_index=i
    for f in me.polygons:f.use_smooth=True
    if uvs is not None:
        uv=me.uv_layers.new(name='UVMap')
        for f in me.polygons:
            for i in f.loop_indices:uv.data[i].uv=uvs[me.loops[i].vertex_index]
    bind(o,ws);return o
scene=bpy.context.scene;scene.render.engine='BLENDER_WORKBENCH';scene.render.resolution_x=540;scene.render.resolution_y=720;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';sh=scene.display.shading;sh.light='STUDIO';sh.color_type='TEXTURE';sh.show_cavity=True
bpy.ops.object.camera_add();cam=bpy.context.object;cam.data.type='ORTHO';scene.camera=cam
def render(tag,d,c=center,size=H*1.35):
    cam.data.ortho_scale=size;cam.location=c+Vector(d).normalized()*H*3;cam.rotation_euler=(c-cam.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath=str(out/(tag+'.png'));bpy.ops.render.render(write_still=True)
render('before_front',(0,-1,0));render('before_rear',(0,1,0));render('before_side',(1,0,0))
# New lower limb plates from exact licensed source nodes. Independent parts
# fitted on the skin/underlayer, no helmet or new facial modifications.
rawobjs=load(armorfile);rawmap={o.name:o for o in rawobjs if o.type=='MESH'}
steel=material(ident+'_leg_plate',(.027,.039,.056) if ident=='commander-male' else (.34,.37,.40),.78,.33)
edge=material(ident+'_leg_edge',(.58,.36,.09) if ident=='commander-male' else (.44,.46,.48),.82,.3)
new=[];plates=[];newreport=[]
for sign in (-1,1):
    side=min(('L','R'),key=lambda s:abs(np.sign(bone('upperleg01.'+s)[0]-xmid)-sign))
    A=bone('upperleg01.'+side);K=bone('lowerleg01.'+side);F=bone('foot.'+side)
    for typ,names0,j0,j1,frac,bn in [
      ('thigh',['Thigh plate','Thigh folded center ridge'],A,K,(.12,.83),'upperleg01.'+side),
      ('knee',['Knee plate'],A,K,(.82,1.04),'lowerleg01.'+side),
      ('shin',['Shin plate'],K,F,(.14,.88),'lowerleg01.'+side)]:
        group=['cuisses-greaves__'+n+' '+str(sign) for n in names0]
        if any(n not in rawmap for n in group):raise RuntimeError('missing licensed part '+str(group))
        oo=[rawmap[n] for n in group];S=np.concatenate([pts(o) for o in oo]);lo=S.min(0);hi=S.max(0)
        axis=j1-j0;length=np.linalg.norm(axis);axis/=length
        rel=P-j0;along=rel@axis;rad=np.linalg.norm(rel-along[:,None]*axis,axis=1)
        region=P[(along>=length*frac[0])&(along<=length*frac[1])&(rad<.13*H)&(np.sign(P[:,0]-xmid)==sign)]
        if len(region)<20:raise RuntimeError('leg measurement insufficient '+typ+side)
        q=np.quantile(region,[.03,.97],axis=0)
        lower=q[0].copy();upper=q[1].copy();lower[0]-=.004;upper[0]+=.004
        lower[1]=q[0,1]-.021;upper[1]=q[0,1]-.006
        for o in oo:
            Q=lower+(pts(o)-lo)/np.maximum(hi-lo,1e-6)*(upper-lower)
            for i,(x,y,z) in enumerate(Q):
                hit,n,_,d=under.ray_cast(Vector((x,P[:,1].min()-.4,z)),Vector((0,1,0)),H)
                if hit is not None and n.y<-.15:Q[i,1]=hit.y-.006-(upper[1]-y)
            o.parent=None;o.matrix_world=Matrix.Identity(4)
            for v,q0 in zip(o.data.vertices,Q):v.co=Vector(q0)
            o.data.update()
            for k,m in enumerate(o.data.materials):o.data.materials[k]=edge if m and 'edge' in m.name.lower() else steel
            sourceName=o.name;o.name='R53_LegPlate_%02d'%len(plates)
            bind(o,[{bn:1.} for _ in Q]);plates.append(o);new.append(o)
            newreport.append({'part':o.name,'source':sourceName,'bone':bn,'rest':metrics(Q,under),'vertices':len(Q),'triangles':len(tri(o))})
for o in rawobjs:
    if o not in plates and o.name in bpy.data.objects:bpy.data.objects.remove(o,do_unlink=True)
# Folded textile panel, back of measured torso/legs. Parametric garment topology,
# two surfaces and side walls, UVs and skin weights; no cloth solver claim.
navy=material('Commander_navy_wool',(.025,.046,.105),0,.82)
trim=material('Commander_cape_gold_binding',(.35,.22,.075),.18,.6)
furbase=material('Garan_mantle_leather',(.20,.16,.12),0,.93)
def rear(x,z):
    q,n,i,d=outer.ray_cast(Vector((x,P[:,1].max()+H,z)),Vector((0,-1,0)),H*2)
    return float(q.y) if q is not None and n.y>.05 else None
backSamples=[rear(xmid,z) for z in np.linspace(hip[2],zshoulder,20)]
backSamples=[x for x in backSamples if x is not None]
if len(backSamples)<4:raise RuntimeError('back measurements missing')
backY=float(np.quantile(backSamples,.85))
def cloth_weights(t,u):
    # Upper spine attachment; transition to pelvis/root lower down.
    if t<.23:return {sp[-1]:1-t/.46,sp[-2]:t/.46}
    if t<.62:
        a=(t-.23)/.39;return {sp[-1]:(1-a)*.5,sp[-2]:(1-a)*.5,'root':a}
    return {'root':1.}
V=[];UV=[];W=[];FACES=[];MI=[];nx=35;nz=40 if ident=='commander-male' else 16
for j in range(nz):
    t=j/(nz-1)
    for i in range(nx):
        u=2*i/(nx-1)-1
        if ident=='commander-male':
            width=shoulderW*(.55+.22*t);z=zshoulder-(zshoulder-(hip[2]-.21*H))*t-.025*H*abs(u)**2*(1-t)
            x=xmid+width*u
            y0=rear(x,z);y=max(backY-.025*H,y0 if y0 is not None else backY-.02*H)
            y+=.022+.035*t+.008*(.45+.55*t)*(1+math.cos(u*5*math.pi+.5*t))
        else:
            width=shoulderW*(.63-.06*t);z=zshoulder+.025*H-.135*H*t-.055*H*abs(u)**2
            x=xmid+width*u;y0=rear(x,z)
            y=max(backY-.025*H,y0 if y0 is not None else backY-.02*H)+.018+.007*(1+math.cos(u*4*math.pi))
        V.append((x,y,z));UV.append((i/(nx-1),t));W.append(cloth_weights(t*.40 if ident=='garan' else t,u))
# Closed cloth shell with real thickness.
N=len(V);thick=.0018 if ident=='commander-male' else .004
V+= [(x,y+thick,z) for x,y,z in V[:]];UV+=UV[:];W+=W[:]
for j in range(nz-1):
    for i in range(nx-1):
        a=j*nx+i;b=a+1;c=a+nx+1;d=a+nx
        FACES.extend([(a,b,c,d),(N+d,N+c,N+b,N+a)])
        MI.extend([1 if ident=='commander-male' and (i==0 or i==nx-2 or j==nz-2) else 0]*2)
boundary=list(range(nx))+[j*nx+nx-1 for j in range(1,nz)]+list(range(N-2,N-nx-1,-1))+[j*nx for j in range(nz-2,0,-1)]
for a,b in zip(boundary,boundary[1:]+boundary[:1]):FACES.append((b,a,N+a,N+b));MI.append(1 if ident=='commander-male' else 0)
cape=mesh('R53_Cape' if ident=='commander-male' else 'R53_FurMantle',V,FACES,W,[navy,trim] if ident=='commander-male' else [furbase],UV,MI);new.append(cape)
fur=None;furCount=0
if ident=='garan':
    # Tapered fur clumps anchored to rear outer textile surface, with
    # inherited rig weights. Random seed affects variation, not anchor fit.
    rng=np.random.default_rng(5349);fv=[];ff=[];fw=[];fm=[]
    for j in range(nz-1):
        for i in range(nx-1):
            a=j*nx+i;b=a+1;c=a+nx+1;d=a+nx
            for sample in range(3):
                u,v=rng.uniform(.08,.92,2);ws=np.array([(1-u)*(1-v),u*(1-v),u*v,(1-u)*v]);ids=[a,b,c,d]
                p0=sum((Vector(V[N+k])*float(wt) for k,wt in zip(ids,ws)),Vector())
                ww={}
                for k,wt in zip(ids,ws):
                    for bn,weight in W[k].items():ww[bn]=ww.get(bn,0)+float(wt)*weight
                direction=Vector((rng.uniform(-.25,.25),.52,-1)).normalized();across=direction.cross(Vector((0,1,0))).normalized();normal=direction.cross(across).normalized()
                length=float(rng.uniform(.014,.034));rad=float(rng.uniform(.0011,.0025));idx=len(fv)
                for t,rr in ((0,1),(.55,.7),(1,.06)):
                    c0=p0+direction*length*t+Vector((0,.0018+.004*t,0))
                    for k in range(4):
                        angle=k*math.pi/2;fv.append(tuple(c0+(across*math.cos(angle)+normal*math.sin(angle))*rad*rr));fw.append(ww)
                mat=int(rng.integers(0,4))
                for row in range(2):
                    for k in range(4):ff.append((idx+row*4+k,idx+row*4+(k+1)%4,idx+(row+1)*4+(k+1)%4,idx+(row+1)*4+k));fm.append(mat)
                furCount+=1
    mats=[material('Garan_fur_%d'%i,c,0,.91) for i,c in enumerate(((.15,.12,.09),(.26,.21,.16),(.37,.33,.27),(.48,.44,.37)))]
    fur=mesh('R53_MantleFur',fv,ff,fw,mats,indices=fm);new.append(fur)
bpy.context.view_layer.update()
# Source parts are kept intact; evaluate each actual clip at three frames.
def verify_original():
    for o in parts:
        if not np.array_equal(pts(o),original[o.name]):raise RuntimeError('source part modified '+o.name)
    for o in [body]+beards:
        for n in names:
            if not np.array_equal(np.array([o.matrix_world@v.co for v in o.data.shape_keys.key_blocks[n].data]),morphs[(o.name,n)]):raise RuntimeError('source morph changed')
verify_original()
def validate_new(o):
    Q=pts(o);T=tri(o);a=Q[T];areas=np.linalg.norm(np.cross(a[:,1]-a[:,0],a[:,2]-a[:,0]),axis=1)
    if not np.isfinite(Q).all() or not len(T) or np.any(areas<=1e-12):raise RuntimeError('invalid new mesh '+o.name)
    if any(not v.groups for v in o.data.vertices):raise RuntimeError('unweighted part')
    return {'name':o.name,'vertices':len(Q),'triangles':len(T),'zeroArea':0}
# Record baseline and evaluate bounded back-clearance adjustments of the
# cape/mantle, preserving its folds and all source body/armor geometry.
drapes=[cape]+([fur] if fur else []);drape0={o.name:pts(o) for o in drapes}
def setoffset(off):
    for o in drapes:
        for v,q in zip(o.data.vertices,drape0[o.name]):v.co=Vector(q+np.array([0,off,0]))
        o.data.update()
    bpy.context.view_layer.update()
def sample(rendering=False):
    rows=[]
    for n,act in selected.items():
        reset();ad.action=act;lo,hi=map(float,act.frame_range)
        for k,f in enumerate(np.linspace(lo,hi,3)):
            scene.frame_set(math.floor(f),subframe=float(f%1));bpy.context.view_layer.update()
            b=tree([body],True);u=tree([body]+cloth+oldarmor,True)
            rows.append({'clip':n,'frame':float(f),'new':[{'part':o.name,'body':metrics(pts(o,True),b),'underlayer':metrics(pts(o,True),u)} for o in new],
                         'originalArmor':[{'part':o.name,'body':metrics(pts(o,True),b)} for o in oldarmor],
                         'beard':[{'part':o.name,'body':metrics(pts(o,True),b)} for o in beards]})
            if rendering and k==1:render('action_'+n,(1,2,.1) if n in ('Walk_Loop','Sprint_Loop') else (1,-2,0))
    reset();return rows
def objective(rows):
    vals=[score(q['underlayer']) for row in rows for q in row['new'] if q['part'] in {o.name for o in drapes}]
    return float(np.mean(vals))+float(max(vals))*.5
candidates=[]
for off in (0.,.008,.016,.024):
    setoffset(off);rows=sample();candidates.append({'offset_m':off,'score':objective(rows)})
best=min(candidates,key=lambda q:(q['score'],q['offset_m']))
setoffset(best['offset_m']);checks=sample(True);verify_original()
stats=[validate_new(o) for o in new]
for tag,d in [('front',(0,-1,0)),('left',(-1,0,0)),('right',(1,0,0)),('rear',(0,1,0)),('threequarter',(1,-1,0))]:render('after_'+tag,d)
render('mantle_detail',(1,2,.1),Vector((xmid,backY,zshoulder-.10*H)),H*.55)
for n,act in selected.items():
    t=ad.nla_tracks.new();t.name='R53_'+n;t.strips.new('R53_'+n,1,act)
allparts=parts+new;bpy.ops.object.select_all(action='DESELECT')
for o in allparts+[rig]:o.select_set(True)
bpy.context.view_layer.objects.active=body
dest=out/(ident+'_outfit_candidate.glb')
opts=dict(filepath=str(dest),export_format='GLB',use_selection=True,export_skins=True,export_animations=True,export_morph=True)
props=bpy.ops.export_scene.gltf.get_rna_type().properties
if 'export_animation_mode' in props and 'NLA_TRACKS' in props['export_animation_mode'].enum_items.keys():opts['export_animation_mode']='NLA_TRACKS'
elif 'export_nla_strips' in props:opts['export_nla_strips']=True
else:raise RuntimeError('NLA export unsupported')
bpy.ops.export_scene.gltf(**opts)
graw=dest.read_bytes();g=json.loads(graw[20:20+int.from_bytes(graw[12:16],'little')])
if len(g.get('skins',[]))!=1 or not all(any(n.lower() in a.get('name','').lower() for a in g.get('animations',[])) for n in clips):raise RuntimeError('rig/animation export')
count=len(allparts);bpy.ops.wm.read_factory_settings(use_empty=True);rs=load(dest);rt=[o for o in rs if o.type=='MESH' and rigof(o)]
if len(rt)!=count or len({rigof(o) for o in rt})!=1:raise RuntimeError('roundtrip shared rig')
if len([o for o in rt if o.data.shape_keys and all(n in o.data.shape_keys.key_blocks for n in names)])!=(2 if ident=='garan' else 1):raise RuntimeError('roundtrip morph inventory')
result={'id':ident,'sourceSHA256':rec['sha256'],'sha256':sha(dest),'armorSourceSHA256':sha(armorfile),'legPlates':newreport,'newParts':stats,'furClumps':furCount,'drapeSearch':candidates,'selectedBackOffset_m':best['offset_m'],'samples':checks,'originalGeometryAndMorphsUnchanged':True,'rigCount':1,'morphs':names,'clips':clips,'roundTrip':True,'visualApproved':False,'collisionApproved':False,'productionApproved':False,'limitations':['cape and mantle have skin-weighted folds, not cloth dynamics','sampled signed nearest-surface proxies only','no age skin or gauntlet/boot redesign','not final reference likeness']}
(out/'outfit-report.json').write_text(json.dumps(result,indent=2));print('R53 CAST OUTFIT',ident,len(plates),'fur clumps',furCount,'offset',best['offset_m'],'score',best['score'],flush=True)
