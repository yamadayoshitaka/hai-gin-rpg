"""Body-first prototype: derive chest armor from actual body polygons and preserve skin weights.
Usage: blender -b --python tools/generate-body-first-outfit.py -- BODY.gltf OUTPUT.glb
Prototype only: does not generate the complete job catalog or photographic PBR textures.
"""
import bpy,sys,os,json
from mathutils import Vector
def main():
    args=sys.argv[sys.argv.index('--')+1:]
    if len(args)!=2:raise SystemExit('Expected BODY.gltf OUTPUT.glb')
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
    bpy.ops.import_scene.gltf(filepath=os.path.abspath(args[0]))
    rigs=[o for o in bpy.context.scene.objects if o.type=='ARMATURE']
    bodies=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.vertex_groups]
    if len(rigs)!=1 or not bodies:raise RuntimeError('Skinned body required')
    rig=rigs[0]
    spine={b.name for b in rig.data.bones if b.name.startswith('spine_')}
    made=[]
    for body in bodies:
        chest=[]
        for polygon in body.data.polygons:
            weights=[]
            for vi in polygon.vertices:
                v=body.data.vertices[vi]
                weights.append(sum(g.weight for g in v.groups
                    if body.vertex_groups[g.group].name in spine))
            if weights and min(weights)>.65:
                chest.append(polygon.index)
        if not chest:continue
        duplicate=body.copy()
        duplicate.data=body.data.copy()
        bpy.context.collection.objects.link(duplicate)
        duplicate.name='Procedural_BodySurface_Cuirass'
        # Keep exact body surface topology and vertex groups; remove non-chest polygons.
        import bmesh
        mesh=bmesh.new();mesh.from_mesh(duplicate.data)
        mesh.faces.ensure_lookup_table()
        keep=set(chest)
        bmesh.ops.delete(mesh,geom=[f for f in mesh.faces if f.index not in keep],context='FACES')
        mesh.to_mesh(duplicate.data);mesh.free()
        if not duplicate.data.polygons:
            bpy.data.objects.remove(duplicate,do_unlink=True)
            continue
        solid=duplicate.modifiers.new('ArmorClearanceAndThickness','SOLIDIFY')
        solid.thickness=.018
        solid.offset=1.0
        mat=bpy.data.materials.new('Prototype_Brushed_Steel')
        mat.diffuse_color=(.24,.29,.34,1)
        mat.use_nodes=True
        principled=mat.node_tree.nodes.get('Principled BSDF')
        principled.inputs['Metallic'].default_value=.78
        principled.inputs['Roughness'].default_value=.35
        duplicate.data.materials.clear()
        duplicate.data.materials.append(mat)
        made.append(duplicate.name)
    if not made:raise RuntimeError('No torso polygons selected; inspect body skin weights')
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=os.path.abspath(args[1]),export_format='GLB',
        use_selection=False,export_skins=True,export_animations=False)
    print('BODY_FIRST_OUTFIT_PROTOTYPE',json.dumps({'meshes':made,'output':args[1]}))
if __name__=='__main__':main()
