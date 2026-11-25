"""Fit actual repository Quaternius garment meshes to HM08 body candidates.
Preserve source UV and garment material, exclude embedded source skin and hood.
Outputs independent skinned clothes with a shared target armature, no body cuts.
Not visual approval or complete collision clearance.
"""
import bpy,bmesh,numpy as np,sys,json,hashlib,math,re
from pathlib import Path
from mathutils import Vector,Matrix
from mathutils.bvhtree import BVHTree
args=sys.argv[sys.argv.index('--')+1:]
root,wardrobe,out=map(lambda x:Path(x).resolve(),args[:3]);out.mkdir(parents=True,exist_ok=True)
ident,style=args[3:5];sex=ident.split('_')[0]
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
records={}
for f in root.rglob('body-candidates.json'):
    for m in json.loads(f.read_text())['models']:records[m['id']]=(f.parent,m)
folder,rec=records[ident];bodyfile=folder/(ident+'.glb')
if sha(bodyfile)!=rec['sha256']:raise RuntimeError('body provenance mismatch')
source=wardrobe/(sex.title()+'_'+style+'.gltf')
g=json.loads(source.read_text());dependencies=[source]+[source.parent/x['uri'] for x in g.get('buffers',[])+g.get('images',[]) if 'uri' in x and not x['uri'].startswith('data:')]
provenance={p.name:sha(p) for p in dependencies}
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(bodyfile));bpy.context.view_layer.update()
bodylist=[o for o in bpy.context.scene.objects if o.type=='MESH' and any(m.type=='ARMATURE' and m.object for m in o.modifiers)]
if len(bodylist)!=1:raise RuntimeError('ambiguous target body')
body=bodylist[0];rig=next(m.object for m in body.modifiers if m.type=='ARMATURE')
def points(o):return np.array([o.matrix_world@v.co for v in o.data.vertices],np.float64)
def triangles(o):
    o.data.calc_loop_triangles()
    return np.array([tuple(t.vertices) for t in o.data.loop_triangles],np.int32)
P=points(body);T=triangles(body)
def bvh(P,T):
    return BVHTree.FromPolygons([Vector(tuple(float(x) for x in p)) for p in P],[tuple(int(x) for x in t) for t in T],all_triangles=True)
tree=bvh(P,T);height=float(np.ptp(P[:,2]))
old=set(bpy.context.scene.objects)
bpy.ops.import_scene.gltf(filepath=str(source));bpy.context.view_layer.update()
srcobjs=[o for o in bpy.context.scene.objects if o not in old]
sr=[o for o in srcobjs if o.type=='ARMATURE']
if len(sr)!=1:raise RuntimeError('ambiguous garment armature')
src=sr[0]
def pos(r,n):
    b=r.data.bones.get(n)
    if not b:raise RuntimeError('missing joint '+n)
    return r.matrix_world@b.head_local
def midpoint(r,a,b):return (pos(r,a)+pos(r,b))/2
def order(r,prefix):return sorted([b.name for b in r.data.bones if re.fullmatch(prefix+r'[0-9]+',b.name.lower().replace('_',''))],key=lambda n:pos(r,n).z)
ss=order(src,'spine');ts=order(rig,'spine')
if len(ss)!=3 or len(ts)!=5:raise RuntimeError('unexpected spine chain')
# Anchors correspond to joints, not arbitrary object bounding boxes.
# Use axis alignment and length ratio; preserve twist about segment axis as
# much as possible. Root/pelvis is centred at the actual target hip sockets.
anchors={}
def anchor(sn,tn,A,B,C,D):
    a=B-A;b=D-C
    if a.length<1e-5 or b.length<1e-5:raise RuntimeError('zero anatomical segment '+sn)
    q=a.rotation_difference(b);scale=max(.45,min(2.0,b.length/a.length))
    anchors[sn]=(tn,A,C,q,scale)
    return scale
hip=midpoint(rig,'upperleg01.L','upperleg01.R')
anchor('pelvis','root',pos(src,'pelvis'),pos(src,ss[0]),hip,pos(rig,ts[0]))
anchors['root']=anchors['pelvis']
for j,(a,b) in enumerate(zip(ss,[ts[0],ts[2],ts[4]])):
    sa=ss[j+1] if j<2 else 'neck_01';tb=[ts[2],ts[4],'neck01'][j]
    anchor(a,b,pos(src,a),pos(src,sa),pos(rig,b),pos(rig,tb))
