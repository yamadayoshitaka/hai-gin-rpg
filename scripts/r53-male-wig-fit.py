"""R53 G0/G1 male wig fitting candidates using actual integrated scalp.
Existing licensed hair geometry/UVs are preserved. Nearest-surface and
coverage estimates are diagnostics only; no G2-G5 approval.
"""
import bpy, numpy as np, math, sys, hashlib, json
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
args=sys.argv[sys.argv.index('--')+1:]
bodies,hairs,out=map(lambda s:Path(s).resolve(),args[:3]);out.mkdir(parents=True,exist_ok=True)
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def points(o):return np.array([o.matrix_world@v.co for v in o.data.vertices],np.float64)
def export(objs,dest):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:o.select_set(True)
    bpy.context.view_layer.objects.active=objs[0]
    bpy.ops.export_scene.gltf(filepath=str(dest),export_format='GLB',use_selection=True,export_animations=False,export_skins=False)
def bounds(P):return [P.min(0).tolist(),P.max(0).tolist()]
def percentile(P):return np.quantile(P,[.04,.96],axis=0)
def render(scene,cam,center,tag,path):
    dirs={'front':(0,-1,0),'left':(-1,0,0),'right':(1,0,0),'rear':(0,1,0),'crown':(0,0,1)}
    cam.location=center+Vector(dirs[tag])*.85
    up='Y' if tag!='crown' else 'X'
    cam.rotation_euler=(center-cam.location).to_track_quat('-Z',up).to_euler()
    scene.render.filepath=str(path);bpy.ops.render.render(write_still=True)
records=[]
for m in bodies.glob('*/integration.json'):
    for row in json.loads(m.read_text())['models']:records.append((m.parent,row))
