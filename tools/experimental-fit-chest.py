"""Experimental torso fit for review, never publish as verified.
blender -b --python tools/experimental-fit-chest.py -- BODY.gltf ARMOR.glb OUT.glb
"""
import bpy,sys,os,json
from mathutils import Vector
def load(p):
    before=set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.abspath(p))
    return [o for o in bpy.data.objects if o not in before]
def bounds(meshes):
    pts=[o.matrix_world @ Vector(c) for o in meshes for c in o.bound_box]
    return [min(v[i] for v in pts) for i in range(3)],[max(v[i] for v in pts) for i in range(3)]
def main():
    args=sys.argv[sys.argv.index('--')+1:]
    if len(args)!=3:raise SystemExit('BODY ARMOR OUT required')
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
    body=load(args[0]); armor=load(args[1])
    bm=[o for o in body if o.type=='MESH'];am=[o for o in armor if o.type=='MESH']
    rigs=[o for o in body if o.type=='ARMATURE']
    if not bm or not am or len(rigs)!=1:raise RuntimeError('Expected skinned body and armor meshes')
    blo,bhi=bounds(bm);alo,ahi=bounds(am)
    # Torso region approximated from overall body proportions; must be visually checked.
    h=bhi[2]-blo[2]
    target_lo=[blo[0]+(bhi[0]-blo[0])*.22,blo[1]+(bhi[1]-blo[1])*.15,blo[2]+h*.48]
    target_hi=[bhi[0]-(bhi[0]-blo[0])*.22,bhi[1]-(bhi[1]-blo[1])*.15,blo[2]+h*.83]
    src=[max(ahi[i]-alo[i],1e-5) for i in range(3)]
    dst=[target_hi[i]-target_lo[i] for i in range(3)]
    # Uniform scale preserves armor proportions. Never claim surface-conforming fit.
    scale=min(dst[i]/src[i] for i in range(3))
    center_src=Vector([(alo[i]+ahi[i])/2 for i in range(3)])
    center_dst=Vector([(target_lo[i]+target_hi[i])/2 for i in range(3)])
    for o in am:
        o.matrix_world.translation=center_dst+scale*(o.matrix_world.translation-center_src)
        o.scale*=scale
    # Transfer nearest weighted body vertex to each armor vertex.
    from mathutils.kdtree import KDTree
    weighted=[(o,v) for o in bm for v in o.data.vertices if v.groups and o.vertex_groups]
    if not weighted:raise RuntimeError('Source body has no transferable weights')
    tree=KDTree(len(weighted))
    for i,(o,v) in enumerate(weighted):tree.insert(o.matrix_world @ v.co,i)
    tree.balance()
    transferred=0
    for obj in am:
        groups={}
        for v in obj.data.vertices:
            _,idx,_=tree.find(obj.matrix_world @ v.co)
            source,sv=weighted[idx]
            influences=[(source.vertex_groups[g.group].name,g.weight) for g in sv.groups if g.weight>0]
            if not influences:raise RuntimeError('Unweighted source vertex')
            for name,weight in influences:
                if name not in groups:groups[name]=obj.vertex_groups.get(name) or obj.vertex_groups.new(name=name)
                groups[name].add([v.index],weight,'REPLACE')
            transferred+=1
        mod=obj.modifiers.new(name='ArmorSkin',type='ARMATURE')
        mod.object=rigs[0]
    if not transferred:raise RuntimeError('No armor vertices skinned')
    # Regression: deform a weighted armature bone and require armor geometry to move.
    import math
    from mathutils import Quaternion
    rig=rigs[0]
    deform={b.name for b in rig.data.bones if b.use_deform}
    candidates=[]
    for obj in am:
        for v in obj.data.vertices:
            for g in v.groups:
                if g.weight>0.2 and obj.vertex_groups[g.group].name in deform:
                    candidates.append(obj.vertex_groups[g.group].name)
    if not candidates:raise RuntimeError('No deform bone weights on armor')
    # Choose the most represented deform bone; small rotation is a mechanical test,
    # not a substitute for actual walk/attack animation or visual collision checks.
    from collections import Counter
    chosen=next((name for name,_ in Counter(candidates).most_common()
                 if rig.pose.bones.get(name)),None)
    if not chosen:raise RuntimeError('No matching pose bone')
    bone=rig.pose.bones[chosen]
    deps=bpy.context.evaluated_depsgraph_get()
    def sample():
        deps.update()
        samples=[]
        for obj in am:
            evaluated=obj.evaluated_get(deps)
            mesh=evaluated.to_mesh()
            try:
                if mesh.vertices:
                    step=max(1,len(mesh.vertices)//200)
                    samples.extend([evaluated.matrix_world @ mesh.vertices[i].co
                                    for i in range(0,len(mesh.vertices),step)])
            finally:evaluated.to_mesh_clear()
        return samples
    before=sample()
    original_mode=bone.rotation_mode
    bone.rotation_mode='QUATERNION'
    original=bone.rotation_quaternion.copy()
    bone.rotation_quaternion=Quaternion((0,0,1),math.radians(12)) @ original
    after=sample()
    bone.rotation_quaternion=original
    bone.rotation_mode=original_mode
    deps.update()
    max_displacement=max((a-b).length for a,b in zip(after,before))
    if max_displacement<1e-6:raise RuntimeError('Armor did not deform with rig pose')
    pose_check={'bone':chosen,'angle_degrees':12,'max_displacement':max_displacement,
                'status':'mechanical-deformation-only'}
    # Quantify penetration into the body at rest and under the test pose.
    # Nearest body surface is approximated by a BVH ray intersection test.
    from mathutils.bvhtree import BVHTree
    def penetration_count():
        deps.update()
        body_bvhs=[]
        for obj in bm:
            evaluated=obj.evaluated_get(deps)
            mesh=evaluated.to_mesh()
            try:
                verts=[evaluated.matrix_world @ v.co for v in mesh.vertices]
                faces=[tuple(p.vertices) for p in mesh.polygons]
                if faces:body_bvhs.append(BVHTree.FromPolygons(verts,faces,all_triangles=False))
            finally:evaluated.to_mesh_clear()
        inside=0;checked=0
        for obj in am:
            evaluated=obj.evaluated_get(deps)
            mesh=evaluated.to_mesh()
            try:
                step=max(1,len(mesh.vertices)//500)
                for v in mesh.vertices[::step]:
                    p=evaluated.matrix_world @ v.co
                    checked+=1
                    # Count candidate surface points with an odd number of ray hits.
                    for tree in body_bvhs:
                        origin=p.copy()
                        hits=0
                        for _ in range(64):
                            loc,normal,face,distance=tree.ray_cast(origin,Vector((0.912,0.337,0.239)),1e6)
                            if loc is None:break
                            hits+=1
                            origin=loc+Vector((0.912,0.337,0.239))*1e-4
                        if hits%2:
                            inside+=1
                            break
            finally:evaluated.to_mesh_clear()
        return {'sampled_armor_vertices':checked,'inside_body_samples':inside}
    rest_intersection=penetration_count()
    bone.rotation_mode='QUATERNION'
    bone.rotation_quaternion=Quaternion((0,0,1),math.radians(12)) @ original
    posed_intersection=penetration_count()
    bone.rotation_quaternion=original
    bone.rotation_mode=original_mode
    deps.update()
    collision_check={'rest':rest_intersection,'posed':posed_intersection,
                     'method':'sampled-vertex ray parity; approximate, not watertight proof'}
    print('EXPERIMENTAL_COLLISION_AUDIT',json.dumps(collision_check))
    bpy.ops.object.select_all(action='DESELECT')
    for o in body+armor:o.select_set(True)
    bpy.context.view_layer.objects.active=rigs[0]
    os.makedirs(os.path.dirname(os.path.abspath(args[2])),exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=os.path.abspath(args[2]),export_format='GLB',use_selection=True)
    report={'status':'experimental-unverified','scale':scale,'body_bounds':[blo,bhi],'armor_bounds_before':[alo,ahi],'target_torso_bounds':[target_lo,target_hi],'skinned_vertices':transferred,'pose_check':pose_check,'collision_check':collision_check,'note':'Nearest-body-vertex weights transferred; visual fit not approved'}
    with open(os.path.abspath(args[2])+'.json','w') as f:json.dump(report,f,indent=2)
    print('EXPERIMENTAL_TORSO_ALIGNMENT',json.dumps(report))
if __name__=='__main__':main()
