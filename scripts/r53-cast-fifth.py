"""R53 fifth cast candidate: articulated hand/foot plate overlays and localized skin age material.
Pose comparisons and geometry checks are evidence, not final visual/collision approval.
"""
import bpy,numpy as np,math,sys,json,hashlib
from pathlib import Path
from mathutils import Vector,Matrix
from mathutils.bvhtree import BVHTree
args=sys.argv[sys.argv.index('--')+1:]
src,out=map(lambda x:Path(x).resolve(),args[:2]);ident=args[2];out.mkdir(parents=True,exist_ok=True)
if ident not in ('commander-male','garan'):raise RuntimeError('identity')
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
rec=json.loads((src/'outfit-report.json').read_text());p=src/(ident+'_outfit_candidate.glb')
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
def material(name,col,metal=0.,rough=.65):
    m=bpy.data.materials.new(name);m.diffuse_color=(*col,1);m.use_nodes=True
    b=m.node_tree.nodes.get('Principled BSDF');b.inputs['Base Color'].default_value=(*col,1);b.inputs['Metallic'].default_value=metal;b.inputs['Roughness'].default_value=rough;return m
steel=material(ident+'_terminal_plate',(.027,.039,.056) if ident=='commander-male' else (.34,.37,.40),.78,.33)
edge=material(ident+'_terminal_edge',(.58,.36,.09) if ident=='commander-male' else (.44,.46,.48),.82,.30)
under=tree([body]+cloth)
new=[];fit=[]
def make_patch(label,bn,Q,axis,normal,lengthFraction):
    # Measure a local cross section of actual hand/foot vertices; overlay a
    # curved shell with open articulation boundaries, not a full rigid glove.
    axis=np.array(axis);axis/=np.linalg.norm(axis)
    normal=np.array(normal);normal-=axis*np.dot(axis,normal)
    if np.linalg.norm(normal)<1e-5:raise RuntimeError('axis/normal')
    normal/=np.linalg.norm(normal);across=np.cross(axis,normal);across/=np.linalg.norm(across)
    origin=bone(bn);D=Q-origin;u=D@axis;v=D@across;w=D@normal
    a,b=np.quantile(u,[.10,.90]);a,b=a+(b-a)*lengthFraction[0],a+(b-a)*lengthFraction[1]
    l,h=np.quantile(v,[.08,.92]);mid=(l+h)/2;width=(h-l)*.49
    if b-a<.004 or width<.003:raise RuntimeError('terminal dimensions '+label)
    V=[];uv=[];nx=13;ny=9
    for j in range(ny):
        t=j/(ny-1);x=a+(b-a)*t
        for i in range(nx):
            k=2*i/(nx-1)-1;y=mid+k*width*(.86+.14*math.sin(math.pi*t))
            r0=origin+axis*x+across*y+normal*(float(w.max())+.08)
            hit,n,_,d=under.ray_cast(Vector(r0),Vector(-normal),.20)
            depth=float(np.dot(np.array(hit)-origin,normal)) if hit is not None and np.dot(np.array(n),normal)>.12 else float(np.quantile(w,.85))
            z=depth+.0045+.003*(1-k*k)
            V.append(tuple(origin+axis*x+across*y+normal*z));uv.append((i/(nx-1),t))
    N=len(V);V+=[tuple(np.array(x)+normal*.0015) for x in V[:]];uv+=uv[:];F=[];MI=[]
    for j in range(ny-1):
        for i in range(nx-1):
            k=j*nx+i;a0=k;b0=k+1;c=k+nx+1;d=k+nx
            F.extend([(a0,b0,c,d),(N+d,N+c,N+b0,N+a0)]);MI.extend([int(i==0 or i==nx-2 or j==0 or j==ny-2)]*2)
    border=list(range(nx))+[j*nx+nx-1 for j in range(1,ny)]+list(range(N-2,N-nx-1,-1))+[j*nx for j in range(ny-2,0,-1)]
    for a0,b0 in zip(border,border[1:]+border[:1]):F.append((b0,a0,N+a0,N+b0));MI.append(1)
    me=bpy.data.meshes.new(label);me.from_pydata(V,[],F);me.update();o=bpy.data.objects.new(label,me);bpy.context.collection.objects.link(o)
    for m in (steel,edge):me.materials.append(m)
    for f,k in zip(me.polygons,MI):f.material_index=k;f.use_smooth=True
    uvmap=me.uv_layers.new(name='UVMap')
    for f in me.polygons:
        for i in f.loop_indices:uvmap.data[i].uv=uv[me.loops[i].vertex_index]
    g=o.vertex_groups.new(name=bn);g.add(list(range(len(V))),1.,'REPLACE')
    mod=o.modifiers.new('R53 independent articulated plate','ARMATURE');mod.object=rig
    fit.append({'part':label,'bone':bn,'sampledSurfaceVertices':len(Q),'length_m':float(b-a),'width_m':float(width*2),'rest':metrics(pts(o),under)})
    return o
