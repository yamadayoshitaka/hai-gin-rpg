"""Render model-derived character reference atlas; no deployment.
Measurements are actual neutral exported mesh/rig distances, not real-life anthropometry.
"""
import bpy,sys,json,hashlib,math
import numpy as np
from pathlib import Path
from mathutils import Vector,Matrix
args=sys.argv[sys.argv.index('--')+1:]
root,out,reg=map(Path,args[:3]);shard=int(args[3]);out.mkdir(parents=True,exist_ok=True)
rows=json.loads(reg.read_text())['records']
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def pts(o):
    return np.array([tuple(o.matrix_world@v.co) for v in o.data.vertices],float)
def measure(o,rig):
    P=pts(o);lo=P.min(0);hi=P.max(0);H=float(hi[2]-lo[2])
    if not .3<H<3:raise ValueError('body height out of range '+str(H))
    bones={b.name:np.array(tuple(rig.matrix_world@b.head_local)) for b in rig.data.bones}
    def span(a,b):
        return float(np.linalg.norm(bones[a]-bones[b])) if a in bones and b in bones else None
    def section(f):
        # Sample center torso only: excludes outstretched hands and forearms
        # where possible; width/depth of the actual body mesh at this height.
        z=lo[2]+f*H;center=(lo[0]+hi[0])/2
        v=P[(abs(P[:,2]-z)<H*.015)&(abs(P[:,0]-center)<H*.22)]
        return {'width_m':float(np.ptp(v[:,0])),'depth_m':float(np.ptp(v[:,1])),'samples':len(v),'heightFraction':f} if len(v)>=8 else None
    return {'height_m':H,'bodySpanX_m':float(hi[0]-lo[0]),'bodyDepth_m':float(hi[1]-lo[1]),'eyeBoneDistance_m':span('eye.L','eye.R'),'shoulderBoneDistance_m':span('upperarm01.L','upperarm01.R'),'hipBoneDistance_m':span('upperleg01.L','upperleg01.R'),'leftUpperArmSegment_m':span('upperarm01.L','lowerarm01.L'),'leftForearmSegment_m':span('lowerarm01.L','wrist.L'),'leftThighSegment_m':span('upperleg01.L','lowerleg01.L'),'leftShinSegment_m':span('lowerleg01.L','foot.L'),'torsoSections':{str(f):section(f) for f in (.52,.60,.68,.76,.84)},'measurementBasis':'neutral unposed body mesh, rest bone head distances; cross sections are sampled estimates; missing bones null','bodyMesh':o.name},lo,hi,bones
for row in rows[shard::6]:
    i=row['id'];kind=row['sourceKind'];d=out/i;d.mkdir(exist_ok=True)
    if kind=='hero':
        a=root/'hero';p=a/'continuous-neck-study'/(i+'_continuous_neck.glb');r=json.loads((a/'continuous-neck-study'/'continuous-neck-report.json').read_text())
        if not r.get('continuousNeckCandidate') or not r.get('exportInventoryVerified'):raise ValueError('hero assembly '+i)
    else:
        a=root/kind/(('r53-cast-quality-' if kind=='cast' else 'r53-mob-assembled-')+i);p=a/(i+'_assembled.glb');r=json.loads((a/'assembly-report.json').read_text())
        if r.get('id')!=i or not r.get('roundTrip'):raise ValueError('assembly '+i)
    h=sha(p)
    if h!=r['sha256']:raise ValueError('model checksum '+i)
    bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(p))
    sc=bpy.context.scene;rigs=[o for o in sc.objects if o.type=='ARMATURE']
    if len(rigs)!=1:raise ValueError('rig '+i)
    rig=rigs[0];rig.animation_data_clear()
    for b in rig.pose.bones:b.matrix_basis=Matrix.Identity(4)
    rig.data.pose_position='REST'
    mesh=[o for o in sc.objects if o.type=='MESH' and len(o.data.vertices)]
    for o in mesh:
        if o.data.shape_keys:
            for k in o.data.shape_keys.key_blocks:k.value=0
    bpy.context.view_layer.update()
    # Prefer actual anatomical body (all facial shapes), never armor bounds.
    bodies=[o for o in mesh if o.name.startswith('R53_ContinuousSkin')]
    if not bodies:bodies=[o for o in mesh if o.data.shape_keys and all(n in o.data.shape_keys.key_blocks for n in ('jawOpen','smile','blink_L','blink_R')) and not any(k in o.name.lower() for k in ('brow','lash','teeth','tongue','beard','hair'))]
    if not bodies:raise ValueError('no measured body '+i)
    body=max(bodies,key=lambda o:np.ptp(pts(o)[:,2]))
    m,lo,hi,bones=measure(body,rig)
    P=np.concatenate([pts(o) for o in mesh]);a0=P.min(0);a1=P.max(0);center=Vector((a0+a1)/2)
    sc.render.engine='BLENDER_WORKBENCH';sc.render.resolution_x=600;sc.render.resolution_y=800;sc.render.resolution_percentage=100;sc.render.image_settings.file_format='PNG'
    sh=sc.display.shading;sh.light='STUDIO';sh.color_type='TEXTURE';sh.show_cavity=True
    bpy.ops.object.camera_add();cam=bpy.context.object;cam.data.type='ORTHO';sc.camera=cam
    def render(name,dir,focus,scale):
        cam.data.ortho_scale=scale;cam.location=focus+Vector(dir).normalized()*m['height_m']*3
        cam.rotation_euler=(focus-cam.location).to_track_quat('-Z','Y' if abs(dir[2])<.95 else 'X').to_euler()
        sc.render.filepath=str(d/(name+'.png'));bpy.ops.render.render(write_still=True)
        return name+'.png'
    dirs=[('front',(0,-1,0)),('rear',(0,1,0)),('left',(-1,0,0)),('right',(1,0,0)),('top',(0,0,1)),('bottom',(0,0,-1)),('front_left_45',(-1,-1,0)),('front_right_45',(1,-1,0)),('rear_left_45',(-1,1,0))]
    # orthographic full-body scale identical across four horizontal views
    scale=max(float(np.ptp(P[:,2]))*1.12,float(np.ptp(P[:,0]))*1.50,float(np.ptp(P[:,1]))*1.50)
    full={n:render('body_'+n,v,center,scale) for n,v in dirs if n in ('front','rear','left','front_right_45')}
    eye0=(bones['eye.L']+bones['eye.R'])/2 if 'eye.L' in bones and 'eye.R' in bones else np.array([(lo[0]+hi[0])/2,(lo[1]+hi[1])/2,hi[2]-m['height_m']*.055])
    focus=Vector(eye0);focus.z-=m['height_m']*.025
    headScale=m['height_m']*.25
    sc.render.resolution_x=640;sc.render.resolution_y=640
    head={n:render('head_'+n,v,focus,headScale) for n,v in dirs}
    rec={**row,'modelSHA256':h,'measurements':m,'images':{'body':full,'head':head},'renderBasis':'actual GLB neutral rest pose; matched orthographic camera; not an AI illustration','referenceApproved':False,'visualApproved':False,'productionApproved':False}
    (d/'record.json').write_text(json.dumps(rec,ensure_ascii=False,indent=2))
    print('REGISTERED CANDIDATE',i,h,m['height_m'],flush=True)
