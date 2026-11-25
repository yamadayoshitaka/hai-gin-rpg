"""R53 base-body LOD and measured anatomical inventory. Not final face/garment QA."""
import bpy, numpy as np, json, sys, hashlib, math
from pathlib import Path
from mathutils import Vector
args=sys.argv[sys.argv.index('--')+1:]
src,out=map(lambda x:Path(x).resolve(),args[:2]);out.mkdir(parents=True,exist_ok=True)
records=json.loads((src/'body-candidates.json').read_text())['models']
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def load(p):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(p));bpy.context.view_layer.update()
    a=[o for o in bpy.context.scene.objects if o.type=='MESH' and any(m.type=='ARMATURE' and m.object for m in o.modifiers)]
    if len(a)!=1:raise RuntimeError('ambiguous anatomical mesh')
    o=a[0];rig=next(m.object for m in o.modifiers if m.type=='ARMATURE' and m.object)
    return o,rig
def positions(o):return np.array([o.matrix_world@v.co for v in o.data.vertices],np.float64)
def tris(o):
    o.data.calc_loop_triangles()
    return np.array([tuple(t.vertices) for t in o.data.loop_triangles],np.int32)
def signature(r):return [(b.name,b.parent.name if b.parent else None,tuple(b.head_local),tuple(b.tail_local)) for b in r.data.bones]
def weight_check(o,r):
    ids={g.index for g in o.vertex_groups if g.name in r.data.bones}
    sums=np.array([sum(g.weight for g in v.groups if g.group in ids) for v in o.data.vertices])
    if not np.isfinite(sums).all() or np.any(sums<1e-6):raise RuntimeError('unweighted vertices')
    return float(sums.min()),float(sums.max())
def measurements(o,r):
    P=positions(o);lo=P.min(0);hi=P.max(0);height=hi[2]-lo[2]
    h=(P[:,2]-lo[2])/height
    bands={}
    for n,a,b in [('hips',.46,.50),('waist',.55,.59),('abdomen',.59,.63),('chest',.69,.74),('neck',.855,.88),('head',.94,.985)]:
        q=P[(h>=a)&(h<=b)&(np.abs(P[:,0])<height*(.20 if n in ('hips','chest') else .13))]
        if len(q)<8:raise RuntimeError('insufficient band samples '+n)
        bands[n]={'width_m':float(np.ptp(q[:,0])),'depth_m':float(np.ptp(q[:,1])),'samples':len(q),'height_fraction':[a,b]}
    return {'height_m':float(height),'bounds_m':[lo.tolist(),hi.tolist()],'bands':bands,'joints_m':{b.name:list(r.matrix_world@b.head_local) for b in r.data.bones},'classification':'actual model mesh sections; not source-image measurements'}
def pose_probe(o,r):
    # Controlled bend probes are not authored walk/run motion.
    bones=[p for p in r.pose.bones if p.name.lower().startswith(('upperarm','lowerarm','upperleg','lowerleg','spine','neck'))]
    if len(bones)<8:raise RuntimeError('insufficient probe joints')
    base=positions(o)
    for b in bones:
        b.rotation_mode='XYZ';b.rotation_euler=(0,0,0)
    evidence=[]
    for direction in (-1,1):
        for b in bones:
            b.rotation_euler=(direction*math.radians(12),0,0)
        bpy.context.view_layer.update()
        e=o.evaluated_get(bpy.context.evaluated_depsgraph_get());m=e.to_mesh()
        try:
            P=np.array([e.matrix_world@v.co for v in m.vertices])
            if P.shape!=base.shape or not np.isfinite(P).all():raise RuntimeError('pose evaluation failed')
            delta=float(np.max(np.linalg.norm(P-base,axis=1)))
            if delta<.001 or delta>3.:raise RuntimeError('ineffective or unstable pose')
            evidence.append({'probe':direction,'max_displacement_m':delta})
        finally:e.to_mesh_clear()
    for b in bones:b.rotation_euler=(0,0,0)
    bpy.context.view_layer.update()
    return evidence
def validate_mesh(o,r):
    P=positions(o);T=tris(o)
    if not np.isfinite(P).all() or not len(T):raise RuntimeError('invalid geometry')
    q=P[T];area=np.linalg.norm(np.cross(q[:,1]-q[:,0],q[:,2]-q[:,0]),axis=1)
    # Report inherited microscopic faces; do not claim collision quality.
    return {'vertices':len(P),'triangles':len(T),'zero_area_triangles':int(np.sum(area<=1e-12)),'weight_sum_range':weight_check(o,r)}
