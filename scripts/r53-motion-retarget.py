"""Retarget actual CC0 UAL animation to HM08 rig candidates; not mocap/visual approval."""
import bpy,numpy as np,math,sys,json,hashlib,re
from pathlib import Path
from mathutils import Vector,Quaternion
args=sys.argv[sys.argv.index('--')+1:]
source,root,out=map(lambda x:Path(x).resolve(),args[:3]);out.mkdir(parents=True,exist_ok=True)
ident=args[3]
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
if sha(source)!='69591853d817488edaa8fd9bf8fc1d821eaeaf789f8627b3cd23b41c4ed67997':raise RuntimeError('unexpected UAL source')
records={}
for p in root.rglob('body-candidates.json'):
    for m in json.loads(p.read_text())['models']:records[m['id']]=(p.parent,m)
for p in root.rglob('integration.json'):
    for m in json.loads(p.read_text())['models']:records[m['id']]=(p.parent,m)
folder,rec=records[ident];bodyfile=folder/(ident+'.glb')
if sha(bodyfile)!=rec['sha256']:raise RuntimeError('body SHA mismatch')
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(source));bpy.context.view_layer.update()
sr=[o for o in bpy.context.scene.objects if o.type=='ARMATURE' and len(o.data.bones)>20]
if len(sr)!=1:raise RuntimeError('ambiguous source rig '+str([o.name for o in sr]))
src=sr[0];sourceobjs=list(bpy.context.scene.objects)
print('UAL bones',list(src.data.bones.keys()),flush=True)
# Collect only actions actually attached to the source armature.
ad=src.animation_data
if not ad:raise RuntimeError('no source animation')
acts={}
if ad.action:acts[ad.action.name]=ad.action
for track in ad.nla_tracks:
    for st in track.strips:
        if st.action:acts[st.action.name]=st.action
for a in bpy.data.actions:
    if any(f.data_path.startswith('pose.bones[') for f in a.fcurves):acts.setdefault(a.name,a)
print('UAL actions',list(acts),flush=True)
for tr in ad.nla_tracks:tr.mute=True
def pick(name):
    # Blender glTF import appends the rig name to each UAL action.
    # Match exact clip IDs only; never accept substring matches such as
    # Swim_Idle_Loop or Sitting_Idle_Loop for the neutral standing idle.
    expected={name.casefold(),(name+'_Armature').casefold(),(name+'|Armature').casefold()}
    q=[a for n,a in acts.items() if n.casefold() in expected]
    if len(q)!=1:raise RuntimeError('missing/ambiguous exact source clip '+name+' '+str([a.name for a in q]))
    print('R53 selected source clip',name,q[0].name,flush=True)
    return q[0]
clips=['Idle_Loop','Walk_Loop','Sprint_Loop','Sword_Attack']
for name in clips:pick(name)
bpy.ops.import_scene.gltf(filepath=str(bodyfile));bpy.context.view_layer.update()
meshlist=[o for o in bpy.context.scene.objects if o not in sourceobjs and o.type=='MESH' and any(m.type=='ARMATURE' and m.object for m in o.modifiers)]
if len(meshlist)!=1:raise RuntimeError('target body ambiguous')
body=meshlist[0];rig=next(m.object for m in body.modifiers if m.type=='ARMATURE' and m.object)
print('HM08 bones',list(rig.data.bones.keys()),flush=True)
def norm(n):return re.sub('[^a-z0-9]','',n.lower())
def find(bones,aliases,required=True):
    for name in aliases:
        exact=[b for b in bones if norm(b.name)==norm(name)]
        if len(exact)==1:return exact[0]
    if required:raise RuntimeError('missing joint '+str(aliases))
    return None
mapping=[]
def add(snames,tnames,required=True):
    a=find(src.data.bones,snames,required);b=find(rig.data.bones,tnames,required)
    if a and b:
        if any(x[1]==b.name for x in mapping):raise RuntimeError('duplicate target joint '+b.name)
        mapping.append((a.name,b.name))
