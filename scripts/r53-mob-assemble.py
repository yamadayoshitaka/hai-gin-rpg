"""Assemble actual R53 mob assets with one shared rig.
Keep detached assets and the unmasked body intact; no visual/release approval.
"""
import bpy,numpy as np,sys,json,hashlib,math
from pathlib import Path
from mathutils import Vector,Matrix
from mathutils.bvhtree import BVHTree
args=sys.argv[sys.argv.index('--')+1:]
motion,wig,garment,out=map(lambda p:Path(p).resolve(),args[:4]);out.mkdir(parents=True,exist_ok=True)
ident,style=args[4:6]
def read(p):return json.loads(p.read_text())
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
mr=read(motion/'motion-report.json');wr=read(wig/'wig-fit-report.json')['models'][0];gr=read(garment/'garment-third-report.json');ar=read(garment/'motion-garment-report.json')
mp=motion/(ident+'_motion.glb');wp=wig/(ident+'_wig.glb');gp=garment/(ident+'_'+style+'_garment.glb')
if any(x['id']!=ident for x in (mr,wr,gr,ar)) or gr['style']!=style:raise RuntimeError('identity mismatch')
if any(sha(p)!=x['sha256'] for p,x in ((mp,mr),(wp,wr),(gp,gr))):raise RuntimeError('asset hash mismatch')
if not (mr['sourceBodySHA256']==wr['bodySHA256']==gr['bodySHA256']==ar['bodySHA256'] and ar['motionSHA256']==mr['sha256'] and ar['garmentSHA256']==gr['sha256']):raise RuntimeError('cross-asset provenance mismatch')
if sha(garment/'skin-mask-candidate.json')!=ar['maskSHA256']:raise RuntimeError('mask provenance')
if not (wig/'ATTRIBUTION.md').is_file():raise RuntimeError('missing hair credit')
(out/'ATTRIBUTION.md').write_bytes((wig/'ATTRIBUTION.md').read_bytes())
bpy.ops.wm.read_factory_settings(use_empty=True)
def load(p):
    before=set(bpy.context.scene.objects);bpy.ops.import_scene.gltf(filepath=str(p));bpy.context.view_layer.update()
    return [o for o in bpy.context.scene.objects if o not in before]
def rigof(o):return next((m.object for m in o.modifiers if m.type=='ARMATURE' and m.object),None)
def skinned(o):return o.type=='MESH' and rigof(o) is not None
def points(o,posed=False):
    if not posed:return np.array([o.matrix_world@v.co for v in o.data.vertices],np.float64)
    e=o.evaluated_get(bpy.context.evaluated_depsgraph_get());m=e.to_mesh()
    try:return np.array([e.matrix_world@v.co for v in m.vertices],np.float64)
    finally:e.to_mesh_clear()
def triangles(o):
    o.data.calc_loop_triangles();return np.array([tuple(t.vertices) for t in o.data.loop_triangles],np.int32)
def bind(a,b):
    if set(a.data.bones.keys())!=set(b.data.bones.keys()):raise RuntimeError('rig inventory mismatch')
    for n in a.data.bones.keys():
        A=np.array(a.matrix_world@a.data.bones[n].matrix_local);B=np.array(b.matrix_world@b.data.bones[n].matrix_local)
        if np.max(np.abs(A-B))>.002:raise RuntimeError('rest bind mismatch '+n)
def bvh(P,T):
    if not len(T) or not np.isfinite(P).all():raise RuntimeError('invalid collision mesh')
    return BVHTree.FromPolygons([Vector(tuple(float(v) for v in p)) for p in P],[tuple(int(v) for v in t) for t in T],all_triangles=True)
def pen(P,tree):
    d=[]
    for p in P:
        q,n,i,dist=tree.find_nearest(Vector(p))
        if q is None:raise RuntimeError('nearest surface unavailable')
        d.append((Vector(p)-q).dot(n))
    d=np.array(d);return {'penetrationProxy':float(np.mean(d<-.003)),'deepPenetrationProxy':float(np.mean(d<-.015))}
