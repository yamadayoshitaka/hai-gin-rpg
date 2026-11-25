"""R53 assembled mob LOD candidates. Preserve body morph topology by design.
Decimate only hair/clothing; preserve actual UV/material/skin and animations.
Measure posed surface and penetration regression, not mobile FPS approval.
"""
import bpy,numpy as np,sys,json,hashlib,math
from pathlib import Path
from mathutils import Vector,Matrix
from mathutils.bvhtree import BVHTree
args=sys.argv[sys.argv.index('--')+1:]
src,out=map(lambda x:Path(x).resolve(),args[:2]);out.mkdir(parents=True,exist_ok=True);ident=args[2]
rec=json.loads((src/'assembly-report.json').read_text());p=src/(ident+'_assembled.glb')
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
if rec['id']!=ident or sha(p)!=rec['sha256'] or rec['rigCount']!=1:raise RuntimeError('invalid source')
(out/'ATTRIBUTION.md').write_bytes((src/'ATTRIBUTION.md').read_bytes())
names=rec['morphs'];clips=rec['clips']
def rigof(o):return next((m.object for m in o.modifiers if m.type=='ARMATURE' and m.object),None)
def pos(o,pose=False):
    if not pose:return np.array([o.matrix_world@v.co for v in o.data.vertices],np.float64)
    e=o.evaluated_get(bpy.context.evaluated_depsgraph_get());m=e.to_mesh()
    try:return np.array([e.matrix_world@v.co for v in m.vertices],np.float64)
    finally:e.to_mesh_clear()
def tri(o):
    o.data.calc_loop_triangles();return np.array([tuple(t.vertices) for t in o.data.loop_triangles],np.int32)
def load(p):
    bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(p));bpy.context.view_layer.update()
    parts=[o for o in bpy.context.scene.objects if o.type=='MESH' and rigof(o)]
    if len(parts)!=rec['meshCount'] or len({rigof(o) for o in parts})!=1:raise RuntimeError('shared rig or part inventory mismatch')
    bs=[o for o in parts if o.data.shape_keys and all(n in o.data.shape_keys.key_blocks for n in names)]
    if len(bs)!=1:raise RuntimeError('body morph inventory mismatch')
    body=bs[0];rig=rigof(body)
    others=[o for o in parts if o!=body]
    if any(o.data.shape_keys for o in others):raise RuntimeError('cannot simplify additional morph meshes')
    if any(not o.name.startswith(('R53_Hair_','R53_Clothing_')) for o in others):raise RuntimeError('unexpected accessory names '+str([o.name for o in others]))
    ad=rig.animation_data
    if not ad:raise RuntimeError('missing action data')
    acts={}
    if ad.action:acts[ad.action.name]=ad.action
    for tr in ad.nla_tracks:
        for st in tr.strips:
            if st.action:acts[st.action.name]=st.action
        tr.mute=True
    selected={}
    for name in clips:
        matches=[a for n,a in acts.items() if name.lower() in n.lower()]
        if len(matches)!=1:raise RuntimeError('action missing/ambiguous '+name)
        selected[name]=matches[0];matches[0].use_fake_user=True
    ad.action=None
    for tr in list(ad.nla_tracks):ad.nla_tracks.remove(tr)
    def reset():
        ad.action=None
        for b in rig.pose.bones:b.matrix_basis=Matrix.Identity(4)
        for n in names:body.data.shape_keys.key_blocks[n].value=0
        bpy.context.view_layer.update()
    reset()
    return body,rig,others,ad,selected,reset
def sig(r):
    return {b.name:(b.parent.name if b.parent else None,np.array(r.matrix_world@b.matrix_local)) for b in r.data.bones}
def checkrig(a,b):
    if set(a)!=set(b) or any(a[n][0]!=b[n][0] or np.max(np.abs(a[n][1]-b[n][1]))>.002 for n in a):raise RuntimeError('rig regression')
def mat_sig(o):
    return sorted(m.name for m in o.data.materials if m)