anchor('neck_01','neck01',pos(src,'neck_01'),pos(src,'Head'),pos(rig,'neck01'),pos(rig,'head'))
anchors['Head']=anchors['neck_01']
for side in ('l','r'):
    S=side.upper()
    chain=[('clavicle','clavicle','upperarm','upperarm01'),('upperarm','upperarm01','lowerarm','lowerarm01'),('lowerarm','lowerarm01','hand','wrist'),('thigh','upperleg01','calf','lowerleg01'),('calf','lowerleg01','foot','foot'),('foot','foot','ball','toe1-1')]
    for sn,tn,se,te in chain:
        anchor(sn+'_'+side,tn+'.'+S,pos(src,sn+'_'+side),pos(src,se+'_'+side),pos(rig,tn+'.'+S),pos(rig,te+'.'+S))
    anchors['ball_'+side]=anchors['foot_'+side]
    anchors['hand_'+side]=anchors['lowerarm_'+side]
    # Embedded source skin is removed; finger groups can remain at sleeve tips.
    for b in src.data.bones:
        if b.name.endswith('_'+side) and b.name.startswith(('index','middle','pinky','ring','thumb','ball_leaf')):anchors[b.name]=anchors['foot_'+side] if b.name.startswith('ball') else anchors['hand_'+side]
def metrics(Q,tree):
    d=[]
    for v in Q:
        q,n,idx,dist=tree.find_nearest(Vector(v))
        if q is None:raise RuntimeError('nearest body unavailable')
        d.append((Vector(v)-q).dot(n))
    d=np.array(d)
    return {'penetrationProxy':float(np.mean(d<-.003)),'deepPenetrationProxy':float(np.mean(d<-.015)),'medianClearance_m':float(np.median(d)),'maxDepth_m':float(d.min())}
def normals(P,T):
    q=P[T];return np.cross(q[:,1]-q[:,0],q[:,2]-q[:,0])
# The glTF importer can create mesh-type bone display/custom shapes
# (e.g. Icosphere.001). Only the source glTF's declared skinned nodes
# that bind to its actual armature are garment inputs.
declared={n['name'] for n in g['nodes'] if 'mesh' in n and 'skin' in n and 'hood' not in n['name'].lower()}
def source_node_name(o):
    if o.name in declared:return o.name
    prefix,sep,suffix=o.name.rpartition('.')
    return prefix if sep and len(suffix)==3 and suffix.isdigit() else o.name
candidates=[o for o in srcobjs if o.type=='MESH' and source_node_name(o) in declared and
            any(m.type=='ARMATURE' and m.object==src for m in o.modifiers)]
found={source_node_name(o) for o in candidates}
ignored=[o.name for o in srcobjs if o.type=='MESH' and o not in candidates]
print('R53 source garment nodes',sorted(found),'excluded',ignored,flush=True)
if found!=declared or len(candidates)!=len(declared):
    raise RuntimeError('declared garment mismatch: missing '+str(sorted(declared-found))+' duplicate count '+str(len(candidates)-len(found)))
