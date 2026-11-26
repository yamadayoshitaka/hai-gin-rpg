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
r53_clip_actions={}
for n in clips:
    a=[v for k,v in acts.items() if n.lower() in k.lower()]
    if len(a)!=1:raise RuntimeError('clip '+n)
    r53_clip_actions[n]=a[0];a[0].use_fake_user=True
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
# Pin the actual illustration and the visible-only 2D annotation.
# Single oblique view cannot establish true metric depth.
referencePath=Path('data/r53-female-portrait-landmarks.json')
reference=json.loads(referencePath.read_text())
referenceBytes=Path(reference['image']).read_bytes()
if hashlib.sha1(('blob '+str(len(referenceBytes))+chr(0)).encode()+referenceBytes).hexdigest()!=reference['gitBlob']:raise RuntimeError('portrait source drift')
(out/'portrait-reference.webp').write_bytes(referenceBytes)
rp2={k:np.array(v,dtype=float) for k,v in reference['points'].items()}
eyePx=float(np.linalg.norm(rp2['eye_far_center']-rp2['eye_near_center']))
def ratio(a,b):return float(np.linalg.norm(rp2[a]-rp2[b])/eyePx)
portraitRatios={'nearEyeWidth':ratio('eye_near_outer','eye_near_inner'),'nearEyeHeight':ratio('eye_near_upper','eye_near_lower'),'browEyeGap':ratio('brow_near_mid','eye_near_center'),'lipWidth':ratio('lip_near_corner','lip_far_corner'),'lipHeight':ratio('lip_upper_peak_near','lip_lower_center'),'noseMouth':ratio('nose_base','lip_center'),'mouthChin':ratio('lip_center','chin'),'crownToChin':ratio('hair_crown','chin'),'hairVisibleLength':ratio('hair_crown','hair_left_lower_visible'),'braidLength':ratio('braid_start','braid_end')}
referenceReport={'source':reference['image'],'gitBlob':reference['gitBlob'],'pixelLandmarks':len(rp2),'ratios':portraitRatios,'camera':reference['camera'],'unobserved':reference['unobserved'],'approximate':True,'orthographicFit':False}
Dprofile=np.zeros_like(Q0)
Dprofile[:,0]=(Q0[:,0]-eye[0])*((-.19 if female else .085)*jaw+(.045 if female else -.012)*cheek+(-.13 if female else .035)*bridge+(-.10 if female else .035)*alar)
Dprofile[:,1]=gap*((.055 if female else -.035)*chin+(-.037 if female else .022)*cheek+(.035 if female else -.018)*noseTip+(.012 if female else -.010)*philtrum)
Dprofile[:,2]=gap*((.085 if female else -.027)*chin+(.025 if female else -.008)*lip)
# Keep the neck seam geometry fixed; avoid changing the eye sockets.
neckLock=np.clip((Z+1.90)/.32,0,1);neckLock=neckLock*neckLock*(3-2*neckLock)
if female:
    # Full jaw arc, including the lateral mandible, instead of a small
    # central-front mask. Preserve the neck cut and orbital support.
    jside=ga(Z,-1.09,.40)*ga(np.abs(X),.82,.38)*np.clip((.66-Y)/.90,0,1)
    Dprofile[:,0]-=.095*(Q0[:,0]-eye[0])*jside
    Dprofile[:,2]+=gap*.045*ga(Z,-1.48,.27)*ga(X,0,.66)*front
    Dprofile[:,1]+=gap*.035*ga(Z,-.91,.24)*ga(X,0,.30)*front
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

# Independent synthetic nine-view concept. Coordinates are normalized by
# eye separation in front and eye-to-chin height in each side view.
# The old portrait is preserved as provenance, not the new design target.
nine=json.loads(Path('data/r53-female-nine-view-design.json').read_text())
nv=nine['views'];fp={k:np.array(v,float) for k,v in nv['front']['p'].items()}
ipd=float(np.linalg.norm(fp['eye_right']-fp['eye_left']))
fc2=(fp['eye_left']+fp['eye_right'])/2
def frontHeight(k):return float((fc2[1]-fp[k][1])/ipd)
def frontWidth(a,b):return float(abs(fp[a][0]-fp[b][0])/ipd)
def sideDepth(k):
    ds=[]
    for v,sgn in (('left',-1),('right',1)):
        p=nv[v]['p'];h=abs(p['chin'][1]-p['eye'][1])
        ds.append(sgn*(p[k][0]-p['eye'][0])/h*abs(frontHeight('chin')))
    return float(np.mean(ds))
designMetrics={'eyeWidth':frontWidth('eye_left_outer','eye_left_inner'),'browGap':float((fp['eye_left'][1]-fp['brow_left_mid'][1])/ipd),'noseWidth':frontWidth('nose_left','nose_right'),'lipWidth':frontWidth('lip_left','lip_right'),'lipHeight':float((fp['lower_lip'][1]-fp['upper_lip'][1])/ipd),'jawWidth':frontWidth('jaw_left','jaw_right'),'cheekWidth':frontWidth('cheek_left','cheek_right'),'noseHeight':frontHeight('nose_tip'),'mouthHeight':frontHeight('mouth'),'chinHeight':frontHeight('chin'),'noseProjection':sideDepth('nose_tip'),'mouthProjection':sideDepth('mouth'),'chinProjection':sideDepth('chin'),'hairDrop':float((fp['hair_right_end'][1]-fp['chin'][1])/ipd),'hairWidth':frontWidth('hair_left','hair_right')}
detail=json.loads(Path('data/r53-female-detail-landmarks.json').read_text())
df={k:np.asarray(v,float) for k,v in detail['views']['front'].items()}
detailIPD=float(np.linalg.norm(df['irisR'][0]-df['irisL'][0]))
def span(a):return float(np.ptp(a[:,0])/detailIPD)
def angle(a,b):return float(np.degrees(np.arctan2(b[1]-a[1],b[0]-a[0])))
def internal(a,b,c):
    u=a-b;v=c-b
    return float(np.degrees(np.arccos(np.clip(np.dot(u,v)/(np.linalg.norm(u)*np.linalg.norm(v)),-1,1))))
dm={}
for label in ('L','R'):
    U0=df['eye'+label+'Upper'];L0=df['eye'+label+'Lower'];bu=df['brow'+label+'Top'];bl=df['brow'+label+'Bottom']
    dm[label]={'eyeWidth':span(U0),'eyeHeight':float((L0[:,1].max()-U0[:,1].min())/detailIPD),'eyeTiltDeg':angle(U0[0],U0[-1]),'browWidth':span(bu),'browGap':float((U0[:,1].min()-bl[:,1].mean())/detailIPD),'browThickness':float(np.mean(bl[:,1]-bu[:,1])/detailIPD),'browCurve':((bu+bl)*.5).tolist(),'upperLashLength':float(np.median(np.linalg.norm(df['lash'+label+'Tips']-df['lash'+label+'Roots'],axis=1))/detailIPD),'lowerLashLength':float(np.median(np.linalg.norm(df['lowerLash'+label+'Tips']-df['lowerLash'+label+'Roots'],axis=1))/detailIPD),'underEyeWidth':span(df['underEye'+label]),'underEyeDrop':float((df['underEyeOuter'+label][:,1].mean()-df['iris'+label][0,1])/detailIPD)}
dm['mouthWidth']=span(df['lipSeam']);dm['upperLipThickness']=float((df['lipSeam'][3,1]-df['lipTop'][3,1])/detailIPD);dm['lowerLipThickness']=float((df['lipBottom'][3,1]-df['lipSeam'][3,1])/detailIPD)
dm['noseWidth']=span(df['noseAlar']);dm['philtrumLength']=float((df['philtrum'][-1,1]-df['philtrum'][0,1])/detailIPD)
dm['profile']={}
for v,sgn in (('left',-1),('right',1)):
    q={k:np.asarray(a,float) for k,a in detail['views'][v].items()};norm=abs(q['chin'][0,1]-q['eye'][0,1])
    dm['profile'][v]={'noseBridgeDeg':angle(q['noseRoot'][0],q['noseTip'][0]),'noseLipRelative':float(sgn*(q['upperLip'][0,0]-q['noseTip'][0,0])/norm),'noseChinRelative':float(sgn*(q['chin'][0,0]-q['noseTip'][0,0])/norm),'lowerLipRelative':float(sgn*(q['lowerLip'][0,0]-q['upperLip'][0,0])/norm),'jawContourAngleDeg':internal(q['jaw'][0],q['jaw'][4],q['jaw'][-1]),'jawChinToNeckSlopeDeg':angle(q['jaw'][0],q['neckJoin'][0]),'cheekShadingLandmarks':q['cheekShading'].tolist()}
