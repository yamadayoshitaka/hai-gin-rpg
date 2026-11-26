"""Actual GLB renders only. One review pass, no production approval."""
import bpy,sys,json,math,hashlib
from pathlib import Path
from mathutils import Vector
import numpy as np
src,out=map(lambda p:Path(p).resolve(),sys.argv[sys.argv.index('--')+1:]);out.mkdir(parents=True,exist_ok=True)
manifest=json.loads((src/'parts-manifest.json').read_text())
items=manifest['parts']+manifest['rigidItems']
assert len(items)==20
report=[]
for part in items:
    p=src/part['file'];assert hashlib.sha256(p.read_bytes()).hexdigest()==part['sha256']
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(p))
    scene=bpy.context.scene
    meshes=[o for o in scene.objects if o.type=='MESH']
    if not meshes:raise RuntimeError('no mesh '+part['id'])
    bpy.context.view_layer.update()
    deps=bpy.context.evaluated_depsgraph_get();points=[]
    for ob in meshes:
        ev=ob.evaluated_get(deps);me=ev.to_mesh()
        points.extend(tuple(ev.matrix_world@v.co) for v in me.vertices);ev.to_mesh_clear()
    P=np.array(points);assert np.isfinite(P).all()
    lo=P.min(0);hi=P.max(0);c=Vector((lo+hi)/2);s=max(float(np.max(hi-lo)),.01)
    try:scene.render.engine='BLENDER_EEVEE_NEXT'
    except Exception:scene.render.engine='BLENDER_EEVEE'
    if hasattr(scene,'eevee') and hasattr(scene.eevee,'taa_render_samples'):scene.eevee.taa_render_samples=24
    world=bpy.data.worlds.new('ReviewWorld');world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.20,.20,.20,1);world.node_tree.nodes['Background'].inputs[1].default_value=.65;scene.world=world
    for name,axis,power,size in [('key',(-1.4,-2.2,1.9),420,1.8),('fill',(1.7,-1.5,.5),180,1.8),('rim',(0,2.2,1.5),300,1.4)]:
        d=bpy.data.lights.new(name,'AREA');d.energy=power*s*s;d.shape='DISK';d.size=size*s
        o=bpy.data.objects.new(name,d);scene.collection.objects.link(o);o.location=c+Vector(axis)*s;o.rotation_euler=(c-o.location).to_track_quat('-Z','Y').to_euler()
    d=bpy.data.cameras.new('camera');d.type='ORTHO';d.ortho_scale=s*1.35;d.clip_start=max(.00005,s*.001);d.clip_end=max(1,s*20)
    cam=bpy.data.objects.new('camera',d);scene.collection.objects.link(cam);scene.camera=cam
    scene.render.resolution_x=640;scene.render.resolution_y=640;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='JPEG';scene.render.image_settings.quality=94
    folder=out/part['id'];folder.mkdir(exist_ok=True)
    files=[]
    for label,axis in [('front',(0,-1,0)),('side',(1,0,0)),('rear',(0,1,0)),('threequarter',(.65,-1,.12))]:
        cam.location=c+Vector(axis).normalized()*s*4;cam.rotation_euler=(c-cam.location).to_track_quat('-Z','Y').to_euler()
        path=folder/(label+'.jpg');scene.render.filepath=str(path);bpy.ops.render.render(write_still=True)
        assert path.exists() and path.stat().st_size>1000
        files.append(str(path.relative_to(out)))
    report.append({'id':part['id'],'sourceSHA256':part['sha256'],'images':files,'status':'actual GLB PBR review; no visual approval','boundsM':(hi-lo).tolist(),'sourceHeroRun':45800729706 if part in manifest['parts'] else None,'legacyPropOrExistingAccessory':part in manifest['rigidItems']})
    (out/'review-index.json').write_text(json.dumps(report,indent=2))
print('Rendered review images',len(report),'parts; no deployment')