garments=[];reports=[]
for o in candidates:
    # Drop embedded bare-skin material polygons while retaining authored UVs.
    M=o.matrix_world.copy();mesh=o.data;bm=bmesh.new();bm.from_mesh(mesh)
    skin=[f for f in bm.faces if 'regular' in (mesh.materials[f.material_index].name.lower() if f.material_index<len(mesh.materials) and mesh.materials[f.material_index] else '')]
    if skin:bmesh.ops.delete(bm,geom=skin,context='FACES')
    loose=[v for v in bm.verts if not v.link_faces]
    if loose:bmesh.ops.delete(bm,geom=loose,context='VERTS')
    bm.to_mesh(mesh);bm.free();mesh.update()
    if not len(mesh.polygons):
        print('R53 skin-only source node removed',o.name,flush=True);continue
    print('R53 garment part',o.name,'vertices',len(mesh.vertices),'faces',len(mesh.polygons),'groups',len(o.vertex_groups),flush=True)
    Q=points(o);TT=triangles(o)
    groups=[g.name for g in o.vertex_groups]
    weights=[];fitted=[]
    for v,p in zip(mesh.vertices,Q):
        row={};q=Vector((0,0,0));total=0
        for wg in v.groups:
            if wg.weight<1e-6:continue
            name=groups[wg.group]
            if name not in anchors:raise RuntimeError('unmapped garment weight '+name)
            tn,A,C,rot,k=anchors[name];wt=float(wg.weight)
            q+=(C+rot@(Vector(p)-A)*k)*wt;row[tn]=row.get(tn,0)+wt;total+=wt
        if total<1e-6:raise RuntimeError('unweighted garment vertex '+o.name)
        fitted.append(tuple(q/total));weights.append({n:w/total for n,w in row.items()})
    F=np.array(fitted);base=F.copy();N=normals(F,TT);area=np.linalg.norm(N,axis=1);valid=area>1e-12
    before=metrics(F,tree)
    # Shared displacement across split UV seams; retain local triangle winding
    # and avoid collapsing existing garment folds while reducing skin intrusion.
    _,w=np.unique(np.round(F,6),axis=0,return_inverse=True);counts=np.bincount(w);nv=len(counts)
    W=np.column_stack([np.bincount(w,weights=F[:,k])/counts for k in range(3)])
    edges=np.unique(np.sort(np.concatenate((w[TT[:,[0,1]]],w[TT[:,[1,2]]],w[TT[:,[2,0]]])),axis=1),axis=0)
    edges=edges[edges[:,0]!=edges[:,1]];e0=np.r_[edges[:,0],edges[:,1]];e1=np.r_[edges[:,1],edges[:,0]]
    deg=np.maximum(1,np.bincount(e0,minlength=nv))
    def smooth(A):return np.column_stack([np.bincount(e0,weights=A[e1,k],minlength=nv)/deg for k in range(3)])
    def score(m):return m['penetrationProxy']+2*m['deepPenetrationProxy']
    D=np.zeros_like(W);best=before;accepted=0
    for it in range(18):
        A=np.zeros_like(D)
        for j,p in enumerate(W+D):
            q,n,idx,dist=tree.find_nearest(Vector(p));d=(Vector(p)-q).dot(n)
            if d<.004 and dist<.08:A[j]=np.array(n)*min(.006,.004-d)
        if not np.any(A):break
        A=.6*A+.4*smooth(A)
        for _ in range(2):A=.75*A+.25*smooth(A)
        ok=False
        for fac in (1,.5,.25,.1,.03):
            C=D+fac*A;C*=np.minimum(1,.045/np.maximum(np.linalg.norm(C,axis=1),1e-12))[:,None]
            H=base+C[w];nn=normals(H,TT)
            if np.any((np.einsum('ij,ij->i',nn,N)<0)&valid) or np.any((np.linalg.norm(nn,axis=1)<area*.03)&valid):continue
            m=metrics(H,tree)
            if score(m)<score(best)-1e-7:
                D=C;best=m;accepted+=1;ok=True;break
        if not ok:break
    F=base+D[w]
    # Replace source bind only. The original body and original garment source
    # remain unchanged; all target bones and UV layers stay in the output.
    o.parent=None;o.matrix_world=Matrix.Identity(4)
    for mod in list(o.modifiers):o.modifiers.remove(mod)
    for v,p in zip(mesh.vertices,F):v.co=Vector(p)
    mesh.update();o.vertex_groups.clear()
    names=sorted({n for row in weights for n in row})
    gg={n:o.vertex_groups.new(name=n) for n in names}
    for i,row in enumerate(weights):
        for n,wt in row.items():gg[n].add([i],wt,'REPLACE')
    mod=o.modifiers.new('R53 target rig','ARMATURE');mod.object=rig
    o.name='R53_'+o.name;garments.append(o)
    reports.append({'part':o.name,'sourceSkinFacesRemoved':len(skin),'vertices':len(F),'triangles':len(TT),'uvLayers':[u.name for u in mesh.uv_layers],
                    'mappedBones':names,'before':before,'after':best,'acceptedIterations':accepted,
                    'maxLocalDisplacement_m':float(np.max(np.linalg.norm(D,axis=1)))})