dreport={'pointCount':detail['pointCount'],'metrics':dm,'colorSamples':detail['colorSamples'],'sourceSHA256':detail['sourceSHA256'],'uncertainty':detail['uncertainty'],'applied':[],'visualApproved':False}
nineReport={'sourceSHA256':nine['sha256'],'pointCount':nine['pointsCount'],'views':list(nv),'metrics':designMetrics,'synthetic':True,'calibratedOrthographic':False,'fitViews':['front','left','right'],'reviewOnlyViews':['rear','top','bottom','front_left_45','front_right_45','rear_left_45'],'fullBodyReference':False}
# Calibrate a provisional weak-perspective camera from actual eye centers
# and visible midline landmarks. Search yaw/pitch; the image is oblique,
# so only screen-space residuals are fitted, not claimed as 3D measures.
if female:
    qbase=Q0+Dprofile
    def vertex_at(mask,score):
        ids=np.flatnonzero(mask)
        if not len(ids):raise RuntimeError('portrait landmark region missing')
        return int(ids[np.argmin(score[ids])])
    noseI=vertex_at((np.abs(X)<.20)&(Z>-.92)&(Z<-.30),qbase[:,1])
    chinI=vertex_at((np.abs(X)<.20)&(Z<-1.15)&(Z>-1.78)&(Y<-.10),qbase[:,2]+.25*qbase[:,1])
    mouthI=vertex_at((np.abs(X)<.10)&(Z<-.84)&(Z>-1.28),qbase[:,1]+gap*.3*np.abs(Z+1.10))
    eyes3=np.array(sorted(dstEye.values(),key=lambda v:v[0]))
    obs=np.array([rp2[k] for k in ('eye_near_center','eye_far_center','nose_tip','lip_center','chin')])
    anchors=np.vstack([eyes3,qbase[[noseI,mouthI,chinI]]])
    best=None
    for yaw0 in np.linspace(-.72,.72,25):
        for pitch0 in np.linspace(-.40,.40,17):
            right=np.array([math.cos(yaw0),math.sin(yaw0),0.])
            fwd=np.array([math.sin(yaw0),-math.cos(yaw0),0.])
            up=np.array([0.,0.,1.])*math.cos(pitch0)+fwd*math.sin(pitch0)
            B=np.vstack([right,-up]);src2=(anchors-eye)@B.T
            v=src2[1]-src2[0];u=obs[1]-obs[0];sv=np.linalg.norm(v)
            if sv<1e-6:continue
            theta=math.atan2(u[1],u[0])-math.atan2(v[1],v[0]);R=np.array([[math.cos(theta),-math.sin(theta)],[math.sin(theta),math.cos(theta)]])
            M=R@B*(np.linalg.norm(u)/sv)
            tr=obs[:2].mean(0)-(anchors[:2]-eye).mean(0)@M.T
            err=float(np.mean(np.linalg.norm((anchors-eye)@M.T+tr-obs,axis=1)**2))
            if best is None or err<best[0]:best=(err,M,tr,float(yaw0),float(pitch0))
    err,M,tr,yaw0,pitch0=best
    fitD=np.zeros_like(Q0)
    for j,(idx,spread) in enumerate(((noseI,.22),(mouthI,.27),(chinI,.34))):
        target=obs[j+2];cur=(qbase[idx]-eye)@M.T+tr
        step=np.linalg.pinv(M)@(target-cur)
        step*=min(1.,gap*.075/max(np.linalg.norm(step),1e-9))
        dist0=np.linalg.norm((qbase-qbase[idx])/gap,axis=1)
        mask=np.exp(-(dist0/spread)**2)*front*(1-orbital)**3*neckLock
        fitD+=mask[:,None]*step*.65
    # Replace single portrait correction with front and side constraints
    # from the new design. Existing source anatomy stays intact.
    fitD=np.zeros_like(Q0);baseAnchors=qbase[[noseI,mouthI,chinI]]
    targets=np.array([[eye[0],eye[1]-gap*designMetrics['noseProjection'],eye[2]+gap*designMetrics['noseHeight']],[eye[0],eye[1]-gap*designMetrics['mouthProjection'],eye[2]+gap*designMetrics['mouthHeight']],[eye[0],eye[1]-gap*designMetrics['chinProjection'],eye[2]+gap*designMetrics['chinHeight']]])
    for idx,target,spread in zip((noseI,mouthI,chinI),targets,(.22,.29,.39)):
        step=target-qbase[idx];step*=min(1.,gap*.16/max(np.linalg.norm(step),1e-9))
        ds=np.linalg.norm((qbase-qbase[idx])/gap,axis=1)
        fitD+=np.exp(-(ds/spread)**2)[:,None]*step*.80*(front*(1-orbital)**3*neckLock)[:,None]
    # Projected jaw width vs current actual horizontal cross section.
    jmask=(Z<-1.0)&(Z>-1.46)&(Y<.0)
    measured=float(np.ptp(qbase[jmask,0])/gap) if jmask.any() else designMetrics['jawWidth']
    k0=float(np.clip(designMetrics['jawWidth']/max(measured,.01)-1,-.16,.12))
    fitD[:,0]+=k0*(Q0[:,0]-eye[0])*jaw
    Dprofile+=fitD
    # Local nose alar/lip breadth and relative sagittal shape; preserve
    # orbital centers, seam and mouth topology. Measure selected vertices,
    # not arbitrary target counts.
    local0=Q0+Dprofile
    nmask=(np.abs(X)<.48)&(Z<-.48)&(Z>-.92)&(Y<-.10)
    lmask=(np.abs(X)<.62)&(Z<- .91)&(Z>-1.32)&(Y<-.10)
    def widthFactor(mask,target):
        if mask.sum()<5:return 0.
        return float(np.clip(target/max(float(np.ptp(local0[mask,0])/gap),.01)-1,-.12,.12))
    nf=widthFactor(nmask,dm['noseWidth']);lf=widthFactor(lmask,dm['mouthWidth'])
    fineD=np.zeros_like(Q0)
    fineD[:,0]=(Q0[:,0]-eye[0])*(nf*ga(Z,-.73,.19)*ga(X,0,.40)+lf*ga(Z,-1.12,.16)*ga(X,0,.53))*front
    ph=np.mean([v['noseLipRelative'] for v in dm['profile'].values()]);ch=np.mean([v['noseChinRelative'] for v in dm['profile'].values()])
    height0=abs(designMetrics['chinHeight'])*gap
    for idx,rel,spread in ((mouthI,ph,.24),(chinI,ch,.32)):
        targetY=local0[noseI,1]-rel*height0
        fineD[:,1]+=np.clip(targetY-local0[idx,1],-gap*.055,gap*.055)*np.exp(-(np.linalg.norm((local0-local0[idx])/gap,axis=1)/spread)**2)*front
    # Cheek shading points are not depth; measure actual cheek surface
    # and apply only a bounded smooth contour transition, not a fabricated target.
    cheekIds=np.flatnonzero((np.abs(X)>.55)&(np.abs(X)<1.0)&(Z<-.28)&(Z>-.75)&(Y<-.1))
    dreport['cheekDepthBeforeRange_m']=[float(local0[cheekIds,1].min()),float(local0[cheekIds,1].max())] if len(cheekIds) else None
    fineD*=((1-orbital)**3*neckLock)[:,None];Dprofile+=fineD
    dreport['applied']=['nose breadth proxy','lip breadth proxy','relative nose/lip/chin sagittal offsets']
    dreport['shapeCorrection']={'noseWidthFactor':nf,'lipWidthFactor':lf,'maxDisplacement_m':float(np.linalg.norm(fineD,axis=1).max())}
    nineReport.update({'preFitMidlineRms_m':float(np.sqrt(np.mean(np.sum((baseAnchors-targets)**2,axis=1)))),'targetMidline_m':targets.tolist(),'appliedJawWidthFactor':k0,'appliedFeatures':['nose','mouth','chin','jaw'],'sourceJawWidthRatio':measured})
    referenceReport.update({'cameraYaw_rad':yaw0,'cameraPitch_rad':pitch0,'preFitRms_px':float(math.sqrt(err)),'fittedFeatures':['nose_tip','lip_center','chin'],'maxPortraitDisplacement_m':float(np.linalg.norm(fitD,axis=1).max()),'landmarkIndices':[noseI,mouthI,chinI]})
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
# Fit the actual projected cheek/jaw outline using the detailed traced
# front and bilateral profiles. Keep projection targets separate from
# unobservable anatomical bone angle and cheek depth.
def fit_lower_outline(A):
    ed=np.unique(np.sort(np.concatenate((ST[:,[0,1]],ST[:,[1,2]],ST[:,[2,0]])),axis=1),axis=0)
    p0=A[ed[:,0]];p1=A[ed[:,1]]
    def slice_points(V,axis,pos):
        a=V[ed[:,0]];b=V[ed[:,1]];u=a[:,axis]-pos;v=b[:,axis]-pos
        k=(u*v<0)
        return a[k]+(b[k]-a[k])*(u[k]/(u[k]-v[k]))[:,None]
    origin2=(df['irisL'][0]+df['irisR'][0])*.5
    lf=np.vstack((df['cheekL'],df['jawL']));rf=np.vstack((df['cheekR'],df['jawR']))
    # The lower tip is intentionally left to the sagittal silhouette fit.
    # Trace widths at 13 rows, relative to inter-pupil distance.
    ys=np.linspace(max(lf[0,1],rf[0,1])+2,min(lf[-1,1],rf[-1,1])-5,13)
    zRows=eye[2]-(ys-origin2[1])*gap/detailIPD
    targetL=eye[0]+(np.interp(ys,lf[:,1],lf[:,0])-origin2[0])*gap/detailIPD
    targetR=eye[0]+(np.interp(ys,rf[:,1],rf[:,0])-origin2[0])*gap/detailIPD
    # Side-view eye point is the visible eye, not its skeletal centre.
    # Use original globe anterior surface as an approximate origin.
    eyeFront=float(np.mean([mapP(pts(eyes[('sclera',k)]))[:,1].min() for k in ('L','R')]))
    sideCurves=[]
    for label,sign0 in (('left',1.),('right',-1.)):
        d=detail['views'][label];p=np.asarray(d['jaw'],float);e=np.asarray(d['eye'][0],float)
        # Independent vertical calibration from front eye-to-lowest-chin.
        scl=abs(float(np.mean(df['chin'][:,1])-origin2[1]))*gap/detailIPD/max(abs(p[0,1]-e[1]),1.)
        q=np.column_stack([eyeFront+(p[:,0]-e[0])*sign0*scl,eye[2]-(p[:,1]-e[1])*scl])
        q=q[np.argsort(q[:,0])];sideCurves.append(q)
    # Use the anterior under-jaw segment only. Posterior jaw line in a
    # drawing is not necessarily the visible silhouette or bone.
    yLo=max(q[0,0] for q in sideCurves);yHi=min(q[-1,0] for q in sideCurves)
    if yHi<=yLo:raise RuntimeError('invalid side jaw calibration')
    yRows=np.linspace(yLo+.07*(yHi-yLo),yLo+.50*(yHi-yLo),9)
    tz=np.mean([np.interp(yRows,q[:,0],q[:,1]) for q in sideCurves],axis=0)
    def measure(V):
        left=[];right=[];low=[]
        for z in zRows:
            q=slice_points(V,2,z);q=q[q[:,1]<eye[1]+gap*.60]
            left.append(float(q[:,0].min()) if len(q) else float('nan'))
            right.append(float(q[:,0].max()) if len(q) else float('nan'))
        for y in yRows:
            q=slice_points(V,1,y);q=q[(q[:,2]>eye[2]-gap*1.95)&(q[:,2]<eye[2]-gap*.90)]
            low.append(float(q[:,2].min()) if len(q) else float('nan'))
        return np.asarray(left),np.asarray(right),np.asarray(low)
    base=measure(A)
    masks=[np.isfinite(v) for v in base]
    if min(m.sum() for m in masks)<5:raise RuntimeError('insufficient actual jaw contour samples')
    targets=(targetL,targetR,tz)
    def error(vals):
        e=[]
        for v,t,k in zip(vals,targets,masks):
            if not np.isfinite(v[k]).all():return 1e3
            e.extend((v[k]-t[k])/gap)
        return float(np.sqrt(np.mean(np.square(e))))
    def inter(x,v,d,k):
        return np.interp(x,v[k][::-1] if v[0]>v[-1] else v[k],d[k][::-1] if v[0]>v[-1] else d[k])
    x0=(A[:,0]-eye[0])/gap;y0=(A[:,1]-eye[1])/gap;z0=(A[:,2]-eye[2])/gap
    # Attenuate near the nose/eye/ear and lower neck cut.
    depth=np.clip((.65-y0)/.60,0.,1.)
    vertical=np.clip((-z0-.23)/.30,0.,1.)*np.clip((z0+1.98)/.23,0.,1.)
    widthD=np.zeros_like(A)
    for side0,target,actual,k in ((-1,targetL,base[0],masks[0]),(1,targetR,base[1],masks[1])):
        dx=inter(A[:,2],zRows,target-actual,k)
        sideMask=np.clip((side0*x0-.22)/.52,0.,1.)
        widthD[:,0]+=np.clip(dx,-gap*.20,gap*.20)*sideMask*depth*vertical
    dz=inter(A[:,1],yRows,tz-base[2],masks[2])
    # Lower-jaw support moves under the chin, not the lips, eyes or neck.
    old=inter(A[:,1],yRows,base[2],masks[2])
    under=np.exp(-((A[:,2]-old)/(gap*.18))**2)
    yfade=np.clip((yHi-A[:,1])/(gap*.35),0.,1.)*np.clip((A[:,1]-yLo+gap*.20)/(gap*.20),0.,1.)
    jawD=np.zeros_like(A);jawD[:,2]=np.clip(dz,-gap*.14,gap*.14)*under*yfade*vertical
    # Test different amounts of each independent correction. Reject folds
    # against the untouched master topology, not just the modified baseline.
    best=A.copy();bestVal=base;bestErr=error(base);initial=bestErr;tries=[]
    for w0 in (0.,.35,.65,1.):
        for j0 in (0.,.35,.65,1.):
            if w0==j0==0:continue
            C=A+w0*widthD+j0*jawD
            N=profile_norm(C)
            if np.any(pv&((np.sum(pn*N,axis=1)<=0)|(np.linalg.norm(N,axis=1)<.15*pa))):continue
            cur=measure(C);e=error(cur);tries.append({'widthStrength':w0,'underJawStrength':j0,'rmsRatio':e})
            if e<bestErr:best=C;bestVal=cur;bestErr=e
    def finite_list(v):return [float(x) if np.isfinite(x) else None for x in v]
    def per(v,t,k):return float(np.sqrt(np.mean(np.square(v[k]-t[k])))*1000)
    rep={'method':'triangle edge cross-section, projected front cheek/jaw and bilateral anterior under-jaw traces',
         'beforeRmsRatio':initial,'afterRmsRatio':bestErr,'applied':bestErr<initial-1e-8,
         'frontZ_m':zRows.tolist(),'sideY_m':yRows.tolist(),'curveLabels':['front_left','front_right','side_underjaw'],
         'target_m':[finite_list(x) for x in targets],'before_m':[finite_list(x) for x in base],'after_m':[finite_list(x) for x in bestVal],
         'beforeRmsMm':[per(v,t,k) for v,t,k in zip(base,targets,masks)],'afterRmsMm':[per(v,t,k) for v,t,k in zip(bestVal,targets,masks)],
         'maxDisplacementMm':float(np.linalg.norm(best-A,axis=1).max()*1000),'attempts':tries,
         'unresolved':['true cheek depth absent from synthetic image','skeletal mandibular angle not determined by skin trace','posterior jaw and neck shape require independent reference'],
         'visualApproved':False}
    return best,rep