for side in ('L','R'):
    # Hand is the palm/wrist segment, excludes most finger vertices.
    # Actual target joint names are HM08 wrist and middle finger chain.
    bn='wrist.'+side;A=bone(bn);B=bone('finger3-1.'+side);axis=B-A
    if np.linalg.norm(axis)<.008:axis=tail(bn)-A
    mask=np.array([sum(v for n,v in w.items() if n==bn or n.startswith('metacarpal') and n.endswith('.'+side))>.42 for w in weights])
    Q=P[mask]
    if len(Q)<25:
        d=P-A;u=d@(axis/np.linalg.norm(axis));Q=P[(u>-.012)&(u<np.linalg.norm(axis)*1.18)&(np.linalg.norm(d-u[:,None]*axis/np.linalg.norm(axis),axis=1)<.05)]
    if len(Q)<25:raise RuntimeError('hand samples '+side)
    # Dorsal direction is orthogonal to palm axis; select actual bone local
    # vector with upward component to avoid crossing the palm.
    rot=(rig.matrix_world@rig.data.bones[bn].matrix_local).to_3x3();n=np.array(rot@Vector((0,0,1)))
    if n[2]<0:n=-n
    if abs(np.dot(n,axis/np.linalg.norm(axis)))>.85:n=np.array((0,0,1.))
    new.append(make_patch('R53_HandPlate_'+side,bn,Q,axis,n,(0.,.86)))
    bn='foot.'+side;A=bone(bn);B=bone('toe3-1.'+side);axis=B-A
    mask=np.array([sum(v for n,v in w.items() if n==bn or n.startswith('toe') and n.endswith('.'+side))>.50 for w in weights]);Q=P[mask]
    if len(Q)<25:raise RuntimeError('foot samples '+side)
    new.append(make_patch('R53_FootPlate_'+side,bn,Q,axis,np.array((0,0,1.)),(.10,.85)))
bpy.context.view_layer.update()
# Multi-pose optimization: rigid local plate translation only, preserving
# original triangle shape and weights. Search world-rest shifts derived from
# per-part surface normals; accept only Pareto non-regression in sampled poses.
allplates=plates+new;start={o.name:pts(o) for o in allplates}
def put(o,Q):
    inv=o.matrix_world.inverted()
    for v,p in zip(o.data.vertices,Q):v.co=inv@Vector(p)
    o.data.update()
def samples():
    rows=[]
    for n,act in selected.items():
        reset();ad.action=act;lo,hi=map(float,act.frame_range)
        for k,f in enumerate(np.linspace(lo,hi,3)):
            scene.frame_set(math.floor(f),subframe=float(f%1));bpy.context.view_layer.update()
            b=tree([body],True);u=tree([body]+cloth,True)
            rows.append({'clip':n,'frame':float(f),'plates':{o.name:{'body':metrics(pts(o,True),b),'underlayer':metrics(pts(o,True),u)} for o in allplates}})
    reset();return rows
