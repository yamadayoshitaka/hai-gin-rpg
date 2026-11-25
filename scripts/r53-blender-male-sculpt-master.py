"""R53 male anatomical sculpt master refinement, not a final fixed face.
Preserve donor UVs, skin groups and measured open neck ring. Subdivision is
sampling density only; it is not evidence of high-frequency facial detail.
"""
import bpy,sys,math,json,hashlib
from pathlib import Path
from mathutils import Vector
from mathutils.kdtree import KDTree
args=sys.argv[sys.argv.index("--")+1:]
source,out=Path(args[0]).resolve(),Path(args[1]).resolve()
out.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(source))
bpy.context.view_layer.update()
matches=[o for o in bpy.context.scene.objects if o.type=="MESH" and o.name=="R53_male_anatomy_reference"]
if len(matches)!=1: raise RuntimeError("Cannot identify the male sculpt master")
obj=matches[0]
rigs=[m.object for m in obj.modifiers if m.type=="ARMATURE" and m.object]
if len(rigs)!=1: raise RuntimeError("Missing male donor armature")
rig=rigs[0]
M=obj.matrix_world.copy()
inv=M.inverted()
cut=1.515
def world(): return [M@v.co for v in obj.data.vertices]
before=world()
if not before or abs(min(p.z for p in before)-cut)>1e-5: raise RuntimeError("Unexpected neck cut")
seam_before=[p for p in before if abs(p.z-cut)<1e-5]
if len(seam_before)<8: raise RuntimeError("Missing neck seam")
uv_names=[u.name for u in obj.data.uv_layers]
group_names=[g.name for g in obj.vertex_groups]
if not uv_names or not group_names: raise RuntimeError("No UV or skin groups")
obj.data.calc_loop_triangles()
before_tri=len(obj.data.loop_triangles)
bpy.ops.object.select_all(action="DESELECT")
obj.select_set(True);bpy.context.view_layer.objects.active=obj
sub=obj.modifiers.new("R53 sculpt sampling","SUBSURF")
sub.subdivision_type="SIMPLE";sub.levels=2;sub.render_levels=2
while list(obj.modifiers).index(sub)>0:
    bpy.ops.object.modifier_move_up(modifier=sub.name)
bpy.ops.object.modifier_apply(modifier=sub.name)
bpy.context.view_layer.update()
mesh=obj.data
pts=world()
# Weld only adjacency for fairing, not the mesh itself; retain UV seams and weights.
groups={}; membership=[]; unique=[]
for p in pts:
    key=tuple(round(c,6) for c in p)
    i=groups.get(key)
    if i is None:
        i=len(unique);groups[key]=i;unique.append(p.copy())
    membership.append(i)
adj=[set() for p in unique]
for edge in mesh.edges:
    a,b=(membership[i] for i in edge.vertices)
    if a!=b: adj[a].add(b);adj[b].add(a)
def smoothstep(a,b,x):
    t=max(0.,min(1.,(x-a)/(b-a)))
    return t*t*(3.-2.*t)
# Conservative lower lateral cheek fairing. Do not smooth eyes, nose, lips,
# ear rims, neck, or the open ring; individual sculpting is still required.
weights=[]
for p in unique:
    x,y,z=p
    a=abs(x)
    lateral=smoothstep(.035,.048,a)*(1-smoothstep(.065,.078,a))
    lower=smoothstep(1.550,1.570,z)*(1-smoothstep(1.600,1.620,z))
    front=1-smoothstep(-.035,.025,y) # glTF front +Z maps to Blender -Y
    weights.append(lateral*lower*front)
cur=[p.copy() for p in unique]
limit=.0005
for _ in range(3):
    nxt=[]
    for i,p in enumerate(cur):
        if not adj[i] or weights[i]<=0:
            nxt.append(p.copy());continue
        mean=sum((cur[j] for j in adj[i]),Vector())/len(adj[i])
        q=p+(mean-p)*(.24*weights[i])
        delta=q-unique[i]
        if delta.length>limit:q=unique[i]+delta.normalized()*limit
        nxt.append(q)
    cur=nxt
for v,i in zip(mesh.vertices,membership):
    if weights[i]>0:v.co=inv@cur[i]
for p in mesh.polygons:p.use_smooth=True
mesh.update()
bpy.context.view_layer.update()
after=world();mesh.calc_loop_triangles()
if not all(math.isfinite(c) for p in after for c in p):raise RuntimeError("Non-finite geometry")
seam_after=[p for p in after if abs(p.z-cut)<1e-5]
kd=KDTree(len(seam_after))
for i,p in enumerate(seam_after):kd.insert(p,i)
kd.balance()
seam_error=max(kd.find(p)[2] for p in seam_before)
if seam_error>1e-5:raise RuntimeError("Original neck anchors changed")
if min(p.z for p in after)<cut-1e-5:raise RuntimeError("Geometry below neck seam")
if [u.name for u in mesh.uv_layers]!=uv_names:raise RuntimeError("UV layers lost")
if [g.name for g in obj.vertex_groups]!=group_names:raise RuntimeError("Skin groups lost")
if not any(m.type=="ARMATURE" and m.object==rig for m in obj.modifiers):raise RuntimeError("Armature lost")
if len(after)<=len(before)*4:raise RuntimeError("Insufficient subdivision")
max_edit=max((p-q).length for p,q in zip(cur,unique))
if max_edit>limit+1e-7:raise RuntimeError("Local sculpt budget exceeded")
obj.name="R53_male_sculpt_master"
mesh.name="R53_male_sculpt_master"
report=dict(classification="male anatomical sculpt master candidate",sourceSex="male",
    source_sha256=hashlib.sha256(source.read_bytes()).hexdigest(),
    vertices_before=len(before),vertices_after=len(after),triangles_before=before_tri,
    triangles_after=len(mesh.loop_triangles),neck_anchors_before=len(seam_before),
    neck_samples_after=len(seam_after),max_original_anchor_error_m=seam_error,
    uv_layers=uv_names,skin_groups=len(group_names),bones=len(rig.data.bones),
    max_local_edit_m=max_edit,edited_geometric_vertices=sum((p-q).length>1e-8 for p,q in zip(cur,unique)),
    visualApproved=False,remaining=["individual male face sculpting","eyes and oral geometry",
    "expression morphs","PBR skin","full-body seam and motion quality"])
(out/"sculpt-audit.json").write_text(json.dumps(report,indent=2))
bpy.ops.wm.save_as_mainfile(filepath=str(out/"male_sculpt_master.blend"))
bpy.ops.object.select_all(action="DESELECT");obj.select_set(True);rig.select_set(True)
bpy.context.view_layer.objects.active=obj
bpy.ops.export_scene.gltf(filepath=str(out/"male_sculpt_master.glb"),export_format="GLB",
    use_selection=True,export_animations=False,export_skins=True,export_morph=True)
print("R53 male sculpt master:",report)