if female:
    Q,dreport['lowerOutlineFit']=fit_lower_outline(Q)
# Fit the measured visible eyelid curves, rather than preserving an
# arbitrarily small aperture. Globes remain centered on the eye bones.
# A bounded candidate search uses actual front-ray visibility and rejects
# mesh inversions. The synthetic image cannot override safe globe size.
eyeScaleFactors={k:1. for k in ('L','R')}
if female:
    QbaseEye=Q.copy()
    tris0=[tuple(int(i) for i in t) for t in ST]
    def skin_bvh(A):return BVHTree.FromPolygons([Vector(p) for p in A],tris0,all_triangles=True)
    def globe_bvh(side,factor):
        o=eyes[('sclera',side)];A=mapP(pts(o));c=dstEye[side];A=c+(A-c)*factor
        return BVHTree.FromPolygons([Vector(p) for p in A],[tuple(int(i) for i in t) for t in tri(o)],all_triangles=True)
    def aperture(A,side,factor,st0=None):
        c=dstEye[side];st0=st0 or skin_bvh(A);gt=globe_bvh(side,factor)
        xs=np.linspace(c[0]-gap*.33,c[0]+gap*.33,53);zs=np.linspace(c[2]-gap*.23,c[2]+gap*.23,43)
        hits=[]
        for x0 in xs:
            for z0 in zs:
                origin=Vector((x0,float(Q0[:,1].min()-.08),z0))
                e,_,_,ed=gt.ray_cast(origin,Vector((0,1,0)),.4);a,_,_,sd=st0.ray_cast(origin,Vector((0,1,0)),.4)
                if e is not None and (a is None or ed<sd-.00005):hits.append((x0,z0))
        return np.array(hits).reshape(-1,2)
    def aperture_metric(G,side):
        lab='L' if dstEye[side][0]<eye[0] else 'R'
        if len(G)<10:return 100.,{'samples':len(G)}
        c=dstEye[side];U0=df['eye'+lab+'Upper'];L0=df['eye'+lab+'Lower'];o=df['iris'+lab][0]
        U1=np.column_stack([c[0]+(U0[:,0]-o[0])*gap/detailIPD,c[2]-(U0[:,1]-o[1])*gap/detailIPD])
        L1=np.column_stack([c[0]+(L0[:,0]-o[0])*gap/detailIPD,c[2]-(L0[:,1]-o[1])*gap/detailIPD])
        w0,h0=np.ptp(G,axis=0)/gap
        err=abs(w0-dm[lab]['eyeWidth'])+abs(h0-dm[lab]['eyeHeight'])
        # Compare actual top/bottom envelopes over their common x domain.
        e=[]
        for x0 in np.unique(G[:,0]):
            z0=G[np.abs(G[:,0]-x0)<1e-9,1]
            if U1[0,0]<=x0<=U1[-1,0]:
                e.extend([abs(z0.max()-np.interp(x0,U1[:,0],U1[:,1])),abs(z0.min()-np.interp(x0,L1[:,0],L1[:,1]))])
        rms=float(np.sqrt(np.mean(np.square(e)))/gap) if e else 1.
        return float(err+rms),{'samples':len(G),'widthRatio':float(w0),'heightRatio':float(h0),'curveRmsRatio':rms,'targetWidth':dm[lab]['eyeWidth'],'targetHeight':dm[lab]['eyeHeight']}
    initialTree=skin_bvh(QbaseEye);originalA={side:aperture(QbaseEye,side,1.,initialTree) for side in ('L','R')}
    bestQ=QbaseEye.copy();bestFactor=1.;bestErr=sum(aperture_metric(originalA[k],k)[0] for k in originalA);beforeErr=bestErr;attempts=[]
    # Warp local vertices according to the sampled reference upper/lower
    # contours. Taper influence beyond orbital rim and preserve skin depth.
    # Search separately along horizontal and vertical axes; bounded ocular
    # aspect ratios avoid unrestricted eyeball enlargement. The prior
    # candidate remains in the search as an exact regression baseline.
    for factor in (1.,1.12,1.22,(1.28,1.18,1.18),(1.32,1.18,1.18),(1.35,1.22,1.22),(1.38,1.22,1.22)):
        for strength in (.25,.35,.45,.55,.65,.75,1.):
            delta=np.zeros_like(QbaseEye)
            for side in ('L','R'):
                G=originalA[side]
                if len(G)<10:continue
                c=dstEye[side];lab='L' if c[0]<eye[0] else 'R';u0=df['eye'+lab+'Upper'];l0=df['eye'+lab+'Lower'];o=df['iris'+lab][0]
                x0,x1=G[:,0].min(),G[:,0].max();gx=np.unique(G[:,0]);gzU=np.array([G[G[:,0]==x,1].max() for x in gx]);gzL=np.array([G[G[:,0]==x,1].min() for x in gx])
                t=np.clip((QbaseEye[:,0]-x0)/max(x1-x0,.001),0,1)
                tx=c[0]+(u0[0,0]+t*(u0[-1,0]-u0[0,0])-o[0])*gap/detailIPD
                if isinstance(factor,tuple):
                    # Preserve the exterior coordinate offset rather than
                    # collapsing the surrounding orbital rim toward a corner.
                    tx+=QbaseEye[:,0]-(x0+t*(x1-x0))
                uPx=u0[0,0]+t*(u0[-1,0]-u0[0,0])
                zu=c[2]-(np.interp(uPx,u0[:,0],u0[:,1])-o[1])*gap/detailIPD
                zl=c[2]-(np.interp(uPx,l0[:,0],l0[:,1])-o[1])*gap/detailIPD
                oldU=np.interp(QbaseEye[:,0],gx,gzU);oldL=np.interp(QbaseEye[:,0],gx,gzL)
                w=np.clip((QbaseEye[:,2]-oldL)/np.maximum(oldU-oldL,.002),0,1)
                zt=w*(zu-oldU)+(1-w)*(zl-oldL)
                wx=np.exp(-((QbaseEye[:,0]-c[0])/(gap*(.36 if isinstance(factor,tuple) else .32)))**4)
                wz=np.exp(-((QbaseEye[:,2]-c[2])/(gap*.28))**4)
                wy=np.clip((c[1]-QbaseEye[:,1]+gap*.04)/(gap*.19),0,1)
                weight=wx*wz*wy
                delta[:,0]+=np.clip(tx-QbaseEye[:,0],-gap*.13,gap*.13)*weight*strength
                delta[:,2]+=np.clip(zt,-gap*.10,gap*.10)*weight*strength
            candidate=QbaseEye+delta
            n1=profile_norm(candidate)
            if np.any(pv&((np.sum(pn*n1,axis=1)<=0)|(np.linalg.norm(n1,axis=1)<.15*pa))):continue
            t0=skin_bvh(candidate);met={k:aperture_metric(aperture(candidate,k,factor,t0),k) for k in ('L','R')}
            err=sum(x[0] for x in met.values());attempts.append({'globeScale':factor,'warpStrength':strength,'error':err,'eyes':{k:x[1] for k,x in met.items()}})
            if err<bestErr:bestErr=err;bestFactor=factor;bestQ=candidate
    # Independently refine the canthi without increasing globe size.
    refinement=[]
    def score_refinement(A,side):
        sk=skin_bvh(A);gt=globe_bvh(side,bestFactor)
        O=mapP(pts(eyes[('sclera',side)]));c=dstEye[side];O=c+(O-c)*bestFactor
        lo=O.min(0);hi=O.max(0);G=[]
        for x in np.linspace(lo[0],hi[0],33):
            for z in np.linspace(lo[2],hi[2],33):
                org=Vector((x,float(Q0[:,1].min()-.3),z))
                e,_,_,ed=gt.ray_cast(org,Vector((0,1,0)),1.)
                a,_,_,sd=sk.ray_cast(org,Vector((0,1,0)),1.)
                if e is not None and (a is None or ed<sd-.00005):G.append((x,z))
        if len(G)<10:return 100.,{}
        lab='L' if dstEye[side][0]<eye[0] else 'R'
        ww,hh=np.ptp(np.array(G),axis=0)/gap
        we=abs(ww/dm[lab]['eyeWidth']-1);he=abs(hh/dm[lab]['eyeHeight']-1)
        er,met=aperture_metric(aperture(A,side,bestFactor,sk),side)
        return float(we+he+3*(max(0.,we-.12)+max(0.,he-.12))+er),{'widthError':float(we),'heightError':float(he),'widthRatio':float(ww),'heightRatio':float(hh),'curve':met}
    for side in ('L','R'):
        A0=bestQ.copy();baseScore,baseMetric=score_refinement(A0,side)
        localBest=A0;localScore=baseScore;canthus_candidate={'stretch':0.,'relief_m':0.,'metrics':baseMetric}
        c=dstEye[side];dx=A0[:,0]-c[0];dz=A0[:,2]-c[2]
        weight=np.exp(-(dx/(gap*.31))**4-(dz/(gap*.18))**4)*np.clip((c[1]-A0[:,1]+gap*.045)/(gap*.16),0,1)
        corner=np.exp(-((np.abs(dx)-gap*.20)/(gap*.075))**2)
        if baseMetric.get('widthError',1.)>.12:
            for stretch in (0.,.05,.10,.15,.20):
                for relief in (0.,.00035,.0007,.00105,.0014):
                    C=A0.copy();C[:,0]+=stretch*dx*weight;C[:,1]+=relief*corner*weight
                    n1=profile_norm(C)
                    if np.any(pv&((np.sum(pn*n1,axis=1)<=0)|(np.linalg.norm(n1,axis=1)<.15*pa))):continue
                    score,metric=score_refinement(C,side)
                    if metric.get('heightError',1.)>max(.12,baseMetric.get('heightError',1.))+1e-8:continue
                    if metric.get('widthError',1.)>baseMetric.get('widthError',1.)+1e-8:continue
                    if score<localScore-1e-8:
                        localBest=C;localScore=score;canthus_candidate={'stretch':stretch,'relief_m':relief,'metrics':metric}
        bestQ=localBest;refinement.append({'side':side,'before':baseMetric,'selected':canthus_candidate,'beforeScore':baseScore,'afterScore':localScore})
    Q=bestQ;eyeScaleFactors={k:bestFactor for k in ('L','R')}
    dreport['eyelidCurveFit']={'beforeError':beforeErr,'afterError':bestErr,'globeScale':bestFactor,'attempts':attempts,'canthusRefinement':refinement,'applied':bool(bestErr<beforeErr-1e-8),'initialEyes':{k:aperture_metric(originalA[k],k)[1] for k in originalA},'limitation':'synthetic projected target; topology and globe scale constrain fit'}
