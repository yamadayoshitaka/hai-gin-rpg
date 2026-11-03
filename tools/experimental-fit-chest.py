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
    # Anchor on the actual upper-torso rig bone, not the overall body bounds
    # (which include arm span and can place armor near the waist).
    rig=rigs[0]
    anchor=rig.data.bones.get('spine_03') or rig.data.bones.get('spine_02')
    if anchor:
        bone_center=rig.matrix_world @ ((anchor.head_local+anchor.tail_local)*.5)
        print('EXPERIMENTAL_CHEST_BONE_ANCHOR',json.dumps({'bone':anchor.name,'center':list(bone_center),'old_target':list(center_dst)}))
        center_dst=bone_center.copy()

    # Bake the fit into mesh vertices in world coordinates, then reset transforms.
    # The previous combination of object translation and scale was not reliably
    # preserved when Blender exported skinned GLB, placing the chest at the waist.
    from mathutils import Matrix
    for o in am:
        original_world=o.matrix_world.copy()
        positions=[center_dst+scale*((original_world @ v.co)-center_src) for v in o.data.vertices]
        if o.parent:
            saved_world=o.matrix_world.copy()
            o.parent=None
            o.matrix_world=saved_world
        o.matrix_world=Matrix.Identity(4)
        for v,position in zip(o.data.vertices,positions):
            v.co=position
        o.data.update()
    bpy.context.view_layer.update()
    fitted_lo,fitted_hi=bounds(am)
    expected_center=(Vector(fitted_lo)+Vector(fitted_hi))*.5
    # Mesh geometry may be asymmetric; use actual bounds to translate to torso center.
    correction=center_dst-expected_center
    for obj in am:
        for vertex in obj.data.vertices:vertex.co+=correction
        obj.data.update()
    bpy.context.view_layer.update()
    fitted_lo,fitted_hi=bounds(am)
    if ((Vector(fitted_lo)+Vector(fitted_hi))*.5-center_dst).length>0.02:
        raise RuntimeError('Fitted armor center remains offset after correction')
    print('EXPERIMENTAL_FITTED_ARMOR_BOUNDS',json.dumps({'min':fitted_lo,'max':fitted_hi,'target_center':list(center_dst)}))
    # Transfer nearest weighted body vertex to each armor vertex.
    from mathutils.kdtree import KDTree
    # Restrict transfer to actual torso-weighted body vertices. Nearest global
    # vertex was selecting the head for almost every armor vertex.
    rig_names=[b.name for b in rigs[0].data.bones if b.use_deform]
    torso_bones={name for name in rig_names if any(t in name.lower()
                 for t in ('spine','chest','torso','upperbody','upper_body','body'))}
    print('AVAILABLE_DEFORM_BONES',json.dumps(rig_names))
    print('TORSO_BONES',json.dumps(sorted(torso_bones)))
    if not torso_bones:raise RuntimeError('No torso deform bones in source rig')
    weighted=[(o,v) for o in bm for v in o.data.vertices
              if o.vertex_groups and any(o.vertex_groups[g.group].name in torso_bones
                                          and g.weight>0.05 for g in v.groups)]
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
            influences=[(source.vertex_groups[g.group].name,g.weight) for g in sv.groups
                        if g.weight>0 and source.vertex_groups[g.group].name in torso_bones]
            total=sum(w for _,w in influences)
            influences=[(name,w/total) for name,w in influences] if total>0 else []
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
    # A chest regression must use a torso bone, not the most common weight
    # (which can incorrectly be Head due to imperfect nearest-vertex fitting).
    counts=Counter(candidates)
    torso_names=[name for name in counts if any(token in name.lower()
                 for token in ('spine','chest','torso','upperbody','upper_body'))]
    chosen=max(torso_names,key=lambda name:counts[name],default=None)
    if not chosen or not rig.pose.bones.get(chosen):
        raise RuntimeError('No weighted torso bone found for chest pose test: '+str(list(counts.most_common(20))))
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
                for i in range(0,len(mesh.vertices),step):
                    v=mesh.vertices[i]
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
    # Surface-aware correction: project only vertices detected inside body
    # towards the nearest body surface, with a small clearance.
    # Experimental geometry correction; visual quality is not guaranteed.
    baseline_intersection=penetration_count()
    deps.update()
    body_surfaces=[]
    for obj in bm:
        ev=obj.evaluated_get(deps)
        mesh=ev.to_mesh()
        try:
            verts=[ev.matrix_world @ v.co for v in mesh.vertices]
            faces=[tuple(p.vertices) for p in mesh.polygons]
            if faces:body_surfaces.append(BVHTree.FromPolygons(verts,faces,all_triangles=False))
        finally:ev.to_mesh_clear()
    direction=Vector((0.912,0.337,0.239)).normalized()
    def inside_surface(point,tree):
        origin=point.copy()
        hits=0
        for _ in range(64):
            loc,normal,face,distance=tree.ray_cast(origin,direction,1e6)
            if loc is None:break
            hits+=1
            origin=loc+direction*1e-4
        return bool(hits%2)
    adjusted=0
    for obj in am:
        inverse=obj.matrix_world.inverted()
        for v in obj.data.vertices:
            point=obj.matrix_world @ v.co
            containing=[tree for tree in body_surfaces if inside_surface(point,tree)]
            if not containing:continue
            nearest=[]
            for tree in containing:
                location,normal,face,distance=tree.find_nearest(point)
                if location is not None:nearest.append((distance,location,normal,tree))
            if not nearest:continue
            _,location,normal,tree=min(nearest,key=lambda item:item[0])
            # Evaluate both normal orientations; choose the point outside the
            # original containing mesh, avoiding assumptions about winding.
            clearance=0.012
            options=[location+normal*clearance,location-normal*clearance]
            exterior=next((q for q in options if not inside_surface(q,tree)),None)
            if exterior is None:continue
            v.co=inverse @ exterior
            adjusted+=1
        obj.data.update()
    rest_intersection=penetration_count()
    bone.rotation_mode='QUATERNION'
    bone.rotation_quaternion=Quaternion((0,0,1),math.radians(12)) @ original
    posed_intersection=penetration_count()
    bone.rotation_quaternion=original
    bone.rotation_mode=original_mode
    deps.update()
    collision_check={'before_surface_projection':baseline_intersection,'rest':rest_intersection,'posed':posed_intersection,'corrected_vertices':adjusted,
                     'method':'sampled-vertex ray parity; approximate, not watertight proof'}
    print('EXPERIMENTAL_COLLISION_AUDIT',json.dumps(collision_check))
    bpy.ops.object.select_all(action='DESELECT')
    for o in body+armor:o.select_set(True)
    bpy.context.view_layer.objects.active=rigs[0]
    os.makedirs(os.path.dirname(os.path.abspath(args[2])),exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=os.path.abspath(args[2]),export_format='GLB',use_selection=True)
    report={'chest_anchor':list(center_dst),'status':'experimental-unverified','scale':scale,'body_bounds':[blo,bhi],'armor_bounds_before':[alo,ahi],'target_torso_bounds':[target_lo,target_hi],'skinned_vertices':transferred,'pose_check':pose_check,'collision_check':collision_check,'note':'Nearest-body-vertex weights transferred; visual fit not approved'}
    with open(os.path.abspath(args[2])+'.json','w') as f:json.dump(report,f,indent=2)
    print('EXPERIMENTAL_TORSO_ALIGNMENT',json.dumps(report))
if __name__=='__main__':main()
