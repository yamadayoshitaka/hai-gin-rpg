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
manifest=json.loads((master.parent/'SOURCE-MANIFEST.json').read_text())
sourceRecord=next(a for a in manifest['artifacts'] if a['id']=='realistic-head-animation')
rawMaster=master.read_bytes()
gitBlob=hashlib.sha1(('blob '+str(len(rawMaster))+'\0').encode()+rawMaster).hexdigest()
actualMasterSHA=sha(master)
if manifest['license']!='CC0-1.0' or sourceRecord['output']!=master.name or len(rawMaster)!=sourceRecord['previewBytes'] or actualMasterSHA!=sourceRecord['previewSha256'] or gitBlob!='cf27a3936bb356475f1b1a6eb284fc2aa8155212':
    raise RuntimeError('master source integrity: '+str({'actualSHA256':actualMasterSHA,'expectedSHA256':sourceRecord['previewSha256'],'gitBlob':gitBlob,'bytes':len(rawMaster)}))
print('R53 verified master provenance',actualMasterSHA,gitBlob,len(rawMaster),flush=True)
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
Q0=mapP(S)
# Subtle, separate facial profiles, applied before weight/morph transfer.
# Keep orbital rims, globe alignment and scalp/neck unchanged.
gap=float(np.linalg.norm(dstEye['L']-dstEye['R']))
X=(Q0[:,0]-eye[0])/gap;Y=(Q0[:,1]-eye[1])/gap;Z=(Q0[:,2]-eye[2])/gap
def ga(v,c,w):return np.exp(-((v-c)/w)**2)
front=np.clip((-Y+.12)/.48,0,1);front=front*front*(3-2*front)
orbital=np.maximum(ga(X,.5,.32),ga(X,-.5,.32))*ga(Z,0,.25)
# Differentiate the entire lower face, not only the tip of the chin.
# Gaussian masks preserve eye rims and the validated lower-neck cut.
jaw=ga(Z,-1.04,.53)*ga(np.abs(X),.73,.48)*front*(1-orbital)
cheek=ga(Z,-.47,.39)*ga(np.abs(X),.62,.32)*front*(1-orbital)
chin=ga(Z,-1.43,.30)*ga(X,0,.48)*front
bridge=ga(Z,-.38,.40)*ga(X,0,.23)*front*(1-orbital)
noseTip=ga(Z,-.70,.20)*ga(X,0,.29)*front
alar=ga(Z,-.75,.20)*ga(np.abs(X),.22,.18)*front
philtrum=ga(Z,-.93,.17)*ga(X,0,.26)*front
lip=ga(Z,-1.14,.13)*ga(X,0,.40)*front
female=ident=='commander-female'
Dprofile=np.zeros_like(Q0)
Dprofile[:,0]=(Q0[:,0]-eye[0])*((-.19 if female else .085)*jaw+(.045 if female else -.012)*cheek+(-.13 if female else .035)*bridge+(-.10 if female else .035)*alar)
Dprofile[:,1]=gap*((.055 if female else -.035)*chin+(-.037 if female else .022)*cheek+(.035 if female else -.018)*noseTip+(.012 if female else -.010)*philtrum)
Dprofile[:,2]=gap*((.085 if female else -.027)*chin+(.025 if female else -.008)*lip)
# Keep the neck seam geometry fixed; avoid changing the eye sockets.
neckLock=np.clip((Z+1.90)/.32,0,1);neckLock=neckLock*neckLock*(3-2*neckLock)
Dprofile*=((1-orbital*.85)*neckLock)[:,None]
if female:
    # Use the actual female anatomy candidate as a secondary anterior
    # reference, rather than guessing all of the sex-specific proportions.
    # Ray sample the same x/z coordinates on both heads; only adjust front
    # cheek, nasal and lip depth, never the orbital margins or neck cut.
    sourceFace=BVHTree.FromPolygons([Vector(p) for p in Q0],[tuple(int(i) for i in t) for t in ST],all_triangles=True)
    correction=np.zeros(len(Q0));support=np.zeros(len(Q0))
    for k,p0 in enumerate(Q0):
        if abs(X[k])>.94 or Z[k]>.35 or Z[k]<-1.66 or Y[k]>-.05:continue
        start=Vector((p0[0],min(float(P[:,1].min()),float(Q0[:,1].min()))-.04,p0[2]))
        q0,_,_,_=sourceFace.ray_cast(start,Vector((0,1,0)),gap*9)
        q1,_,_,_=baseTree.ray_cast(start,Vector((0,1,0)),gap*9)
        if q0 is None or q1 is None or abs(p0[1]-q0.y)>.0035:continue
        weight=float(front[k]*(1-orbital[k])**3*neckLock[k])
        weight*=float(np.exp(-((Z[k]+.76)/.78)**4))
        correction[k]=np.clip(q1.y-q0.y,-gap*.10,gap*.10)*weight*.40
        support[k]=weight
    # Smooth measured displacement over original topological adjacency.
    ed=np.unique(np.sort(np.concatenate([ST[:,[0,1]],ST[:,[1,2]],ST[:,[2,0]]]),axis=1),axis=0)
    ea=np.r_[ed[:,0],ed[:,1]];eb=np.r_[ed[:,1],ed[:,0]]
    deg=np.maximum(1,np.bincount(ea,minlength=len(Q0)))
    for _ in range(4):correction=.58*correction+.42*np.bincount(ea,weights=correction[eb],minlength=len(Q0))/deg
    Dprofile[:,1]+=correction*(1-orbital)**3*neckLock

# Guard against inverted or collapsed faces against the unchanged source.
def profile_norm(A):
    T=A[ST];return np.cross(T[:,1]-T[:,0],T[:,2]-T[:,0])
pn=profile_norm(Q0);pa=np.linalg.norm(pn,axis=1);pv=pa>1e-11
profile_factor=1.
for _ in range(12):
    Q=Q0+Dprofile*profile_factor;nn=profile_norm(Q)
    if not np.any(pv&((np.sum(pn*nn,axis=1)<=0)|(np.linalg.norm(nn,axis=1)<.15*pa))):break
    profile_factor*=.5
else:raise RuntimeError('profile neutral topology')
profile_report={'profile':'female' if female else 'male','scaleFactor':profile_factor,'peak_m':float(np.linalg.norm(Q-Q0,axis=1).max()),'newDefects':0,'eyeCentersUnchanged':True,'regions':['jaw','cheek','chin','nasalBridge','alar','philtrum','lip'],'neckLock':True,'femaleReferenceDepthFit':bool(female)}
wr=[];deltas={n:[] for n in names};dist=[];matches=[]
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

# Baked per-vertex anatomical UV projection; texture maps are exportable
# in glTF, unlike a Blender-only procedural shader. Preserve original UV.
def rgba_image(name,rgb,noncolor=False):
    a=np.asarray(rgb,dtype=np.float32)
    if a.ndim==2:a=np.repeat(a[:,:,None],3,axis=2)
    a=np.concatenate([np.clip(a,0,1),np.ones((*a.shape[:2],1),np.float32)],axis=2)
    im=bpy.data.images.new(name,width=a.shape[1],height=a.shape[0],alpha=True)
    if noncolor:im.colorspace_settings.name='Non-Color'
    im.pixels.foreach_set(a.ravel());im.update();im.pack();return im
def texlink(mat,bs,im,uv,socket):
    nd=mat.node_tree.nodes;lk=mat.node_tree.links
    u=nd.new('ShaderNodeUVMap');u.uv_map=uv
    t=nd.new('ShaderNodeTexImage');t.image=im;lk.new(u.outputs['UV'],t.inputs['Vector'])
    if socket:lk.new(t.outputs['Color'],bs.inputs[socket])
    return t