def stats(o,r):
    P=pos(o);T=tri(o)
    if not np.isfinite(P).all() or len(T)<1:raise RuntimeError('invalid geometry')
    q=P[T];area=np.linalg.norm(np.cross(q[:,1]-q[:,0],q[:,2]-q[:,0]),axis=1)
    ids={g.index for g in o.vertex_groups if g.name in r.data.bones}
    weights=np.array([sum(g.weight for g in v.groups if g.group in ids) for v in o.data.vertices])
    if not np.isfinite(weights).all() or np.any(weights<.000001):raise RuntimeError('unweighted vertex '+o.name)
    return {'vertices':len(P),'triangles':len(T),'zeroArea':int(np.sum(area<=1e-12)),'uvLayers':len(o.data.uv_layers),'materials':mat_sig(o),'weightRange':[float(weights.min()),float(weights.max())]}
def tree(P,T):
    return BVHTree.FromPolygons([Vector(tuple(float(v) for v in p)) for p in P],[tuple(int(v) for v in t) for t in T],all_triangles=True)
def distance(P,t):
    d=[];signed=[]
    for p in P:
        q,n,i,x=t.find_nearest(Vector(p))
        if q is None:raise RuntimeError('missing surface')
        d.append(x);signed.append((Vector(p)-q).dot(n))
    d=np.array(d);signed=np.array(signed)
    return {'p95_m':float(np.quantile(d,.95)),'max_m':float(d.max()),'penetrationProxy':float(np.mean(signed<-.003)),'deepPenetrationProxy':float(np.mean(signed<-.015))}
def scene_camera(body):
    P=pos(body);H=float(np.ptp(P[:,2]));center=Vector((P.min(0)+P.max(0))/2)
    sc=bpy.context.scene;sc.render.engine='BLENDER_WORKBENCH';sc.render.resolution_x=480;sc.render.resolution_y=640;sc.render.resolution_percentage=100
    sc.render.image_settings.file_format='PNG';sh=sc.display.shading;sh.light='STUDIO';sh.color_type='TEXTURE';sh.show_cavity=True
    bpy.ops.object.camera_add();cam=bpy.context.object;cam.data.type='ORTHO';cam.data.ortho_scale=H*1.35;sc.camera=cam
    def render(tag,d):
        cam.location=center+Vector(d).normalized()*H*3;cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler()
        sc.render.filepath=str(out/(tag+'.png'));bpy.ops.render.render(write_still=True)
    return sc,render
def gltf(p):
    raw=p.read_bytes();return json.loads(raw[20:20+int.from_bytes(raw[12:16],'little')])
def source_pose_data(body,rig,other,ad,acts,reset):
    samples={};sc=bpy.context.scene
    for name,act in acts.items():
        reset();ad.action=act;lo,hi=map(float,act.frame_range)
        for i,f in enumerate(np.linspace(lo,hi,3)):
            sc.frame_set(math.floor(f),subframe=float(f%1));bpy.context.view_layer.update()
            B=pos(body,True);bt=tree(B,tri(body))
            samples[(name,i)]={o.name:(pos(o,True),tri(o),distance(pos(o,True),bt)) for o in other}
    reset();return samples