if len(garments)<3:raise RuntimeError('insufficient garment parts')
for o in srcobjs:
    if o not in garments and o.name in bpy.data.objects:bpy.data.objects.remove(o,do_unlink=True)
bpy.context.view_layer.update()
if not np.array_equal(points(body),P):raise RuntimeError('source body modified')
scene=bpy.context.scene;scene.render.engine='BLENDER_WORKBENCH';scene.render.resolution_x=480;scene.render.resolution_y=640;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';sh=scene.display.shading;sh.light='STUDIO';sh.color_type='TEXTURE';sh.show_cavity=True
bpy.ops.object.camera_add();cam=bpy.context.object;cam.data.type='ORTHO';cam.data.ortho_scale=height*1.4;scene.camera=cam
center=Vector((P.min(0)+P.max(0))/2)
def render(tag,d):
    cam.location=center+Vector(d)*height*3;cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath=str(out/(tag+'.png'));bpy.ops.render.render(write_still=True)
for tag,d in [('front',(0,-1,0)),('side',(1,0,0)),('rear',(0,1,0)),('threequarter',(1,-1,0))]:render(tag,d)
def evaluated(o):
    dep=bpy.context.evaluated_depsgraph_get();e=o.evaluated_get(dep);m=e.to_mesh()
    try:return np.array([e.matrix_world@v.co for v in m.vertices])
    finally:e.to_mesh_clear()
poses=[]
for joint,axis,degs in [('upperarm01.L',0,25),('lowerleg01.R',0,25)]:
    p=rig.pose.bones[joint];p.rotation_mode='XYZ';p.rotation_euler[axis]=math.radians(degs);bpy.context.view_layer.update()
    B=evaluated(body);bt=bvh(B,T)
    poses.append({'joint':joint,'degrees':degs,'parts':[{'name':o.name,**metrics(evaluated(o),bt)} for o in garments]})
    render('pose_'+joint.replace('.','_'),(1,-1,0))
    p.rotation_euler=(0,0,0);bpy.context.view_layer.update()
# Separate skinned garment, not combined nude or source rig.
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True)
for o in garments:o.select_set(True)
bpy.context.view_layer.objects.active=garments[0]
dest=out/(ident+'_'+style+'_garment.glb')
bpy.ops.export_scene.gltf(filepath=str(dest),export_format='GLB',use_selection=True,export_skins=True,export_animations=False)
raw=dest.read_bytes();n=int.from_bytes(raw[12:16],'little');g=json.loads(raw[20:20+n])
if not g.get('skins') or not all('JOINTS_0' in p['attributes'] and 'WEIGHTS_0' in p['attributes'] for m in g['meshes'] for p in m['primitives']):raise RuntimeError('garment skin export missing')
if not any('TEXCOORD_0' in p['attributes'] for m in g['meshes'] for p in m['primitives']):raise RuntimeError('garment UV missing')
report={'id':ident,'style':style,'bodySHA256':rec['sha256'],'sourceFilesSHA256':provenance,'source':'repository Quaternius outfits','declaredSourceGarments':sorted(declared),'ignoredSourceMeshes':ignored,'sha256':sha(dest),'parts':reports,'poseProbes':poses,'bodyModified':False,'bodyMaskApplied':False,'collisionApproved':False,'visualApproved':False,'classification':'unapproved fitted garment candidate'}
(out/'garment-report.json').write_text(json.dumps(report,indent=2));print('R53 GARMENT',json.dumps(report),flush=True)
,'',o.name)
candidates=[o for o in srcobjs if o.type=='MESH' and source_node_name(o) in declared and
            any(m.type=='ARMATURE' and m.object==src for m in o.modifiers)]
found={source_node_name(o) for o in candidates}
ignored=[o.name for o in srcobjs if o.type=='MESH' and o not in candidates]
print('R53 source garment nodes',sorted(found),'excluded',ignored,flush=True)
if found!=declared or len(candidates)!=len(declared):
    raise RuntimeError('declared garment mismatch: missing '+str(sorted(declared-found))+' duplicate count '+str(len(candidates)-len(found)))