ms=load(mp);bs=[o for o in ms if skinned(o)]
if len(bs)!=1:raise RuntimeError('ambiguous animated body')
body=bs[0];rig=rigof(body);ad=rig.animation_data
if ad is None:raise RuntimeError('no rig animation')
clips=[x['clip'] for x in mr['clips']];names=[x['name'] for x in mr['morphs']]
if len(clips)!=10 or len(names)!=13 or not body.data.shape_keys or any(n not in body.data.shape_keys.key_blocks for n in names):raise RuntimeError('source morph/clip inventory')
acts={}
if ad.action:acts[ad.action.name]=ad.action
for tr in ad.nla_tracks:
    for st in tr.strips:
        if st.action:acts[st.action.name]=st.action
    tr.mute=True
selected={}
for name in clips:
    cand=[a for n,a in acts.items() if name.lower() in n.lower()]
    if len(cand)!=1:raise RuntimeError('missing or ambiguous clip '+name+' '+str(list(acts)))
    selected[name]=cand[0];cand[0].use_fake_user=True
ad.action=None
for tr in list(ad.nla_tracks):ad.nla_tracks.remove(tr)
def neutral():
    ad.action=None
    for b in rig.pose.bones:b.matrix_basis=Matrix.Identity(4)
    for n in names:body.data.shape_keys.key_blocks[n].value=0
    bpy.context.view_layer.update()
neutral();P=points(body);T=triangles(body);baseline=points(body,True)
if np.max(np.abs(P-baseline))>.002:raise RuntimeError('body not at rest')
gs=load(gp);clothes=[o for o in gs if skinned(o)]
if len(clothes)!=len(gr['parts']):raise RuntimeError('garment inventory')
for i,o in enumerate(clothes):
    bind(rigof(o),rig);M=o.matrix_world.copy();o.parent=None;o.matrix_world=M
    for mod in o.modifiers:
        if mod.type=='ARMATURE':mod.object=rig
    o.name='R53_Clothing_%02d'%i
for o in gs:
    if o not in clothes and o.name in bpy.data.objects:bpy.data.objects.remove(o,do_unlink=True)
ws=load(wp);hairs=[o for o in ws if o.type=='MESH']
if not hairs:raise RuntimeError('missing wig geometry')
hair_original={}
for i,o in enumerate(hairs):
    if rigof(o) is not None:raise RuntimeError('expected independent static wig')
    M=o.matrix_world.copy();o.parent=None;o.matrix_world=M
    o.name='R53_Hair_%02d'%i;hair_original[o.name]=points(o)
    o.vertex_groups.clear();g=o.vertex_groups.new(name='head');g.add(list(range(len(o.data.vertices))),1.,'REPLACE')
    m=o.modifiers.new('R53 head attachment','ARMATURE');m.object=rig
for o in ws:
    if o not in hairs and o.name in bpy.data.objects:bpy.data.objects.remove(o,do_unlink=True)
bpy.context.view_layer.update()
for o in hairs:
    if np.max(np.abs(points(o,True)-hair_original[o.name]))>.002:raise RuntimeError('wig rest attachment shift')
