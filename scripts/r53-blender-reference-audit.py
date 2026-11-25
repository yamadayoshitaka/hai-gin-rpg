"""Blender background reference audit; never promotes donor meshes to final faces."""
import bpy, sys, json, math, hashlib
from pathlib import Path
from mathutils import Vector

args=sys.argv[sys.argv.index("--")+1:]
source=Path(args[0]).resolve()
out=Path(args[1]).resolve()
mode=args[2] if len(args)>2 else "head"
out.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(source))
meshes=[o for o in bpy.context.scene.objects if o.type=="MESH"]
if not meshes: raise RuntimeError("No imported mesh")
records=[]
allpoints=[]
for o in meshes:
    m=o.data
    m.calc_loop_triangles()
    points=[o.matrix_world @ v.co for v in m.vertices]
    if not points or not all(math.isfinite(v) for p in points for v in p):
        raise RuntimeError("Empty or non-finite mesh: "+o.name)
    lo=[min(p[i] for p in points) for i in range(3)]
    hi=[max(p[i] for p in points) for i in range(3)]
    degenerate=sum(1 for t in m.loop_triangles if t.area<=1e-12)
    records.append(dict(name=o.name,vertices=len(m.vertices),triangles=len(m.loop_triangles),
        min_m=lo,max_m=hi,degenerate=degenerate,
        shape_keys=[k.name for k in m.shape_keys.key_blocks] if m.shape_keys else [],
        materials=[s.material.name if s.material else None for s in o.material_slots],
        vertex_groups=len(o.vertex_groups)))
    allpoints.extend(points)
lo=Vector([min(p[i] for p in allpoints) for i in range(3)])
hi=Vector([max(p[i] for p in allpoints) for i in range(3)])
height=hi.z-lo.z
if height<=0: raise RuntimeError("Invalid bounds")
if mode=="body":
    selected=[p for p in allpoints if p.z>=hi.z-height*.18]
    lo=Vector([min(p[i] for p in selected) for i in range(3)])
    hi=Vector([max(p[i] for p in selected) for i in range(3)])
center=(lo+hi)/2
scale=max(hi.z-lo.z,hi.x-lo.x,hi.y-lo.y)*1.16
report=dict(blender=bpy.app.version_string,source=source.name,
    sha256=hashlib.sha256(source.read_bytes()).hexdigest(),mode=mode,
    meshes=records,armatures=[dict(name=o.name,bones=len(o.data.bones)) for o in bpy.context.scene.objects if o.type=="ARMATURE"],
    visualApproved=False,classification="reference audit only")
(out/"audit.json").write_text(json.dumps(report,indent=2),encoding="utf-8")
bpy.ops.wm.save_as_mainfile(filepath=str(out/"reference.blend"))
scene=bpy.context.scene
scene.render.engine="BLENDER_WORKBENCH"
scene.render.resolution_x=640
scene.render.resolution_y=640
scene.render.resolution_percentage=100
scene.render.image_settings.file_format="PNG"
sh=scene.display.shading
sh.light="STUDIO"
sh.color_type="SINGLE"
sh.single_color=(.65,.58,.52)
sh.show_shadows=True
sh.show_cavity=True
sh.cavity_type="BOTH"
sh.background_type="WORLD"
scene.world=bpy.data.worlds.new("ReviewWorld") if scene.world is None else scene.world
scene.world.color=(.15,.15,.15)
bpy.ops.object.camera_add()
cam=bpy.context.object
cam.data.type="ORTHO"
cam.data.ortho_scale=scale
cam.data.clip_start=.001
cam.data.clip_end=100
scene.camera=cam
for angle in [0,45,90,-90,180]:
    a=math.radians(angle)
    cam.location=center+Vector((math.sin(a),-math.cos(a),0))*max(1,scale*3)
    cam.rotation_euler=(center-cam.location).to_track_quat("-Z","Y").to_euler()
    scene.render.filepath=str(out/("view_%s.png"%angle))
    bpy.ops.render.render(write_still=True)
print("R53 reference audit completed:",out)
