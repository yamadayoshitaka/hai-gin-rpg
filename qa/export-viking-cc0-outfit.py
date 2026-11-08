#!/usr/bin/env python3
"""Export the real CC0 Viking garments with original UVs and diffuse atlases.

MakeHuman Viking OBJ anatomy is Y-up and 10x Blender Studio scene scale.
This source is NOT automatically rig-fit; a separate image/mesh QA must accept
skeleton/cloth collisions before any playable model is replaced.
"""
import bpy, pathlib, os, sys, math, json, hashlib, traceback, struct
def hard_fail(t,e,tb):
    traceback.print_exception(t,e,tb);os._exit(1)
sys.excepthook=hard_fail

src=pathlib.Path('/tmp/viking-source')
out=pathlib.Path('qa-reports/blender-human-masters/export')
out.mkdir(parents=True,exist_ok=True)
parts=[
 ('tunic','tunic_viking/tunicviking.obj','tunic_viking/TUNIC_Viking.png'),
 ('pants','pants_viking/pantsviking.obj','pants_viking/PantsViking.png'),
 ('boots','boots_viking/bootsviking.obj','boots_viking/BootsViking.png'),
 ('scalp','scalp_viking/scalpviking.obj','scalp_viking/scalpVKG.png'),
 ('beard','beard_viking/beardviking.obj','beard_viking/BeardViking.png'),
 ('eyebrows','eyebrows_vkg/eyebrowvkg.obj','eyebrows_vkg/eyebrowVKG.png'),
 ('moustache','moustache_viking/moustacheviking.obj','moustache_viking/MoustacheViking.png')
]
def parse_obj(path):
    vertices=[];uvs=[];faces=[]
    for line in path.read_text(encoding='utf8',errors='replace').splitlines():
        if line.startswith('v '):
            vertices.append(tuple(map(float,line.split()[1:4])))
        elif line.startswith('vt '):
            uvs.append(tuple(map(float,line.split()[1:3])))
        elif line.startswith('f '):
            face=[]
            for index in line.split()[1:]:
                data=index.split('/')
                face.append((int(data[0])-1,int(data[1])-1 if len(data)>1 and data[1] else None))
            if len(face)>=3:faces.append(face)
    if len(vertices)<60 or len(faces)<40:
        raise RuntimeError('Viking asset has no meaningful 3D mesh: '+str(path))
    for f in faces:
        for vi,uv in f:
            if vi<0 or vi>=len(vertices):raise RuntimeError('Invalid vertex index')
            if uv is not None and (uv<0 or uv>=len(uvs)):raise RuntimeError('Invalid UV')
    return vertices,uvs,faces

geometries=[]
for name,meshpath,imgpath in parts:
    mp=src/meshpath;ip=src/imgpath
    if not mp.is_file() or not ip.is_file():raise RuntimeError('CC0 Viking part missing '+meshpath)
    v,uv,faces=parse_obj(mp)
    geometries.append((name,meshpath,imgpath,v,uv,faces))
