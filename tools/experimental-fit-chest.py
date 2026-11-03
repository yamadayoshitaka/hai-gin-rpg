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
    bpy.ops.object.select_all(action='DESELECT')
    for o in body+armor:o.select_set(True)
    bpy.context.view_layer.objects.active=rigs[0]
    os.makedirs(os.path.dirname(os.path.abspath(args[2])),exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=os.path.abspath(args[2]),export_format='GLB',use_selection=True)
    report={'status':'experimental-unverified','scale':scale,'body_bounds':[blo,bhi],'armor_bounds_before':[alo,ahi],'target_torso_bounds':[target_lo,target_hi],'skinned_vertices':transferred,'note':'Nearest-body-vertex weights transferred; visual fit not approved'}
    with open(os.path.abspath(args[2])+'.json','w') as f:json.dump(report,f,indent=2)
    print('EXPERIMENTAL_TORSO_ALIGNMENT',json.dumps(report))
if __name__=='__main__':main()