# Use measured head coordinates for a continuous cylindrical UV.
# Front face is centred at u=.5, avoiding seams in the lips and eyes.
uv=hd.data.uv_layers.new(name='R53_AnatomicalSkin')
lowZ=float(Q[:,2].min());highZ=float(Q[:,2].max());height=highZ-lowZ
for l in hd.data.loops:
    x,y,z=Q[l.vertex_index]
    uv.data[l.index].uv=(.5+math.atan2(x-eye[0],-(y-eye[1]))/(2*math.pi),(z-lowZ)/height)
# Correct wrap-crossing polygons at the back.
for poly in hd.data.polygons:
    ids=list(poly.loop_indices);us=[uv.data[i].uv.x for i in ids]
    if max(us)-min(us)>.5:
        for i in ids:
            if uv.data[i].uv.x<.5:uv.data[i].uv.x+=1
size=1024;yy,xx=np.mgrid[0:size,0:size];U=(xx+.5)/size;V=(yy+.5)/size
rng=np.random.default_rng(5300+(1 if female else 0))
noise=rng.normal(0,1,(size,size));fine=.005*noise+.009*np.sin(67*U+39*V)*np.sin(103*V)
def field(u,v,wu,wv):return np.exp(-((U-u)/wu)**2-((V-v)/wv)**2)
base=np.array([.76,.58,.48] if female else [.69,.49,.39])
C=np.broadcast_to(base,(size,size,3)).copy()+fine[:,:,None]
# Subtle cheek, lip-area and eye socket tonal variation, not painted geometry.
# Actual anatomical lip colouring is applied separately using mesh landmarks.
ev=(eye[2]-lowZ)/height;mv=(eye[2]-gap*1.15-lowZ)/height
cheeks=field(.42,ev-.11,.047,.09)+field(.58,ev-.11,.047,.09)
C+=cheeks[:,:,None]*np.array([.025,-.018,-.014])
C+=field(.5,mv,.045,.026)[:,:,None]*np.array([.015,-.035,-.025])
if female:
    # Vermilion and eyelid colour gradients follow the existing anatomical UV.
    # This is subtle material colour, not a substitute for geometric lips.
    lipMask=np.clip(field(.5,mv+.014,.060,.018)+.85*field(.5,mv-.009,.056,.017),0,1)
    C=C*(1-.45*lipMask[:,:,None])+np.array([.53,.245,.22])*.45*lipMask[:,:,None]
    socket=field(.403,ev+.005,.042,.023)+field(.597,ev+.005,.042,.023)
    C-=socket[:,:,None]*np.array([.027,.039,.034])
im=rgba_image(ident+'_SkinAlbedo',C)
texlink(skin,bs,im,uv.name,'Base Color')
rough=np.clip(.54+.035*noise+.03*field(.5,mv,.06,.045)-.06*field(.5,ev-.03,.055,.16),.40,.70)
texlink(skin,bs,rgba_image(ident+'_SkinRoughness',rough,True),uv.name,'Roughness')
dx=(np.roll(noise,-1,1)-np.roll(noise,1,1))*.018
dy=(np.roll(noise,-1,0)-np.roll(noise,1,0))*.018
norm=np.stack([.5+dx,.5+dy,np.full_like(dx,1)],axis=2)
nt=texlink(skin,bs,rgba_image(ident+'_SkinMicroNormal',norm,True),uv.name,None)
nm=skin.node_tree.nodes.new('ShaderNodeNormalMap');nm.uv_map=uv.name;nm.inputs['Strength'].default_value=.24
skin.node_tree.links.new(nt.outputs['Color'],nm.inputs['Color']);skin.node_tree.links.new(nm.outputs['Normal'],bs.inputs['Normal'])
if 'Specular IOR Level' in bs.inputs:bs.inputs['Specular IOR Level'].default_value=.28
if 'Subsurface Weight' in bs.inputs:bs.inputs['Subsurface Weight'].default_value=.065
elif 'Subsurface' in bs.inputs:bs.inputs['Subsurface'].default_value=.065
skin.diffuse_color=(*base,1)
pbrReport={'skinTextureSize':size,'albedo':True,'roughness':True,'normal':True,'uv':'R53_AnatomicalSkin','proceduralBaked':True,'visualApproved':False}

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
# Lower jaw rotation around an anatomical hinge, separated from lip
# expression transfer. The original source contains folded oral surfaces.
# Derive the hinge and lip region from eye spacing and measured head geometry.
# Locate the actual central lip crease between the upper and lower
# vermilion profiles using measured front-surface rays, rather than a
# fixed eye-spacing ratio alone.
mouthProbe=BVHTree.FromPolygons([Vector(p) for p in Q],[tuple(int(i) for i in t) for t in ST],all_triangles=True)
zs=np.linspace(eye[2]-gap*1.30,eye[2]-gap*.94,81)
mouthRows=[]
for dx0 in (-.10,-.05,0,.05,.10):
    depths=[]
    for z0 in zs:
        q0,_,_,_=mouthProbe.ray_cast(Vector((eye[0]+dx0*gap,float(Q[:,1].min()-.04),z0)),Vector((0,1,0)),gap*8)
        depths.append(float(q0.y) if q0 is not None else np.nan)
    d=np.asarray(depths)
    peaks=[j for j in range(7,len(zs)-7) if np.isfinite(d[j-7:j+8]).all() and d[j]>=d[j-1] and d[j]>=d[j+1]]
    if peaks:
        j=max(peaks,key=lambda k:min(d[k]-np.min(d[k-7:k]),d[k]-np.min(d[k+1:k+8])))
        contrast=float(min(d[j]-np.min(d[j-7:j]),d[j]-np.min(d[j+1:j+8])))
        if contrast>.00012:mouthRows.append((float(zs[j]),contrast,float(dx0)))
mouthZ=float(np.median([x[0] for x in mouthRows])) if len(mouthRows)>=3 else float(eye[2]-gap*1.12)
mouthWidth=gap*.37
creaseX=np.array([r[2] for r in mouthRows]);creaseZ=np.array([r[0] for r in mouthRows])
def localCrease(x):
    if len(creaseX)<3:return np.full_like(x,mouthZ)
    return np.interp(x,creaseX,creaseZ,left=creaseZ[0],right=creaseZ[-1])
# Mark folded oral lining on its existing geometry, keeping the exterior
# lip and facial skin unchanged. Use the measured anterior surface and
# triangle depth, not a painted black ellipse across the lips.
mouthInner=np.zeros(len(Q),dtype=bool)
for k,p0 in enumerate(Q):
    if abs(p0[0]-eye[0])>gap*.36 or abs(p0[2]-mouthZ)>gap*.19:continue
    hit,_,_,_=mouthProbe.ray_cast(Vector((p0[0],float(Q[:,1].min()-.04),p0[2])),Vector((0,1,0)),gap*8)
    if hit is not None and .0028<p0[1]-hit.y<gap*.52:mouthInner[k]=True
lining=skin.copy();lining.name='R53_OralLining'
lining.node_tree.nodes.clear();nd=lining.node_tree.nodes
ob0=nd.new('ShaderNodeOutputMaterial');pb=nd.new('ShaderNodeBsdfPrincipled')
pb.inputs['Base Color'].default_value=(.075,.014,.013,1);pb.inputs['Roughness'].default_value=.54
lining.node_tree.links.new(pb.outputs['BSDF'],ob0.inputs['Surface']);lining.diffuse_color=(.075,.014,.013,1)
hd.data.materials.append(lining);innerFaces=0
for poly in hd.data.polygons:
    if all(mouthInner[k] for k in poly.vertices):
        poly.material_index=len(hd.data.materials)-1;innerFaces+=1
