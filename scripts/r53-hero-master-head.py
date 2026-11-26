"""R53 independent master-head reconstruction candidate, original hero preserved."""
import bpy,numpy as np,math,sys,json,hashlib
from pathlib import Path
from mathutils import Vector,Matrix
from mathutils.bvhtree import BVHTree
args=sys.argv[sys.argv.index('--')+1:]
src,out=map(lambda x:Path(x).resolve(),args[:2]);ident=args[2];out.mkdir(parents=True,exist_ok=True)
if ident not in ('commander-male','commander-female'):raise RuntimeError('identity')
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
rp=src/'anatomy-report.json';p=src/(ident+'_anatomy_candidate.glb')
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



from mathutils.geometry import barycentric_transform
# Official source preview contains the real skin, two sclerae and two irises.
# Use the actual imported transforms, not a procedural head or eyeball.
master=Path(args[3]).resolve()
if sha(master)!='cd74b2575785e470e2001ce90103f5b3a76d56382296acebabcae3d6c53f59':raise RuntimeError('master source hash')
before=set(bpy.context.scene.objects);bpy.ops.import_scene.gltf(filepath=str(master));bpy.context.view_layer.update()
imported=[o for o in bpy.context.scene.objects if o not in before]
raw=[o for o in imported if o.type=='MESH']
if len(raw)!=5:raise RuntimeError('master anatomy inventory '+str([o.name for o in raw]))
headparts=[o for o in raw if not any(k in o.name.lower() for k in ('.iris.','.sclera.'))]
if len(headparts)!=1:raise RuntimeError('master skin inventory')
hd=headparts[0];eyes={}
for side in ('L','R'):
    for kind in ('iris','sclera'):
        o=[o for o in raw if ('.'+kind+'.'+side).lower() in o.name.lower()]
        if len(o)!=1:raise RuntimeError('missing original '+kind+' '+side)
        eyes[(kind,side)]=o[0]
S=pts(hd);ST=tri(hd)
srcEye={side:(pts(eyes[('sclera',side)]).min(0)+pts(eyes[('sclera',side)]).max(0))/2 for side in ('L','R')}
srcCenter=(srcEye['L']+srcEye['R'])/2;dstEye={k:bone('eye.'+k) for k in ('L','R')}
sx=abs(dstEye['L'][0]-dstEye['R'][0])/abs(srcEye['L'][0]-srcEye['R'][0])
sz=hh/(float(S[:,2].max())-srcCenter[2])
# Measure cranium depth on both actual meshes in equivalent upper-head bands.
sp=S[S[:,2]>srcCenter[2]-(S[:,2].max()-srcCenter[2])*.72]
tp=P[P[:,2]>eye[2]-hh*.72]
sd=np.ptp(np.quantile(sp[:,1],[.03,.97]));td=np.ptp(np.quantile(tp[:,1],[.03,.97]));sy=float(np.clip(td/sd,.70,1.35))
scale=np.array([sx,sy,sz]);print('R53 MASTER fit scales',ident,scale.tolist(),'source eye',srcCenter.tolist(),'target',eye.tolist(),flush=True)
if np.any(scale<.45) or np.any(scale>1.65):raise RuntimeError('head landmark alignment out of range')
def mapP(A):return (A-srcCenter)*scale+eye
# Source head is deliberately independent, not yet replacing the original.
# Preserve source UVs and topology and use only original separate eye parts.
def freeze(o,Q):
    if o.data.shape_keys:o.shape_key_clear()
    o.parent=None;o.matrix_world=Matrix.Identity(4)
    for v,q in zip(o.data.vertices,Q):v.co=Vector(q)
    o.data.update()
    for p in o.data.polygons:p.use_smooth=True
def bind(o,weightRows):
    o.vertex_groups.clear()
    groups={n:o.vertex_groups.new(name=n) for n in sorted({n for w in weightRows for n in w})}
    for i,w in enumerate(weightRows):
        t=sum(w.values())
        if t<=0:raise RuntimeError('unweighted master vertex')
        for n,x in w.items():
            if x>1e-6:groups[n].add([i],x/t,'REPLACE')
    m=o.modifiers.new('HM08 shared skeleton','ARMATURE');m.object=rig
