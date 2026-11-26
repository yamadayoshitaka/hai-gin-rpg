"""R53 generic mob studies: independent baked head/body meshes.
No named-cast likeness, new reference artwork or final visual approval.
"""
import bpy,numpy as np,sys,json,hashlib,math
from pathlib import Path
from mathutils import Vector
args=sys.argv[sys.argv.index('--')+1:]
root,config,out=map(lambda x:Path(x).resolve(),args[:3]);out.mkdir(parents=True,exist_ok=True)
ident=args[3]
plan=next(x for x in json.loads(config.read_text())['models'] if x['id']==ident)
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
records={}
for p in root.rglob('body-candidates.json'):
    for m in json.loads(p.read_text())['models']:records[m['id']]=(p.parent,m)
bid=plan['bodySource'];folder,rec=records[bid];source=folder/(bid+'.glb')
if sha(source)!=rec['sha256']:raise RuntimeError('body SHA mismatch')
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(source));bpy.context.view_layer.update()
objs=[o for o in bpy.context.scene.objects if o.type=='MESH' and len(o.data.vertices)>1000 and any(m.type=='ARMATURE' and m.object for m in o.modifiers)]
if len(objs)!=1:raise RuntimeError('ambiguous body')
o=objs[0];rig=next(m.object for m in o.modifiers if m.type=='ARMATURE' and m.object)
mesh=o.data
if mesh.shape_keys:raise RuntimeError('source contains existing morphs')
def points():return np.array([o.matrix_world@v.co for v in mesh.vertices],np.float64)
def triangles():
    mesh.calc_loop_triangles();return np.array([tuple(t.vertices) for t in mesh.loop_triangles],np.int32)
def rigsig():return [(b.name,b.parent.name if b.parent else None,tuple(b.head_local),tuple(b.tail_local)) for b in rig.data.bones]
def skin():return [[(g.group,float(g.weight)) for g in v.groups] for v in mesh.vertices]
P=points();T=triangles();rig0=rigsig();skin0=skin();uv0=[u.name for u in mesh.uv_layers]
def joint(n):
    if n not in rig.data.bones:raise RuntimeError('missing facial joint '+n)
    return np.array(rig.matrix_world@rig.data.bones[n].head_local)
el,er=joint('eye.L'),joint('eye.R');ec=(el+er)/2
# Estimate head dimensions from the actual source mesh and eye bone positions,
# not from an unrelated adult male coordinate system.
top=float(P[:,2].max());H=top-ec[2];spacing=abs(el[0]-er[0])/2
if not .025<H<.16 or not .015<spacing<.055:raise RuntimeError('unexpected head dimensions '+str([H,spacing]))
x=P[:,0]-ec[0];y=P[:,1];z=P[:,2];side=np.sign(x);ax=np.abs(x)
cut=ec[2]-H*1.20;upper=ec[2]-H*.90
head=z>cut
headP=P[head]
if len(headP)<300:raise RuntimeError('insufficient head geometry')
front=float(np.quantile(headP[:,1],.05));back=float(np.quantile(headP[:,1],.95))
if not .06<back-front<.35:raise RuntimeError('unexpected head depth')
# The donor face is negative Y. Approximate feature centres from actual
# rig landmarks; the profile coefficients are design estimates, not measured likeness.
mouth=joint('oris01');mz=float(mouth[2])
if not ec[2]-H*1.2<mz<ec[2]-H*.15:mz=ec[2]-H*.67
nosez=ec[2]-(ec[2]-mz)*.42
fy=front+(back-front)*.13
scale=H/.10
def smooth(a,b,t):
    u=np.clip((t-a)/(b-a),0,1);return u*u*(3-2*u)
def field(cx,cy,cz,rx,ry,rz):return np.exp(-((ax-cx)/rx)**2-((y-cy)/ry)**2-((z-cz)/rz)**2)
eye=field(spacing,fy,ec[2],.027*scale,.044*scale,.022*scale)
nose=field(0,front,nosez,.023*scale,.042*scale,.030*scale)
lips=field(0,fy,mz,.038*scale,.036*scale,.018*scale)
jaw=field(spacing*1.6,fy+(back-front)*.27,mz-H*.20,.031*scale,.056*scale,.029*scale)
ew,eh,es,nw,npj,mw,lp,jw=plan['studyCoefficients']
D=np.zeros_like(P)
D[:,0]+=eye*(ew*(x-side*spacing)+side*es*scale)
D[:,2]+=eye*eh*(z-ec[2])
D[:,0]+=nose*x*nw;D[:,1]-=nose*npj*scale
D[:,0]+=lips*x*mw;D[:,1]-=lips*lp*scale
D[:,0]+=jaw*side*jw*scale
D*=smooth(cut,upper,z)[:,None];D[~head]=0
# Weld seam displacement without changing source topology or skin weights.
_,w=np.unique(np.round(P,6),axis=0,return_inverse=True);counts=np.bincount(w)
D=np.column_stack([np.bincount(w,weights=D[:,k])/counts for k in range(3)])[w];D[~head]=0
def normals(Q):
    q=Q[T];return np.cross(q[:,1]-q[:,0],q[:,2]-q[:,0])
N=normals(P);area=np.linalg.norm(N,axis=1);valid=area>1e-11
def defects(Q):
    nn=normals(Q)
    return ((np.einsum('ij,ij->i',N,nn)<0)|(np.linalg.norm(nn,axis=1)<area*.025))&valid