hd.data.calc_loop_triangles()
oralTriangles=np.array([t.material_index==len(hd.data.materials)-1 for t in hd.data.loop_triangles],dtype=bool)
def oral_visibility(A):
    tr=BVHTree.FromPolygons([Vector(p) for p in A],[tuple(int(i) for i in t) for t in ST],all_triangles=True)
    xs=np.linspace(eye[0]-gap*.32,eye[0]+gap*.32,45)
    zs=np.linspace(mouthZ-gap*.30,mouthZ+gap*.20,37)
    grid=np.zeros((len(zs),len(xs)),dtype=bool)
    for iz,z in enumerate(zs):
        for ix,x in enumerate(xs):
            q,_,i,_=tr.ray_cast(Vector((x,float(Q[:,1].min()-.05),z)),Vector((0,1,0)),gap*8)
            if q is not None and i is not None:grid[iz,ix]=bool(oralTriangles[i])
    # Require contiguous visible lining, not isolated pixels.
    best=0;run=0
    for v in grid[:,len(xs)//2]:
        run=run+1 if v else 0;best=max(best,run)
    return {'visibleLiningSamples':int(grid.sum()),'centerOpeningHeight_m':float(best*(zs[1]-zs[0])),'gridSamples':int(grid.size)}
neutralOralVisibility=oral_visibility(Q)
mouthLandmarks={'creaseZ_m':mouthZ,'sampledCreases':len(mouthRows),'fallback':len(mouthRows)<3,'eyeGap_m':gap,'oralLiningVertices':int(mouthInner.sum()),'oralLiningFaces':innerFaces}

hingeY=float(eye[1]+gap*.85)
hingeZ=float(eye[2]-gap*.40)
def smooth01(t):
    t=np.clip(t,0.,1.);return t*t*(3-2*t)
def jaw_motion(A,angle):
    x=(A[:,0]-eye[0])/gap;y=(A[:,1]-eye[1])/gap;z=(A[:,2]-eye[2])/gap
    # Lower lip and chin move with mandible, upper lip stays in place.
    lipline=(localCrease(x)-eye[2])/gap+.045*np.clip(np.abs(x)/.6,0,1)**2
    low=smooth01((lipline-z+.015)/(.165 if female else .20))
    front=smooth01((.9-y)/1.1)
    neck=smooth01((z+2.3)/.75)
    side=1-.55*smooth01((np.abs(x)-.8)/.6)
    weight=low*front*neck*side
    yy=A[:,1]-hingeY;zz=A[:,2]-hingeZ
    co=np.cos(angle);si=np.sin(angle)
    out=np.zeros_like(A);out[:,1]=(yy*(co-1)-zz*si)*weight;out[:,2]=(yy*si+zz*(co-1))*weight
    return out
jawAngles={'jawOpen':.275,'viseme_A':.275,'viseme_O':.16,'viseme_E':.10,'viseme_I':.055,'viseme_U':.085,'laugh':.285,'smile':.025} if female else {'jawOpen':.23,'viseme_A':.19,'viseme_O':.12,'viseme_E':.07,'viseme_I':.045,'viseme_U':.06,'laugh':.21,'smile':.025}
hd.shape_key_add(name='Basis');fixed={};reports=[]
for name in names:
    D=np.array(deltas[name])
    if name in jawAngles:
        # Keep original lateral articulation, but replace the old collapsed
        # lower-face vertical displacement with a rotation-based candidate.
        region=smooth01((-(Q[:,2]-eye[2])/gap-.76)/.25)*smooth01((.8-(Q[:,1]-eye[1])/gap)/1.2)*smooth01(((Q[:,2]-eye[2])/gap+2.2)/.55)
        D[:,1:]*=(1-.94*region[:,None])
        D+=jaw_motion(Q,jawAngles[name])
        if female and name in ('jawOpen','viseme_A','viseme_O','laugh'):
            # Separate the upper lip gently from the lower jaw. Localize to
            # the measured crease and preserve nose, corners and neck.
            x0=(Q[:,0]-eye[0])/gap;z0=(Q[:,2]-mouthZ)/gap;y0=(Q[:,1]-eye[1])/gap
            upper=smooth01((z0+.018)/.060)*np.exp(-((z0-.075)/.12)**2)*np.exp(-(x0/.31)**4)*smooth01((-.08-y0)/.24)
            D[:,2]+=gap*.035*(jawAngles[name]/.275)*upper
            # Keep the lip corners stable and give the folded oral interior
            # a separate displacement from the front vermilion surface.
            central=np.exp(-(x0/.29)**4)*np.exp(-((z0+.035)/.16)**4)*smooth01((-.04-y0)/.22)
            yfront=np.quantile(Q[(np.abs(x0)<.15)&(np.abs(z0)<.20),1],.14)
            inner=smooth01((Q[:,1]-yfront-.0015)/.0045)
            D[:,1]+=gap*.19*(jawAngles[name]/.275)*central*inner*mouthInner
            D[:,2]*=(1-.42*central*(~mouthInner))
            # Keep outward lateral articulation, but suppress the inherited
            # central lip stretch that creates a narrow vertical crumple.
            D[:,0]*=(1-.72*central)
    # Explore explicit local upper/lower lip separation candidates.
    # A recessed skin surface alone is not an oral opening. Score actual
    # first-hit lining pixels, preserve surface topology and the chin.
    openingSearch=None
    if female and name in ('jawOpen','viseme_A','viseme_O','laugh'):
        xx=(Q[:,0]-eye[0])/gap;zz=(Q[:,2]-localCrease(xx))/gap;yy=(Q[:,1]-eye[1])/gap
        wx=np.exp(-(xx/.33)**6);wz=np.exp(-(zz/.20)**4);wf=smooth01((-.04-yy)/.25)
        split=np.tanh(zz/.035)
        # Move opposing lips apart and retreat inner tissue independently.
        L=np.zeros_like(Q);L[:,2]=gap*wx*wz*wf*split*(~mouthInner)
        L[:,1]=gap*wx*wz*wf*mouthInner*.45
        baseD=weld(D);bestD=baseD;best=oral_visibility(Q+baseD);attempts=[]
        for k in (.025,.05,.075,.10,.14):
            for scale0 in (.8,1.0):
                cand=weld(baseD*scale0+L*k)
                if defects(Q+cand).any():continue
                met=oral_visibility(Q+cand)
                attempts.append({'separation':k,'baseScale':scale0,**met})
                score0=met['visibleLiningSamples']+2000*met['centerOpeningHeight_m']
                if score0>best['visibleLiningSamples']+2000*best['centerOpeningHeight_m']:
                    bestD=cand;best=met
        D=bestD;openingSearch={'candidateCount':len(attempts),'selectedPreRepair':best,'attempts':attempts}
    D=weld(D);alpha=np.ones(len(cnt))
    for it in range(120):
        A=Q+D*alpha[w,None];bad=defects(A)
        if not bad.any():break
        seeds=np.unique(w[ST[bad]]);t=alpha.copy();t[seeds]*=.72
        avg=np.bincount(e0,weights=t[e1],minlength=len(cnt))/degree;alpha=np.minimum(alpha,.78*t+.22*avg)
    peak=float(np.max(np.linalg.norm(A-Q,axis=1)))
    if bad.any():raise RuntimeError('master expression triangle defect '+name)
    k=hd.shape_key_add(name=name);k.data.foreach_set('co',A.astype(np.float32).ravel());k.value=0
    fixed[name]=A-Q;reports.append({'name':name,'peak_m':peak,'effective':peak>=.0001,'repairIterations':it,'newDefects':0,'openingSearch':openingSearch})
# Use original iris/sclera meshes, keeping UV and relative alignment.
# Source fitting uses the same head transform so eyes cannot drift away
# from the authored lids. Eye coverage is measured by actual front rays.
# Measure the front scleral surface at each iris vertex. The imported
# iris was hidden behind the opaque sclera; conform its actual topology
# to the curved front surface with a sub-millimetre clearance.
eyeFit={}
eyeSource={k:mapP(pts(o)) for k,o in eyes.items()}
for (kind,side),o in eyes.items():
    A=eyeSource[(kind,side)].copy()
    if kind=='iris':
        globe=eyeSource[('sclera',side)]
        gt=BVHTree.FromPolygons([Vector(p) for p in globe],[tuple(int(i) for i in t) for t in tri(eyes[('sclera',side)])],all_triangles=True)
        old=A.copy();hits=0
        for i,p in enumerate(A):
            q,_,_,_=gt.ray_cast(Vector((p[0],float(globe[:,1].min()-.05),p[2])),Vector((0,1,0)),.12)
            if q is not None:
                A[i,1]=min(p[1],q.y-.00018);hits+=1
        if hits<.90*len(A):raise RuntimeError('iris conformation coverage '+side)
        eyeFit[side]={'matchedVertices':hits,'vertices':len(A),'maxForwardCorrection_m':float(np.max(old[:,1]-A[:,1])),'clearance_m':.00018}
    freeze(o,A);o.name='R53_Master_'+kind+'_'+side;bind(o,[{'eye.'+side:1.} for _ in A])
    m=o.data.materials[0].copy();m.name=ident+'_'+kind+'_'+side
    b=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
    b.inputs['Roughness'].default_value=.25 if kind=='iris' else .28
    if 'Coat Weight' in b.inputs:
        b.inputs['Coat Weight'].default_value=.12 if kind=='iris' else .08
        b.inputs['Coat Roughness'].default_value=.12
    if 'Specular IOR Level' in b.inputs:b.inputs['Specular IOR Level'].default_value=.42
    if kind=='iris':
        m.diffuse_color=(.095,.20,.31,1) if female else (.18,.095,.043,1)
    else:m.diffuse_color=(.86,.84,.79,1)
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
    # Count samples where the iris itself, not merely the sclera,
    # is the first visible ocular surface through the actual eyelids.
    it=tree([eyes[('iris',side)]]);st=tree([eyes[('sclera',side)]])
    visibleIris=0
    for x,z,_ in G:
        i0,_,di=cast(it,x,z);s0,_,ds=cast(st,x,z);h0,_,dh=cast(skinTree,x,z)
        if i0 is not None and (s0 is None or di<ds-.00003) and (h0 is None or di<dh-.00003):visibleIris+=1
    eyeFit[side]['visibleIrisSamples']=visibleIris
    eyeFit[side]['visibleEyeSamples']=len(G)
    if visibleIris<5:raise RuntimeError('iris remains occluded '+side)
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

# Eyebrow fibres projected onto the actual forehead; each root inherits
# the underlying triangle's bone weights and all thirteen morph deltas.
brows=[];browReports=[]
for side in ('L','R'):
    O=pts(eyes[('sclera',side)]);lo=O.min(0);hi=O.max(0)
    cx=float((lo[0]+hi[0])/2);sgn=1 if cx>eye[0] else -1
    ew=float(hi[0]-lo[0]);ez=float(hi[2]-lo[2])
    V=[];F=[];RW=[];RD={n:[] for n in names};roots=[]
    for j in range(34):
        t=j/33
        x=cx+sgn*ew*(-.51+1.10*t)
        z=float(hi[2])+ez*((.20 if female else .13)+(.17 if female else .09)*math.sin(math.pi*t)-.10*t)
        thick=(.00165 if female else .0020)*(.37+.63*math.sin(math.pi*t)**.6)
        for row in (-1,0,1):
            zz=z+row*thick
            a,i,_=cast(skinTree,x,zz)
            if a is None:continue
            ids=ST[i];b=bary(np.array(a),Q[ids]);rw={}
            for k,ww in zip(ids,b):
                for n,v in wr[k].items():rw[n]=rw.get(n,0)+float(ww)*v
            length=(.0035 if female else .0044)*(.55+.45*math.sin(math.pi*t))
            dx=sgn*length*(.48+.45*t);dz=length*(.75-.90*t)
            # Sample the whole fibre along the skin, rather than straight
            # lines floating above a curved brow ridge.
            C=[]
            for u in (0.,.33,.67,1.):
                hit,_,_=cast(skinTree,x+dx*u,zz+dz*u)
                if hit is None:break
                C.append(hit+Vector((0,-(.00015+.00030*math.sin(math.pi*u)),0)))
            if len(C)!=4:continue
            idx=len(V)
            for k,c in enumerate(C):
                tangent=(C[min(3,k+1)]-C[max(0,k-1)]).normalized()
                u=tangent.cross(Vector((0,1,0))).normalized();v=tangent.cross(u).normalized()
                rad=(.000115 if female else .000125)*(1-.86*k/3)
                for h in range(5):
                    th=2*math.pi*h/5;V.append(tuple(c+rad*(u*math.cos(th)+v*math.sin(th))));RW.append(rw)
                    for n in names:RD[n].append(b@fixed[n][ids])
            for k in range(3):
                for h in range(5):
                    h2=(h+1)%5;F.append((idx+k*5+h,idx+k*5+h2,idx+(k+1)*5+h2,idx+(k+1)*5+h))
            roots.append(tuple(a))
    if len(roots)<30:raise RuntimeError('insufficient brow roots '+side)
    me=bpy.data.meshes.new('R53_BrowFibres_'+side);me.from_pydata(V,[],F);me.update()
    ob=bpy.data.objects.new('R53_BrowFibres_'+side,me);bpy.context.collection.objects.link(ob)
    mat=bpy.data.materials.new('R53_Brow_'+side);col=(.042,.023,.016) if female else (.026,.018,.012)
    mat.diffuse_color=(*col,1);mat.use_nodes=True
    bs=mat.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*col,1);bs.inputs['Roughness'].default_value=.62
    me.materials.append(mat)
    for p0 in me.polygons:p0.use_smooth=True
    bind(ob,RW);ob.shape_key_add(name='Basis')
    for n in names:
        k=ob.shape_key_add(name=n);k.data.foreach_set('co',(np.array(V)+np.array(RD[n])).astype(np.float32).ravel())
    brows.append(ob);browReports.append({'side':side,'roots':len(roots),'vertices':len(V),'morphs':len(names),'visualApproved':False})


