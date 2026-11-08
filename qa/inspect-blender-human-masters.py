#!/usr/bin/env python3
"""Read actual CC0 Blender human base meshes without modifying the original.

Called by Ubuntu Blender CLI after ZIP download and prior CRC/SHA checks.
The first phase inventories every mesh and asset collection. Only actual
Blender mesh data can be exported as a high-detail GLB preview.
"""
import bpy, json, os, re, sys, hashlib, pathlib
from mathutils import Vector

ROOT=pathlib.Path(os.environ.get("SOURCE_QA_DIR","qa-reports/blender-human-masters"))
ROOT.mkdir(parents=True,exist_ok=True)
source=pathlib.Path(bpy.data.filepath)
if not source.is_file():
    raise RuntimeError("The official .blend source was not loaded")
data=[]
for obj in bpy.data.objects:
    if obj.type!="MESH":continue
    mesh=obj.data
    coords=[tuple(v.co) for v in mesh.vertices]
    mins=[min(v[k] for v in mesh.vertices) for k in range(3)] if mesh.vertices else [0]*3
    maxs=[max(v[k] for v in mesh.vertices) for k in range(3)] if mesh.vertices else [0]*3
    data.append(dict(name=obj.name, mesh=mesh.name, vertices=len(mesh.vertices),
        polygons=len(mesh.polygons), triangles=sum(len(p.vertices)-2 for p in mesh.polygons),
        shapeKeys=list(mesh.shape_keys.key_blocks.keys()) if mesh.shape_keys else [],
        materials=[x.name if x else None for x in mesh.materials],
        dimensions=[round(v,5) for v in obj.dimensions],
        bounds={"min":[round(float(x),5) for x in mins],"max":[round(float(x),5) for x in maxs]},
        collections=[c.name for c in obj.users_collection],asset=bool(obj.asset_data),
        uvLayers=[uv.name for uv in mesh.uv_layers],
        linked=not bool(obj.users_collection)))
catalog=[dict(name=c.name,children=len(c.children),objects=len(c.objects),
              asset=bool(c.asset_data)) for c in bpy.data.collections]
data.sort(key=lambda x:(-x["vertices"],x["name"]))
report={"sourceFile":source.name,"license":"CC0-1.0",
    "sourceSha256":hashlib.sha256(source.read_bytes()).hexdigest(),
    "blenderVersion":bpy.app.version_string,"meshes":data,"collections":catalog,
    "sourceMasterUnoptimized":True,"usedInBattle":False,"ff13ArtQualityApproved":False}
(ROOT/"inventory.json").write_text(json.dumps(report,indent=2,ensure_ascii=False)+"\n",encoding="utf8")
print("BLENDER_REAL_SOURCE_INSPECTION "+json.dumps({
 "blenderVersion":report["blenderVersion"],"objectCount":len(data),
 "candidateHeads":[{k:o[k] for k in ["name","vertices","polygons","shapeKeys","collections"]}
                   for o in data if "head" in o["name"].lower()][:16],
 "largestMeshes":[{k:o[k] for k in ["name","vertices","polygons"]} for o in data[:18]],
 "collections":catalog[:40]},ensure_ascii=False))
if not data:raise RuntimeError("No actual Blender mesh objects")
