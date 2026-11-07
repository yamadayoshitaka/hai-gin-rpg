"""Build two independent GLB assets from already-repository CC0/MIT sources on free GitHub Actions.

Usage:
  blender -b --python tools/build-free-knight-pair.py
This is NOT generative AI and NOT a commercially approved visual fit.
No external APIs, keys or paid service. Originals remain unchanged.
"""
import bpy
import json
import math
import os
import struct
from pathlib import Path
from mathutils import Vector, Matrix

ROOT=Path.cwd()
BODY=ROOT/'assets/characters/quaternius-base/Superhero_Male_FullBody.gltf'
ARMOR_DIR=ROOT/'assets/characters/seven-head-equipment-candidates'
OUT=ROOT/'assets/characters/free-knight'
PARTS=[
 ('plate_head-male.glb', 'helmet', .90, .19, .22, .17),
 ('plate_chest-male.glb', 'breastplate', .68, .44, .32, .36),
 ('plate_hands-male.glb', 'gauntlets', .54, .93, .25, .35),
 ('plate_legs-male.glb', 'cuisses-greaves', .31, .41, .28, .47),
 ('plate_feet-male.glb', 'boots-sabatons', .075, .42, .34, .16),
]

def import_gltf(filepath):
    old=set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(filepath.resolve()))
    return [ob for ob in bpy.data.objects if ob not in old]

def box(meshes):
    pts=[ob.matrix_world @ Vector(corner) for ob in meshes for corner in ob.bound_box]
    if not pts: raise RuntimeError('No valid mesh geometry')
    lo=Vector([min(v[a] for v in pts) for a in range(3)])
    hi=Vector([max(v[a] for v in pts) for a in range(3)])
    return lo,hi

def write_glb(filepath,selected):
    filepath.parent.mkdir(parents=True,exist_ok=True)
    bpy.ops.object.select_all(action='DESELECT')
    for ob in selected: ob.select_set(True)
    bpy.context.view_layer.objects.active=next((ob for ob in selected if ob.type=='ARMATURE'),selected[0])
    bpy.ops.export_scene.gltf(filepath=str(filepath.resolve()),export_format='GLB',
        use_selection=True,export_animations=False)
    raw=filepath.read_bytes()
    if len(raw)<32 or raw[:4]!=b'glTF' or struct.unpack_from('<I',raw,8)[0]!=len(raw):
        raise RuntimeError('Invalid GLB export: '+str(filepath))
    header=struct.unpack_from('<I4s',raw,12)
    if header[1]!=b'JSON':raise RuntimeError('Missing GLB JSON chunk')
    doc=json.loads(raw[20:20+header[0]])
    if not doc.get('meshes'):raise RuntimeError('No exported mesh')
    return {'meshes':len(doc['meshes']),'skins':len(doc.get('skins',[])),
        'materials':len(doc.get('materials',[])), 'bytes':len(raw)}

def to_world_static_mesh(ob,category):
    deps=bpy.context.evaluated_depsgraph_get()
    evaluated=ob.evaluated_get(deps)
    mesh=bpy.data.meshes.new_from_object(evaluated,preserve_all_data_layers=True,depsgraph=deps)
    if not mesh or not len(mesh.vertices):return None
    # Make a separate, static mesh: no hidden body/rig in the armor GLB.
    neo=bpy.data.objects.new(category+'__'+ob.name,mesh)
    bpy.context.collection.objects.link(neo)
    world=ob.matrix_world.copy()
    for vert in mesh.vertices: vert.co=world @ vert.co
    neo.matrix_world=Matrix.Identity(4)
    return neo

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)