if female:
    after=np.vstack([eyes3,Q[[noseI,mouthI,chinI]]])
    referenceReport['postFitRms_px']=float(np.sqrt(np.mean(np.linalg.norm((after-eye)@M.T+tr-obs,axis=1)**2)))
    referenceReport['acceptedProfileScale']=profile_factor
    nineReport['postFitMidlineRms_m']=float(np.sqrt(np.mean(np.sum((Q[[noseI,mouthI,chinI]]-targets)**2,axis=1))))
    nineReport['profileScale']=profile_factor
    dreport['profileScale']=profile_factor
    dreport['cheekDepthAfterRange_m']=[float(Q[cheekIds,1].min()),float(Q[cheekIds,1].max())] if len(cheekIds) else None
(out/'nine-view-fit-report.json').write_text(json.dumps(nineReport,indent=2))
(out/'portrait-landmark-report.json').write_text(json.dumps(referenceReport,indent=2))
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
    # Sampled RGB difference includes the original lighting. Apply a small
    # bounded fraction as albedo shading; do not mistake it for skin depth.
    cs=detail['colorSamples'];diff=np.mean([np.array(cs[k+'_cheek']['rgb'])-np.array(cs[k+'_under_eye']['rgb']) for k in ('left','right')],axis=0)/255
    for side0,u0 in (('L',.403),('R',.597)):
        v0=ev-dm[side0]['underEyeDrop']*gap/height
        mask=field(u0,v0,float(np.clip(dm[side0]['underEyeWidth']*.09,.025,.045)),.018)
        C-=mask[:,:,None]*np.clip(diff*.24,0,.055)
    dreport['applied'].append('bounded sampled under-eye colour gradient')
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
        wx=np.exp(-(xx/.39)**6);wf=smooth01((-.02-yy)/.28)
        # Independent lip separation field: all folded tissue follows the
        # lip on its own side, not a mask that pins the inner lip to zero.
        # Keep the exterior chin short and avoid the old frowning jaw hinge.
        def repair_candidate(D):
            D=weld(D);alpha=np.ones(len(cnt))
            for it0 in range(120):
                A0=Q+D*alpha[w,None];bad0=defects(A0)
                if not bad0.any():return A0-Q,it0
                seeds=np.unique(w[ST[bad0]]);t0=alpha.copy();t0[seeds]*=.72
                avg0=np.bincount(e0,weights=t0[e1],minlength=len(cnt))/degree
                alpha=np.minimum(alpha,.78*t0+.22*avg0)
            return None,120
        def candidate_metric(D):
            m=oral_visibility(Q+D)
            # Penalize deformation of the chin and nose, while prioritizing
            # actual contiguous first-hit oral lining over mere recession.
            chin0=(zz<-.28)&(zz>-.65)&(np.abs(xx)<.20)&(yy<0)
            chinShift=float(np.max(np.abs(D[chin0,2]))) if chin0.any() else 0.
            target={'jawOpen':.007,'viseme_A':.006,'viseme_O':.005,'laugh':.006}[name]
            score0=m['visibleLiningSamples']+3500*min(m['centerOpeningHeight_m'],target)-2300*max(0.,chinShift-.004)
            if name=='laugh':
                corners=(np.abs(xx)>.23)&(np.abs(xx)<.48)&(np.abs(zz)<.16)&(yy<0)
                if corners.any():score0+=5000*float(np.mean(D[corners,2]))
            return score0,{**m,'chinShift_m':chinShift}
        baseD=weld(D);safe0,it0=repair_candidate(baseD)
        if safe0 is None:safe0=np.zeros_like(Q)
        bestD=safe0;bestScore,best=candidate_metric(bestD);attempts=[]
        # Compare localized, graph-smoothed opposed-lip fields with and
        # without inherited jaw motion. Search after topology repair.
        # A slight crease-height offset compensates asymmetric contact lips.
        for offset in (-.025,0.,.025):
            zc=zz-offset
            for width in (.18,.27):
                wz=np.exp(-(zc/width)**4)
                split=np.tanh(zc/.042)
                for opening in (.065,.105,.155,.22,.28):
                    L=np.zeros_like(Q)
                    L[:,2]=gap*opening*wx*wz*wf*split*(.65+.35*(split<0))
                    L[:,1]=gap*opening*.7*wx*wz*wf*mouthInner
                    if name=='laugh':
                        corner=np.exp(-((np.abs(xx)-.35)/.14)**2)*np.exp(-(zz/.20)**2)*wf
                        L[:,2]+=gap*.095*corner
                        L[:,0]+=gap*.035*np.sign(xx)*corner
                    elif name=='viseme_O':
                        L[:,0]-=gap*.045*np.tanh(xx/.13)*wx*wz*wf
                        L[:,1]-=gap*.024*wx*wz*wf*(~mouthInner)
                    # Let the actual topological neighbors transition
                    # smoothly; no artificial face-hole or painted slit.
                    L=weld(L)
                    for _ in range(2):
                        ll=np.column_stack([np.bincount(w,weights=L[:,k])/cnt for k in range(3)])
                        avg=np.column_stack([np.bincount(e0,weights=ll[e1,k],minlength=len(cnt))/degree for k in range(3)])
                        L=(.83*ll+.17*avg)[w]
                    for baseScale in (0.,.25,.6):
                        cand,it0=repair_candidate(baseD*baseScale+L)
                        if cand is None:continue
                        score0,met=candidate_metric(cand)
                        attempts.append({'creaseOffset':offset,'width':width,'separation':opening,'baseScale':baseScale,'repairIterations':it0,**met})
                        if score0>bestScore:
                            bestD=cand;bestScore=score0;best=met
        D=bestD;openingSearch={'candidateCount':len(attempts),'selectedPreRepair':best,'attempts':attempts,'method':'topology-repaired opposed lip fields'}
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
# Keep iris circular in its original plane when sclera width is adjusted.
# The existing ray-conformation below then follows the updated globe.
def ocular_factor(k):
    f=eyeScaleFactors[k[1]]
    return (f[2],f[1],f[2]) if isinstance(f,tuple) and k[0]=='iris' else f
eyeSource={k:dstEye[k[1]]+(mapP(pts(o))-dstEye[k[1]])*ocular_factor(k) for k,o in eyes.items()}
if female:
    irisSizeReport={}
    for side in ('L','R'):
        k=('iris',side);A=eyeSource[k];lab='L' if dstEye[side][0]<eye[0] else 'R'
        ip=df['iris'+lab];target=float(abs(ip[2,0]-ip[1,0])*gap/detailIPD)
        ext=np.ptp(A,axis=0);mid=(A.min(0)+A.max(0))/2
        if not .005<target<.020 or min(ext[0],ext[2])<.001:raise RuntimeError('invalid traced iris diameter '+side)
        A[:,0]=mid[0]+(A[:,0]-mid[0])*target/ext[0]
        A[:,2]=mid[2]+(A[:,2]-mid[2])*target/ext[2]
        irisSizeReport[side]={'targetDiameter_m':target,'previousWidth_m':float(ext[0]),'previousHeight_m':float(ext[2]),'actualWidth_m':float(np.ptp(A[:,0])),'actualHeight_m':float(np.ptp(A[:,2])),'referenceProjectedHeight_m':float(abs(ip[4,1]-ip[3,1])*gap/detailIPD),'source':'350-point approximate 2D iris contour; circular shape inferred'}
    dreport['irisDiameterFit']=irisSizeReport
