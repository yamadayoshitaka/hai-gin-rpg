"""Import the exact upstream HM08 body topology for offline REVIEW, not production."""
import bpy, json, sys, math, hashlib
from pathlib import Path
from mathutils import Vector
from collections import Counter

args=sys.argv[sys.argv.index("--")+1:]
src,out=map(Path,args)
out.mkdir(parents=True,exist_ok=True)
verts=[]; faces=[]
for line in src.read_text(encoding="utf-8").splitlines():
    f=line.split()
    if not f: continue
    if f[0]=="v": verts.append(tuple(map(float,f[1:4])))
    if f[0]=="f":
        ids=[int(x.split("/")[0])-1 for x in f[1:]]
        if all(0<=i<13380 for i in ids): faces.append(ids)
assert len(verts)==19158 and faces, "unexpected HM08 topology"
verts=verts[:13380]
assert all(math.isfinite(x) for v in verts for x in v)
lo=min(v[1] for v in verts); hi=max(v[1] for v in verts)
assert hi>lo
scale=1.65/(hi-lo)
verts=[(x*scale,-z*scale,(y-lo)*scale) for x,y,z in verts]
bpy.ops.wm.read_factory_settings(use_empty=True)
mesh=bpy.data.meshes.new("HM08_reference_body")
mesh.from_pydata(verts,[],faces)
assert not mesh.validate(verbose=True), "invalid mesh data"
mesh.update()
obj=bpy.data.objects.new("HM08_reference_body",mesh)
bpy.context.collection.objects.link(obj)
for p in mesh.polygons: p.use_smooth=True
mat=bpy.data.materials.new("Neutral geometry review"); mat.diffuse_color=(.45,.48,.52,1)
obj.data.materials.append(mat)
bpy.context.view_layer.objects.active=obj; obj.select_set(True)
edge_counts=Counter(tuple(sorted((f[i],f[(i+1)%len(f)]))) for f in faces for i in range(len(f)))
report={"status":"reference-only; not approved","source":"MakeHuman HM08 CC0","source_sha256":hashlib.sha256(src.read_bytes()).hexdigest(),"vertex_count":len(verts),"face_count":len(faces),"height_m":1.65,"boundary_edges":sum(n==1 for n in edge_counts.values()),"nonmanifold_edges":sum(n>2 for n in edge_counts.values()),"unverified":["adult female morph","reference-photo comparison","R20 head fit","rigging","clothes","motion","hair"],"bounds_m":[[min(v[i] for v in verts),max(v[i] for v in verts)] for i in range(3)]}
(out/"reference_audit.json").write_text(json.dumps(report,indent=2))
bpy.ops.export_scene.gltf(filepath=str(out/"HM08_reference_only.glb"),export_format="GLB",use_selection=True)
scene=bpy.context.scene
scene.render.engine="BLENDER_WORKBENCH"
scene.render.resolution_x=700; scene.render.resolution_y=900; scene.render.resolution_percentage=100
scene.display.shading.light="STUDIO"; scene.display.shading.color_type="MATERIAL"; scene.display.shading.show_cavity=True
scene.display.shading.background_type="WORLD"; scene.world=bpy.data.worlds.new("Review background"); scene.world.color=(.14,.14,.14)
camdata=bpy.data.cameras.new("Review camera"); cam=bpy.data.objects.new("Review camera",camdata);scene.collection.objects.link(cam);scene.camera=cam
camdata.type="ORTHO";camdata.ortho_scale=2.0
for name,loc in {"front":(0,-3,.825),"side":(3,0,.825),"back":(0,3,.825),"quarter":(2.2,-2.2,.825),"top":(0,-.01,4)}.items():
    cam.location=loc;cam.rotation_euler=(Vector((0,0,.825))-cam.location).to_track_quat("-Z","Y").to_euler()
    scene.render.filepath=str(out/(name+".png"));bpy.ops.render.render(write_still=True)
print(json.dumps(report))