E=np.unique(np.sort(np.concatenate((w[T[:,[0,1]]],w[T[:,[1,2]]],w[T[:,[2,0]]])),axis=1),axis=0);E=E[E[:,0]!=E[:,1]]
e0=np.r_[E[:,0],E[:,1]];e1=np.r_[E[:,1],E[:,0]];deg=np.maximum(1,np.bincount(e0,minlength=len(counts)))
alpha=np.ones(len(counts))
for it in range(120):
    Q=P+D*alpha[w,None];bad=defects(Q)
    if not bad.any():break
    seeds=np.unique(w[T[bad]]);target=alpha.copy();target[seeds]*=.70
    avg=np.bincount(e0,weights=target[e1],minlength=len(counts))/deg
    alpha=np.minimum(alpha,.75*target+.25*avg)
active=np.linalg.norm(D,axis=1)>1e-5
if not active.any():raise RuntimeError('no facial sculpt effect')
factor=float(np.average(alpha[w][active],weights=np.linalg.norm(D[active],axis=1)))
peak=float(np.max(np.linalg.norm(Q-P,axis=1)))
if bad.any() or factor<.60 or peak<.0005:raise RuntimeError('unsafe or ineffective facial study '+str([factor,peak,int(bad.sum())]))
if np.max(np.abs(Q[~head]-P[~head]))>1e-10:raise RuntimeError('body or neck changed')
inv=o.matrix_world.inverted()
for v,p in zip(mesh.vertices,Q):v.co=inv@Vector(p)
mesh.update();bpy.context.view_layer.update()
if rigsig()!=rig0 or skin()!=skin0 or [u.name for u in mesh.uv_layers]!=uv0 or not np.array_equal(triangles(),T):raise RuntimeError('source rig, weights, topology or UV changed')
o.name=ident
bpy.ops.object.select_all(action='DESELECT');o.select_set(True);rig.select_set(True);bpy.context.view_layer.objects.active=o
dest=out/(ident+'.glb')
bpy.ops.export_scene.gltf(filepath=str(dest),export_format='GLB',use_selection=True,export_skins=True,export_animations=False)
raw=dest.read_bytes();n=int.from_bytes(raw[12:16],'little');g=json.loads(raw[20:20+n])
if not g.get('skins') or len(g['skins'][0]['joints'])!=len(rig0):raise RuntimeError('export rig lost')
# Actual model renders, not independent reference images.
scene=bpy.context.scene;scene.render.engine='BLENDER_WORKBENCH';scene.render.resolution_x=480;scene.render.resolution_y=560;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';sh=scene.display.shading;sh.light='STUDIO';sh.color_type='SINGLE';sh.single_color=(.60,.51,.44);sh.show_cavity=True
bpy.ops.object.camera_add();cam=bpy.context.object;cam.data.type='ORTHO';scene.camera=cam
center=Vector((ec[0],(front+back)/2,(top+cut)/2));full=Vector((P.min(0)+P.max(0))/2);height=float(np.ptp(P[:,2]))
views=[('front',(0,-1,0),center,H*3.25),('left',(-1,0,0),center,H*3.25),('right',(1,0,0),center,H*3.25),('rear',(0,1,0),center,H*3.25),('left45',(-1,-1,0),center,H*3.25),('right45',(1,-1,0),center,H*3.25),('crown',(0,0,1),center,H*3.25),('face',(0,-1,0),center,H*2.8),('body_front',(0,-1,0),full,height*1.2),('body_side',(1,0,0),full,height*1.2),('body_rear',(0,1,0),full,height*1.2)]
for tag,d,c,size in views:
    cam.data.ortho_scale=size;cam.location=c+Vector(d).normalized()*3;cam.rotation_euler=(c-cam.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath=str(out/(tag+'.png'));bpy.ops.render.render(write_still=True)
# Re-import the actual exported mesh to verify rigged roundtrip.
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(dest));bpy.context.view_layer.update()
rs=[a for a in bpy.context.scene.objects if a.type=='MESH' and len(a.data.vertices)>1000 and any(m.type=='ARMATURE' and m.object for m in a.modifiers)]
if len(rs)!=1 or len(next(m.object for m in rs[0].modifiers if m.type=='ARMATURE').data.bones)!=len(rig0):raise RuntimeError('roundtrip rig missing')
if not np.isfinite(np.array([rs[0].matrix_world@v.co for v in rs[0].data.vertices])).all():raise RuntimeError('roundtrip invalid coordinates')
result={'id':ident,'sex':plan['sex'],'age':plan['age'],'build':plan['build'],'bodySource':bid,'sourceBodySHA256':rec['sha256'],'sha256':sha(dest),'headGeometrySHA256':hashlib.sha256(Q[head].astype('<f4').tobytes()).hexdigest(),'headDisplacementSHA256':hashlib.sha256((Q-P)[head].astype('<f4').tobytes()).hexdigest(),'headVertices':int(head.sum()),'vertices':len(P),'triangles':len(T),'bones':len(rig0),'identityPeak_m':peak,'identityFactor':factor,'newFaceFlips':0,'collapsed':0,'neckAnchorError_m':0,'roundTrip':True,'estimatedDesign':plan['studyCoefficients'],'measuredSource':{'eyeCenters_m':[el.tolist(),er.tolist()],'headTop_m':top,'headCut_m':cut,'frontBackQuantiles_m':[front,back]},'renderHashes':{tag:sha(out/(tag+'.png')) for tag,*_ in views},'independentReferenceViews':False,'visualApproved':False,'finalIdentity':False,'classification':'provisional female named-cast study, not measured likeness','designNote':plan['designNote'],'reference':plan['reference'],'protectedR6Used':False,'ageIsDesignEstimate':True,'expressionsIntegrated':False,'hairFit':False,'clothingFit':False}
(out/'cast-study-report.json').write_text(json.dumps(result,indent=2));print('R53 CAST STUDY',json.dumps(result),flush=True)