for (kind,side),o in eyes.items():
    A=eyeSource[(kind,side)].copy()
    if kind=='iris':
        globe=eyeSource[('sclera',side)]
        gt=BVHTree.FromPolygons([Vector(p) for p in globe],[tuple(int(i) for i in t) for t in tri(eyes[('sclera',side)])],all_triangles=True)
        old=A.copy();hits=0
        for i,p in enumerate(A):
            q,_,_,_=gt.ray_cast(Vector((p[0],float(globe[:,1].min()-.05),p[2])),Vector((0,1,0)),.12)
            if q is not None:
                A[i,1]=(q.y-.00018) if female else min(p[1],q.y-.00018);hits+=1
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
        rgb_ref=np.asarray(dreport['colorSamples']['iris']['rgb'],dtype=float)/255.
        if rgb_ref.shape!=(3,) or not np.isfinite(rgb_ref).all() or np.any((rgb_ref<0)|(rgb_ref>1)):raise RuntimeError('invalid iris RGB in source ledger')
        col=np.where(rgb_ref<=.04045,rgb_ref/12.92,((rgb_ref+.055)/1.055)**2.4) if ident=='commander-female' else np.array([.18,.095,.043])
        iris_pattern=.72+.18*np.sin(67*ang+19*rad)+.10*np.sin(113*ang-33*rad)
        rgb=col*iris_pattern[:,:,None]*(.55+.45*np.sin(np.clip(rad,0,1)*np.pi))[:,:,None]
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
    if len(G):
        dside='L' if np.mean(G[:,0])<eye[0] else 'R'
        dreport.setdefault('actualEyeOpening',{})[dside]={'widthRatio':float(np.ptp(G[:,0])/gap),'heightRatio':float(np.ptp(G[:,1])/gap),'targetWidth':dm[dside]['eyeWidth'],'targetHeight':dm[dside]['eyeHeight']}
    if visibleIris<5:raise RuntimeError('iris remains occluded '+side)
    if len(G)<8:continue
    # Ray-derived upper/lower margins: find nearby actual skin triangles.
    # Generate tapered tubes rooted in actual triangle with interpolated
    # skin weights and all facial morph deltas.
    V=[];F=[];rootRows=[];rootD={n:[] for n in names};rootCount=0;lashMeasures=[]
    for upper in (True,False):
        gx=np.unique(G[:,0]);edgeZ=np.array([G[G[:,0]==v,1].max() if upper else G[G[:,0]==v,1].min() for v in gx])
        for x in np.linspace(gx[0],gx[-1],54 if upper else 32)[1:-1]:
            z=float(np.interp(x,gx,edgeZ));sgn=1 if upper else -1
            hit=None
            for step in range(1,9):
                zz=z+sgn*step*.00024
                a,i,sd=cast(skinTree,float(x),zz);b,_,ed=cast(et,float(x),zz)
                if a is not None and (b is None or sd<=ed+.00005):hit=(a,i);break
            if hit is None:continue
            a,i=hit;ids=ST[i];b=bary(np.array(a),Q[ids]);wr0={}
            for j,t in zip(ids,b):
                for n,v in wr[j].items():wr0[n]=wr0.get(n,0)+float(t)*v
            dside='L' if x<eye[0] else 'R'
            frac=float(np.clip((x-gx[0])/max(gx[-1]-gx[0],1e-6),0,1))
            pref=('lash' if upper else 'lowerLash')+dside
            rr=df[pref+'Roots'];tt=df[pref+'Tips'];dif=tt-rr
            t0=np.linspace(0,1,len(rr));projected=np.array([np.interp(frac,t0,dif[:,0]),-np.interp(frac,t0,dif[:,1])])*gap/detailIPD
            # Preserve the measured screen-space tangent and length; the
            # out-of-plane bend is estimated. Root remains on the actual lid.
            dx0,dz0=projected
            dz0=sgn*max(abs(dz0),.00075 if upper else .00045)
            origin=a+Vector((0,-.00045,0));at=len(V)
            length=float(np.linalg.norm([dx0,dz0]));depth=.00165 if upper else .0009
            C=[origin+Vector((dx0*t,-depth*(1.65*t-.65*t*t),dz0*(.48*t+.52*t*t))) for t in np.linspace(0,1,7)]
            lashMeasures.append({'upper':upper,'root_m':list(origin),'tip_m':list(C[-1]),'projectedLength_m':length,'projectedDirectionDeg':float(np.degrees(np.arctan2(dz0,dx0)))})
            for k,c in enumerate(C):
                t=k/(len(C)-1);rad=(.000145 if upper else .00010)*(1-.94*t**1.3)
                direction=(C[min(k+1,len(C)-1)]-C[max(k-1,0)]).normalized()
                u=direction.cross(Vector((1,0,0))).normalized();v=direction.cross(u).normalized()
                for j in range(5):
                    th=2*math.pi*j/5;V.append(tuple(c+rad*(u*math.cos(th)+v*math.sin(th))));rootRows.append(wr0)
                    for n in names:rootD[n].append(b@fixed[n][ids])
            for k in range(len(C)-1):
                for j in range(5):t=(j+1)%5;F.append((at+k*5+j,at+k*5+t,at+(k+1)*5+t,at+(k+1)*5+j))
            rootCount+=1
    if not V:continue
    me=bpy.data.meshes.new('MasterLashes_'+side);me.from_pydata(V,[],F);me.update();o=bpy.data.objects.new('R53_MasterLashes_'+side,me);bpy.context.collection.objects.link(o)
    mat=bpy.data.materials.new('FineLashes_'+side);mat.use_nodes=True;bs=mat.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(.017,.010,.008,1);bs.inputs['Roughness'].default_value=.58;mat.diffuse_color=(.017,.010,.008,1);me.materials.append(mat)
    bind(o,rootRows);o.shape_key_add(name='Basis')
    for n in names:
        k=o.shape_key_add(name=n);k.data.foreach_set('co',(np.array(V)+np.array(rootD[n])).astype(np.float32).ravel())
    for poly in me.polygons:poly.use_smooth=True
    lashes.append(o);exposureReport[-1]['lashRoots']=rootCount
    dreport.setdefault('actualLashGeometry',{})[side]={'rootCount':rootCount,'upperCount':sum(x['upper'] for x in lashMeasures),'lowerCount':sum(not x['upper'] for x in lashMeasures),'strands':lashMeasures}

# Eyebrow fibres projected onto the actual forehead; each root inherits
# the underlying triangle's bone weights and all thirteen morph deltas.
brows=[];browReports=[]
for side in ('L','R'):
    O=pts(eyes[('sclera',side)]);lo=O.min(0);hi=O.max(0)
    cx=float((lo[0]+hi[0])/2);sgn=1 if cx>eye[0] else -1
    ew=float(hi[0]-lo[0]);ez=float(hi[2]-lo[2])
    V=[];F=[];RW=[];RD={n:[] for n in names};roots=[]
    for j in range(52):
        t=j/51
        if female:
            dside='L' if cx<eye[0] else 'R';curve=np.array(dm[dside]['browCurve'])
            xp=curve[:,0];yp=curve[:,1];u0=t if sgn>0 else 1-t
            k0=min(len(curve)-2,int(u0*(len(curve)-1)));f0=u0*(len(curve)-1)-k0
            q0=(1-f0)*curve[k0]+f0*curve[k0+1];origin=df['iris'+dside][0]
            x=cx+(q0[0]-origin[0])*gap/detailIPD
            z=dstEye[side][2]-(q0[1]-origin[1])*gap/detailIPD
            thick=float(np.clip(dm[dside]['browThickness']*gap*.5,.0008,.0022))*(.45+.55*math.sin(math.pi*t)**.6)
        else:
            x=cx+sgn*ew*(-.51+1.10*t);z=float(hi[2])+ez*(.13+.09*math.sin(math.pi*t)-.10*t);thick=.002*(.37+.63*math.sin(math.pi*t)**.6)
        for row in (-1,-.5,0,.5,1):
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
                C.append(hit+Vector((0,-(.00045+.00040*math.sin(math.pi*u)),0)))
            if len(C)!=4:continue
            idx=len(V)
            for k,c in enumerate(C):
                tangent=(C[min(3,k+1)]-C[max(0,k-1)]).normalized()
                u=tangent.cross(Vector((0,1,0))).normalized();v=tangent.cross(u).normalized()
                rad=(.00016 if female else .000125)*(1-.86*k/3)
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
    mat=bpy.data.materials.new('R53_Brow_'+side);col=(.073,.038,.019) if female else (.026,.018,.012)
    mat.diffuse_color=(*col,1);mat.use_nodes=True
    bs=mat.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*col,1);bs.inputs['Roughness'].default_value=.62
    me.materials.append(mat)
    for p0 in me.polygons:p0.use_smooth=True
    bind(ob,RW);ob.shape_key_add(name='Basis')
    for n in names:
        k=ob.shape_key_add(name=n);k.data.foreach_set('co',(np.array(V)+np.array(RD[n])).astype(np.float32).ravel())
    dreport.setdefault('actualBrowRoots',{})[side]={'count':len(roots),'bounds_m':[np.min(roots,axis=0).tolist(),np.max(roots,axis=0).tolist()]}
    brows.append(ob);browReports.append({'side':side,'roots':len(roots),'vertices':len(V),'morphs':len(names),'visualApproved':False})


dreport['applied']+=['projected per-region upper/lower lash vector and length','brow centerline and thickness','bounded ray-tested eyelid curve fit']
dreport['unresolved']=['remaining eyelid projection residual','individual lash depth/curl inferred','true cheek depth target','skeletal mandibular angle geometry fit','true lip border texture tracing','posterior mandibular contour']
if female and dreport.get('lowerOutlineFit',{}).get('applied'):dreport['applied'].append('projected front cheek/jaw and anterior under-jaw curve fit')
(out/'detail-face-report.json').write_text(json.dumps(dreport,indent=2))
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
            # Match the actual selected lower-lip morph; the candidate search
            # may choose less rotation than the nominal jaw angle.
            xx0=(Q[:,0]-eye[0])/gap;zz0=(Q[:,2]-mouthZ)/gap
            mask=(np.abs(xx0)<.25)&(zz0<-.045)&(zz0>-.21)&(Q[:,1]<eye[1])&(~mouthInner)
            if mask.any():
                shift=np.median(fixed[n][mask],axis=0)
                D[:,1]=np.clip(shift[1],-.003,.008)
                D[:,2]=np.clip(shift[2],-.016,.002)
            else:
                angle=jawAngles[n]*.35;yy=A[:,1]-hingeY;zz=A[:,2]-hingeZ
                D[:,1]=yy*(math.cos(angle)-1)-zz*math.sin(angle)
                D[:,2]=yy*math.sin(angle)+zz*(math.cos(angle)-1)
        k=ob.shape_key_add(name=n);k.data.foreach_set('co',(A+D).astype(np.float32).ravel())
    oral.append(ob);oralReports.append({'name':name,'components':len(centers),'vertices':len(V),'lowerJawFollow':lower,'morphs':len(names)})