ymin=min(x[1] for _,_,_,verts,_,_ in geometries for x in verts)
ymax=max(x[1] for _,_,_,verts,_,_ in geometries for x in verts)
xmin=min(x[0] for _,_,_,verts,_,_ in geometries for x in verts)
xmax=max(x[0] for _,_,_,verts,_,_ in geometries for x in verts)
zmin=min(x[2] for _,_,_,verts,_,_ in geometries for x in verts)
zmax=max(x[2] for _,_,_,verts,_,_ in geometries for x in verts)
scale=1.69/(ymax-ymin)
objects=[];manifest=[]
for name,meshpath,imgpath,vertices,uvs,faces in geometries:
    # Original object axes: X horizontal, Y vertical, Z depth.
    # Align source to a 1.69m axis, at ground zero; keep UVs exactly as OBJ.
    points=[((x-(xmin+xmax)/2)*scale,-(z-(zmin+zmax)/2)*scale,(y-ymin)*scale) for x,y,z in vertices]
    mesh=bpy.data.meshes.new('CC0-Viking-'+name)
    mesh.from_pydata(points,[],[[v for v,u in f] for f in faces])
    mesh.update(calc_edges=True)
    if uvs:
        layer=mesh.uv_layers.new(name='Original_MakeHuman_UV')
        for polygon,face in zip(mesh.polygons,faces):
            for loopid,(_vi,uv) in zip(polygon.loop_indices,face):
                if uv is not None:layer.data[loopid].uv=uvs[uv]
    for p in mesh.polygons:p.use_smooth=True
    obj=bpy.data.objects.new('CC0-Viking-'+name,mesh)
    bpy.context.collection.objects.link(obj)
    mat=bpy.data.materials.new('CC0-Viking-Diffuse-'+name);mat.use_nodes=True
    texnode=mat.node_tree.nodes.new('ShaderNodeTexImage')
    texnode.image=bpy.data.images.load(str(src/imgpath),check_existing=False)
    texnode.image.colorspace_settings.name='sRGB'
    bsdf=mat.node_tree.nodes.get('Principled BSDF')
    mat.node_tree.links.new(texnode.outputs['Color'],bsdf.inputs['Base Color'])
    bsdf.inputs['Roughness'].default_value=.70 if name not in ('boots',) else .60
    bsdf.inputs['Metallic'].default_value=0
    mesh.materials.append(mat)
    objects.append(obj)
    manifest.append(dict(part=name,originalOBJ=meshpath,originalTexture=imgpath,
        originalVertices=len(vertices),originalTriangles=sum(len(f)-2 for f in faces),
        originalUVCount=len(uvs),originalPNGBytes=(src/imgpath).stat().st_size))
bpy.ops.object.select_all(action='DESELECT')
for o in objects:o.select_set(True)
bpy.context.view_layer.objects.active=objects[0]
output=out/'viking-outfit-source.glb'
bpy.ops.export_scene.gltf(filepath=str(output),export_format='GLB',
  use_selection=True,export_animations=False,export_skins=False,export_yup=True)
raw=output.read_bytes()
if raw[:4]!=b'glTF' or struct.unpack_from('<I',raw,8)[0]!=len(raw):
    raise RuntimeError('Viking source GLB invalid')
if len(raw)<2e6 or len(raw)>35e6:raise RuntimeError('Viking preview unexpected data size '+str(len(raw)))
report=dict(id='viking-outfit-source',
 sourceCollection='Makehuman-2 CC0 Viking Gear Set',sourceType='actual OBJ + original texture PNGs',
 sourceURL='https://github.com/Makehuman-2/MH2_Asset_Repository_CCO/releases/download/CC0/RP_Viking_set_CC0.zip',
 license='CC0-1.0',sourceVertices=sum(p['originalVertices'] for p in manifest),
 sourceTriangles=sum(p['originalTriangles'] for p in manifest),
 sourceObjects=[p['part'] for p in manifest],
 output=output.name,previewBytes=len(raw),previewSha256=hashlib.sha256(raw).hexdigest(),
 parts=manifest,sourceUnmodified=True,originalUVPreserved=True,
 photoDiffuseOriginals=True,normalAndRoughnessMeasured=False,gameplayModelReplaced=False,
 skullRigFitValidated=False,bodyIntersectionsChecked=False,ff13QualityApproved=False,
 originDimensions=[round((xmax-xmin)*scale,4),round((ymax-ymin)*scale,4),round((zmax-zmin)*scale,4)])
(out/'viking-export-report.json').write_text(json.dumps(report,indent=2,ensure_ascii=False)+'\n',encoding='utf8')
print('EXPORTED_VIKING_CC0_GARMENTS '+json.dumps({k:v for k,v in report.items() if k!='parts'},ensure_ascii=False))
