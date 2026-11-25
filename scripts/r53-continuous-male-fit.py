"""R53 continuous-surface male head/body integration candidates.
Transfers real sculpt displacements and existing motion morphs to the rigged
full-body donor, preserving its topology, UVs and neck connection. No cast
identity, high-resolution head transplant, or visual approval is claimed.
"""
import bpy, numpy as np, sys, math, json, hashlib
from pathlib import Path
from mathutils import Vector
from mathutils.kdtree import KDTree
args=sys.argv[sys.argv.index('--')+1:]
heads,motion,bodies,out=map(lambda x:Path(x).resolve(),args[:4])
out.mkdir(parents=True,exist_ok=True)
ids=[int(x) for x in args[4].split(',')]
head_records={r['id']:r for r in json.loads((heads/'male-candidate-audit.json').read_text())['faces']}
motion_records={r['id']:r for r in json.loads((motion/'male-motion-audit.json').read_text())['faces']}
body_records={}
for p in bodies.glob('*/body-candidates.json'):
    for m in json.loads(p.read_text())['models']:body_records[m['id']]=(p.parent,m)
names=['jawOpen','viseme_A','viseme_I','viseme_U','viseme_E','viseme_O','smile','blink_L','blink_R','browRaise','browFrown']
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def load(p,expected):
    if sha(p)!=expected:raise RuntimeError('source hash mismatch '+str(p))
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(p));bpy.context.view_layer.update()
    objs=[o for o in bpy.context.scene.objects if o.type=='MESH' and len(o.data.vertices)>1000 and any(m.type=='ARMATURE' and m.object for m in o.modifiers)]
    if len(objs)!=1:raise RuntimeError('ambiguous rigged mesh '+str(p))
    o=objs[0];rig=next(m.object for m in o.modifiers if m.type=='ARMATURE' and m.object)
    return o,rig
def pos(o,key=None):
    data=o.data.vertices if key is None else key.data
    return np.array([o.matrix_world@v.co for v in data],np.float64)
def triangles(o):
    o.data.calc_loop_triangles()
    return np.array([tuple(t.vertices) for t in o.data.loop_triangles],np.int32)
def normals(P,T):
    q=P[T];return np.cross(q[:,1]-q[:,0],q[:,2]-q[:,0])
def smooth(a,b,x):
    t=np.clip((x-a)/(b-a),0,1);return t*t*(3-2*t)
def kd(P):
    k=KDTree(len(P))
    for i,p in enumerate(P):k.insert(Vector(p),i)
    k.balance();return k
def sample(tree,coords,values):
    result=[];dist=[]
    for p in coords:
        _,idx,d=tree.find(Vector(p))
        result.append(values[idx]);dist.append(d)
    return np.asarray(result),np.asarray(dist)
def bones(r):
    return [(b.name,b.parent.name if b.parent else None,tuple(b.head_local),tuple(b.tail_local)) for b in r.data.bones]
def verify(P,Q,T):
    a=normals(P,T);b=normals(Q,T);area=np.linalg.norm(a,axis=1);valid=area>1e-11
    return int(np.sum((np.einsum('ij,ij->i',a,b)<0)&valid)),int(np.sum((np.linalg.norm(b,axis=1)<area*.02)&valid))
def write_positions(o,P):
    inv=o.matrix_world.inverted()
    for v,p in zip(o.data.vertices,P):v.co=inv@Vector(p)
    o.data.update();bpy.context.view_layer.update()