garments=[];reports=[]
for o in candidates:
    # Drop embedded bare-skin material polygons while retaining authored UVs.
    M=o.matrix_world.copy();mesh=o.data;bm=bmesh.new();bm.from_mesh(mesh)
    skin=[f for f in bm.faces if 'regular' in (mesh.materials[f.material_index].name.lower() if f.material_index<len(mesh.materials) and mesh.materials[f.material_index] else '')]
    if skin:bmesh.ops.delete(bm,geom=skin,context='FACES')
    loose=[v for v in bm.verts if not v.link_faces]
    if loose:bmesh.ops.delete(bm,geom=loose,context='VERTS')
    bm.to_mesh(mesh);bm.free();mesh.update()
    if not len(mesh.polygons):continue
    Q=points(o);TT=triangles(o)
    groups=[g.name for g in o.vertex_groups]
    weights=[];fitted=[]
    for v,p in zip(mesh.vertices,Q):
        row={};q=Vector((0,0,0));total=0
        for wg in v.groups:
            if wg.weight<1e-6:continue
            name=groups[wg.group]
            if name not in anchors:raise RuntimeError('unmapped garment weight '+name)
            tn,A,C,rot,k=anchors[name];wt=float(wg.weight)
            q+=(C+rot@(Vector(p)-A)*k)*wt;row[tn]=row.get(tn,0)+wt;total+=wt
        if total<1e-6:raise RuntimeError('unweighted garment vertex '+o.name)
        fitted.append(tuple(q/total));weights.append({n:w/total for n,w in row.items()})
    F=np.array(fitted);base=F.copy();N=normals(F,TT);area=np.linalg.norm(N,axis=1);valid=area>1e-12
    before=metrics(F,tree)
    # Shared displacement across split UV seams; retain local triangle winding
    # and avoid collapsing existing garment folds while reducing skin intrusion.
    _,w=np.unique(np.round(F,6),axis=0,return_inverse=True);counts=np.bincount(w);nv=len(counts)
    W=np.column_stack([np.bincount(w,weights=F[:,k])/counts for k in range(3)])
    edges=np.unique(np.sort(np.concatenate((w[TT[:,[0,1]]],w[TT[:,[1,2]]],w[TT[:,[2,0]]])),axis=1),axis=0)
    edges=edges[edges[:,0]!=edges[:,1]];e0=np.r_[edges[:,0],edges[:,1]];e1=np.r_[edges[:,1],edges[:,0]]
    deg=np.maximum(1,np.bincount(e0,minlength=nv))
    def smooth(A):return np.column_stack([np.bincount(e0,weights=A[e1,k],minlength=nv)/deg for k in range(3)])
    def score(m):return m['penetrationProxy']+2*m['deepPenetrationProxy']
    D=np.zeros_like(W);best=before;accepted=0
    for it in range(18):
        A=np.zeros_like(D)
        for j,p in enumerate(W+D):
            q,n,idx,dist=tree.find_nearest(Vector(p));d=(Vector(p)-q).dot(n)
            if d<.004 and dist<.08:A[j]=np.array(n)*min(.006,.004-d)
        if not np.any(A):break
        A=.6*A+.4*smooth(A)
        for _ in range(2):A=.75*A+.25*smooth(A)
        ok=False
        for fac in (1,.5,.25,.1,.03):
            C=D+fac*A;C*=np.minimum(1,.045/np.maximum(np.linalg.norm(C,axis=1),1e-12))[:,None]
            H=base+C[w];nn=normals(H,TT)
            if np.any((np.einsum('ij,ij->i',nn,N)<0)&valid) or np.any((np.linalg.norm(nn,axis=1)<area*.03)&valid):continue
            m=metrics(H,tree)
            if score(m)<score(best)-1e-7:
                D=C;best=m;accepted+=1;ok=True;break
        if not ok:break
    F=base+D[w]
    # Replace source bind only. The original body and original garment source
    # remain unchanged; all target bones and UV layers stay in the output.
    o.parent=None;o.matrix_world=Matrix.Identity(4)
    for mod in list(o.modifiers):o.modifiers.remove(mod)
    for v,p in zip(mesh.vertices,F):v.co=Vector(p)
    mesh.update();o.vertex_groups.clear()
    names=sorted({n for row in weights for n in row})
    gg={n:o.vertex_groups.new(name=n) for n in names}
    for i,row in enumerate(weights):
        for n,wt in row.items():gg[n].add([i],wt,'REPLACE')
    mod=o.modifiers.new('R53 target rig','ARMATURE');mod.object=rig
    o.name='R53_'+o.name;garments.append(o)
    reports.append({'part':o.name,'sourceSkinFacesRemoved':len(skin),'vertices':len(F),'triangles':len(TT),'uvLayers':[u.name for u in mesh.uv_layers],
                    'mappedBones':names,'before':before,'after':best,'acceptedIterations':accepted,
                    'maxLocalDisplacement_m':float(np.max(np.linalg.norm(D,axis=1)))})