if np.max(np.abs(points(body)-P))>1e-10:raise RuntimeError('neutral body changed')
H=float(np.ptp(P[:,2]));center=Vector((P.min(0)+P.max(0))/2)
scene=bpy.context.scene;scene.render.engine='BLENDER_WORKBENCH';scene.render.resolution_x=480;scene.render.resolution_y=640;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';sh=scene.display.shading;sh.light='STUDIO';sh.color_type='TEXTURE';sh.show_cavity=True
bpy.ops.object.camera_add();cam=bpy.context.object;cam.data.type='ORTHO';scene.camera=cam
def render(tag,d,c=center,size=H*1.35):
    cam.data.ortho_scale=size;cam.location=c+Vector(d).normalized()*H*3;cam.rotation_euler=(c-cam.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath=str(out/(tag+'.png'));bpy.ops.render.render(write_still=True)
for tag,d in [('front',(0,-1,0)),('left',(-1,0,0)),('right',(1,0,0)),('rear',(0,1,0)),('threequarter',(1,-1,0))]:render('rest_'+tag,d)
headrest=rig.matrix_world@rig.data.bones['head'].matrix_local
checks=[]
for name,act in selected.items():
    neutral();ad.action=act
    lo,hi=map(float,act.frame_range)
    if hi<=lo:raise RuntimeError('invalid action range')
    for k,f in enumerate(np.linspace(lo,hi,3)):
        scene.frame_set(math.floor(f),subframe=float(f%1));bpy.context.view_layer.update()
        B=points(body,True);bt=bvh(B,T)
        headpose=rig.matrix_world@rig.pose.bones['head'].matrix
        transform=headpose@headrest.inverted();errors=[];haircheck=[]
        for o in hairs:
            Q=points(o,True);expected=np.array([transform@Vector(p) for p in hair_original[o.name]])
            errors.append(float(np.max(np.linalg.norm(Q-expected,axis=1))));haircheck.append({'part':o.name,**pen(Q,bt)})
        if max(errors)>.003:raise RuntimeError('hair fails head tracking '+name+' '+str(errors))
        checks.append({'clip':name,'frame':float(f),'hairTrackingMaxError_m':max(errors),'hair':haircheck,'clothing':[{'part':o.name,**pen(points(o,True),bt)} for o in clothes]})
        if k==1:render('action_'+name,(1,-2,0))
neutral()
facecenter=Vector((0,float(np.quantile(P[P[:,2]>P[:,2].max()-.18,1],.5)),float(P[:,2].max()-.10)))
for name in ('smile','viseme_A','blink_L'):
    body.data.shape_keys.key_blocks[name].value=1;bpy.context.view_layer.update()
    render('expression_'+name,(0,-1,0),facecenter,.42)
    body.data.shape_keys.key_blocks[name].value=0
neutral()
for name,act in selected.items():
    tr=ad.nla_tracks.new();tr.name='R53_'+name;tr.strips.new('R53_'+name,1,act)
bpy.ops.object.select_all(action='DESELECT')
for o in [body,rig]+clothes+hairs:o.select_set(True)
bpy.context.view_layer.objects.active=body
dest=out/(ident+'_assembled.glb')
opts=dict(filepath=str(dest),export_format='GLB',use_selection=True,export_skins=True,export_animations=True,export_morph=True)
props=bpy.ops.export_scene.gltf.get_rna_type().properties
if 'export_animation_mode' in props and 'NLA_TRACKS' in props['export_animation_mode'].enum_items.keys():opts['export_animation_mode']='NLA_TRACKS'
elif 'export_nla_strips' in props:opts['export_nla_strips']=True
else:raise RuntimeError('unsupported animation export')
bpy.ops.export_scene.gltf(**opts)
raw=dest.read_bytes();j=json.loads(raw[20:20+int.from_bytes(raw[12:16],'little')])
if len(j.get('skins',[]))!=1:raise RuntimeError('expected one exported shared rig')
if not any(all(n in m.get('extras',{}).get('targetNames',[]) for n in names) for m in j['meshes']):raise RuntimeError('export lost morphs')
exported=[a.get('name','') for a in j.get('animations',[])]
if not all(any(n.lower() in a.lower() for a in exported) for n in clips):raise RuntimeError('export lost actions')
# Re-import the actual exported result; verify all mesh parts use same armature.
expectedParts=1+len(clothes)+len(hairs)
bpy.ops.wm.read_factory_settings(use_empty=True);objs=load(dest);parts=[o for o in objs if skinned(o)]
if len(parts)!=expectedParts or len({rigof(o) for o in parts})!=1:raise RuntimeError('roundtrip shared rig or mesh inventory')
if not any(o.data.shape_keys and all(n in o.data.shape_keys.key_blocks for n in names) for o in parts):raise RuntimeError('roundtrip lost expressions')
result={'id':ident,'style':style,'sha256':sha(dest),'bodySHA256':mr['sourceBodySHA256'],'motionSHA256':mr['sha256'],'wigSHA256':wr['sha256'],'garmentSHA256':gr['sha256'],'skinMaskCandidateSHA256':ar['maskSHA256'],'meshCount':len(parts),'rigCount':1,'morphs':names,'clips':clips,'samples':checks,'roundTrip':True,'skinMaskApplied':False,'visualApproved':False,'productionApproved':False,'classification':'assembled review candidate, not collision-free or release-approved'}
(out/'assembly-report.json').write_text(json.dumps(result,indent=2));print('R53 assembled mob',ident,len(parts),len(checks),flush=True)