for lower in (False,True):
    centers=[];radii=[]
    for k in (-2.5,-1.5,-.5,.5,1.5,2.5):
        x=eye[0]+k*gap*.087
        y=lipY+gap*(.25+.027*abs(k)**1.55)
        z=mouthZ+gap*((-.065 if lower else .065)-.009*abs(k))
        centers.append((x,y,z));radii.append((gap*.040,gap*.037,gap*(.040 if lower else .052)))
    oral_piece('R53_LowerTeeth' if lower else 'R53_UpperTeeth',centers,radii,(.73,.69,.60),lower)
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

# Fail early before expensive rendering if the rig inventory was corrupted.
if set(r53_clip_actions)!=set(clips) or not all(isinstance(a,bpy.types.Action) for a in r53_clip_actions.values()):
    raise RuntimeError('animation inventory damaged before rendering')
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
        return .90+.42*(1-math.cos(a))+.12*math.sin(a)**2+.25*math.sin(a+.7)*f**2
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
        vol=.004+.0035*math.sin(math.pi*t*.85)**2+.003*math.sin(a)**4*smooth01((t-.65)/.35)
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
            longLength=float(np.clip(gap*(designMetrics['hairDrop']+1.8),.14,.25))
            hang=float(.006+longLength*mix+.021*side+.012*math.sin(a)*mix+.006*math.sin(19*a+.2)*mix+.001*math.sin(47*a))
            radial=Vector((math.sin(a),-math.cos(a),0))
            target=p+Vector((.045*mix*math.sin(a),.045*mix,-hang))+radial*(.008+.016*mix)
            endtan=Vector((0,0,-hang*.8))-radial*.016*mix
            t0=tan*.55
            q=(2*u**3-3*u*u+1)*p+(u**3-2*u*u+u)*t0+(-2*u**3+3*u*u)*target+(u**3-u*u)*endtan
            q+=radial*(.004*math.sin(math.pi*u)*mix)
        q+=ray*(.00038*math.sin(29*a+5*t)*math.sin(math.pi*min(t,1.))**2)
        near,normal,_,d=skinTree.find_nearest(q)
        if near is not None and d<.025 and (q-near).dot(normal)<.0012:q=near+normal*.0014
        # Ear protrusions must not punch through the side silhouette.
        # Conform against the outer radial envelope at the final z-height.
        if t>.70 and abs(math.sin(a))>.68 and q.z>eye[2]-.035:
            horizontal=Vector((math.sin(a),-math.cos(a),0))
            origin=Vector((c.x,c.y,q.z));h,_,_,_=skinTree.ray_cast(origin+horizontal*.40,-horizontal,.40)
            if h is not None:
                radial_gap=(q-h).dot(horizontal)
                if radial_gap<.0025:q+=horizontal*(.0025-radial_gap)
        return q
    # Outside-body envelope for hanging hair; hidden back depth is inferred.
    # Use body and cloth only for the reusable wig envelope. Armor is
    # checked separately in the assembled review, not baked into the wig.
    clothingTree=tree([body]+cloth)
    def keepOutside(q,a):
        hit,normal,_,d=clothingTree.find_nearest(q)
        if hit is not None and d<.075 and (q-hit).dot(normal)<.005:
            q=hit+normal*.005
        return q
    # Smooth across the scalp/skirt junction and ear envelopes. Every
    # overlay samples this same final surface, preventing a second ridge.
    grid=np.array([[tuple(keepOutside(sample(2*math.pi*k/n,1.95*j/rows),2*math.pi*k/n)) if j>rows*.52 else tuple(sample(2*math.pi*k/n,1.95*j/rows)) for k in range(n)] for j in range(rows+1)])
    originalGrid=grid.copy()
    for _ in range(14):
        avg=(np.roll(grid,1,axis=1)+np.roll(grid,-1,axis=1)+np.roll(grid,1,axis=0)+np.roll(grid,-1,axis=0))*.25
        nxt=.50*grid+.50*avg
        nxt[0]=grid[0];nxt[-1]=.85*grid[-1]+.15*(np.roll(grid[-1],1,axis=0)+np.roll(grid[-1],-1,axis=0))*.5
        grid=nxt
    for j in range(rows+1):
        for k in range(n):
            q=Vector(grid[j,k]);p0,n0,_,d0=skinTree.find_nearest(q)
            if p0 is not None and d0<.025 and (q-p0).dot(n0)<.0014:q=p0+n0*.0014
            if j>rows*.52:q=keepOutside(q,2*math.pi*k/n)
            grid[j,k]=tuple(q);V.append(tuple(q));UV.append((k/n,j/rows))
    def smoothSample(a,t):
        x=(a%(2*math.pi))*n/(2*math.pi);y=np.clip(t/1.95*rows,0,rows-1e-6)
        k=int(x)%n;j=int(y);u=x-int(x);v=y-j
        return Vector((1-v)*((1-u)*grid[j,k]+u*grid[j,(k+1)%n])+v*((1-u)*grid[j+1,k]+u*grid[j+1,(k+1)%n]))
    F.append(tuple(range(n)))
    for j in range(rows):
        for k in range(n):
            a=j*n+k;b=j*n+(k+1)%n;F.append((a,a+n,b+n,b))
    # Fine overlay strips with very shallow relief follow the silhouette.
    # Their edges remain close to the continuous backing; no separate rods.
    groups=[]
    for k in range(56):
        a0=2*math.pi*(k+.15*math.sin(k*2.37))/56;start=len(V);sections=32
        for j in range(sections):
            t=.38+1.54*j/(sections-1);a=a0+.23*math.sin(t*1.7)*math.sin(a0+.5)
            width=.049*(.35+.65*math.sin(math.pi*j/(sections-1))**.65)
            for side in (-1,0,1):
                q=smoothSample(a+side*width,t)
                normal=Vector((math.sin(a),-math.cos(a),max(0.,1-t))).normalized()
                q+=normal*(.00013+.00020*(1-abs(side))*math.sin(math.pi*j/(sections-1)))
                V.append(tuple(q));UV.append(((k+(side*.42))/56,j/(sections-1)))
        for j in range(sections-1):
            for k0 in range(2):
                a=start+j*3+k0;F.append((a,a+3,a+4,a+1))
        groups.append({'kind':'shallow_surface_layer','vertices':sections*3})
    # Individually sculpted swept bangs. Derive the approximate terminal
    # heights from the visible three fringe tips and the eyebrow level.
    # The missing depth is reconstructed on the actual scalp surface.
    bangCount=0
    if female:
        tips=[np.array([fp['hair_left'][0],fp['brow_left_outer'][1]+32]),np.array([fp['part'][0],fp['brow_left_mid'][1]-30]),np.array([fp['hair_right'][0],fp['brow_right_outer'][1]+17])]
        frontSpecs=[(-.85,-.22,0),(-.70,-.12,0),(-.55,-.05,0),(-.40,.12,1),(-.22,.32,1),(-.04,.48,1),(.14,.65,2),(.30,.83,2),(.45,1.00,2)]
        for strand0,(a0,a1,tipI) in enumerate(frontSpecs):
            start=len(V);sections=30;cross=7
            # Convert image vertical offset to a bounded anatomical target;
            # it is projected, not claimed as a measured physical length.
            dz=float(np.clip((fp['brow_left_mid'][1]-tips[tipI][1])/ipd,-.48,.12))*gap
            endZ=float(eye[2]+gap*.22+dz)
            root=smoothSample(a0,.28)
            for j in range(sections):
                t=j/(sections-1);a=a0+(a1-a0)*math.sin(t*math.pi*.5)
                p=smoothSample(a,.28+.70*t)
                u=smooth01((t-.40)/.60)
                if u>0:
                    p.z=(1-u)*p.z+u*endZ
                    hit,_,_=cast(skinTree,p.x,p.z)
                    if hit is not None:p.y=min(p.y,hit.y-.0025)
                p+=Vector((math.sin(a)*.002,-.002-.003*math.sin(math.pi*t),.001))
                lateral=Vector((math.cos(a),math.sin(a),0)).normalized()
                normal=Vector((math.sin(a),-math.cos(a),.3)).normalized()
                width=gap*.105*(.45+.55*math.sin(math.pi*t)**.5)*(1-.97*t**5)
                for k in range(cross):
                    f=k/(cross-1)*2-1
                    q=p+lateral*(f*width)+normal*(.002*(1-f*f)*math.sin(math.pi*t))
                    near,norm,_,d=skinTree.find_nearest(q)
                    if near is not None and d<.018 and (q-near).dot(norm)<.0015:q=near+norm*.0018
                    V.append(tuple(q));UV.append(((k/(cross-1)+strand0)/len(frontSpecs),t))
            for j in range(sections-1):
                for k in range(cross-1):
                    i=start+j*cross+k;F.append((i,i+cross,i+cross+1,i+1))
            bangCount+=sections*cross
        groups.append({'kind':'portrait_front_bangs','vertices':bangCount,'projectedTipCount':3})
    # A separate visible side braid derived from the three annotated
    # braid points. Its 3D course is estimated on the fitted scalp.
    braidCount=0
    braidStart=len(V);braidSections=40;braidSides=6
    braidRadius=float(np.clip(portraitRatios['braidLength']*gap*.055,.003,.007))
    for strand0 in range(0):
        start=len(V)
        for j in range(braidSections):
            t=j/(braidSections-1);a=-.30-1.25*t;v=.33+.73*t
            p=smoothSample(a,v);p0=smoothSample(a-.015,v+.012)
            tangent=(p0-p).normalized();radial=Vector((math.sin(a),-math.cos(a),.35)).normalized()
            u=tangent.cross(radial)
            if u.length<1e-6:u=Vector((1,0,0))
            u.normalize();v0=tangent.cross(u).normalized()
            phase=2*math.pi*(5*t+strand0/3)
            center0=p+radial*.003+braidRadius*.65*(u*math.cos(phase)+v0*math.sin(phase))
            for k in range(braidSides):
                ph=2*math.pi*k/braidSides
                q=center0+braidRadius*.48*(u*math.cos(ph)+v0*math.sin(ph))
                V.append(tuple(q));UV.append((k/braidSides,t))
        for j in range(braidSections-1):
            for k in range(braidSides):
                k1=(k+1)%braidSides;i=start+j*braidSides;F.append((i+k,i+k1,i+braidSides+k1,i+braidSides+k))
        braidCount+=braidSections*braidSides
    if braidCount:groups.append({'kind':'side_braid_inferred_depth','vertices':braidCount})
    me=bpy.data.meshes.new('R53_PortraitLongLayeredHair');me.from_pydata(V,[],F);me.update()
    ob=bpy.data.objects.new('R53_MeasuredScalpHair',me);bpy.context.collection.objects.link(ob)
    col=np.array([.31,.22,.145]);mat=bpy.data.materials.new('R53_GoldenBlondeHair');mat.diffuse_color=(*col,1);mat.use_nodes=True
    bs=mat.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*col,1);bs.inputs['Roughness'].default_value=.69
    if 'Specular IOR Level' in bs.inputs:bs.inputs['Specular IOR Level'].default_value=.11
    me.materials.append(mat);hu=me.uv_layers.new(name='R53_HairFlow')
    for p in me.polygons:
        p.use_smooth=True;ids=list(p.loop_indices);u0=[UV[me.loops[i].vertex_index][0] for i in ids];wrap=max(u0)-min(u0)>.5
        for i,u in zip(ids,u0):
            _,v=UV[me.loops[i].vertex_index];hu.data[i].uv=(u+1 if wrap and u<.5 else u,v)
    yy,xx=np.mgrid[0:1024,0:2048];u=xx/2048;v=yy/1024
    strand=.82+.055*np.sin(2*math.pi*(u*317+.19*np.sin(v*8)))+.035*np.sin(2*math.pi*(u*503+v*.12))+.018*np.sin(2*math.pi*u*809)+.075*np.sin(2*math.pi*(u*19+.28*np.sin(v*4)))
    texlink(mat,bs,rgba_image('R53_BobStrands',strand[:,:,None]*col[None,None,:]),hu.name,'Base Color')
    rough=np.clip(.68+.045*np.sin(2*math.pi*(u*317+.19*np.sin(v*8))),.58,.78)
    texlink(mat,bs,rgba_image('R53_BobRoughness',rough,True),hu.name,'Roughness')
    headName=next((b.name for b in rig.data.bones if b.name.lower()=='head'),None)
    if headName is None:headName=next((b.name for b in rig.data.bones if b.name.lower().endswith('head')),None)
    if headName is None:raise RuntimeError('head bone missing')
    bind(ob,[{headName:1.} for _ in V])
    values=signed(np.array(V),skinTree)
    # Actual geometry evidence; report armor and garment contacts separately.
    hair_contact={}
    for label,oblist in [('body',[body]),('clothing',cloth),('armor',plates)]:
        if oblist:
            hair_contact[label]=metrics(np.array(V),tree(oblist))
    ob['R53_hair_contact_proxy_json']=json.dumps(hair_contact)
    return ob,{'vertices':len(V),'faces':len(F),'scalpSamples':(rows+1)*n,'strandTextureSize':[2048,1024],'sweptFlow':True,'freeLocks':groups,'hairStyle':'nine-view concept ash blonde shoulder layers','referenceLengthRatio':designMetrics['hairDrop'],'rearDepthInferred':True,'contactByCategory':hair_contact,'frontBangVertices':bangCount,'surfaceSmoothingPasses':14,'minRadialClearance_m':float(np.min(values)),'penetrationProxy':float(np.mean(values<-.001)),'deepPenetrationProxy':float(np.mean(values<-.003)),'visualApproved':False,'productionApproved':False,'limitations':['continuous shell study, hairline and outer silhouette require visual approval','nearest-surface metric not a complete collision guarantee']}
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
        # High-resolution skin-only face and both orbital detail views.
        # Existing full-head images are preserved for like-for-like review.
        detailDir=out/'face-detail-review';detailDir.mkdir(exist_ok=True)
        oldRes=(scene.render.resolution_x,scene.render.resolution_y)
        try:
            scene.render.resolution_x=1000;scene.render.resolution_y=1000
            for tag,focus0,scale0 in [('face_front',Vector((eye[0],eye[1],eye[2]-gap*.63)),gap*3.7),('eyes_front',Vector((eye[0],eye[1],eye[2]+gap*.04)),gap*2.1),('eye_left',Vector(dstEye['L']),gap*1.05),('eye_right',Vector(dstEye['R']),gap*1.05)]:
                cam.data.ortho_scale=scale0;cam.location=focus0+Vector((0,-H*3,0));cam.rotation_euler=(focus0-cam.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(detailDir/(tag+'.png'));bpy.ops.render.render(write_still=True)
        finally:scene.render.resolution_x,scene.render.resolution_y=oldRes
        return {'status':'rendered','engine':scene.render.engine,'views':7,'faceDetailViews':4}
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
for n,act in r53_clip_actions.items():
    if not isinstance(act,bpy.types.Action):raise RuntimeError('invalid animation action '+n)
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
            n0=len(plate.data.vertices);originalData=plate.data;backup=originalData.copy();originalCollision=metrics(pts(plate),baseTree)
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
                # Smooth the panel faces themselves rather than just the
                # tiny edge bevels. Accept only if body collision does not
                # become worse and skin weights survive.
                roundedBackup=plate.data.copy();beforeRound=metrics(pts(plate),baseTree)
                try:
                    mod=plate.modifiers.new('R53 panel curved surface','SUBSURF');mod.subdivision_type='CATMULL_CLARK';mod.levels=1
                    bpy.ops.object.modifier_apply(modifier=mod.name)
                    if any(not v.groups for v in plate.data.vertices):raise RuntimeError('panel weight loss')
                    afterRound=metrics(pts(plate),baseTree)
                    if score(afterRound)>score(beforeRound)+.025:raise RuntimeError('panel collision regression')
                    rounded=True
                except Exception:
                    for md0 in list(plate.modifiers):
                        if md0.name.startswith('R53 panel curved surface'):plate.modifiers.remove(md0)
                    plate.data=roundedBackup;rounded=False
                finalCollision=metrics(pts(plate),baseTree)
                if score(finalCollision)>score(originalCollision)+.025:raise RuntimeError('total armor collision regression')
                for pol in plate.data.polygons:pol.use_smooth=True
                for slot in plate.material_slots:
                    if slot.material:slot.material=slot.material.copy()
                for mat in plate.data.materials:
                    if not mat or not mat.use_nodes:continue
                    node=next((n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED'),None)
                    if node:
                        node.inputs['Metallic'].default_value=.66
                        node.inputs['Roughness'].default_value=.43
                        # Old linked textures held the original green/brown
                        # palette. Explicitly replace the base colour only,
                        # retaining normal and roughness texture links.
                        for lk in list(node.inputs['Base Color'].links):mat.node_tree.links.remove(lk)
                        node.inputs['Base Color'].default_value=(.52,.56,.62,1)
                armorStudy.append({'name':plate.name,'before':n0,'after':len(plate.data.vertices),'status':'beveled','curvedPanelAccepted':rounded,'beforeCollision':originalCollision,'afterCollision':finalCollision})
            except Exception as e:
                for md0 in list(plate.modifiers):
                    if md0.name.startswith(('R53 edge bevel','R53 weld seams','R53 panel refinement','R53 rounded panel')):plate.modifiers.remove(md0)
                plate.data=backup;armorStudy.append({'name':plate.name,'before':n0,'status':'retained-original','error':str(e)})
    # Assign a navy textile palette to the existing fitted clothing.
    # Material copies avoid modifying shared source skin materials.
    palette=[]
    if female:
        for ob1 in cloth:
            for slot in ob1.material_slots:
                if slot.material is None:continue
                mt=slot.material.copy();slot.material=mt
                if not mt.use_nodes:mt.use_nodes=True
                nd=next((n for n in mt.node_tree.nodes if n.type=='BSDF_PRINCIPLED'),None)
                if nd is None:continue
                for lk in list(nd.inputs['Base Color'].links):mt.node_tree.links.remove(lk)
                nd.inputs['Base Color'].default_value=(.025,.047,.105,1)
                nd.inputs['Metallic'].default_value=0.;nd.inputs['Roughness'].default_value=.72
                mt.diffuse_color=(.025,.047,.105,1);palette.append(ob1.name)
    assemblyReport['armorStudy']=armorStudy
    assemblyReport['portraitPalette']={'navyClothMeshes':sorted(set(palette)),'silverArmor':True,'goldTrim':'not yet modeled'}
    assemblyReport['bodyMaterialReview']={'clothMeshes':len(cloth),'armorMeshes':len(plates),'note':'original fitted body and garments retained; PBR render evidence required'}
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
    # Full-body PBR studio renders: evaluate actual clothing and metal
    # materials, not the legacy Workbench white-material diagnostic.
    oldEngine=scene.render.engine;oldWorld=scene.world;fullLights=[]
    try:
        try:scene.render.engine='BLENDER_EEVEE_NEXT'
        except Exception:scene.render.engine='BLENDER_EEVEE'
        w0=bpy.data.worlds.new('R53_FullStudioWorld');w0.use_nodes=True
        w0.node_tree.nodes['Background'].inputs[0].default_value=(.19,.19,.19,1);w0.node_tree.nodes['Background'].inputs[1].default_value=.55;scene.world=w0
        for label,offset,power,size0 in [('key',(-1.8,-3.2,2.7),440,2.6),('fill',(2,-2,1),190,2.2),('rim',(0,2.5,2),320,1.8)]:
            dat=bpy.data.lights.new('R53_Full_'+label,'AREA');dat.energy=power;dat.shape='DISK';dat.size=size0
            ob0=bpy.data.objects.new('R53_Full_'+label,dat);bpy.context.collection.objects.link(ob0);ob0.location=center+Vector(offset);ob0.rotation_euler=(center-ob0.location).to_track_quat('-Z','Y').to_euler();fullLights.append(ob0)
        for tag,d in [('pbr_full_front',(0,-1,0)),('pbr_full_threequarter',(.66,-1,.03)),('pbr_full_rear',(0,1,0))]:full_render(tag,d,center,H*1.13)
        assemblyReport['fullPBRReview']={'status':'rendered','views':3}
    finally:
        for ob0 in fullLights:bpy.data.objects.remove(ob0,do_unlink=True)
        scene.world=oldWorld;scene.render.engine=oldEngine
    # Separate nine-view renders for the next image-based iteration.
    reviewDir=out/'nine-view-review';reviewDir.mkdir(exist_ok=True)
    fittedHair.hide_render=False
    for o0 in assembleParts:o0.hide_render=False
    focus=Vector((eye[0],eye[1],eye[2]-hh*.45))
    angles=[('front',(0,-1,0)),('rear',(0,1,0)),('left',(-1,0,0)),('right',(1,0,0)),('top',(0,0,1)),('bottom',(0,0,-1)),('front_left_45',(-1,-1,0)),('front_right_45',(1,-1,0)),('rear_left_45',(-1,1,0))]
    for tag,d in angles:
        cam.data.ortho_scale=hh*5.2;cam.location=focus+Vector(d).normalized()*H*3
        cam.rotation_euler=(focus-cam.location).to_track_quat('-Z','Y' if abs(d[2])<.95 else 'X').to_euler()
        scene.render.filepath=str(reviewDir/(tag+'.png'));bpy.ops.render.render(write_still=True)
    assemblyReport['nineViewReview']={'views':[x[0] for x in angles],'source':'actual assembled model','visualApproved':False}
    # Sample actual skeletal clips for visual motion evidence. Restore rest
    # state before exporting; the existing NLA animation clips are preserved.
    motion=[]
    for key,act in r53_clip_actions.items():
        if not any(v in key.lower() for v in ('walk','run','attack','idle','sprint','dodge')):continue
        ad.action=act
        lo,hi=act.frame_range;frame=float(lo+(hi-lo)*.42)
        scene.frame_set(int(frame),subframe=frame-int(frame));bpy.context.view_layer.update()
        full_render('motion_'+key.replace('/','_'),(.66,-1,.03),center,H*1.23)
        motion.append({'clip':key,'frame':frame})
        ad.action=None;reset()
    assemblyReport['motionReview']=motion
    scene.frame_set(1);reset()
    # Keep the new integrated body, face and facial submeshes independent
    # of armor, hair, garments and weapons. Export under the identical rig.
    coreDir=out/'core-body-study';coreDir.mkdir(exist_ok=True)
    coreParts=[assembly]+[o for o in new if o!=hd]
    bpy.ops.object.select_all(action='DESELECT')
    for o in coreParts+[rig]:o.select_set(True)
    bpy.context.view_layer.objects.active=assembly
    coreDest=coreDir/(ident+'_core_body.glb')
    bpy.ops.export_scene.gltf(**dict(opts,filepath=str(coreDest)))
    # Review the actual independent core, not a legacy outfit. Use a
    # temporary neutral material on the below-neck surface for a clothed
    # mannequin-style diagnostic; do not bake this into the core GLB.
    oldPose=rig.data.pose_position;oldColor=sh.color_type
    oldIndices=[p.material_index for p in assembly.data.polygons]
    originalSlots=len(assembly.data.materials)
    previewMat=bpy.data.materials.new('R53_CORE_PREVIEW_ONLY')
    previewMat.diffuse_color=(.16,.20,.27,1)
    assembly.data.materials.append(previewMat)
    try:
        rig.data.pose_position='REST';reset()
        for poly in assembly.data.polygons:
            z0=float((assembly.matrix_world@poly.center).z)
            if z0<eye[2]-gap*1.97:poly.material_index=originalSlots
        sh.color_type='MATERIAL'
        for o in new+parts+[fittedHair,assembly]:o.hide_render=o not in coreParts
        bpy.context.view_layer.update()
        for tag,d in [('core_neutral_front',(0,-1,0)),('core_neutral_side',(1,0,0)),('core_neutral_rear',(0,1,0)),('core_neutral_threequarter',(.66,-1,.03))]:
            full_render(tag,d,center,H*1.13)
    finally:
        for poly,idx0 in zip(assembly.data.polygons,oldIndices):poly.material_index=idx0
        assembly.data.materials.pop(index=originalSlots)
        sh.color_type=oldColor;rig.data.pose_position=oldPose;reset()
    for o in new+parts+[fittedHair,assembly]:o.hide_render=o not in assembleParts
    assemblyReport['independentCore']={'file':str(coreDest.relative_to(out)),'sha256':sha(coreDest),'objects':[o.name for o in coreParts],'armorIncluded':False,'hairIncluded':False,'clothingIncluded':False,'approval':False,'reviewViews':['core_neutral_front','core_neutral_side','core_neutral_rear','core_neutral_threequarter'],'reviewMaterial':'temporary neutral body preview, no legacy clothing meshes, rest pose'}
    coreRaw=coreDest.read_bytes();coreJson=json.loads(coreRaw[20:20+int.from_bytes(coreRaw[12:16],'little')])
    if any(any(k in n.get('name','').lower() for k in ('armor','clothing','hair','legplate')) for n in coreJson['nodes'] if 'mesh' in n):raise RuntimeError('core contains legacy equipment')
    if not all(any(n.lower() in a.get('name','').lower() for a in coreJson.get('animations',[])) for n in clips):raise RuntimeError('core clips missing')
    assemblyReport['independentCore']['verifiedNoLegacyEquipment']=True
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
    # Export the actual current meshes individually, with the same rig
    # and rest transforms. These are review candidates, not final equipment.
    partDir=out/'current-modular-parts';partDir.mkdir(exist_ok=True)
    manifest=[];partFailures=[]
    def part_class(ob):
        if ob==assembly:return 'body'
        if ob==fittedHair:return 'hair'
        if ob in cloth:return 'clothing'
        if ob in plates:return 'armor'
        if ob in eyes.values():return 'eye'
        if ob in lashes:return 'lash'
        if ob in brows:return 'brow'
        if ob in oral:return 'oral'
        low=ob.name.lower()
        if 'sword' in low or 'shield' in low:return 'weapon'
        return 'accessory'
    def vec_matrix(m):return [[float(v) for v in row] for row in m]
    rigSpec={'bones':[{'name':b.name,'parent':b.parent.name if b.parent else None,'restMatrix':vec_matrix(b.matrix_local),'head_m':list(b.head_local),'tail_m':list(b.tail_local)} for b in rig.data.bones],'rigWorldMatrix':vec_matrix(rig.matrix_world),'coordinateSystem':'Blender world, metres, Z up; exported GLB uses Y up'}
    (partDir/'rig-rest.json').write_text(json.dumps(rigSpec,indent=2))
    import re
    for idx,ob in enumerate(assembleParts):
        name=re.sub(r'[^A-Za-z0-9_.-]','_',ob.name)
        partId=f'{idx:02d}_{name}';p=partDir/(partId+'.glb')
        try:
            bpy.ops.object.select_all(action='DESELECT');ob.select_set(True);rig.select_set(True);bpy.context.view_layer.objects.active=ob
            # Individual modules share the canonical rest rig; clips stay
            # in the complete/core GLBs. Avoid duplicating every animation.
            bpy.ops.export_scene.gltf(**dict(opts,filepath=str(p),export_animations=False))
            rr=p.read_bytes();gj=json.loads(rr[20:20+int.from_bytes(rr[12:16],'little')])
            if len(gj.get('meshes',[]))!=1 or len(gj.get('skins',[]))!=1:raise RuntimeError('independent mesh/rig inventory')
            A=pts(ob);lo=A.min(0);hi=A.max(0)
            item={'id':partId,'name':ob.name,'category':part_class(ob),'file':p.name,'sha256':sha(p),'vertices':len(A),'faces':len(ob.data.polygons),'bounds_m':[lo.tolist(),hi.tolist()],'dimensions_m':(hi-lo).tolist(),'worldMatrix':vec_matrix(ob.matrix_world),'jointNames':list(g.name for g in ob.vertex_groups),'measurementKind':'actual rest mesh; not concept target','animationPolicy':'shared rig; clips in complete/core GLB','visualApproved':False,'productionApproved':False}
            manifest.append(item)
        except Exception as e:
            partFailures.append({'id':partId,'error':str(e)})
            if p.exists():p.unlink()
    (partDir/'manifest.json').write_text(json.dumps({'parts':manifest,'failures':partFailures,'rig':'rig-rest.json','expectedCount':len(assembleParts),'exportedCount':len(manifest),'allExported':not partFailures,'visualApproved':False},indent=2))
    assemblyReport['currentModularParts']={'manifest':str((partDir/'manifest.json').relative_to(out)),'exported':len(manifest),'expected':len(assembleParts),'failures':partFailures}
    bpy.ops.object.select_all(action='DESELECT')
    for ob in assembleParts+[rig]:ob.select_set(True)
    bpy.context.view_layer.objects.active=assembly
    # Editable scene for manual review; this contains all source study
    # objects and the independent core, not a production-ready asset.
    try:
        bpy.ops.file.pack_all()
        bpy.ops.wm.save_as_mainfile(filepath=str((assemblyDir/(ident+'_review.blend')).resolve()),copy=True)
        assemblyReport['editableBlend']=str((assemblyDir/(ident+'_review.blend')).relative_to(out))
    except Exception as exc:
        assemblyReport['editableBlendError']=str(exc)
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

# Convert genuine generated PNG renders to separately labelled review JPEGs.
# Never use design/reference images as actual model render evidence.
try:
    jpeg_scene=bpy.context.scene
    jpeg_scene.render.image_settings.file_format='JPEG'
    jpeg_scene.render.image_settings.color_mode='RGB'
    jpeg_scene.render.image_settings.quality=94
    jpeg_scene.view_settings.view_transform='Standard'
    jpeg_scene.view_settings.exposure=0
    jpeg_scene.view_settings.gamma=1
    jpeg_count=0
    for image_path in sorted(out.rglob('*.png')):
        if 'reference' in image_path.name.lower() or 'annotated' in image_path.name.lower():continue
        img=bpy.data.images.load(str(image_path.resolve()),check_existing=False)
        try:
            jpg=out/'actual-render-jpg'/image_path.relative_to(out).with_suffix('.jpg')
            jpg.parent.mkdir(parents=True,exist_ok=True)
            img.save_render(str(jpg.resolve()),scene=jpeg_scene)
            jpeg_count+=1
        finally:bpy.data.images.remove(img)
    (out/'actual-render-jpg'/'manifest.json').write_text(json.dumps({'count':jpeg_count,'source':'Blender actual rendered PNG conversion','visualApproved':False},indent=2))
except Exception as exc:
    print('R53 JPG EXPORT FAILED',str(exc),flush=True)