if len(records)!=10:raise RuntimeError('expected ten integrated male assets')
styles=sorted(hairs.glob('male_hair_*_lod0.glb'))
if len(styles)!=14:raise RuntimeError('expected fourteen source male hair styles')
selected={int(v) for v in args[3].split(',')}
if not selected or not selected.issubset(set(range(1,11))):raise RuntimeError('invalid requested IDs')
results=[];failures=[]
for folder,rec in sorted(records,key=lambda x:x[1]['id']):
    ident=rec['id'];i=int(ident[-2:])
    if i not in selected:continue
    try:
        p=folder/(ident+'.glb')
        if sha(p)!=rec['sha256']:raise RuntimeError('integrated body hash mismatch')
        bpy.ops.wm.read_factory_settings(use_empty=True)
        bpy.ops.import_scene.gltf(filepath=str(p));bpy.context.view_layer.update()
        obj=[o for o in bpy.context.scene.objects if o.type=='MESH' and any(m.type=='ARMATURE' and m.object for m in o.modifiers)]
        if len(obj)!=1:raise RuntimeError('ambiguous body mesh')
        body=obj[0];P=points(body);top=float(P[:,2].max())
        # Anatomical scalp slice measured in Blender metres; exclude lower face.
        scalp=P[(P[:,2]>=top-.105)&(P[:,2]<=top-.032)]
        if len(scalp)<100:raise RuntimeError('insufficient scalp samples')
        bb=percentile(scalp);size=bb[1]-bb[0];center=(bb[0]+bb[1])/2
        if min(size[:2])<.05:raise RuntimeError('invalid head dimensions')
        body.data.calc_loop_triangles()
        triangles=[tuple(t.vertices) for t in body.data.loop_triangles if min(P[v,2] for v in t.vertices)>top-.27]
        tree=BVHTree.FromPolygons([Vector(p) for p in P],triangles,all_triangles=True)
        scene=bpy.context.scene;scene.render.engine='BLENDER_WORKBENCH'
        scene.render.resolution_x=480;scene.render.resolution_y=480;scene.render.resolution_percentage=100
        scene.render.image_settings.file_format='PNG'
        sh=scene.display.shading;sh.light='STUDIO';sh.color_type='MATERIAL';sh.show_shadows=True;sh.show_cavity=True;sh.cavity_type='BOTH'
        bpy.ops.object.camera_add();cam=bpy.context.object;cam.data.type='ORTHO';cam.data.ortho_scale=.41;scene.camera=cam
        target=Vector((center[0],center[1],top-.10))
        for tag in ('front','left','right','rear','crown'):render(scene,cam,target,tag,out/(ident+'_bald_'+tag+'.png'))
        # 14 real existing styles distributed across 10 distinct heads; first ten here.
        # No newly fabricated hair strands or automatic visual approval.
        style=styles[i-1];before=set(bpy.context.scene.objects)
        bpy.ops.import_scene.gltf(filepath=str(style));bpy.context.view_layer.update()
        wig=[o for o in bpy.context.scene.objects if o not in before and o.type=='MESH']
        if not wig:raise RuntimeError('no wig geometry')
        raw=[points(o) for o in wig];S=np.concatenate(raw);wt=float(S[:,2].max());width=float(np.ptp(S[:,0]));height=float(np.ptp(S[:,2]))
        crown=S[(S[:,2]>=wt-max(width*.40,height*.12))&(S[:,2]<=wt-max(width*.045,height*.012))]
        if len(crown)<100:raise RuntimeError('insufficient actual crown')
        cb=percentile(crown);cs=cb[1]-cb[0];cc=(cb[0]+cb[1])/2
        if min(cs[:2])<.015:raise RuntimeError('invalid crown dimensions')
        # Uniform per-style fit using measured root-band width/depth, not hair tips.
        nominal=float(np.sqrt((size[0]/cs[0])*(size[1]/cs[1])))
        if not .1<nominal<10:raise RuntimeError('unreasonable scale')
        # Use true scalp nearest surfaces to compare fit hypotheses.
        probe=S[::max(1,len(S)//2400)]
        def transformed(Q,k,lift,dy):
            return Q*k+np.array([center[0]-cc[0]*k,center[1]-cc[1]*k+dy,top+lift-wt*k])
        def score(Q):
            signed=[]
            for pt in Q:
                loc,n,idx,dist=tree.find_nearest(Vector(pt))
                if loc is not None:signed.append(float((Vector(pt)-loc).dot(n)))
            d=np.asarray(signed)
            if len(d)==0:raise RuntimeError('no surface distances')
            return float(np.mean(d<-.003)),float(np.mean(d>.035)),float(np.median(np.abs(d)))
        options=[]
        for fac in (.96,1.02,1.08,1.14):
            for lift in (.003,.008,.013):
                for dy in (-.004,0,.004):
                    k=nominal*fac;test=score(transformed(probe,k,lift,dy))
                    options.append((test[0]*4+test[1]+test[2]*8,k,lift,dy,test))
        _,k,lift,dy,diag=min(options,key=lambda a:a[0])
        # Bake fitted positions in world space; preserve mesh UVs and materials.
        for o,R in zip(wig,raw):
            inv=o.matrix_world.inverted()
            for v,q in zip(o.data.vertices,transformed(R,k,lift,dy)):v.co=inv@Vector(q)
            o.data.update()
        bpy.context.view_layer.update()
        W=np.concatenate([points(o) for o in wig])
        if not np.isfinite(W).all():raise RuntimeError('invalid fitted wig positions')
        for tag in ('front','left','right','rear','crown'):render(scene,cam,target,tag,out/(ident+'_fit_'+tag+'.png'))
        body.hide_render=True
        for tag in ('front','left','right','rear','crown'):render(scene,cam,target,tag,out/(ident+'_wig_'+tag+'.png'))
        dest=out/(ident+'_wig.glb');export(wig,dest)
        r={'id':ident,'bodySHA256':rec['sha256'],'sourceHair':style.name,'sourceHairSHA256':sha(style),'license':'CC BY 4.0; Vincent Freelance; see ATTRIBUTION.md','coordinateSystem':'Blender world metres Z-up, GLB Y-up','headScalpBounds_m':bb.tolist(),'headScalpSamples':len(scalp),'crownBounds_m':cb.tolist(),'sourceHairBounds_m':bounds(S),'fittedHairBounds_m':bounds(W),'uniformScale':k,'lift_m':lift,'offsetY_m':dy,'nearestSurfacePenetrationProxy':diag[0],'nearestSurfaceGapProxy':diag[1],'medianDistance_m':diag[2],'sha256':sha(dest),'G0Measured':True,'G1FitCandidate':True,'G2MaterialApproval':False,'G3CollisionApproval':False,'G4MobileApproval':False,'G5VisualApproval':False}
        results.append(r);print('R53 WIG',json.dumps(r),flush=True)
    except Exception as e:
        failures.append({'id':ident,'error':str(e)});print('R53 WIG ERROR',failures[-1],flush=True)
    finally:(out/'wig-fit-report.json').write_text(json.dumps({'models':results,'failures':failures},indent=2))
if failures or len(results)!=len(selected):raise RuntimeError('partial wig fit')
