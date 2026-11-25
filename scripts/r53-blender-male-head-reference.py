"""Extract a male-only anatomical sculpt reference from the measured R41 donor.
Not a release asset. No female mesh, runtime identity or synthetic expression claims.
"""
import bpy,bmesh,sys,json,hashlib
from pathlib import Path
from mathutils import Vector
source=Path(sys.argv[sys.argv.index("--")+1]).resolve()
out=Path(sys.argv[sys.argv.index("--")+2]).resolve()
out.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(source))
meshes=[o for o in bpy.context.scene.objects if o.type=="MESH"]
if len(meshes)!=1: raise RuntimeError("Expected single male anatomical donor")
o=meshes[0]
if not any(o.type=="ARMATURE" for o in bpy.context.scene.objects): raise RuntimeError("No source armature")
# R41 measured height 1.760 m. Retain lower neck above the shoulder flare.
cut=1.515
points=[o.matrix_world@v.co for v in o.data.vertices]
if abs(max(p.z for p in points)-1.76)>.005: raise RuntimeError("Unexpected male donor scale")
bpy.context.view_layer.objects.active=o
o.select_set(True)
bm=bmesh.new();bm.from_mesh(o.data)
M=o.matrix_world
plane_co=M.inverted()@Vector((0,0,cut))
plane_no=(M.to_3x3().transposed()@Vector((0,0,1))).normalized()
bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),
  dist=1e-7,plane_co=plane_co,plane_no=plane_no,clear_inner=True,clear_outer=False)
if not bm.faces: raise RuntimeError("Head crop is empty")
bm.normal_update();bm.to_mesh(o.data);bm.free();o.data.update()
pts=[o.matrix_world@v.co for v in o.data.vertices]
if min(p.z for p in pts)<cut-1e-5: raise RuntimeError("Lower body retained")
o.name="R53_male_anatomy_reference"
o.data.name="R53_male_head_neck_reference"
# Keep original UVs and deform groups, with open cut boundary for body seam fitting.
o.data.calc_loop_triangles()
seam=[p for p in pts if abs(p.z-cut)<1e-5]
if len(seam)<8: raise RuntimeError("Missing cut ring")
report=dict(source=source.name,source_sha256=hashlib.sha256(source.read_bytes()).hexdigest(),
  sourceSex="male",classification="anatomical sculpt reference only",cut_height_m=cut,
  vertices=len(pts),triangles=len(o.data.loop_triangles),seam_vertices=len(seam),
  seam_width_m=max(p.x for p in seam)-min(p.x for p in seam),
  seam_depth_m=max(p.y for p in seam)-min(p.y for p in seam),
  skin_groups=len(o.vertex_groups),visualApproved=False,
  missing=["high precision eye and oral meshes","11 expression morphs","final skin PBR","individual sculpt","body seam fitting"])
(out/"male-reference.json").write_text(json.dumps(report,indent=2))
bpy.ops.wm.save_as_mainfile(filepath=str(out/"male_anatomy_reference.blend"))
bpy.ops.export_scene.gltf(filepath=str(out/"male_anatomy_reference.glb"),export_format="GLB",
  export_animations=False,export_skins=True,export_morph=True)
print("Male head/neck reference:",report)