def main():
    if not BODY.is_file():raise RuntimeError('Missing CC0 body source')
    for entry,*_ in PARTS:
        if not (ARMOR_DIR/entry).is_file():raise RuntimeError('Missing MIT candidate '+entry)
    OUT.mkdir(parents=True,exist_ok=True)
    reset()
    imported=import_gltf(BODY)
    meshes=[ob for ob in imported if ob.type=='MESH']
    rigged=[ob for ob in imported if ob.type=='ARMATURE']
    if not meshes or not rigged:raise RuntimeError('Expected skinned full-body humanoid')
    blo,bhi=box(meshes)
    bodyCenter=(blo+bhi)*.5
    bodyHeight=bhi.z-blo.z
    bodyWidth=bhi.x-blo.x
    bodyDepth=bhi.y-blo.y
    if bodyHeight<=0.2 or bodyWidth<=0.02:raise RuntimeError('Invalid body dimensions')
    body_report=write_glb(OUT/'knight_male_body.glb',imported)
    body_report.update({'source':str(BODY.relative_to(ROOT)),'bodyHeight':round(bodyHeight,5)})
    print('BODY:',json.dumps(body_report))
    # Build an independent armor shell using already-licensed modular pieces.
    reset()
    armor_pieces=[]
    per_piece=[]
    for filename,name,z_rel,width_rel,depth_rel,height_rel in PARTS:
        source=import_gltf(ARMOR_DIR/filename)
        original_meshes=[ob for ob in source if ob.type=='MESH']
        if not original_meshes:raise RuntimeError('Empty candidate: '+filename)
        new_meshes=[]
        for ob in original_meshes:
            neo=to_world_static_mesh(ob,name)
            if neo:new_meshes.append(neo)
        if not new_meshes:raise RuntimeError('No usable candidate surfaces '+filename)
        src_min,src_max=box(new_meshes)
        src_center=(src_min+src_max)*.5
        src_size=src_max-src_min
        dst_center=Vector((bodyCenter.x,bodyCenter.y,blo.z+z_rel*bodyHeight))
        dst_size=Vector((bodyHeight*width_rel,bodyHeight*depth_rel,bodyHeight*height_rel))
        # Uniform scaling is intentionally conservative, maintaining piece shape.
        factors=[dst_size[j]/max(src_size[j],1e-5) for j in range(3)]
        scale=min(factors)
        if not math.isfinite(scale) or scale<=0:raise RuntimeError('Bad scale '+name)
        for ob in new_meshes:
            for vert in ob.data.vertices:
                vert.co=dst_center+(vert.co-src_center)*scale
            ob.data.update()
        per_piece.append({'source':filename,'category':name,'meshes':len(new_meshes),
            'scale':round(scale,5),'anchorZ':round(dst_center.z,5),
            'sourceSize':[round(v,4) for v in src_size]})
        armor_pieces.extend(new_meshes)
        # Never export upstream rig/root nodes into the separate armor GLB.
        for ob in source:
            if bpy.data.objects.get(ob.name) is ob:
                bpy.data.objects.remove(ob,do_unlink=True)
    if len(armor_pieces)<5:raise RuntimeError('Incomplete armor (need 5 imported parts)')
    armor_report=write_glb(OUT/'knight_full_plate_armor.glb',armor_pieces)
    armor_report['parts']=per_piece
    print('ARMOR:',json.dumps(armor_report))
    manifest={
      'schema':'free-knight-import-v1',
      'source':'pre-existing free 3D assets; Blender assembly on GitHub Actions',
      'generatedByAI':False,
      'cost':'0 paid API or subscription',
      'approval':'preview-only; inspect fit, joints, penetration, visuals',
      'body':{'file':'assets/characters/free-knight/knight_male_body.glb',**body_report},
      'armor':{'file':'assets/characters/free-knight/knight_full_plate_armor.glb',**armor_report},
      'licenses':[
        {'source':'Quaternius Universal Base Characters','type':'CC0 1.0',
         'file':'assets/characters/quaternius-base/base-license.txt'},
        {'source':'Holokat/game-assets','type':'MIT',
         'file':'assets/characters/seven-head-equipment-candidates/LICENSE.upstream'}
      ],
      'limitations':'This combines available MIT armor parts; it does not create new AI geometry or validate deformation/rigger compatibility.'
    }
    (OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print('SAVED_PAIR',OUT)

if __name__=='__main__':main()
