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
    # Reject armor that is clearly not aligned with the body.
    from mathutils import Vector
    def bounds(items):
        points=[o.matrix_world @ Vector(v) for o in items for v in o.bound_box]
        return ([min(p[i] for p in points) for i in range(3)],
                [max(p[i] for p in points) for i in range(3)])
    lo,hi=bounds(body_meshes)
    alo,ahi=bounds(meshes)
    sizes=[max(hi[i]-lo[i],1e-6) for i in range(3)]
    asizes=[ahi[i]-alo[i] for i in range(3)]
    # Blender imports glTF Y-up into Z-up coordinates. Check all three axes.
    overlap=[max(0,min(hi[i],ahi_armor)-max(lo[i],alo[i]))
             for i,ahi_armor in enumerate(ahi)]
    if overlap[2] < min(sizes[2],asizes[2])*.15:
        raise RuntimeError('Armor outside body vertical range; align it before rigging')
    if overlap[0] < min(sizes[0],asizes[0])*.1 or overlap[1] < min(sizes[1],asizes[1])*.1:
        raise RuntimeError('Armor outside body horizontal footprint; align it before rigging')
    if any(asizes[i]>sizes[i]*2.5 for i in range(3)):
        raise RuntimeError('Armor larger than body; align scale before rigging')
    # No automatic transform correction: a wrong source coordinate system must
    # be fixed in Blender and visually approved before binding.
    for obj in meshes:
        bpy.ops.object.select_all(action='DESELECT')
        obj.select_set(True)
        rig.select_set(True)
        bpy.context.view_layer.objects.active=rig
        bpy.ops.object.parent_set(type='ARMATURE_AUTO', keep_transform=True)
        if not obj.vertex_groups or not any(v.groups for v in obj.data.vertices):
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