# Independent dental and tongue candidates. Fit behind the actual lips;
# preserve the original skin topology and record ray-based visibility
# rather than declaring that the mouth is production-ready.
oral=[];oralReports=[]
def local_cavity_front():
    # Find the source skin in the central mouth band; retain its measured depth.
    mask=(np.abs(Q[:,0]-eye[0])<gap*.12)&(np.abs(Q[:,2]-mouthZ)<gap*.16)&(Q[:,1]<eye[1])
    if int(mask.sum())<4:raise RuntimeError('oral landmarks unavailable')
    return float(np.quantile(Q[mask,1],.15))
lipY=local_cavity_front()
# The source head's oral interior is closed by a folded inner skin.
# Tooth crowns are distinct rounded solids, not a white mouth texture.
def oral_piece(name,centers,radii,col,lower=False):
    V=[];F=[]
    for center,rad in zip(centers,radii):
        cx,cy,cz=center;rx,ry,rz=rad;start=len(V);rings=9;seg=16
        V.append((cx,cy,cz-rz));bottom=start
        for j in range(1,rings):
            th=math.pi*j/rings
            for k in range(seg):
                ph=2*math.pi*k/seg
                V.append((cx+rx*math.sin(th)*math.cos(ph),cy+ry*math.sin(th)*math.sin(ph),cz-rz*math.cos(th)))
        top=len(V);V.append((cx,cy,cz+rz))
        for k in range(seg):
            q=(k+1)%seg
            F.append((bottom,start+1+q,start+1+k))
            for j in range(rings-2):
                at=start+1+j*seg;F.append((at+k,at+q,at+seg+q,at+seg+k))
            at=start+1+(rings-2)*seg;F.append((at+k,at+q,top))
    me=bpy.data.meshes.new(name);me.from_pydata(V,[],F);me.update()
    ob=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(ob)
    mat=bpy.data.materials.new(name+'_PBR');mat.diffuse_color=(*col,1);mat.use_nodes=True
    bs=mat.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*col,1);bs.inputs['Roughness'].default_value=.37 if 'Teeth' in name else .48
    me.materials.append(mat)
    for p0 in me.polygons:p0.use_smooth=True
    headName=next((b.name for b in rig.data.bones if b.name.lower()=='head'),None)
    if headName is None:headName=next((b.name for b in rig.data.bones if b.name.lower().endswith('head')),None)
    if headName is None:raise RuntimeError('oral head bone')
    bind(ob,[{headName:1.} for _ in V])
    A=np.array(V);ob.shape_key_add(name='Basis')
    # Lower teeth and tongue follow the same rotation as the chin, without
    # warping their crowns or being attached to upper-lip weights.
    for n in names:
        D=np.zeros_like(A)
        if lower and n in jawAngles:
            angle=jawAngles[n]*.84;yy=A[:,1]-hingeY;zz=A[:,2]-hingeZ
            D[:,1]=yy*(math.cos(angle)-1)-zz*math.sin(angle)
            D[:,2]=yy*math.sin(angle)+zz*(math.cos(angle)-1)
        k=ob.shape_key_add(name=n);k.data.foreach_set('co',(A+D).astype(np.float32).ravel())
    oral.append(ob);oralReports.append({'name':name,'components':len(centers),'vertices':len(V),'lowerJawFollow':lower,'morphs':len(names)})