def bary(p,A):
    a,b,c=A;v0=b-a;v1=c-a;v2=p-a
    d00=v0@v0;d01=v0@v1;d11=v1@v1;d20=v2@v0;d21=v2@v1;den=d00*d11-d01*d01
    if abs(den)<1e-18:return np.array([1.,0,0])
    y=(d11*d20-d01*d21)/den;z=(d00*d21-d01*d20)/den
    w=np.clip([1-y-z,y,z],0,1);return w/w.sum()
# Transfer original skin weights and real expression displacements through
# nearest triangle barycentric interpolation. No guessed eye bone binding
# on the skin; the two source globes use the actual eye bones independently.
BT=tri(body);baseTree=tree([body]);D0={n:morphs[(body.name,n)]-P for n in names}
Q=mapP(S);wr=[];deltas={n:[] for n in names};dist=[];matches=[]
for p0 in Q:
    q,n,i,d=baseTree.find_nearest(Vector(p0))
    if q is None:raise RuntimeError('body surface unavailable')
    ids=BT[i];w=bary(np.array(q),P[ids]);weight={}
    for k,a in zip(ids,w):
        for n0,x in weights[k].items():weight[n0]=weight.get(n0,0)+float(a)*x
    wr.append(weight);dist.append(float(d));matches.append((ids,w))
    for n in names:deltas[n].append(w@D0[n][ids])
