"""Blender 4.x: bind an ALREADY ALIGNED outfit to the character armature.
Usage: blender -b --python tools/rig_outfit_blender.py -- body.glb aligned_armor.glb output.glb
Alignment must be performed/checked in Blender first. No guessing or mesh cutting.
"""
import bpy, sys, os
from mathutils import Matrix

def imported(path):
    before=set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.abspath(path))
    return [o for o in bpy.data.objects if o not in before]

def main():
    args=sys.argv[sys.argv.index('--')+1:]
    if len(args)!=3: raise SystemExit('Expected body.glb aligned_armor.glb output.glb')
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    body=imported(args[0])
    rigs=[o for o in body if o.type=='ARMATURE']
    if len(rigs)!=1: raise RuntimeError('Body GLB must contain exactly one armature')
    rig=rigs[0]
    armor=imported(args[1])
    body_meshes=[o for o in body if o.type=='MESH']
    if not body_meshes: raise RuntimeError('Body GLB has no body meshes')
    meshes=[o for o in armor if o.type=='MESH']
    if not meshes: raise RuntimeError('Outfit contains no meshes')
    if any(o.type=='ARMATURE' for o in armor):
        raise RuntimeError('Outfit already has a rig; use a dedicated retargeting workflow')
    # No automatic transform correction: a wrong source coordinate system must
    # be fixed in Blender and visually approved before binding.
    for obj in meshes:
        bpy.ops.object.select_all(action='DESELECT')
        obj.select_set(True)
        rig.select_set(True)
        bpy.context.view_layer.objects.active=rig
        bpy.ops.object.parent_set(type='ARMATURE_AUTO', keep_transform=True)
        if not obj.vertex_groups:
            raise RuntimeError('Automatic weights failed: '+obj.name)
        if not any(m.type=='ARMATURE' and m.object==rig for m in obj.modifiers):
            raise RuntimeError('Armature modifier missing: '+obj.name)
    bpy.ops.object.select_all(action='DESELECT')
    rig.select_set(True)
    for obj in meshes+body_meshes: obj.select_set(True)
    bpy.context.view_layer.objects.active=rig
    bpy.ops.export_scene.gltf(filepath=os.path.abspath(args[2]),
        export_format='GLB',use_selection=True,export_skins=True,
        export_animations=False)
    print('EXPORTED',args[2],'ARMOR_MESHES',len(meshes),'BODY_MESHES',len(body_meshes),'RIG',rig.name)

if __name__=='__main__': main()