for lower in (False,True):
    centers=[];radii=[]
    for k in (-2.5,-1.5,-.5,.5,1.5,2.5):
        x=eye[0]+k*gap*.087
        y=lipY+gap*(.19+.027*abs(k)**1.55)
        z=mouthZ+gap*((-.065 if lower else .065)-.009*abs(k))
        centers.append((x,y,z));radii.append((gap*.040,gap*.037,gap*(.040 if lower else .052)))
    oral_piece('R53_LowerTeeth' if lower else 'R53_UpperTeeth',centers,radii,(.83,.77,.64),lower)
oral_piece('R53_Tongue',[(eye[0],lipY+gap*.55,mouthZ-gap*.19)],[(gap*.185,gap*.18,gap*.052)],(.39,.13,.11),True)
# Evaluate the real frontmost surface recession through the lip region.
# A successful morph topology check alone cannot prove an open mouth.
def mouth_surface(V):
    tr=BVHTree.FromPolygons([Vector(p) for p in V],[tuple(int(i) for i in t) for t in ST],all_triangles=True)
    out=[]
    for x in np.linspace(eye[0]-mouthWidth*.72,eye[0]+mouthWidth*.72,25):
        for z in np.linspace(mouthZ-gap*.23,mouthZ+gap*.16,25):
            hit,_,_,_=tr.ray_cast(Vector((x,lipY-gap*2,z)),Vector((0,1,0)),gap*5)
            out.append(float(hit.y) if hit is not None else lipY+gap*2)
    return np.array(out)
neutralM=mouth_surface(Q);mouthMetrics={}
for n in ('jawOpen','viseme_A','viseme_O','laugh'):
    a=mouth_surface(Q+fixed[n]);mouthMetrics[n]={'recessedSamples':int(np.sum(a-neutralM>gap*.07)),'sampleCount':len(a),'maxRecession_m':float(np.max(a-neutralM)),'actualOpeningApproved':False,**oral_visibility(Q+fixed[n]),'neutralVisibleLiningSamples':neutralOralVisibility['visibleLiningSamples']}

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

# Separate continuous neck study; never overwrite the validated head.
def neck_assembly():
    from collections import Counter
    V=[];RW=[];MD=[];F=[];FU=[];FM=[];materials=[];uvNames=set()
    def matindex(m):
        if m not in materials:materials.append(m)
        return materials.index(m)
    def clipped(obj,A,rows,D,z,upper):
        v=[];rw=[];md=[];f=[];fu=[];fm=[];lookup={}
        obj.data.calc_loop_triangles()
        layers=list(obj.data.uv_layers);uvNames.update(l.name for l in layers)
        def make(i,li):
            return A[i],rows[i],np.array([D[n][i] for n in names]),{l.name:np.array(l.data[li].uv) for l in layers}
        def interp(a,b):
            t=float((z-a[0][2])/(b[0][2]-a[0][2]));q=(1-t)*a[0]+t*b[0];q[2]=z
            w0={k:(1-t)*a[1].get(k,0)+t*b[1].get(k,0) for k in set(a[1])|set(b[1])}
            return q,w0,(1-t)*a[2]+t*b[2],{k:(1-t)*a[3][k]+t*b[3][k] for k in a[3]}
        def add(a):
            key=tuple(np.round(a[0]*1e6).astype(np.int64))
            if key not in lookup:lookup[key]=len(v);v.append(a[0]);rw.append(a[1]);md.append(a[2])
            return lookup[key]
        def inside(a):return a[0][2]>=z if upper else a[0][2]<=z
        for t in obj.data.loop_triangles:
            poly=[make(i,li) for i,li in zip(t.vertices,t.loops)];cut=[]
            for a,b in zip(poly,poly[1:]+poly[:1]):
                ia,ib=inside(a),inside(b)
                if ia:cut.append(a)
                if ia!=ib:cut.append(interp(a,b))
            for j in range(1,len(cut)-1):
                corners=[cut[0],cut[j],cut[j+1]];ids=tuple(add(a) for a in corners)
                if len(set(ids))!=3:continue
                p0,p1,p2=[v[i] for i in ids]
                if np.linalg.norm(np.cross(p1-p0,p2-p0))<1e-12:continue
                f.append(ids);fu.append([a[3] for a in corners]);fm.append(obj.data.materials[t.material_index])
        ec=Counter();dr={}
        for t in f:
            for a,b in zip(t,t[1:]+t[:1]):
                k=tuple(sorted((a,b)));ec[k]+=1;dr[k]=(a,b)
        edges=[dr[k] for k,c in ec.items() if c==1 and all(abs(v[i][2]-z)<2e-6 for i in k)]
        nxt=dict(edges)
        if len(nxt)!=len(edges) or len(set(nxt.values()))!=len(nxt) or len(nxt)<12:raise RuntimeError('neck cut not simple')
        start=next(iter(nxt));ring=[start];k=nxt[start]
        while k!=start and k not in ring and k in nxt:ring.append(k);k=nxt[k]
        if k!=start or len(ring)!=len(nxt):raise RuntimeError('multiple or open neck rings')
        return v,rw,md,f,fu,fm,ring
    attempts=[];hc=bc=None
    for tf,bf in ((1.10,1.28),(1.06,1.25),(1.15,1.34),(1.20,1.40)):
        za=float(eye[2]-hh*tf);zb=float(eye[2]-hh*bf)
        try:hc=clipped(hd,Q,wr,fixed,za,True);bc=clipped(body,P,weights,D0,zb,False);break
        except Exception as e:hc=bc=None;attempts.append(str(e))
    if hc is None:raise RuntimeError('no valid neck loops: '+str(attempts))
    def append(cut):
        v,r,d,f,u,m,ring=cut;o=len(V);V.extend(v);RW.extend(r);MD.extend(d)
        F.extend(tuple(i+o for i in t) for t in f);FU.extend(u);FM.extend(matindex(x) for x in m)
        return [i+o for i in ring]
    ar=append(hc);br=append(bc)[::-1]
    ac=np.mean([V[i] for i in ar],axis=0);bc0=np.mean([V[i] for i in br],axis=0)
    def az(i,c):return math.atan2(V[i][0]-c[0],-(V[i][1]-c[1]))
    def rotate(a,k):return a[k:]+a[:k]
    ar=rotate(ar,min(range(len(ar)),key=lambda i:abs(az(ar[i],ac))))
    def angular(a,b):return abs(math.atan2(math.sin(a-b),math.cos(a-b)))
    br=rotate(br,min(range(len(br)),key=lambda i:angular(az(br[i],bc0),az(ar[0],ac))))
    def arc(r):
        d=np.array([np.linalg.norm(V[a]-V[b]) for a,b in zip(r,r[1:]+r[:1])]);return np.r_[0,np.cumsum(d)/d.sum()]
    aa,bb=arc(ar),arc(br);i=j=0;bridge=[]
    while i<len(ar) or j<len(br):
        a=ar[i%len(ar)];b=br[j%len(br)]
        if j==len(br) or (i<len(ar) and aa[i+1]<=bb[j+1]):
            i+=1;bridge.append((ar[i%len(ar)],a,b))
        else:j+=1;bridge.append((a,b,br[j%len(br)]))
    def skinuv(q):return np.array([.5+math.atan2(q[0]-eye[0],-(q[1]-eye[1]))/(2*math.pi),(q[2]-lowZ)/height])
    for t in bridge:
        F.append(t);coords=[skinuv(V[k]) for k in t]
        if max(x[0] for x in coords)-min(x[0] for x in coords)>.5:
            for x in coords:
                if x[0]<.5:x[0]+=1
        FU.append([{'R53_AnatomicalSkin':x} for x in coords]);FM.append(matindex(skin))
    # Every actual cut edge must be stitched with opposite winding.
    orient=Counter((a,b) for t in F for a,b in zip(t,t[1:]+t[:1]))
    es={tuple(sorted((a,b))) for t in bridge for a,b in zip(t,t[1:]+t[:1])}
    seamBad=sum(orient[(a,b)]!=1 or orient[(b,a)]!=1 for a,b in es)
    if seamBad:raise RuntimeError('seam edge topology '+str(seamBad))
    A=np.array(V);T=np.array(bridge);N0=np.cross(A[T[:,1]]-A[T[:,0]],A[T[:,2]]-A[T[:,0]])
    areas=np.linalg.norm(N0,axis=1)/2
    if float(areas.min())<1e-10:raise RuntimeError('degenerate neck bridge')
    me=bpy.data.meshes.new('R53_ContinuousSkin');me.from_pydata(V,[],F);me.update()
    ob=bpy.data.objects.new('R53_ContinuousSkin',me);bpy.context.collection.objects.link(ob)
    for m in materials:me.materials.append(m)
    layers={name:me.uv_layers.new(name=name) for name in sorted(uvNames|{'R53_AnatomicalSkin'})}
    for poly,mi,uvs in zip(me.polygons,FM,FU):
        poly.material_index=mi;poly.use_smooth=True
        for li,u0 in zip(poly.loop_indices,uvs):
            for name,l in layers.items():l.data[li].uv=u0.get(name,(0.,0.))
    bind(ob,RW);ob.shape_key_add(name='Basis');MD=np.array(MD);morphBad={}
    for k,n in enumerate(names):
        B=A+MD[:,k];sk=ob.shape_key_add(name=n);sk.data.foreach_set('co',B.astype(np.float32).ravel())
        N1=np.cross(B[T[:,1]]-B[T[:,0]],B[T[:,2]]-B[T[:,0]])
        morphBad[n]=int(np.sum((np.sum(N0*N1,axis=1)<=0)|(np.linalg.norm(N1,axis=1)<.03*np.linalg.norm(N0,axis=1))))
    return ob,{'status':'candidate','headRingVertices':len(ar),'bodyRingVertices':len(br),'bridgeTriangles':len(bridge),'seamBadEdges':seamBad,'minimumBridgeArea_m2':float(areas.min()),'morphBridgeDefects':morphBad,'cutPlanes_m':[za,zb],'previousAttempts':attempts,'visualApproved':False,'productionApproved':False}

