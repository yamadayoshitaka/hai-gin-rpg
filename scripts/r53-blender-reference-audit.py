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

# Export the imported reference without cameras/lights, before rendering.
# Keep original donor files immutable and compare imported round-trip geometry.
def scene_stats():
    objs=[o for o in bpy.context.scene.objects if o.type=="MESH"]
    points=[o.matrix_world @ v.co for o in objs for v in o.data.vertices]
    if not points or not all(math.isfinite(v) for p in points for v in p):
        raise RuntimeError("Invalid round-trip vertices")
    triangles=0
    for o in objs:
        o.data.calc_loop_triangles()
        triangles+=len(o.data.loop_triangles)
    return dict(vertices=len(points),triangles=triangles,
        bounds_m=[[min(p[i] for p in points) for i in range(3)],
                  [max(p[i] for p in points) for i in range(3)]],
        morphs=sorted({k.name for o in objs if o.data.shape_keys
            for k in o.data.shape_keys.key_blocks if k != o.data.shape_keys.reference_key}),
        bones=sum(len(o.data.bones) for o in bpy.context.scene.objects if o.type=="ARMATURE"))

def neck_sections():
    # Intersect actual surface triangles with horizontal planes. The donor
    # samples are descriptive, not a validated head-to-body attachment seam.
    levels=[hi.z-(hi.z-lo.z)*f for f in (.78,.84,.90,.96)]
    rows=[]
    for z in levels:
        for o in meshes:
            m=o.data
            pts=[o.matrix_world @ v.co for v in m.vertices]
            hits=[]
            for tri in m.loop_triangles:
                p=[pts[i] for i in tri.vertices]
                for a,b in zip(p,p[1:]+p[:1]):
                    if (a.z<=z<b.z) or (b.z<=z<a.z):
                        hits.append(a+(b-a)*((z-a.z)/(b.z-a.z)))
            if hits:
                rows.append(dict(mesh=o.name,z_m=z,samples=len(hits),
                    min_xy_m=[min(p[i] for p in hits) for i in range(2)],
                    max_xy_m=[max(p[i] for p in hits) for i in range(2)],
                    width_m=max(p.x for p in hits)-min(p.x for p in hits),
                    depth_m=max(p.y for p in hits)-min(p.y for p in hits)))
    return rows

before=scene_stats()
report["neck_region_sections"]=neck_sections()
roundtrip=out/"reference_roundtrip.glb"
bpy.ops.export_scene.gltf(filepath=str(roundtrip),export_format="GLB",
    export_cameras=False,export_lights=False,export_animations=False,
    export_morph=True,export_skins=True)

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

# Run the round-trip in a fresh scene after the reference views were saved.
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(roundtrip))
after=scene_stats()
bounds_error=max(abs(a-b) for p,q in zip(before["bounds_m"],after["bounds_m"])
                 for a,b in zip(p,q))
checks=dict(triangles_preserved=before["triangles"]==after["triangles"],
    morph_names_preserved=before["morphs"]==after["morphs"],
    bone_count_preserved=before["bones"]==after["bones"],
    bounds_preserved=bounds_error<=.0001)
report["roundtrip"]=dict(before=before,after=after,bounds_error_m=bounds_error,
    checks=checks,sha256=hashlib.sha256(roundtrip.read_bytes()).hexdigest())
(out/"audit.json").write_text(json.dumps(report,indent=2),encoding="utf-8")
if not all(checks.values()):
    raise RuntimeError("Reference GLB round-trip failed: "+str(checks))
print("R53 reference audit completed:",out)

