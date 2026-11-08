#!/usr/bin/env python3
"""Export actual unoptimized Blender Studio CC0 anatomy assets as 3D GLB previews.

Source .blend is kept unchanged in the original downloaded CC0 ZIP. These
derivative previews are only for model-library inspection, not battle rigs.
"""
import bpy, os, json, pathlib, hashlib, sys, traceback, struct
from mathutils import Vector
def fail_hard(t,e,tb):
    traceback.print_exception(t,e,tb);sys.stderr.flush();os._exit(1)
sys.excepthook=fail_hard

out=pathlib.Path("qa-reports/blender-human-masters/export")
out.mkdir(parents=True,exist_ok=True)
source=pathlib.Path(bpy.data.filepath)
if not source.exists():raise RuntimeError("Original Blender asset library file missing")

targets=[
 ("realistic-head-animation","Head (Animation) - Realistic","GEO-head_animation_realistic"),
 ("realistic-head-sculpt","Head (Sculpting) - Realistic","GEO-head_sculpting_realistic"),
 ("realistic-body-male","Body Male - Realistic","GEO-body_male_realistic"),
 ("realistic-body-female","Body Female - Realistic","GEO-body_female_realistic")
]
def mat_for(name):
    name=name.lower()
    if "iris" in name:return ("OriginalUV-Iris-Preview",(.14,.21,.18,1),.22)
    if "sclera" in name or ".eye." in name:return ("OriginalUV-Sclera-Preview",(.89,.90,.87,1),.24)
    return ("Untextured-Source-Skin-Preview",(.65,.44,.34,1),.67)
def make_material(meshname):
    title,color,rough=mat_for(meshname)
    key=title+str(color)
    if key in bpy.data.materials:return bpy.data.materials[key]
    m=bpy.data.materials.new(key);m.diffuse_color=color
    m.use_nodes=True
    bsdf=m.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value=color
        bsdf.inputs["Roughness"].default_value=rough
        bsdf.inputs["Metallic"].default_value=0
    return m
def world_bounds(objs):
    lower=Vector((1e8,1e8,1e8));upper=Vector((-1e8,-1e8,-1e8))
    for obj in objs:
        for p in obj.bound_box:
            v=obj.matrix_world @ Vector(p)
            for i in range(3):
                lower[i]=min(lower[i],v[i])
                upper[i]=max(upper[i],v[i])
    return lower,upper

records=[]
for id,collection_name,main in targets:
    col=bpy.data.collections.get(collection_name)
    if col is None:raise RuntimeError("Missing original anatomy collection "+collection_name)
    objs=[o for o in col.objects if o.type=="MESH"]
    if not objs or main not in {o.name for o in objs}:
        raise RuntimeError("Missing original complete anatomy "+main)
    lower,upper=world_bounds(objs)
    center=(lower+upper)/2
    # Body model is scaled to its source world height; head remains full source size.
    # No polygon reduction is permitted, and original file is not saved.
    objects=[]
    for obj in objs:
        copy=obj.copy();copy.data=obj.data.copy()
        copy.name="CC0_SOURCE_"+obj.name
        copy.animation_data_clear()
        copy.parent=None
        bpy.context.scene.collection.objects.link(copy)
        transform=obj.matrix_world.copy()
        transform.translation-=center
        copy.matrix_world=transform
        for m in list(copy.modifiers):
            copy.modifiers.remove(m)
        # Original source geometry is retained; preview shading is explicitly
        # synthetic until compatible real high-resolution atlas is available.
        copy.data.materials.clear()
        copy.data.materials.append(make_material(obj.name))
        copy.hide_set(False);copy.hide_render=False
        objects.append(copy)
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:obj.select_set(True)
    bpy.context.view_layer.objects.active=objects[0]
    filepath=out/(id+".glb")
    bpy.ops.export_scene.gltf(filepath=str(filepath),export_format="GLB",
       use_selection=True,export_animations=False,export_skins=False,
       export_apply=False,export_yup=True)
    raw=filepath.read_bytes()
    if raw[:4]!=b"glTF" or struct.unpack_from("<I",raw,8)[0]!=len(raw):
        raise RuntimeError("Invalid generated GLB "+id)
    if len(raw)<20000 or len(raw)>12000000:
        raise RuntimeError("Anatomy GLB unexpected size "+id+" "+str(len(raw)))
    core=next(o for o in objs if o.name==main)
    vertices=sum(len(o.data.vertices) for o in objs)
    triangles=sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in objs)
    report=dict(id=id,sourceCollection=collection_name,
        mainMeshName=main,sourceVertices=vertices,
        sourceTriangles=triangles,sourceObjects=[o.name for o in objs],
        previewBytes=len(raw),previewSha256=hashlib.sha256(raw).hexdigest(),
        output=filepath.name,sourceUnmodified=True,previewOptimized=False,
        usesTemporaryPreviewMaterials=True,
        hasMeasuredPhotoSkin=False,hasNativeFacialShapeKeys=bool(core.data.shape_keys),
        hasOriginalSkinnedRig=False,characterFitValidated=False,
        artifactOnly=True,gameplayModelReplaced=False,ff13QualityApproved=False,
        originDimensions=[round(float(v),5) for v in (upper-lower)])
    records.append(report)
    print("EXPORTED_HUMAN_SOURCE_PREVIEW "+json.dumps(report,ensure_ascii=False))
    for clone in objects:
        mesh=clone.data
        bpy.data.objects.remove(clone,do_unlink=True)
        if mesh and mesh.users==0:bpy.data.meshes.remove(mesh)
(out/"export-report.json").write_text(json.dumps({
 "license":"CC0-1.0",
 "originalFileSha256":hashlib.sha256(source.read_bytes()).hexdigest(),
 "modelSource":"Blender Studio Human Base Meshes v1.4.1",
 "artifacts":records,
 "sourceArtistApproval":False},indent=2,ensure_ascii=False)+"\n",encoding="utf-8")