add(['pelvis','hips'],['pelvis','hips'])
add(['spine_01'],['spine01','spine_01','spine'])
add(['spine_02'],['spine02','spine_02'],False)
add(['spine_03'],['spine03','spine_03','chest'],False)
add(['neck_01'],['neck01','neck'],False)
add(['head'],['head'])
for side in ('l','r'):
    for sn,tn in [('clavicle',['clavicle','shoulder']),('upperarm',['upperarm01','upperarm']),('lowerarm',['lowerarm01','lowerarm','forearm']),('hand',['hand','wrist']),('thigh',['upperleg01','upperleg','thigh']),('calf',['lowerleg01','lowerleg','calf','shin']),('foot',['foot']),('ball',['toe','toe01','ball'])]:
        ta=[v+sep+side for v in tn for sep in ('.','_','')]
        add([sn+'_'+side],ta,sn not in ('clavicle','ball'))
    for f in ('thumb','index','middle','ring','pinky'):
        for j in (1,2,3):
            ta=[f'{prefix}{num}{sep}{side}' for prefix in ([f,'little'] if f=='pinky' else [f]) for num in (f'{j:02d}',str(j),f'_{j:02d}') for sep in ('.','_','')]
            add([f'{f}_{j:02d}_{side}'],ta,False)
if len(mapping)<15:raise RuntimeError('insufficient primary mapping')
# Conjugate local motion by source/target rest-world rotation, with no
# translation except existing root bind transform. This remains a candidate
# for human review of axis convention, T/A pose, hands and foot contacts.
transforms={}
for a,b in mapping:
    sq=(src.matrix_world@src.data.bones[a].matrix_local).to_quaternion()
    tq=(rig.matrix_world@rig.data.bones[b].matrix_local).to_quaternion()
    transforms[b]=tq.inverted()@sq
sourcefps=bpy.context.scene.render.fps/bpy.context.scene.render.fps_base
if not 1<=sourcefps<=120:raise RuntimeError('invalid source fps')
# Age/body profiles are explicitly artistic amplitude and tempo studies, not
# recorded age-specific motion. Keep original source timing in metadata.
key=ident
if 'under10' in key:profile='child';tempo=1.12;strength=.90
elif any(x in key for x in ('60s','70s','80plus')):profile='senior';tempo=.78;strength=.72
elif 'obese' in key or ident in ('male_continuous_05','male_continuous_06'):profile='heavy';tempo=.86;strength=.85
else:profile='adult';tempo=1.;strength=1.
# Capture source action before removing external skeleton. Use actual sampled
# pose rotation deltas; retain source digest and per-clip frame range.
samples={}
scene=bpy.context.scene
for name in clips:
    act=pick(name);ad.action=act
    lo,hi=map(float,act.frame_range);duration=(hi-lo)/sourcefps
    if not .08<duration<30:raise RuntimeError('unexpected clip duration '+name)
    fps=24;frames=max(3,int(round(duration/tempo*fps))+1)
    values=[]
    for j in range(frames):
        f=lo+(hi-lo)*j/(frames-1);scene.frame_set(math.floor(f),subframe=f%1);bpy.context.view_layer.update()
        row={}
        for a,b in mapping:
            q=src.pose.bones[a].matrix_basis.to_quaternion();x=transforms[b];v=x@q@x.inverted()
            row[b]=Quaternion().slerp(v,strength)
        values.append(row)
    samples[name]=(act.name,lo,hi,duration,values)
ad.action=None
for o in sourceobjs:
    if o.name in bpy.data.objects:bpy.data.objects.remove(o,do_unlink=True)
rig.animation_data_clear();rig.animation_data_create()
scene.render.fps=24;scene.render.fps_base=1
for p in rig.pose.bones:
    p.rotation_mode='QUATERNION';p.rotation_quaternion=Quaternion();p.location=(0,0,0);p.scale=(1,1,1)
def evaluated():
    bpy.context.view_layer.update()
    o=body.evaluated_get(bpy.context.evaluated_depsgraph_get());m=o.to_mesh()
    try:return np.array([o.matrix_world@v.co for v in m.vertices],np.float64)
    finally:o.to_mesh_clear()
scene.frame_set(1);base=evaluated();report=[];actions=[]
mesh=body.data;mesh.calc_loop_triangles()
T=np.array([tuple(t.vertices) for t in mesh.loop_triangles],np.int32)
def area(P):
    v=P[T];return np.linalg.norm(np.cross(v[:,1]-v[:,0],v[:,2]-v[:,0]),axis=1)