# Independent head-and-eye preview, with optional existing hair as a
# diagnostic only. Hair is unchanged and is not approved for this head.
new=[hd]+list(eyes.values())+lashes+brows+oral
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

# Independent scalp-fitted hair candidate. Keep all previous renders and the
# baseline head export intact; this is a separate, explicitly unapproved study.
def fitted_scalp_hair():
    # Continuous layered bob: a smooth scalp shell extends into a continuous
    # free-hanging rear/side silhouette, instead of disconnected thick rods.
    crown=Q[Q[:,2]>eye[2]+hh*.30]
    if len(crown)<30:raise RuntimeError('insufficient scalp')
    c=Vector((float(np.median(crown[:,0])),float(np.median(crown[:,1])),float(eye[2]+hh*.26)))
    n=160;rows=64;V=[];F=[];UV=[];clearance=[]
    def edge(a):
        f=max(0.,math.cos(a))
        return .83+.47*(1-math.cos(a))+.17*math.sin(a)**2+.34*math.sin(a+.7)*f**2
    def scalp(a,t):
        ang=.018+(edge(a)-.018)*t
        ray=Vector((math.sin(ang)*math.sin(a),-math.sin(ang)*math.cos(a),math.cos(ang)))
        p,_,_,_=skinTree.ray_cast(c+ray*.42,-ray,.42)
        if p is None:raise RuntimeError('scalp ray missed')
        # A small angular neighborhood filters sharp ear protrusions and
        # retains their envelope. Shell remains outside the measured head.
        dist=(p-c).dot(ray)
        for da in (-.075,-.0375,.0375,.075):
            a1=a+da
            v=Vector((math.sin(ang)*math.sin(a1),-math.sin(ang)*math.cos(a1),math.cos(ang)))
            h,_,_,_=skinTree.ray_cast(c+v*.42,-v,.42)
            if h is not None:dist=max(dist,(h-c).dot(v)-.0015)
        vol=.004+.0035*math.sin(math.pi*t*.85)**2
        return c+ray*(dist+vol),ray
    def sample(a,t):
        if t<=1:
            q,ray=scalp(a,t)
        else:
            p,ray=scalp(a,1.)
            prev,_=scalp(a,.96)
            tan=(p-prev)/.04
            u=t-1
            # Smooth growth from short swept bangs to jaw-length sides and
            # back, without the former abrupt cos(a) threshold.
            side=(1-math.cos(a))/2
            mix=smooth01((side-.06)/.48)
            hang=float(.008+.085*mix+.014*side+.012*math.sin(a)*mix+.0022*math.sin(19*a+.2)*mix+.0008*math.sin(47*a))
            radial=Vector((math.sin(a),-math.cos(a),0))
            target=p+Vector((-.006*mix*math.sin(a),0,-hang))+radial*(.004+.004*mix)
            endtan=Vector((0,0,-hang*.8))-radial*.007*mix
            t0=tan*.16
            q=(2*u**3-3*u*u+1)*p+(u**3-2*u*u+u)*t0+(-2*u**3+3*u*u)*target+(u**3-u*u)*endtan
            q+=radial*(.004*math.sin(math.pi*u)*mix)
        q+=ray*(.00038*math.sin(29*a+5*t)*math.sin(math.pi*min(t,1.))**2)
        near,normal,_,d=skinTree.find_nearest(q)
        if near is not None and d<.025 and (q-near).dot(normal)<.0012:q=near+normal*.0014
        return q
    for j in range(rows+1):
        t=1.95*j/rows
        for k in range(n):
            a=2*math.pi*k/n
            V.append(tuple(sample(a,t)));UV.append((k/n,j/rows))
    F.append(tuple(range(n)))
    for j in range(rows):
        for k in range(n):
            a=j*n+k;b=j*n+(k+1)%n;F.append((a,a+n,b+n,b))
    # Fine overlay strips with very shallow relief follow the silhouette.
    # Their edges remain close to the continuous backing; no separate rods.
    groups=[]
    for k in range(64):
        a0=2*math.pi*k/64;start=len(V);sections=32
        for j in range(sections):
            t=.18+1.74*j/(sections-1);a=a0+.12*math.sin(t*1.7)*math.sin(a0+.5)
            width=.042*(.35+.65*math.sin(math.pi*j/(sections-1))**.65)
            for side in (-1,0,1):
                q=sample(a+side*width,t)
                normal=Vector((math.sin(a),-math.cos(a),max(0.,1-t))).normalized()
                q+=normal*(.00013+.00020*(1-abs(side))*math.sin(math.pi*j/(sections-1)))
                V.append(tuple(q));UV.append(((k+(side*.42))/64,j/(sections-1)))
        for j in range(sections-1):
            for k0 in range(2):
                a=start+j*3+k0;F.append((a,a+3,a+4,a+1))
        groups.append({'kind':'shallow_surface_layer','vertices':sections*3})
    me=bpy.data.meshes.new('R53_ContinuousLayeredBob');me.from_pydata(V,[],F);me.update()
    ob=bpy.data.objects.new('R53_MeasuredScalpHair',me);bpy.context.collection.objects.link(ob)
    col=np.array([.105,.058,.033]);mat=bpy.data.materials.new('R53_ChestnutHair');mat.diffuse_color=(*col,1);mat.use_nodes=True
    bs=mat.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*col,1);bs.inputs['Roughness'].default_value=.64
    if 'Specular IOR Level' in bs.inputs:bs.inputs['Specular IOR Level'].default_value=.18
    me.materials.append(mat);hu=me.uv_layers.new(name='R53_HairFlow')
    for p in me.polygons:
        p.use_smooth=True;ids=list(p.loop_indices);u0=[UV[me.loops[i].vertex_index][0] for i in ids];wrap=max(u0)-min(u0)>.5
        for i,u in zip(ids,u0):
            _,v=UV[me.loops[i].vertex_index];hu.data[i].uv=(u+1 if wrap and u<.5 else u,v)
    yy,xx=np.mgrid[0:1024,0:2048];u=xx/2048;v=yy/1024
    strand=.82+.055*np.sin(2*math.pi*(u*317+.19*np.sin(v*8)))+.035*np.sin(2*math.pi*(u*503+v*.12))+.018*np.sin(2*math.pi*u*809)+.075*np.sin(2*math.pi*(u*19+.28*np.sin(v*4)))
    texlink(mat,bs,rgba_image('R53_BobStrands',strand[:,:,None]*col[None,None,:]),hu.name,'Base Color')
    rough=np.clip(.55+.07*np.sin(2*math.pi*(u*317+.19*np.sin(v*8))),.42,.69)
    texlink(mat,bs,rgba_image('R53_BobRoughness',rough,True),hu.name,'Roughness')
    headName=next((b.name for b in rig.data.bones if b.name.lower()=='head'),None)
    if headName is None:headName=next((b.name for b in rig.data.bones if b.name.lower().endswith('head')),None)
    if headName is None:raise RuntimeError('head bone missing')
    bind(ob,[{headName:1.} for _ in V])
    values=signed(np.array(V),skinTree)
    return ob,{'vertices':len(V),'faces':len(F),'scalpSamples':(rows+1)*n,'strandTextureSize':[2048,1024],'sweptFlow':True,'freeLocks':groups,'hairStyle':'continuous layered asymmetrical bob','minRadialClearance_m':float(np.min(values)),'penetrationProxy':float(np.mean(values<-.001)),'deepPenetrationProxy':float(np.mean(values<-.003)),'visualApproved':False,'productionApproved':False,'limitations':['continuous shell study, hairline and outer silhouette require visual approval','nearest-surface metric not a complete collision guarantee']}