def sums(rows,n):
    a=np.array([score(r['plates'][n]['body']) for r in rows]);b=np.array([score(r['plates'][n]['underlayer']) for r in rows])
    return np.array([a.mean(),a.max(),b.mean(),b.max()])
before=samples();baseline={o.name:sums(before,o.name) for o in allplates};options={}
for o in allplates:
    Q=start[o.name];avg=Q.mean(0);nearest,n,_,_=under.find_nearest(Vector(avg));direction=np.array(n) if nearest is not None else np.array((0,-1,0))
    if np.linalg.norm(direction)<.01:direction=np.array((0,-1,0))
    direction/=np.linalg.norm(direction);options[o.name]=direction
# Evaluate all parts together (each checked only against body/underlayer).
choices={o.name:{'offset_m':0.,'summary':baseline[o.name].tolist()} for o in allplates}
for off in (.004,.008,.012):
    for o in allplates:put(o,start[o.name]+options[o.name]*off)
    bpy.context.view_layer.update();rows=samples()
    for o in allplates:
        a=sums(rows,o.name);b=baseline[o.name];c=np.array(choices[o.name]['summary'])
        if np.all(a<=b+1e-9) and a.sum()<c.sum()-1e-8:choices[o.name]={'offset_m':off,'summary':a.tolist()}
for o in allplates:put(o,start[o.name]+options[o.name]*choices[o.name]['offset_m'])
bpy.context.view_layer.update();after=samples()
for o in allplates:
    if np.any(sums(after,o.name)>baseline[o.name]+1e-7):raise RuntimeError('sample regression '+o.name)