body,rig,others,ad,acts,reset=load(p)
orig={o.name:stats(o,rig) for o in [body]+others};rig0=sig(rig);body0=pos(body);T0=tri(body);bodyName=body.name
morph0={n:np.array([body.matrix_world@v.co for v in body.data.shape_keys.key_blocks[n].data]) for n in names}
refP={o.name:pos(o) for o in others};refT={o.name:tri(o) for o in others}
sourceSamples=source_pose_data(body,rig,others,ad,acts,reset)
sc,render=scene_camera(body)
render('lod0_front',(0,-1,0));render('lod0_side',(1,0,0))
levels=[];prior=sum(v['triangles'] for v in orig.values())
def candidate(level,hr,cr,prior,overrides):
    body,rig,others,ad,acts,reset=load(p);checkrig(rig0,sig(rig))
    decisions=[]
    for o in others:
        S=refP[o.name];TT=refT[o.name];old=orig[o.name]
        # Protect very small accessories and retain UV/material seams as far
        # as collapse decimation permits. Fail closed on surface drift.
        ratio=overrides.get(o.name,hr if o.name.startswith('R53_Hair_') else cr)
        if ratio>=.999 or old['triangles']<80:
            decisions.append({'part':o.name,'ratio':1.,'reason':'original part retained by retry or small-part guard'});continue
        bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
        backup=o.data.copy()
        mod=o.modifiers.new('R53 '+level,'DECIMATE');mod.decimate_type='COLLAPSE';mod.ratio=ratio
        while list(o.modifiers).index(mod)>0:bpy.ops.object.modifier_move_up(modifier=mod.name)
        bpy.ops.object.modifier_apply(modifier=mod.name)
        new=stats(o,rig);Q=pos(o);QT=tri(o)
        forward=distance(S,tree(Q,QT));reverse=distance(Q,tree(S,TT))
        cap=.008 if level=='lod1' else .015
        if new['triangles']>=old['triangles'] or new['zeroArea']>old['zeroArea'] or new['uvLayers']!=old['uvLayers'] or new['materials']!=old['materials'] or max(forward['p95_m'],reverse['p95_m'])>cap:
            bad=o.data;o.data=backup
            if bad.users==0:bpy.data.meshes.remove(bad)
            decisions.append({'part':o.name,'ratio':1.,'reason':'rest surface/UV/material gate retained source','forward':forward,'reverse':reverse})
        else:
            # A second copy is needed if pose regression later requires rollback.
            decisions.append({'part':o.name,'ratio':ratio,'forward':forward,'reverse':reverse,'backup':backup})
    # Compare full set of original action poses. Revert only regressing parts.
    current=source_pose_data(body,rig,others,ad,acts,reset)
    for d in decisions:
        if 'backup' not in d:continue
        n=d['part'];worst=0.;regress=0.
        for k,sample in current.items():
            A,AT,am=sourceSamples[k][n];B,BT,bm=sample[n]
            worst=max(worst,distance(A,tree(B,BT))['p95_m'],distance(B,tree(A,AT))['p95_m'])
            regress=max(regress,bm['penetrationProxy']-am['penetrationProxy'],bm['deepPenetrationProxy']-am['deepPenetrationProxy'])
        d['posedP95Max_m']=worst;d['penetrationRegressionMax']=regress
        backup=d.pop('backup')
        if worst>(.012 if level=='lod1' else .022) or regress>.025:
            o=next(o for o in others if o.name==n);bad=o.data;o.data=backup
            if bad.users==0:bpy.data.meshes.remove(bad)
            d['ratio']=1.;d['reason']='pose regression retained source'
        else:
            if backup.users==0:bpy.data.meshes.remove(backup)
    reset()
    if not np.array_equal(tri(body),T0) or not np.array_equal(pos(body),body0):raise RuntimeError('body neutral changed')
    for n in names:
        if not np.array_equal(np.array([body.matrix_world@v.co for v in body.data.shape_keys.key_blocks[n].data]),morph0[n]):raise RuntimeError('body morph changed '+n)
    finalStats={o.name:stats(o,rig) for o in [body]+others}
    total=sum(v['triangles'] for v in finalStats.values())
    # Conservative fallbacks may legitimately prevent further reduction.
    # Reject rather than label an unchanged or larger asset as a lower LOD.
    if total>=prior:
        return None,{'reason':'LOD triangle count not descending','total':total,'prior':prior,'parts':[],'decisions':decisions}
    sc,render=scene_camera(body)
    render(level+'_front',(0,-1,0));render(level+'_side',(1,0,0))
    ad.action=acts['Walk_Loop'];lo,hi=map(float,ad.action.frame_range);f=(lo+hi)/2
    sc.frame_set(math.floor(f),subframe=f%1);bpy.context.view_layer.update();render(level+'_walk',(1,-1,0))
    reset()
    for name,act in acts.items():
        tr=ad.nla_tracks.new();tr.name='R53_'+name;tr.strips.new('R53_'+name,1,act)
    bpy.ops.object.select_all(action='DESELECT')
    for o in [body,rig]+others:o.select_set(True)
    bpy.context.view_layer.objects.active=body
    dest=out/(ident+'_'+level+'.glb')
    opts=dict(filepath=str(dest),export_format='GLB',use_selection=True,export_skins=True,export_animations=True,export_morph=True)
    props=bpy.ops.export_scene.gltf.get_rna_type().properties
    if 'export_animation_mode' in props and 'NLA_TRACKS' in props['export_animation_mode'].enum_items.keys():opts['export_animation_mode']='NLA_TRACKS'
    elif 'export_nla_strips' in props:opts['export_nla_strips']=True
    else:raise RuntimeError('unsupported NLA export')
    bpy.ops.export_scene.gltf(**opts)
    g=gltf(dest)
    if len(g.get('skins',[]))!=1 or not all(any(n.lower() in a.get('name','').lower() for a in g.get('animations',[])) for n in clips):raise RuntimeError('export rig/action regression')
    if not any(all(n in m.get('extras',{}).get('targetNames',[]) for n in names) for m in g['meshes']):raise RuntimeError('export morph regression')
    b2,r2,o2,ad2,acts2,reset2=load(dest);checkrig(rig0,sig(r2))
    rt={o.name:stats(o,r2) for o in [b2]+o2}
    if sum(v['triangles'] for v in rt.values())!=total:raise RuntimeError('roundtrip triangle regression')
    # Roundtrip poses must remain valid; report surface and penetration changes.
    rtSamples=source_pose_data(b2,r2,o2,ad2,acts2,reset2);worst=0.;reg=0.;partErrors={}
    for k,ss in rtSamples.items():
        for n,(B,BT,bm) in ss.items():
            A,AT,am=sourceSamples[k][n]
            drift=max(distance(A,tree(B,BT))['p95_m'],distance(B,tree(A,AT))['p95_m'])
            regression=max(0.,bm['penetrationProxy']-am['penetrationProxy'],bm['deepPenetrationProxy']-am['deepPenetrationProxy'])
            worst=max(worst,drift);reg=max(reg,regression)
            q=partErrors.setdefault(n,{'part':n,'posedP95Max_m':0.,'penetrationRegressionMax':0.})
            q['posedP95Max_m']=max(q['posedP95Max_m'],drift);q['penetrationRegressionMax']=max(q['penetrationRegressionMax'],regression)
    rejected=[v for v in partErrors.values() if v['posedP95Max_m']>(.012 if level=='lod1' else .022)+.001 or v['penetrationRegressionMax']>.026]
    if rejected:
        return None,{'reason':'roundtrip posed surface regression','parts':rejected,'decisions':decisions,'total':total}
    accepted=({'level':level,'sha256':sha(dest),'bytes':dest.stat().st_size,'triangles':total,'vertices':sum(v['vertices'] for v in rt.values()),'parts':rt,'decisions':decisions,'roundTrip':True,'poseSamples':len(rtSamples),'posedP95Max_m':worst,'penetrationRegressionMax':reg})
    return accepted,None