def export(o,r,p):
    bpy.ops.object.select_all(action='DESELECT');o.select_set(True);r.select_set(True);bpy.context.view_layer.objects.active=o
    bpy.ops.export_scene.gltf(filepath=str(p),export_format='GLB',use_selection=True,export_skins=True,export_animations=False)
def render(o,r,p):
    scene=bpy.context.scene;scene.render.engine='BLENDER_WORKBENCH'
    scene.render.resolution_x=360;scene.render.resolution_y=460;scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG';sh=scene.display.shading;sh.light='STUDIO';sh.color_type='SINGLE';sh.single_color=(.60,.51,.44);sh.show_cavity=True;sh.cavity_type='BOTH'
    P=positions(o);lo=P.min(0);hi=P.max(0);center=Vector((lo+hi)/2);height=hi[2]-lo[2]
    bpy.ops.object.camera_add();cam=bpy.context.object;cam.data.type='ORTHO';cam.data.ortho_scale=height*1.18;scene.camera=cam
    cam.location=center+Vector((.5,-1,0))*height*3;cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath=str(p);bpy.ops.render.render(write_still=True)
results=[];failures=[]
for rec in records:
    ident=rec['id'];p=src/(ident+'.glb')
    try:
        if sha(p)!=rec['sha256']:raise RuntimeError('LOD0 source hash mismatch')
        o,r=load(p);sig=signature(r);uv=len(o.data.uv_layers);orig=validate_mesh(o,r)
        measure=measurements(o,r);measure.update(id=ident,source_sha256=rec['sha256'],ageBand=rec['ageBand'],build=rec['build'],sex=rec['sex'])
        (out/(ident+'-measurements.json')).write_text(json.dumps(measure,indent=2))
        probes=pose_probe(o,r);levels=[]
        for name,ratio in [('lod1',.55),('lod2',.25)]:
            o,r=load(p)
            if o.data.shape_keys:raise RuntimeError('do not decimate morph source')
            bpy.context.view_layer.objects.active=o;o.select_set(True)
            mod=o.modifiers.new('R53 base body '+name,'DECIMATE');mod.decimate_type='COLLAPSE';mod.ratio=ratio
            # Simplify the bind mesh before skin evaluation.
            while list(o.modifiers).index(mod)>0:bpy.ops.object.modifier_move_up(modifier=mod.name)
            bpy.ops.object.modifier_apply(modifier=mod.name)
            if signature(r)!=sig or len(o.data.uv_layers)!=uv:raise RuntimeError('rig/UV regression')
            stats=validate_mesh(o,r)
            if stats['triangles']>=orig['triangles'] or stats['zero_area_triangles']>orig['zero_area_triangles']:raise RuntimeError('decimation regression')
            dest=out/(ident+'_'+name+'.glb');export(o,r,dest)
            o2,r2=load(dest);roundtrip=validate_mesh(o2,r2)
            if len(r2.data.bones)!=len(sig) or len(o2.data.uv_layers)!=uv or roundtrip['triangles']!=stats['triangles']:raise RuntimeError('roundtrip mismatch')
            pose=pose_probe(o2,r2)
            if rec['build'] in ('normal','obese'):render(o2,r2,out/(ident+'_'+name+'.png'))
            levels.append({'name':name,'sha256':sha(dest),'bytes':dest.stat().st_size,**roundtrip,'poseProbes':pose})
        if levels[1]['triangles']>=levels[0]['triangles']:raise RuntimeError('LOD ordering incorrect')
        results.append({'id':ident,'sourceSHA256':rec['sha256'],'lod0':orig,'lod0PoseProbes':probes,'levels':levels,'visualApproved':False,'walkRunApproved':False,'finalCharacter':False})
    except Exception as e:
        failures.append({'id':ident,'error':str(e)});print('R53 LOD FAILURE',failures[-1],flush=True)
    finally:
        (out/'lod-inventory.json').write_text(json.dumps({'models':results,'failures':failures},indent=2))
if failures or len(results)!=len(records):raise RuntimeError('partial base LOD generation')