freeze(hd,Q);hd.name='R53_MasterHead';bind(hd,wr)
# Independent skin material: original source UV and its existing geometry,
# approximate color, optional imported normal from prior PBR material.
skin=hd.data.materials[0].copy();skin.name=ident+'_master_skin'
bs=next(n for n in skin.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
bs.inputs['Base Color'].default_value=(.58,.37,.27,1) if ident=='commander-male' else (.65,.45,.35,1)
bs.inputs['Roughness'].default_value=.55
hd.data.materials[0]=skin
# Stabilize transferred morphs with seam-consistent per-vertex repair.
_,w=np.unique(np.round(Q,6),axis=0,return_inverse=True);cnt=np.bincount(w)
def weld(D):return np.column_stack([np.bincount(w,weights=D[:,k])/cnt for k in range(3)])[w]
def N(V):
    a=V[ST];return np.cross(a[:,1]-a[:,0],a[:,2]-a[:,0])
N0=N(Q);area=np.linalg.norm(N0,axis=1);valid=area>1e-11
def defects(V):
    n=N(V);return ((np.sum(n*N0,axis=1)<0)|(np.linalg.norm(n,axis=1)<area*.03))&valid
E=np.unique(np.sort(np.concatenate((w[ST[:,[0,1]]],w[ST[:,[1,2]]],w[ST[:,[2,0]]])),axis=1),axis=0);E=E[E[:,0]!=E[:,1]]
e0=np.r_[E[:,0],E[:,1]];e1=np.r_[E[:,1],E[:,0]];degree=np.maximum(1,np.bincount(e0,minlength=len(cnt)))
hd.shape_key_add(name='Basis');fixed={};reports=[]
for name in names:
    D=weld(np.array(deltas[name]));alpha=np.ones(len(cnt))
    for it in range(120):
        A=Q+D*alpha[w,None];bad=defects(A)
        if not bad.any():break
        seeds=np.unique(w[ST[bad]]);t=alpha.copy();t[seeds]*=.72
        avg=np.bincount(e0,weights=t[e1],minlength=len(cnt))/degree;alpha=np.minimum(alpha,.78*t+.22*avg)
    peak=float(np.max(np.linalg.norm(A-Q,axis=1)))
    if bad.any():raise RuntimeError('master expression triangle defect '+name)
    k=hd.shape_key_add(name=name);k.data.foreach_set('co',A.astype(np.float32).ravel());k.value=0
    fixed[name]=A-Q;reports.append({'name':name,'peak_m':peak,'effective':peak>=.0001,'repairIterations':it,'newDefects':0})
# Use original iris/sclera meshes, keeping UV and relative alignment.
# Source fitting uses the same head transform so eyes cannot drift away
# from the authored lids. Eye coverage is measured by actual front rays.
for (kind,side),o in eyes.items():
    A=mapP(pts(o));freeze(o,A);o.name='R53_Master_'+kind+'_'+side;bind(o,[{'eye.'+side:1.} for _ in A])
    m=o.data.materials[0].copy();m.name=ident+'_'+kind+'_'+side
    b=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
    b.inputs['Roughness'].default_value=.19 if kind=='iris' else .23
    if kind=='iris':
        # Original iris topology remains; dense radial texture based on
        # the measured local iris surface projection, not a flat extra disk.
        lo=A.min(0);hi=A.max(0);c=(lo+hi)/2;ext=hi-lo
        size=512;Y,X=np.mgrid[0:size,0:size];xx=(X/(size-1)-.5)*2;yy=(Y/(size-1)-.5)*2;rad=np.sqrt(xx*xx+yy*yy);ang=np.arctan2(yy,xx)
        col=np.array([.095,.20,.31] if ident=='commander-female' else [.18,.095,.043])
        detail=.72+.18*np.sin(67*ang+19*rad)+.10*np.sin(113*ang-33*rad)
        rgb=col*detail[:,:,None]*(.55+.45*np.sin(np.clip(rad,0,1)*np.pi))[:,:,None]
        pupil=np.clip((.32-rad)/.035,0,1);rgb=rgb*(1-pupil[:,:,None])+.006*pupil[:,:,None];rgb*=np.clip((1.04-rad)/.12,.20,1)[:,:,None]
        rgba=np.concatenate([np.clip(rgb,0,1),np.ones((size,size,1))],axis=2).astype(np.float32)
        im=bpy.data.images.new(m.name+'_map',width=size,height=size,alpha=True);im.pixels.foreach_set(rgba.ravel());im.update();im.pack()
        uv=o.data.uv_layers.new(name='R53_IrisRadial')
        for l in o.data.loops:
            p=A[l.vertex_index];uv.data[l.index].uv=(.5+(p[0]-c[0])/max(ext[0],.001),.5+(p[2]-c[2])/max(ext[2],.001))
        un=m.node_tree.nodes.new('ShaderNodeUVMap');un.uv_map=uv.name;tex=m.node_tree.nodes.new('ShaderNodeTexImage');tex.image=im
        m.node_tree.links.new(un.outputs['UV'],tex.inputs['Vector']);m.node_tree.links.new(tex.outputs['Color'],b.inputs['Base Color'])
    o.data.materials[0]=m
# Neutral and blink coverage: raycast actual master skin and eyes. A real
# eyelid may cover the globe when blinking; no fabricated opening.
def cast(t,x,z):
    q,n,i,d=t.ray_cast(Vector((x,float(Q[:,1].min()-.3),z)),Vector((0,1,0)),1.0)
    return q,i,d
def exposure(side,sk,ey):
    O=pts(eyes[('sclera',side)]);lo=O.min(0);hi=O.max(0);c=(lo+hi)/2
    grid=[]
    for x in np.linspace(lo[0],hi[0],33):
        for z in np.linspace(lo[2],hi[2],33):
            e,_,ed=cast(ey,x,z);a,i,sd=cast(sk,x,z)
            if e is not None and (a is None or ed<sd-.00005):grid.append((float(x),float(z),float(e.y)))
    return np.array(grid).reshape(-1,3)
skinTree=tree([hd]);exposureReport=[];lashes=[]
for side in ('L','R'):
    et=tree([eyes[('sclera',side)],eyes[('iris',side)]])
    G=exposure(side,skinTree,et)
    exposureReport.append({'side':side,'visibleSamples':len(G),'gridResolution':33})
    if len(G)<8:continue
    # Ray-derived upper/lower margins: find nearby actual skin triangles.
    # Generate tapered tubes rooted in actual triangle with interpolated
    # skin weights and all facial morph deltas.
    V=[];F=[];rootRows=[];rootD={n:[] for n in names};rootCount=0
    for upper in (True,False):
        for x in np.unique(G[:,0])[1:-1]:
            Z=G[np.abs(G[:,0]-x)<1e-8,1];z=float(max(Z) if upper else min(Z));sgn=1 if upper else -1
            hit=None
            for step in range(1,9):
                zz=z+sgn*step*.00045
                a,i,sd=cast(skinTree,float(x),zz);b,_,ed=cast(et,float(x),zz)
                if a is not None and (b is None or sd<=ed+.00005):hit=(a,i);break
            if hit is None:continue
            a,i=hit;ids=ST[i];b=bary(np.array(a),Q[ids]);wr0={}
            for j,t in zip(ids,b):
                for n,v in wr[j].items():wr0[n]=wr0.get(n,0)+float(t)*v
            length=(.0045 if ident=='commander-female' else .0030) if upper else .0018
            origin=a+Vector((0,-.00015,0));direction=Vector((.10*np.sign(x-eye[0]),-.70,.70*sgn)).normalized()
            u=direction.cross(Vector((1,0,0))).normalized();v=direction.cross(u).normalized();at=len(V)
            for t,rad in ((0,.00016),(.35,.00013),(.70,.000075),(1,.000015)):
                c=origin+direction*length*t+Vector((0,-.0003*t*t,.0006*sgn*t*t))
                for j in range(5):
                    th=2*math.pi*j/5;V.append(tuple(c+rad*(u*math.cos(th)+v*math.sin(th))));rootRows.append(wr0)
                    for n in names:rootD[n].append(b@fixed[n][ids])
            for k in range(3):
                for j in range(5):t=(j+1)%5;F.append((at+k*5+j,at+k*5+t,at+(k+1)*5+t,at+(k+1)*5+j))
            rootCount+=1
    if not V:continue
    me=bpy.data.meshes.new('MasterLashes_'+side);me.from_pydata(V,[],F);me.update();o=bpy.data.objects.new('R53_MasterLashes_'+side,me);bpy.context.collection.objects.link(o)
    mat=bpy.data.materials.new('FineLashes_'+side);mat.use_nodes=True;bs=mat.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(.035,.020,.014,1);bs.inputs['Roughness'].default_value=.65;me.materials.append(mat)
    bind(o,rootRows);o.shape_key_add(name='Basis')
    for n in names:
        k=o.shape_key_add(name=n);k.data.foreach_set('co',(np.array(V)+np.array(rootD[n])).astype(np.float32).ravel())
    lashes.append(o);exposureReport[-1]['lashRoots']=rootCount
# Compare neck cross-sections at actual planes; record fit data for a
# future continuous retopology seam. Do NOT hide the seam inside clothing
# or call overlapping original and replacement heads a merged character.
def section(V,T,z):
    seg=[]
    for ids in T:
        A=V[ids];d=A[:,2]-z
        if d.min()>=0 or d.max()<=0:continue
        q=[]
        for i,j in ((0,1),(1,2),(2,0)):
            if d[i]*d[j]<0:q.append(A[i]+(A[j]-A[i])*(-d[i]/(d[j]-d[i])))
        if len(q)==2:seg.extend(q)
    return np.array(seg).reshape(-1,3)
seams=[]
for factor in (1.10,1.25,1.40,1.55,1.70):
    z=eye[2]-hh*factor;a=section(P,BT,z);b=section(Q,ST,z)
    if len(a)<6 or len(b)<6:continue
    ca=(a.min(0)+a.max(0))/2;cb=(b.min(0)+b.max(0))/2
    ea=np.ptp(a,axis=0);eb=np.ptp(b,axis=0)
    err=float(np.linalg.norm(ca-cb)+.5*np.linalg.norm(ea-eb))
    seams.append({'z_m':float(z),'targetSegments':len(a)//2,'masterSegments':len(b)//2,'targetWidthDepth_m':ea[:2].tolist(),'masterWidthDepth_m':eb[:2].tolist(),'centerError_m':float(np.linalg.norm(ca-cb)),'fitScore_m':err})
# Independent head-and-eye preview, with optional existing hair as a
# diagnostic only. Hair is unchanged and is not approved for this head.
new=[hd]+list(eyes.values())+lashes
scene=bpy.context.scene;scene.render.engine='BLENDER_WORKBENCH';scene.render.resolution_x=640;scene.render.resolution_y=720;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG'
sh=scene.display.shading;sh.light='STUDIO';sh.color_type='TEXTURE';sh.show_cavity=True
bpy.ops.object.camera_add();cam=bpy.context.object;cam.data.type='ORTHO';scene.camera=cam
def render(tag,d):
    cam.data.ortho_scale=hh*3.65;cam.location=fc+Vector(d).normalized()*H*3;cam.rotation_euler=(fc-cam.location).to_track_quat('-Z','Y' if abs(d[2])<.95 else 'X').to_euler();scene.render.filepath=str(out/(tag+'.png'));bpy.ops.render.render(write_still=True)
views=[('front',(0,-1,0)),('left',(-1,0,0)),('right',(1,0,0)),('rear',(0,1,0)),('crown',(0,-.05,1))]
for o in new:o.hide_render=True
for o in parts:o.hide_render=o!=body
for tag,d in views:render('original_'+tag,d)
for o in parts:o.hide_render=True
for o in new:o.hide_render=False
for tag,d in views:render('master_'+tag,d)
for o in hair:o.hide_render=False
for tag,d in views:render('with_old_hair_'+tag,d)
for o in hair:o.hide_render=True
for name in names:
    for o in [hd]+lashes:o.data.shape_keys.key_blocks[name].value=1
    bpy.context.view_layer.update();render('expression_'+name,(0,-1,0))
    for o in [hd]+lashes:o.data.shape_keys.key_blocks[name].value=0
bpy.context.view_layer.update()
combos=[]
for ns in [('smile','blink_L','blink_R'),('viseme_A','browRaise'),('laugh','blink_R')]:
    B=Q+sum((fixed[n] for n in ns),np.zeros_like(Q));combos.append({'names':list(ns),'newDefects':int(defects(B).sum())})
for n,act in selected.items():
    tr=ad.nla_tracks.new();tr.name='R53_'+n;tr.strips.new('R53_'+n,1,act)
bpy.ops.object.select_all(action='DESELECT')
for o in new+[rig]:o.select_set(True)
bpy.context.view_layer.objects.active=hd
dest=out/(ident+'_master_head.glb')
opts=dict(filepath=str(dest),export_format='GLB',use_selection=True,export_skins=True,export_animations=True,export_morph=True)
props=bpy.ops.export_scene.gltf.get_rna_type().properties
if 'export_animation_mode' in props and 'NLA_TRACKS' in props['export_animation_mode'].enum_items.keys():opts['export_animation_mode']='NLA_TRACKS'
elif 'export_nla_strips' in props:opts['export_nla_strips']=True
else:raise RuntimeError('NLA export unsupported')
bpy.ops.export_scene.gltf(**opts)
raw=dest.read_bytes();g=json.loads(raw[20:20+int.from_bytes(raw[12:16],'little')])
if len(g.get('skins',[]))!=1 or not all(any(n.lower() in a.get('name','').lower() for a in g.get('animations',[])) for n in clips):raise RuntimeError('master rig/actions')
if not any(all(n in m.get('extras',{}).get('targetNames',[]) for n in names) for m in g['meshes']):raise RuntimeError('master morph inventory')
count=len(new);bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(dest));bpy.context.view_layer.update()
rt=[o for o in bpy.context.scene.objects if o.type=='MESH' and rigof(o)]
if len(rt)!=count or len({rigof(o) for o in rt})!=1:raise RuntimeError('roundtrip inventory')
report={'id':ident,'sourceSHA256':rec['sha256'],'masterSourceSHA256':sha(master),'sha256':sha(dest),'masterSkinVertices':len(Q),'masterSkinTriangles':len(ST),'eyeMeshes':4,'exposure':exposureReport,'sourceEyeCenters_m':{k:v.tolist() for k,v in srcEye.items()},'targetEyeCenters_m':{k:v.tolist() for k,v in dstEye.items()},'scaleXYZ':scale.tolist(),'transferDistanceP95_m':float(np.quantile(dist,.95)),'neckSectionCandidates':seams,'morphs':reports,'combinedMorphs':combos,'clips':clips,'lashMeshes':len(lashes),'roundTrip':True,'continuousNeckIntegrated':False,'oralCavityIntegrated':False,'hairFitApproved':False,'visualApproved':False,'productionApproved':False,'protectedR6Used':False,'limitations':['independent master head study; source head same base for both sex profiles, not final likeness','original body not modified or included','no validated continuous neck seam, oral cavity or eyebrow fiber','original hair comparison only, no fit change','morph transfer and eyelid exposure diagnostic, not closure approval']}
(out/'master-head-report.json').write_text(json.dumps(report,indent=2));print('R53 MASTER HEAD',ident,'verts',len(Q),'eyes',4,'lash meshes',len(lashes),'visible',[x['visibleSamples'] for x in exposureReport],'seam candidates',len(seams),flush=True)