# Age material: local UV rasterization of anatomically located crease fields
# into a new base-color texture. Original UVs, body geometry and shape keys
# remain intact; no global noise on eyes, lips, eyebrows or non-face regions.
age={'applied':False,'method':'none'}
if ident=='garan':
    import mathutils
    mesh0=body.data
    if not mesh0.uv_layers:raise RuntimeError('skin UV missing')
    uv=mesh0.uv_layers.active.data;mesh0.calc_loop_triangles()
    gm=[g.name for g in body.vertex_groups]
    headMask=(P[:,2]>eye[2]-hh*.95)&(P[:,2]<top+1e-6)&(P[:,1]<eye[1]+hh*.04)
    X=(P[:,0]-eye[0])/hh;Z=(P[:,2]-eye[2])/hh;Y=(P[:,1]-eye[1])/hh
    # Local shallow crease shading, forehead arcs, lateral eye lines, and
    # nasolabial contours. Exclude actual eye/lip landmarks and beard region.
    mz=(bone('oris01')[2]-eye[2])/hh
    A=np.abs(X);D=np.zeros(len(P))
    for k in (.32,.43,.54):
        line=k-.09*(X/.65)**2
        D+=.12*np.exp(-((Z-line)/.018)**2)*np.exp(-(X/.56)**6)
    for k in (-.09,.01,.11):
        line=k-.24*(A-.40)
        D+=.12*np.exp(-((Z-line)/.019)**2)*np.exp(-((A-.56)/.13)**2)
    D+=.16*np.exp(-((A-(.20-.30*(Z+.36)))/.018)**2)*np.exp(-((Z+.30)/.25)**4)
    D*=headMask*np.clip((-Y+.04)/.18,0,1)
    D[(A<.30)&(np.abs(Z-mz)<.13)]=0
    D[(A<.43)&(np.abs(Z)<.14)]=0
    D[Z<mz-.20]=0;D=np.clip(D,0,.28)
    # Bake only to the image actually used by each eligible skin material.
    # Require UV face overlap tests; no synthetic texture on eye materials.
    candidates=[]
    for mi,m in enumerate(mesh0.materials):
        if not m or not m.use_nodes:continue
        bsdf=next((n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED'),None)
        if not bsdf:continue
        links=list(bsdf.inputs['Base Color'].links)
        if not links or links[0].from_node.type!='TEX_IMAGE' or not links[0].from_node.image:continue
        tris=[t for t in mesh0.loop_triangles if mesh0.polygons[t.polygon_index].material_index==mi]
        active=[t for t in tris if np.max(D[list(t.vertices)])>.002]
        if active:candidates.append((mi,m,links[0].from_node.image,tris,active))
    if not candidates:
        age={'applied':False,'method':'skin source has no eligible base-color texture; original preserved'}
    else:
        changed=[]
        # Rasterize barycentric interpolation at original texture resolution.
        # Use max mask per texel and protect texels also used by non-head faces.
        for mi,m,im,tris,active in candidates:
            width,height=map(int,im.size)
            if min(width,height)<16 or width*height>16777216:continue
            mask=np.zeros((height,width),np.float32);protect=np.zeros((height,width),bool)
            def raster(t,target,guard=False):
                pp=np.array([uv[i].uv[:] for i in t.loops])*np.array([width-1,height-1])
                if np.any(pp<0) or np.any(pp>np.array([width-1,height-1])):return
                lo=np.floor(pp.min(0)).astype(int);hi=np.ceil(pp.max(0)).astype(int)
                a,b,c=pp;v=b-a;w=c-a;den=v[0]*w[1]-v[1]*w[0]
                if abs(den)<1e-9:return
                xx,yy=np.meshgrid(np.arange(lo[0],hi[0]+1),np.arange(lo[1],hi[1]+1))
                qx=xx-a[0];qy=yy-a[1];s=(qx*w[1]-qy*w[0])/den;t0=(v[0]*qy-v[1]*qx)/den
                inside=(s>=-1e-5)&(t0>=-1e-5)&(s+t0<=1.00001)
                if guard:target[yy[inside],xx[inside]]=True
                else:
                    z=D[list(t.vertices)];val=z[0]*(1-s-t0)+z[1]*s+z[2]*t0
                    target[yy[inside],xx[inside]]=np.maximum(target[yy[inside],xx[inside]],val[inside])
            for t in active:raster(t,mask)
            for t in tris:
                if not np.all(headMask[list(t.vertices)]):raster(t,protect,True)
            mask[protect]=0
            if np.count_nonzero(mask>.003)<20:continue
            newim=im.copy();newim.name='R53_Garan_age_'+im.name
            pixels=np.empty(len(newim.pixels),np.float32);newim.pixels.foreach_get(pixels);pixels=pixels.reshape(height,width,4)
            alpha=pixels[:,:,3].copy();pixels[:,:,:3]*=(1-mask[:,:,None])
            if not np.array_equal(alpha,pixels[:,:,3]):raise RuntimeError('alpha modified')
            newim.pixels.foreach_set(pixels.ravel());newim.update();newim.pack()
            mc=m.copy();mc.name='R53_Garan_skin_age_'+m.name
            bsdf=next(n for n in mc.node_tree.nodes if n.type=='BSDF_PRINCIPLED');bsdf.inputs['Base Color'].links[0].from_node.image=newim
            mesh0.materials[mi]=mc
            changed.append({'material':m.name,'image':im.name,'width':width,'height':height,'affectedTexels':int(np.count_nonzero(mask>.003)),'maxDarkening':float(mask.max()),'alphaPreserved':True})
        age={'applied':bool(changed),'method':'anatomically localized UV base-color crease shading; no actual wrinkle geometry','images':changed,'geometryUnchanged':True}
# Preserve every source non-armor mesh and all original face/beard morphs.
for o in parts:
    if o not in plates and not np.array_equal(pts(o),original[o.name]):raise RuntimeError('source non-armor changed '+o.name)
for o in [body]+beards:
    for n in names:
        if not np.array_equal(np.array([o.matrix_world@v.co for v in o.data.shape_keys.key_blocks[n].data]),morphs[(o.name,n)]):raise RuntimeError('morph changed')
for o in allplates:
    Q=pts(o);T=tri(o);a=Q[T];areas=np.linalg.norm(np.cross(a[:,1]-a[:,0],a[:,2]-a[:,0]),axis=1)
    if not np.isfinite(Q).all() or not len(T) or np.any(areas<=1e-12):raise RuntimeError('bad plate mesh '+o.name)
for tag,d in [('front',(0,-1,0)),('left',(-1,0,0)),('right',(1,0,0)),('rear',(0,1,0)),('threequarter',(1,-1,0))]:render('after_'+tag,d)
render('after_face',(0,-1,0),fc,hh*3.9);render('after_face_side',(1,0,0),fc,hh*3.9)
for side in ('L','R'):
    render('hand_'+side,(0,-1,1),Vector(bone('wrist.'+side)),H*.22)
    render('foot_'+side,(0,-1,1),Vector(bone('foot.'+side)),H*.27)
for n in ('Walk_Loop','Sword_Attack'):
    reset();ad.action=selected[n];lo,hi=map(float,selected[n].frame_range);f=(lo+hi)/2
    scene.frame_set(math.floor(f),subframe=float(f%1));bpy.context.view_layer.update();render('action_'+n,(1,-2,.1))
reset()
for n,act in selected.items():
    t=ad.nla_tracks.new();t.name='R53_'+n;t.strips.new('R53_'+n,1,act)
allparts=parts+new;bpy.ops.object.select_all(action='DESELECT')
for o in allparts+[rig]:o.select_set(True)
bpy.context.view_layer.objects.active=body
dest=out/(ident+'_fifth_candidate.glb')
opts=dict(filepath=str(dest),export_format='GLB',use_selection=True,export_skins=True,export_animations=True,export_morph=True)
props=bpy.ops.export_scene.gltf.get_rna_type().properties
if 'export_animation_mode' in props and 'NLA_TRACKS' in props['export_animation_mode'].enum_items.keys():opts['export_animation_mode']='NLA_TRACKS'
elif 'export_nla_strips' in props:opts['export_nla_strips']=True
else:raise RuntimeError('NLA export unsupported')
bpy.ops.export_scene.gltf(**opts)
raw=dest.read_bytes();g=json.loads(raw[20:20+int.from_bytes(raw[12:16],'little')])
if len(g.get('skins',[]))!=1 or not all(any(n.lower() in a.get('name','').lower() for a in g.get('animations',[])) for n in clips):raise RuntimeError('rig/animation export')
count=len(allparts);bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(dest));bpy.context.view_layer.update()
rt=[o for o in bpy.context.scene.objects if o.type=='MESH' and rigof(o)]
if len(rt)!=count or len({rigof(o) for o in rt})!=1:raise RuntimeError('roundtrip rig/parts')
if len([o for o in rt if o.data.shape_keys and all(n in o.data.shape_keys.key_blocks for n in names)])!=(2 if ident=='garan' else 1):raise RuntimeError('roundtrip morphs')
result={'id':ident,'sourceSHA256':rec['sha256'],'sha256':sha(dest),'terminalPlates':fit,'ageSkin':age,'plateClearance':choices,'baseline':{k:v.tolist() for k,v in baseline.items()},'before':before,'after':after,'sourceNonArmorGeometryUnchanged':True,'morphsUnchanged':True,'rigCount':1,'morphs':names,'clips':clips,'roundTrip':True,'visualApproved':False,'collisionApproved':False,'productionApproved':False,'limitations':['hand and foot dorsal overlays, not full gauntlets or footwear','age shading only; no wrinkle geometry','sampled nearest surface proxy, no continuous collision or armor-to-armor certification','not final reference likeness']}
(out/'fifth-report.json').write_text(json.dumps(result,indent=2));print('R53 CAST FIFTH',ident,'terminal plates',len(fit),'improved plates',sum(v['offset_m']>0 for v in choices.values()),'age texture',age['applied'],flush=True)