fittedHair,hairDiag=fitted_scalp_hair()
candidate=out/'fitted-hair-study';candidate.mkdir(exist_ok=True)
# Render actual new scalp-fitted geometry in all five views, separately from old wig.
for tag,d in views:
    render('fitted_hair_'+tag,d)
    (out/('fitted_hair_'+tag+'.png')).replace(candidate/('fitted_hair_'+tag+'.png'))
fittedHair.hide_render=True

studio=out/'studio-review';studio.mkdir(exist_ok=True)
def studio_render():
    oldEngine=scene.render.engine;oldWorld=scene.world;lights=[]
    try:
        try:scene.render.engine='BLENDER_EEVEE_NEXT'
        except Exception:scene.render.engine='BLENDER_EEVEE'
        w0=bpy.data.worlds.new('R53_StudioWorld');w0.use_nodes=True;w0.node_tree.nodes['Background'].inputs[0].default_value=(.15,.15,.15,1);w0.node_tree.nodes['Background'].inputs[1].default_value=.45;scene.world=w0
        for name,offset,power,size in [('key',(-.38,-.65,.43),19,.50),('fill',(.40,-.35,.16),7,.48),('rim',(.18,.40,.35),12,.35)]:
            dat=bpy.data.lights.new('R53_'+name,'AREA');dat.energy=power;dat.shape='DISK';dat.size=size
            ob=bpy.data.objects.new('R53_'+name,dat);bpy.context.collection.objects.link(ob);ob.location=fc+Vector(offset);ob.rotation_euler=(fc-ob.location).to_track_quat('-Z','Y').to_euler();lights.append(ob)
        fittedHair.hide_render=False
        for tag,d in [('front',(0,-1,0)),('threequarter',(.66,-1,.08))]:
            render('studio_'+tag,d);(out/('studio_'+tag+'.png')).replace(studio/('studio_'+tag+'.png'))
        # Separate lit expression renders, without replacing the 28 legacy
        # matched workbench images used by the comparison manifest.
        fittedHair.hide_render=True
        for n in ('jawOpen','viseme_A','viseme_O','laugh','smile'):
            for o in [hd]+lashes+brows+oral:o.data.shape_keys.key_blocks[n].value=1
            bpy.context.view_layer.update()
            render('pbr_'+n,(0,-1,0));(out/('pbr_'+n+'.png')).replace(studio/('pbr_'+n+'.png'))
            for o in [hd]+lashes+brows+oral:o.data.shape_keys.key_blocks[n].value=0
        bpy.context.view_layer.update()
        return {'status':'rendered','engine':scene.render.engine,'views':7}
    finally:
        fittedHair.hide_render=True
        for ob in lights:bpy.data.objects.remove(ob,do_unlink=True)
        scene.world=oldWorld;scene.render.engine=oldEngine
try:studioReport=studio_render()
except Exception as e:studioReport={'status':'failed','error':str(e)}

for name in names:
    for o in [hd]+lashes+brows+oral:o.data.shape_keys.key_blocks[name].value=1
    bpy.context.view_layer.update();render('expression_'+name,(0,-1,0))
    for o in [hd]+lashes+brows+oral:o.data.shape_keys.key_blocks[name].value=0
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
# Additional independent GLB, preserving the original head-only artifact.
fittedHair.hide_render=False;fittedHair.select_set(True)
hairDest=candidate/(ident+'_fitted_hair_head.glb')
bpy.ops.export_scene.gltf(**dict(opts,filepath=str(hairDest)))
hairDiag['sha256']=sha(hairDest);hairDiag['id']=ident
(candidate/'fitted-hair-report.json').write_text(json.dumps(hairDiag,indent=2))
fittedHair.select_set(False);fittedHair.hide_render=True

