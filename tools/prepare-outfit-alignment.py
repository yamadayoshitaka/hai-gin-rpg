"""Generate a Blender alignment scene for human review (does NOT claim fit).
blender -b --python tools/prepare-outfit-alignment.py -- body.gltf armor.glb review.blend
"""
import bpy,sys,os
def import_gltf(path):
    before=set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.abspath(path))
    return [o for o in bpy.data.objects if o not in before]
def main():
    args=sys.argv[sys.argv.index('--')+1:]
    if len(args)!=3: raise SystemExit('Expected body, armor, output.blend')
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    body=import_gltf(args[0])
    armor=import_gltf(args[1])
    if not any(o.type=='ARMATURE' for o in body): raise RuntimeError('Body rig missing')
    if not any(o.type=='MESH' for o in armor): raise RuntimeError('Armor mesh missing')
    for o in body:
        if o.type=='MESH': o.color=(0.2,0.65,0.95,1)
    for o in armor:
        if o.type=='MESH':
            o.color=(0.95,0.3,0.15,1)
            o.show_in_front=True
    # Keep original transforms intact. User must align mesh in the saved scene.
    collection=bpy.data.collections.new('ARMOR__ALIGN_BEFORE_RIGGING')
    bpy.context.scene.collection.children.link(collection)
    for o in armor:
        for old in list(o.users_collection):old.objects.unlink(o)
        collection.objects.link(o)
    bpy.context.scene.render.engine='BLENDER_EEVEE_NEXT' if hasattr(bpy.context.scene,'render') and 'BLENDER_EEVEE_NEXT' in bpy.context.scene.render.bl_rna.properties['engine'].enum_items.keys() else 'BLENDER_EEVEE'
    bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(args[2]))
    print('ALIGNMENT_REVIEW_REQUIRED',args[2])
if __name__=='__main__':main()