# Keep passing outputs from each level; retry only failing parts with smaller
# reductions, then isolate changed parts. The original numerical gates remain.
for level,hr,cr in [('lod1',.72,.65),('lod2',.40,.35)]:
    overrides={};attempts=[];accepted=None
    # Retain parts whose previous level required a full rollback as a starting
    # point only if the same part is rejected again at this level.
    for attempt in range(6):
        accepted,err=candidate(level,hr,cr,prior,overrides)
        if accepted is not None:break
        attempts.append({'attempt':attempt+1,**err})
        print('R53 LOD RETRY',ident,level,json.dumps(err),flush=True)
        if not err['parts']:
            # Try a different subset: reduce all remaining nonproblematic parts
            # more aggressively only when ordering was the sole failing gate.
            for d in err['decisions']:
                if d['ratio']<1.:overrides[d['part']]=max(.18,d['ratio']*.72)
            continue
        for q in err['parts']:
            n=q['part'];old=overrides.get(n,hr if n.startswith('R53_Hair_') else cr)
            overrides[n]=min(1.,old+(1.-old)*.65) if attempt<2 else 1.
    if accepted is None:
        # Never present a failed file as a valid LOD.
        (out/(ident+'_'+level+'.glb')).unlink(missing_ok=True)
        (out/'retry-diagnostics.json').write_text(json.dumps({'id':ident,'level':level,'attempts':attempts},indent=2))
        raise RuntimeError('all quality-preserving LOD retries failed '+level)
    accepted['retryAttempts']=attempts;levels.append(accepted);prior=accepted['triangles']
    print('R53 MOB LOD',ident,level,prior,'of',sum(v['triangles'] for v in orig.values()),flush=True)

result={'id':ident,'sourceSHA256':rec['sha256'],'lod0':{'triangles':sum(v['triangles'] for v in orig.values()),'vertices':sum(v['vertices'] for v in orig.values()),'bytes':p.stat().st_size,'parts':orig},'levels':levels,'bodyMorphTopologyPreserved':True,'morphCount':len(names),'clipCount':len(clips),'visualApproved':False,'mobileFPSApproved':False,'productionApproved':False}
(out/'mob-lod-report.json').write_text(json.dumps(result,indent=2))