assemblyDir=out/'continuous-neck-study';assemblyDir.mkdir(exist_ok=True)
assemblyReport={'status':'not-run','productionApproved':False}
try:
    assembly,assemblyReport=neck_assembly()
    armorStudy=[]
    # Round the harsh hard edges on the licensed original armor pieces.
    # Work on copies only; transfer vertex groups with Blender's bevel.
    if female:
        for plate in plates:
            n0=len(plate.data.vertices);originalData=plate.data;backup=originalData.copy()
            try:
                if plate.data.shape_keys:raise RuntimeError('plate has morphs')
                bpy.ops.object.select_all(action='DESELECT');plate.select_set(True);bpy.context.view_layer.objects.active=plate
                weld0=plate.modifiers.new('R53 weld seams','WELD');weld0.merge_threshold=.000015
                bpy.ops.object.modifier_apply(modifier=weld0.name)
                bevel=plate.modifiers.new('R53 edge bevel','BEVEL');bevel.width=.0016;bevel.segments=3;bevel.limit_method='ANGLE';bevel.angle_limit=.35
                if hasattr(bevel,'harden_normals'):bevel.harden_normals=True
                bpy.ops.object.modifier_apply(modifier=bevel.name)
                if len(plate.data.vertices)<=n0:
                    sub=plate.modifiers.new('R53 panel refinement','SUBSURF');sub.subdivision_type='SIMPLE';sub.levels=1
                    bpy.ops.object.modifier_apply(modifier=sub.name)
                    sm=plate.modifiers.new('R53 rounded panel','SMOOTH');sm.factor=.20;sm.iterations=2
                    bpy.ops.object.modifier_apply(modifier=sm.name)
                if any(not v.groups for v in plate.data.vertices):raise RuntimeError('panel lost skin weights')
                if len(plate.data.vertices)<=n0:raise RuntimeError('no geometric refinement')
                for pol in plate.data.polygons:pol.use_smooth=True
                for mat in plate.data.materials:
                    if not mat or not mat.use_nodes:continue
                    node=next((n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED'),None)
                    if node:
                        node.inputs['Metallic'].default_value=.82
                        node.inputs['Roughness'].default_value=.34
                armorStudy.append({'name':plate.name,'before':n0,'after':len(plate.data.vertices),'status':'beveled'})
            except Exception as e:
                for md0 in list(plate.modifiers):
                    if md0.name.startswith(('R53 edge bevel','R53 weld seams','R53 panel refinement','R53 rounded panel')):plate.modifiers.remove(md0)
                plate.data=backup;armorStudy.append({'name':plate.name,'before':n0,'status':'retained-original','error':str(e)})
    assemblyReport['armorStudy']=armorStudy
    assembleParts=[assembly]+[o for o in new if o!=hd]+[fittedHair]+[o for o in parts if o!=body and o not in hair]
    for o in new+parts+[fittedHair,assembly]:o.hide_render=o not in assembleParts
    def full_render(tag,d,target,scale):
        cam.data.ortho_scale=scale;cam.location=target+Vector(d).normalized()*H*3
        cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
        scene.render.filepath=str(assemblyDir/(tag+'.png'));bpy.ops.render.render(write_still=True)
    # Render neutral rig rather than the first NLA action pose.
    for tr0 in ad.nla_tracks:tr0.mute=True
    reset()
    target=Vector((eye[0],eye[1],eye[2]-hh*1.1))
    for tag,d in [('neck_front',(0,-1,0)),('neck_side',(1,0,0)),('neck_rear',(0,1,0))]:full_render(tag,d,target,hh*5.0)
    for tag,d in [('full_front',(0,-1,0)),('full_side',(1,0,0)),('full_rear',(0,1,0)),('full_threequarter',(.66,-1,.03))]:full_render(tag,d,center,H*1.13)
    # Sample actual skeletal clips for visual motion evidence. Restore rest
    # state before exporting; the existing NLA animation clips are preserved.
    motion=[]
    for key,act in selected.items():
        if not any(v in key.lower() for v in ('walk','run','attack','idle','sprint','dodge')):continue
        ad.action=act
        lo,hi=act.frame_range;frame=float(lo+(hi-lo)*.42)
        scene.frame_set(int(frame),subframe=frame-int(frame));bpy.context.view_layer.update()
        full_render('motion_'+key.replace('/','_'),(.66,-1,.03),center,H*1.23)
        motion.append({'clip':key,'frame':frame})
        ad.action=None;reset()
    assemblyReport['motionReview']=motion
    scene.frame_set(1);reset()
    for tr0 in ad.nla_tracks:tr0.mute=False
    bpy.ops.object.select_all(action='DESELECT')
    for o in assembleParts+[rig]:o.select_set(True)
    bpy.context.view_layer.objects.active=assembly
    adest=assemblyDir/(ident+'_continuous_neck.glb')
    bpy.ops.export_scene.gltf(**dict(opts,filepath=str(adest)))
    rr=adest.read_bytes();ag=json.loads(rr[20:20+int.from_bytes(rr[12:16],'little')])
    if len(ag.get('skins',[]))!=1 or not all(any(n.lower() in a.get('name','').lower() for a in ag.get('animations',[])) for n in clips):raise RuntimeError('assembled rig/clip inventory')
    if not any(all(n in m.get('extras',{}).get('targetNames',[]) for n in names) for m in ag['meshes']):raise RuntimeError('assembled morph inventory')
    assemblyReport.update({'sha256':sha(adest),'meshCount':len(assembleParts),'exportInventoryVerified':True,'continuousNeckCandidate':True,'productionApproved':False})
except Exception as e:
    assemblyReport.update({'status':'failed','error':str(e),'continuousNeckCandidate':False,'productionApproved':False})
    print('R53 NECK CANDIDATE FAILED',str(e),flush=True)
(assemblyDir/'continuous-neck-report.json').write_text(json.dumps(assemblyReport,indent=2))

raw=dest.read_bytes();g=json.loads(raw[20:20+int.from_bytes(raw[12:16],'little')])
if len(g.get('skins',[]))!=1 or not all(any(n.lower() in a.get('name','').lower() for a in g.get('animations',[])) for n in clips):raise RuntimeError('master rig/actions')
if not any(all(n in m.get('extras',{}).get('targetNames',[]) for n in names) for m in g['meshes']):raise RuntimeError('master morph inventory')
count=len(new);bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(dest));bpy.context.view_layer.update()
rt=[o for o in bpy.context.scene.objects if o.type=='MESH' and rigof(o)]
if len(rt)!=count or len({rigof(o) for o in rt})!=1:raise RuntimeError('roundtrip inventory')
report={'id':ident,'sourceSHA256':rec['sha256'],'masterSourceSHA256':sha(master),'sha256':sha(dest),'masterSkinVertices':len(Q),'masterSkinTriangles':len(ST),'eyeMeshes':4,'irisSurfaceFit':eyeFit,'exposure':exposureReport,'sourceEyeCenters_m':{k:v.tolist() for k,v in srcEye.items()},'targetEyeCenters_m':{k:v.tolist() for k,v in dstEye.items()},'scaleXYZ':scale.tolist(),'transferDistanceP95_m':float(np.quantile(dist,.95)),'neckSectionCandidates':seams,'morphs':reports,'combinedMorphs':combos,'clips':clips,'lashMeshes':len(lashes),'browMeshes':len(brows),'brows':browReports,'facialProfile':profile_report,'pbrMaterialStudy':pbrReport,'studioReview':studioReport,'continuousNeckStudy':assemblyReport,'roundTrip':True,'continuousNeckIntegrated':False,'oralCavityIntegrated':False,'oralCandidates':oralReports,'mouthLandmarks':mouthLandmarks,'mouthSurfaceDiagnostics':mouthMetrics,'jawRotationAngles_rad':jawAngles,'hairFitApproved':False,'visualApproved':False,'productionApproved':False,'protectedR6Used':False,'limitations':['independent master head study; source head has bounded sex-specific jaw and cheek profile, not final likeness','original body not modified or included','no validated continuous neck seam or true oral opening; dental and tongue candidates and eyebrow fibres require visual approval','original hair comparison only, no fit change','morph transfer and eyelid exposure diagnostic, not closure approval']}
(out/'master-head-report.json').write_text(json.dumps(report,indent=2));print('R53 MASTER HEAD',ident,'verts',len(Q),'eyes',4,'lash meshes',len(lashes),'visible',[x['visibleSamples'] for x in exposureReport],'seam candidates',len(seams),flush=True)