if len(garments)<3:raise RuntimeError('insufficient garment parts')
for o in srcobjs:
    if o not in garments and o.name in bpy.data.objects:bpy.data.objects.remove(o,do_unlink=True)
bpy.context.view_layer.update()
if not np.array_equal(points(body),P):raise RuntimeError('source body modified')
scene=bpy.context.scene;scene.render.engine='BLENDER_WORKBENCH';scene.render.resolution_x=480;scene.render.resolution_y=640;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';sh=scene.display.shading;sh.light='STUDIO';sh.color_type='TEXTURE';sh.show_cavity=True
bpy.ops.object.camera_add();cam=bpy.context.object;cam.data.type='ORTHO';cam.data.ortho_scale=height*1.4;scene.camera=cam
center=Vector((P.min(0)+P.max(0))/2)
def render(tag,d):
    cam.location=center+Vector(d)*height*3;cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath=str(out/(tag+'.png'));bpy.ops.render.render(write_still=True)
for tag,d in [('front',(0,-1,0)),('side',(1,0,0)),('rear',(0,1,0)),('threequarter',(1,-1,0))]:render(tag,d)
def evaluated(o):
    dep=bpy.context.evaluated_depsgraph_get();e=o.evaluated_get(dep);m=e.to_mesh()
    try:return np.array([e.matrix_world@v.co for v in m.vertices])
    finally:e.to_mesh_clear()
poses=[]
for joint,axis,degs in [('upperarm01.L',0,25),('lowerleg01.R',0,25)]:
    p=rig.pose.bones[joint];p.rotation_mode='XYZ';p.rotation_euler[axis]=math.radians(degs);bpy.context.view_layer.update()
    B=evaluated(body);bt=bvh(B,T)
    poses.append({'joint':joint,'degrees':degs,'parts':[{'name':o.name,**metrics(evaluated(o),bt)} for o in garments]})
    render('pose_'+joint.replace('.','_'),(1,-1,0))
    p.rotation_euler=(0,0,0);bpy.context.view_layer.update()
# Separate skinned garment, not combined nude or source rig.
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True)
for o in garments:o.select_set(True)
bpy.context.view_layer.objects.active=garments[0]
dest=out/(ident+'_'+style+'_garment.glb')
bpy.ops.export_scene.gltf(filepath=str(dest),export_format='GLB',use_selection=True,export_skins=True,export_animations=False)
raw=dest.read_bytes();n=int.from_bytes(raw[12:16],'little');g=json.loads(raw[20:20+n])
if not g.get('skins') or not all('JOINTS_0' in p['attributes'] and 'WEIGHTS_0' in p['attributes'] for m in g['meshes'] for p in m['primitives']):raise RuntimeError('garment skin export missing')
if not any('TEXCOORD_0' in p['attributes'] for m in g['meshes'] for p in m['primitives']):raise RuntimeError('garment UV missing')
report={'id':ident,'style':style,'bodySHA256':rec['sha256'],'sourceFilesSHA256':provenance,'source':'repository Quaternius outfits','sha256':sha(dest),'parts':reports,'poseProbes':poses,'bodyModified':False,'bodyMaskApplied':False,'collisionApproved':False,'visualApproved':False,'classification':'unapproved fitted garment candidate'}
(out/'garment-report.json').write_text(json.dumps(report,indent=2));print('R53 GARMENT',json.dumps(report),flush=True)
