"""Body-first prototype: derive chest armor from actual body polygons and preserve skin weights.
Usage: blender -b --python tools/generate-body-first-outfit.py -- BODY.gltf OUTPUT.glb
Prototype only: does not generate the complete job catalog or photographic PBR textures.
"""
import bpy,sys,os,json
from mathutils import Vector
def main():
    args=sys.argv[sys.argv.index('--')+1:]
    if len(args) not in (2,3):raise SystemExit('Expected BODY.gltf OUTPUT.glb [JOB_CATALOG.json]')
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
    # Export per-job prototypes from the same body-derived topology.
    # These are material/thickness variants, not finished job-specific costumes.
    if len(args)==3:
        catalog=json.load(open(args[2],encoding='utf-8'))
        outdir=os.path.dirname(os.path.abspath(args[1]))
        os.makedirs(outdir,exist_ok=True)
        palette={
            'general':((.28,.23,.18,1),.05,.9,.008),
            'melee':((.32,.35,.40,1),.75,.35,.018),
            'ranged':((.19,.12,.08,1),.05,.85,.012),
            'magic':((.15,.12,.33,1),.02,.92,.007),
            'support':((.66,.60,.44,1),.12,.72,.009),
            'enemy':((.24,.17,.18,1),.50,.48,.016)}
        report=[]
        for job_id,job in catalog.items():
            color,metal,rough,thickness=palette.get(job['category'],palette['general'])
            for obj in bpy.context.scene.objects:
                if obj.name.startswith('Procedural_BodySurface_Cuirass'):
                    obj.data.materials[0].diffuse_color=color
                    node=obj.data.materials[0].node_tree.nodes.get('Principled BSDF')
                    node.inputs['Base Color'].default_value=color
                    node.inputs['Metallic'].default_value=metal
                    node.inputs['Roughness'].default_value=rough
                    for mod in obj.modifiers:
                        if mod.type=='SOLIDIFY':mod.thickness=thickness
            target=os.path.join(outdir,job_id+'.glb')
            bpy.ops.object.select_all(action='SELECT')
            bpy.ops.export_scene.gltf(filepath=target,export_format='GLB',
                use_selection=False,export_skins=True,export_animations=False)
            report.append({'job':job_id,'category':job['category'],
                'path':os.path.basename(target),'bytes':os.path.getsize(target),
                'status':'prototype-material-variant','photographicPBR':False})
        with open(os.path.join(outdir,'manifest.json'),'w',encoding='utf-8') as f:
            json.dump({'schema':'body-first-job-prototypes-v1','items':report},f,ensure_ascii=False,indent=2)
        print('BODY_FIRST_ALL_JOBS',json.dumps({'count':len(report),'output':outdir}))
        return
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=os.path.abspath(args[1]),export_format='GLB',
        use_selection=False,export_skins=True,export_animations=False)
    print('BODY_FIRST_OUTFIT_PROTOTYPE',json.dumps({'meshes':made,'output':args[1]}))
if __name__=='__main__':main()