ref_id='male_face_01'
ref,_=load(heads/(ref_id+'.glb'),head_records[ref_id]['sha256'])
R=pos(ref);RT=triangles(ref);tree=kd(R)
if abs(R[:,2].min()-1.515)>2e-5 or abs(R[:,2].max()-1.760)>.006:raise RuntimeError('reference frame mismatch')
# These are deliberately unassigned male fit studies, not named characters.
profiles=['30s_normal','20s_muscular','40s_chubby','30s_muscular','50s_obese','40s_obese','20s_slim','50s_slim','30s_chubby','50s_normal']
results=[];failures=[]
for i in ids:
    ident='male_face_%02d'%i
    dest_id='male_continuous_%02d'%i
    try:
        rec=head_records[ident]
        o,_=load(heads/(ident+'.glb'),rec['sha256']);Q=pos(o)
        if Q.shape!=R.shape or not np.array_equal(triangles(o),RT):raise RuntimeError('sculpt topology/index order changed')
        field=Q-R
        if not np.isfinite(field).all() or np.max(np.linalg.norm(field,axis=1))>.035:raise RuntimeError('sculpt field outside budget')
        mo,_=load(motion/(ident+'.glb'),motion_records[ident]['sha256']);MP=pos(mo)
        if not mo.data.shape_keys:raise RuntimeError('source morphs absent')
        keys=mo.data.shape_keys.key_blocks
        deltas={n:pos(mo,keys[n])-MP for n in names}
        mtree=kd(MP)
        bid='male_'+profiles[i-1];folder,br=body_records[bid]
        body,rig=load(folder/(bid+'.glb'),br['sha256'])
        if body.data.shape_keys:raise RuntimeError('unexpected body morphs; preserve original')
        P=pos(body);T=triangles(body);B=bones(rig);UV=[u.name for u in body.data.uv_layers]
        # Preserve original mesh and neck weights; only transfer above fixed seam.
        head=P[:,2]>1.535
        if not head.any() or abs(P[:,2].max()-1.760)>.006:raise RuntimeError('body frame mismatch')
        D=np.zeros_like(P);sampled,dist=sample(tree,P[head],field)
        if np.quantile(dist,.95)>.012:raise RuntimeError('reference/head surface alignment insufficient')
        D[head]=sampled*smooth(1.535,1.554,P[head,2])[:,None]
        # Weld displacement values at coincident UV vertices, not topology.
        _,w=np.unique(np.round(P,6),axis=0,return_inverse=True);count=np.bincount(w)
        def weld(A):
            return np.column_stack([np.bincount(w,weights=A[:,k])/count for k in range(3)])[w]
        D=weld(D);D[~head]=0
        factor=1.
        for _ in range(15):
            F=P+D*factor;flips,collapse=verify(P,F,T)
            if not flips and not collapse:break
            factor*=.8
        if flips or collapse or factor<.65:raise RuntimeError('identity transfer not safe')
        if i!=1 and np.max(np.linalg.norm(F-P,axis=1))<.0001:raise RuntimeError('identity displacement lost')
        if np.max(np.abs(F[~head]-P[~head]))>1e-10:raise RuntimeError('neck/body anchor moved')
        write_positions(body,F)
        # Transfer actual source morph deltas, not a new procedural expression.
        body.shape_key_add(name='Basis');inv=body.matrix_world.inverted()
        morph_audit=[];all_delta={}
        for n in names:
            A=np.zeros_like(P);mapped,md=sample(mtree,F[head],deltas[n])
            if np.quantile(md,.95)>.012:raise RuntimeError('motion surface alignment insufficient')
            A[head]=mapped*smooth(1.535,1.554,P[head,2])[:,None]
            A=weld(A);A[~head]=0
            # Repair only defective triangle neighbourhoods.
            W=w[T];edges=np.unique(np.sort(np.concatenate((W[:,[0,1]],W[:,[1,2]],W[:,[2,0]])),axis=1),axis=0)
            edges=edges[edges[:,0]!=edges[:,1]]
            e0=np.concatenate((edges[:,0],edges[:,1]));e1=np.concatenate((edges[:,1],edges[:,0]))
            degree=np.maximum(1,np.bincount(e0,minlength=len(count)))
            alpha=np.ones(len(count));N=normals(F,T);area=np.linalg.norm(N,axis=1);valid=area>1e-11
            for it in range(120):
                G=F+A*alpha[w,None]
                NN=normals(G,T)
                bad=((np.einsum('ij,ij->i',N,NN)<0)|(np.linalg.norm(NN,axis=1)<area*.02))&valid
                if not bad.any():break
                seeds=np.unique(W[bad]);target=alpha.copy();target[seeds]*=.72
                for _ in range(2):
                    avg=np.bincount(e0,weights=target[e1],minlength=len(count))/degree
                    target=np.minimum(target,.58*target+.42*avg)
                alpha=np.minimum(alpha,target)
            fl,co=verify(F,G,T);mag=np.linalg.norm(A,axis=1);active=mag>1e-5
            f=float(np.average(alpha[w][active],weights=mag[active])) if active.any() else 0.
            peak=float(np.max(np.linalg.norm(G-F,axis=1)))
            if fl or co or f<.65 or peak<.0001:raise RuntimeError('unsafe/ineffective morph '+n+' factor='+str(f))
            key=body.shape_key_add(name=n);key.data.foreach_set('co',np.asarray([inv@Vector(p) for p in G],np.float32).ravel());key.value=0
            all_delta[n]=G-F
            morph_audit.append({'name':n,'peak_m':peak,'factor':f,'flips':fl,'collapsed':co,'localCorrectionIterations':it,'attenuatedVertices':int(np.sum(alpha[w]<.99))})
        combos=[]
        for ns in [('smile','blink_L','blink_R'),('jawOpen','browRaise'),('viseme_A','blink_L'),('browFrown','viseme_U')]:
            G=F+sum((all_delta[n] for n in ns),np.zeros_like(F))
            fl,co=verify(F,G,T)
            combos.append({'names':ns,'flips':fl,'collapsed':co,'pass':not(fl or co)})
        if bones(rig)!=B or [u.name for u in body.data.uv_layers]!=UV or not np.array_equal(triangles(body),T):raise RuntimeError('rig or topology changed')
        body.name=dest_id
        bpy.ops.object.select_all(action='DESELECT');body.select_set(True);rig.select_set(True);bpy.context.view_layer.objects.active=body
        dest=out/(dest_id+'.glb')
        bpy.ops.export_scene.gltf(filepath=str(dest),export_format='GLB',use_selection=True,export_skins=True,export_animations=False,export_morph=True,export_morph_normal=True)
        # Compare neutral before/after on the actual continuous mesh.
        scene=bpy.context.scene;scene.render.engine='BLENDER_WORKBENCH'
        scene.render.resolution_x=480;scene.render.resolution_y=560;scene.render.resolution_percentage=100
        scene.render.image_settings.file_format='PNG'
        sh=scene.display.shading;sh.light='STUDIO';sh.color_type='SINGLE';sh.single_color=(.60,.51,.44);sh.show_shadows=True;sh.show_cavity=True;sh.cavity_type='BOTH'
        bpy.ops.object.camera_add();cam=bpy.context.object;cam.data.type='ORTHO';scene.camera=cam
        for tag,angle,scale,cz,expr in [('full_front',0,2.0,.88,None),('full_side',90,2.0,.88,None),('face_front',0,.39,1.60,None),('face_side',90,.39,1.60,None),('face_45',45,.39,1.60,None),('smile',0,.39,1.60,'smile'),('open',0,.39,1.60,'jawOpen')]:
            for n in names:body.data.shape_keys.key_blocks[n].value=float(n==expr)
            center=Vector((0,-.07,cz));rad=math.radians(angle);cam.data.ortho_scale=scale
            cam.location=center+Vector((math.sin(rad),-math.cos(rad),0))*3
            cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler()
            scene.render.filepath=str(out/(dest_id+'_'+tag+'.png'));bpy.ops.render.render(write_still=True)
        digest=sha(dest)
        # Actual Blender re-import, not just checking the GLB header.
        ro,rr=load(dest,digest)
        if len(rr.data.bones)!=len(B) or not ro.data.shape_keys or not all(n in ro.data.shape_keys.key_blocks for n in names):raise RuntimeError('roundtrip lost skin/morph')
        if not np.isfinite(pos(ro)).all():raise RuntimeError('roundtrip nonfinite')
        result={'id':dest_id,'faceSource':ident,'bodySource':bid,'faceSHA256':rec['sha256'],'bodySHA256':br['sha256'],'motionSHA256':motion_records[ident]['sha256'],'sha256':digest,'vertices':len(P),'triangles':len(T),'bones':len(B),'identityFactor':factor,'identityPeak_m':float(np.max(np.linalg.norm(F-P,axis=1))),'faceMapP95_m':float(np.quantile(dist,.95)),'neckAnchorError_m':0,'newFaceFlips':flips,'collapsed':collapse,'morphs':morph_audit,'combinedMorphs':combos,'roundTrip':True,'visualApproved':False,'finalIdentity':False,'hairFit':False,'clothingFit':False,'motionApproved':False}
        results.append(result);print('R53 CONTINUOUS',json.dumps(result),flush=True)
    except Exception as e:
        failures.append({'id':dest_id,'error':str(e)});print('R53 FIT ERROR',failures[-1],flush=True)
    finally:
        (out/'integration.json').write_text(json.dumps({'classification':'male continuous mesh transfer studies; not final identities','models':results,'failures':failures},indent=2))
if failures or len(results)!=len(ids):raise RuntimeError('partial integration; see artifacts')