valid=area(base)>1e-11
for name,(original,lo,hi,duration,rows) in samples.items():
    act=bpy.data.actions.new('R53_'+name);rig.animation_data.action=act
    previous={}
    for frame,row in enumerate(rows,1):
        for b,q in row.items():
            q=q.copy()
            if b in previous and q.dot(previous[b])<0:q.negate()
            previous[b]=q.copy()
            p=rig.pose.bones[b];p.rotation_quaternion=q;p.keyframe_insert(data_path='rotation_quaternion',frame=frame,group=b)
    for f in act.fcurves:
        for k in f.keyframe_points:k.interpolation='LINEAR'
    checks=[]
    for frame in sorted(set([1,len(rows)//4,len(rows)//2,len(rows)*3//4,len(rows)])):
        scene.frame_set(max(1,frame));P=evaluated()
        if P.shape!=base.shape or not np.isfinite(P).all():raise RuntimeError('invalid posed body '+name)
        delta=float(np.max(np.linalg.norm(P-base,axis=1)))
        collapsed=int(np.sum((area(P)<area(base)*.02)&valid))
        checks.append({'frame':frame,'maxDisplacement_m':delta,'nearZeroTriangles':collapsed,'lowestPoint_m':float(P[:,2].min()),'highestPoint_m':float(P[:,2].max())})
    if max(c['maxDisplacement_m'] for c in checks)<.001 or max(c['maxDisplacement_m'] for c in checks)>2:raise RuntimeError('ineffective/unstable motion '+name)
    scene.frame_set(1);first=evaluated();temporal=[]
    for frame in sorted(set([max(2,len(rows)//4),max(2,len(rows)//2),max(2,len(rows)*3//4),len(rows)])):
        scene.frame_set(frame);P=evaluated();temporal.append(float(np.max(np.linalg.norm(P-first,axis=1))))
    if max(temporal)<.0005:raise RuntimeError('clip is static across time '+name)
    print('R53 clip pose verified',ident,name,'frames',len(rows),'temporal variation',max(temporal),flush=True)
    # Render real posed meshes at two frames for manual inspection.
    scene.render.engine='BLENDER_WORKBENCH';scene.render.resolution_x=400;scene.render.resolution_y=560;scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG';sh=scene.display.shading;sh.light='STUDIO';sh.color_type='SINGLE';sh.single_color=(.59,.51,.46);sh.show_cavity=True
    if scene.camera is None:
        bpy.ops.object.camera_add();scene.camera=bpy.context.object;scene.camera.data.type='ORTHO'
    cam=scene.camera;H=float(np.ptp(base[:,2]));center=Vector((base.min(0)+base.max(0))/2)
    cam.data.ortho_scale=H*1.35
    for frame in (1,max(2,len(rows)//2)):
        scene.frame_set(frame)
        for tag,direction in [('front',(0,-1,0)),('side',(1,0,0))]:
            cam.location=center+Vector(direction)*H*3;cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler()
            scene.render.filepath=str(out/f'{name}_{frame}_{tag}.png');bpy.ops.render.render(write_still=True)
    report.append({'clip':name,'sourceAction':original,'sourceFrameRange':[lo,hi],'sourceDuration_s':duration,'targetFrames':len(rows),'temporalVariation_m':max(temporal),'sampleChecks':checks})
    actions.append((name,act,len(rows)));rig.animation_data.action=None
# Export named NLA clips and preserve existing expression morph targets.
for name,act,frames in actions:
    tr=rig.animation_data.nla_tracks.new();tr.name='R53_'+name;st=tr.strips.new('R53_'+name,1,act)
bpy.ops.object.select_all(action='DESELECT');body.select_set(True);rig.select_set(True);bpy.context.view_layer.objects.active=body
dest=out/(ident+'_motion.glb')
bpy.ops.export_scene.gltf(filepath=str(dest),export_format='GLB',use_selection=True,export_skins=True,export_animations=True,export_nla_strips=True,export_morph=True)
raw=dest.read_bytes();n=int.from_bytes(raw[12:16],'little');g=json.loads(raw[20:20+n]);exported=[a.get('name','') for a in g.get('animations',[])]
if not g.get('skins') or not all(any(name.lower() in e.lower() for e in exported) for name in clips):raise RuntimeError('missing exported clip '+str(exported))
if ident.startswith('male_continuous_'):
    required=['jawOpen','viseme_A','viseme_I','viseme_U','viseme_E','viseme_O','smile','blink_L','blink_R','browRaise','browFrown']
    if not any(all(k in m.get('extras',{}).get('targetNames',[]) for k in required) for m in g.get('meshes',[])):raise RuntimeError('expression morphs lost')
(out/'motion-report.json').write_text(json.dumps({'id':ident,'sourceBodySHA256':rec['sha256'],'animationSourceSHA256':sha(source),'license':'Quaternius Universal Animation Library CC0 1.0','profile':profile,'tempo':tempo,'rotationAmplitude':strength,'mapping':mapping,'clips':report,'exportedClips':exported,'sha256':sha(dest),'visualApproved':False,'footLockApproved':False,'weaponGripApproved':False,'productionApproved':False},indent=2))
print('R53 motion candidate',ident,profile,len(mapping),exported,flush=True)
