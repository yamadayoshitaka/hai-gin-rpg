"""R53 hero close-up PBR material candidate. Preserve source geometry and morphs."""
import bpy,numpy as np,math,sys,json,hashlib
from pathlib import Path
from mathutils import Vector,Matrix
from mathutils.bvhtree import BVHTree
args=sys.argv[sys.argv.index('--')+1:]
src,out=map(lambda x:Path(x).resolve(),args[:2]);ident=args[2];out.mkdir(parents=True,exist_ok=True)
if ident not in ('commander-male','commander-female'):raise RuntimeError('identity')
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
if ident=='commander-female':rp=src/'visual-report.json';p=src/(ident+'_visual_candidate.glb')
else:rp=src/'assembly-report.json';p=src/(ident+'_assembled.glb')
rec=json.loads(rp.read_text())
if rec['id']!=ident or sha(p)!=rec['sha256']:raise RuntimeError('source provenance')
for n in ('ATTRIBUTION.md','ARMOR-LICENSE.txt'):
    if (src/n).is_file():(out/n).write_bytes((src/n).read_bytes())
if not (out/'ATTRIBUTION.md').is_file():raise RuntimeError('missing hair credit')
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(p));bpy.context.view_layer.update()
def rigof(o):return next((m.object for m in o.modifiers if m.type=='ARMATURE' and m.object),None)
def pts(o,pose=False):
    if not pose:return np.array([o.matrix_world@v.co for v in o.data.vertices],np.float64)
    e=o.evaluated_get(bpy.context.evaluated_depsgraph_get());m=e.to_mesh()
    try:return np.array([e.matrix_world@v.co for v in m.vertices],np.float64)
    finally:e.to_mesh_clear()
def tri(o):
    o.data.calc_loop_triangles();return np.array([tuple(t.vertices) for t in o.data.loop_triangles],np.int32)
def tree(objs,pose=False):
    vs=[];ts=[];n=0
    for o in objs:
        P=pts(o,pose);T=tri(o);vs.append(P);ts.append(T+n);n+=len(P)
    return BVHTree.FromPolygons([Vector(tuple(float(v) for v in q)) for q in np.concatenate(vs)],[tuple(int(v) for v in t) for t in np.concatenate(ts)],all_triangles=True)
def signed(Q,t):
    ds=[]
    for p in Q:
        q,n,i,d=t.find_nearest(Vector(p))
        if q is None:raise RuntimeError('missing surface')
        ds.append((Vector(p)-q).dot(n))
    return np.array(ds)
def metrics(Q,t):
    a=signed(Q,t);return {'penetrationProxy':float(np.mean(a<-.003)),'deepPenetrationProxy':float(np.mean(a<-.015)),'minSigned_m':float(a.min())}
def score(m):return m['penetrationProxy']+2*m['deepPenetrationProxy']
parts=[o for o in bpy.context.scene.objects if o.type=='MESH' and rigof(o)]
names=rec['morphs'];clips=rec['clips'];bs=[o for o in parts if not o.name.startswith('R53_Beard') and o.data.shape_keys and all(n in o.data.shape_keys.key_blocks for n in names)]
if len(bs)!=1 or len({rigof(o) for o in parts})!=1:raise RuntimeError('source mesh inventory')
body=bs[0];rig=rigof(body);beards=[o for o in parts if o.name.startswith('R53_Beard')]
cloth=[o for o in parts if o.name.startswith('R53_Clothing_')]
plates=[o for o in parts if o.name.startswith(('R53_Armor_','R53_LegPlate_'))]
hair=[o for o in parts if o.name.startswith('R53_Hair_')]
if not hair or not cloth or len(beards)!=(1 if ident=='garan' else 0):raise RuntimeError('source part inventory')
ad=rig.animation_data;acts={}
if ad.action:acts[ad.action.name]=ad.action
for t in ad.nla_tracks:
    for st in t.strips:
        if st.action:acts[st.action.name]=st.action
    t.mute=True
selected={}
for n in clips:
    a=[v for k,v in acts.items() if n.lower() in k.lower()]
    if len(a)!=1:raise RuntimeError('clip '+n)
    selected[n]=a[0];a[0].use_fake_user=True
ad.action=None
for t in list(ad.nla_tracks):ad.nla_tracks.remove(t)
def reset():
    ad.action=None
    for b in rig.pose.bones:b.matrix_basis=Matrix.Identity(4)
    for o in [body]+beards:
        for n in names:o.data.shape_keys.key_blocks[n].value=0
    bpy.context.view_layer.update()
reset()
original={o.name:pts(o) for o in parts}
morphs={(o.name,n):np.array([o.matrix_world@v.co for v in o.data.shape_keys.key_blocks[n].data]) for o in [body]+beards for n in names}
P=original[body.name];H=float(np.ptp(P[:,2]));center=Vector((P.min(0)+P.max(0))/2)
def bone(n):return np.array(rig.matrix_world@rig.data.bones[n].head_local)
def tail(n):return np.array(rig.matrix_world@rig.data.bones[n].tail_local)
gn=[g.name for g in body.vertex_groups]
weights=[{gn[g.group]:float(g.weight) for g in v.groups if gn[g.group] in rig.data.bones and g.weight>1e-6} for v in body.data.vertices]
eye=(bone('eye.L')+bone('eye.R'))/2;top=float(P[:,2].max());hh=top-eye[2];fc=Vector((eye[0],eye[1],top-hh*.95))

# Anatomical component identification on actual welded mesh. No synthetic
# floating eye or arbitrary skin selection if the source cannot be identified.
mesh=body.data;T=tri(body)
_,w=np.unique(np.round(P,6),axis=0,return_inverse=True);parent=list(range(int(w.max())+1))
def root(i):
    while parent[i]!=i:parent[i]=parent[parent[i]];i=parent[i]
    return i
for a,b,c in T:
    a,b,c=[root(int(w[k])) for k in (a,b,c)]
    if a!=b:parent[b]=a
    if a!=c:parent[c]=a
components={}
for vi,k in enumerate(w):components.setdefault(root(int(k)),[]).append(vi)
groups=[np.array(v,dtype=np.int64) for v in components.values()];groups.sort(key=len,reverse=True)
skinids=groups[0];skinMask=np.zeros(len(P),bool);skinMask[skinids]=True
if len(skinids)<len(P)*.40:raise RuntimeError('main skin component ambiguous')
eyeGroups=[]
for side in ('L','R'):
    e=bone('eye.'+side);cand=[]
    for g in groups[1:]:
        Q=P[g];lo=Q.min(0);hi=Q.max(0);c=(lo+hi)/2;ext=hi-lo
        if len(g)>=30 and np.linalg.norm(c-e)<.036 and .008<ext[0]<.050 and .008<ext[2]<.050 and max(ext)<.055:
            score0=float(np.linalg.norm(c-e))+.015*abs(ext[0]-ext[2])/max(ext[0],ext[2])
            cand.append((score0,g,c,ext))
    cand.sort(key=lambda q:q[0])
    if cand:eyeGroups.append((side,*cand[0][1:]))
if len(eyeGroups)==2 and np.intersect1d(eyeGroups[0][1],eyeGroups[1][1]).size:eyeGroups=[]
if len(eyeGroups)!=2:eyeGroups=[]
print('R53 HERO components',[(len(g),P[g].min(0).tolist(),P[g].max(0).tolist()) for g in groups[:12]],flush=True)
# PBR renders under fixed three-light studio setup with same camera/exposure.
scene=bpy.context.scene
try:scene.render.engine='BLENDER_EEVEE_NEXT'
except Exception:scene.render.engine='BLENDER_EEVEE'
scene.render.resolution_x=600;scene.render.resolution_y=800;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.world=bpy.data.worlds.new('R53 neutral studio');scene.world.use_nodes=True
scene.world.node_tree.nodes.get('Background').inputs[0].default_value=(.16,.18,.22,1);scene.world.node_tree.nodes.get('Background').inputs[1].default_value=.45
try:scene.view_settings.view_transform='AgX'
except Exception:pass
bpy.ops.object.camera_add();cam=bpy.context.object;cam.data.type='ORTHO';scene.camera=cam
lights=[]
for name,rel,power,size,col in [('key',(-1.4,-2.1,1.9),650,2.0,(1,.92,.82)),('fill',(1.6,-1.0,.6),350,2.3,(.78,.88,1)),('rim',(0,1.5,1.3),850,1.5,(.83,.91,1))]:
    ld=bpy.data.lights.new(name,'AREA');ld.energy=power;ld.shape='DISK';ld.size=size;ld.color=col
    o=bpy.data.objects.new(name,ld);bpy.context.collection.objects.link(o);o.location=Vector(rel)+center;o.rotation_euler=(center-o.location).to_track_quat('-Z','Y').to_euler();lights.append(o)
def render(tag,d,c=center,size=H*1.30):
    cam.data.ortho_scale=size;cam.location=c+Vector(d).normalized()*H*3;cam.rotation_euler=(c-cam.location).to_track_quat('-Z','Y' if abs(d[2])<.95 else 'X').to_euler()
    scene.render.filepath=str(out/(tag+'.png'));bpy.ops.render.render(write_still=True)
def shots(prefix):
    for tag,d in [('front',(0,-1,0)),('left',(-1,0,0)),('right',(1,0,0)),('rear',(0,1,0)),('crown',(0,-.08,1))]:
        render(prefix+'_head_'+tag,d,fc,hh*4.3)
    render(prefix+'_body',(1,-2,.1))
shots('before')
# Procedural micro-normal map, not photogrammetric skin. Preserve existing
# authored maps if present; use source UVs and restrict to the actual skin polygons.
rng=np.random.default_rng(5353);sz=512
yy,xx=np.mgrid[0:sz,0:sz];field=np.zeros((sz,sz),np.float32)
# periodic multi-scale height variation; low amplitude, no painted freckles
for freq,amp in [(32,.13),(57,.10),(91,.08),(131,.045)]:
    field+=amp*np.sin(2*np.pi*(freq*xx+((freq*3)%137)*yy)/sz+rng.uniform(0,6.28))*np.sin(2*np.pi*(freq*yy-((freq*5)%151)*xx)/sz+rng.uniform(0,6.28))
dx=(np.roll(field,-1,1)-np.roll(field,1,1))*.10;dy=(np.roll(field,-1,0)-np.roll(field,1,0))*.10
N=np.stack([-dx,-dy,np.ones_like(dx)],axis=-1);N/=np.linalg.norm(N,axis=-1,keepdims=True)
def image(name,a,noncolor=False):
    a=np.asarray(a,dtype=np.float32);h,w=a.shape[:2];im=bpy.data.images.new(name,width=w,height=h,alpha=True)
    if noncolor:im.colorspace_settings.name='Non-Color'
    im.pixels.foreach_set(np.ascontiguousarray(a).ravel());im.update();im.pack();return im
normalImage=image(ident+'_skin_micro_normal',np.concatenate([N*.5+.5,np.ones((sz,sz,1))],axis=-1),True)
changes=[];skinPolys=[p for p in mesh.polygons if all(skinMask[v] for v in p.vertices)]
skinMats=sorted({p.material_index for p in skinPolys})
def principled(m):
    return next((n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED'),None) if m and m.use_nodes else None
for mi in skinMats:
    m=mesh.materials[mi]
    if not m:continue
    mc=m.copy();mc.name=ident+'_skinPBR_'+m.name;bs=principled(mc)
    if bs is None:continue
    normal=bs.inputs['Normal'];rough=bs.inputs['Roughness']
    added=False
    if not normal.is_linked and mesh.uv_layers:
        tex=mc.node_tree.nodes.new('ShaderNodeTexImage');tex.image=normalImage
        nm=mc.node_tree.nodes.new('ShaderNodeNormalMap');nm.inputs['Strength'].default_value=.22
        mc.node_tree.links.new(tex.outputs['Color'],nm.inputs['Color']);mc.node_tree.links.new(nm.outputs['Normal'],normal);added=True
    if not rough.is_linked:rough.default_value=.53
    if 'Metallic' in bs.inputs and not bs.inputs['Metallic'].is_linked:bs.inputs['Metallic'].default_value=0.
    mesh.materials.append(mc);k=len(mesh.materials)-1
    for p in skinPolys:
        if p.material_index==mi:p.material_index=k
    changes.append({'part':'skin','original':m.name,'material':mc.name,'normalAdded':added,'originalBaseColorPreserved':True})
# Eye texture on measured existing eyeballs only. UV layer preserves all
# original UV coordinates. Iris color chosen from role direction, not sample pixels.
eyeReport=[]
if eyeGroups and mesh.uv_layers:
    uv0=mesh.uv_layers.active;uv=mesh.uv_layers.new(name='R53_iris_projection')
    for i,v in enumerate(uv0.data):uv.data[i].uv=v.uv
    S=512;Y,X=np.mgrid[0:S,0:S];x=(X/(S-1)-.5)*2;y=(Y/(S-1)-.5)*2;rr=np.sqrt(x*x+y*y);ang=np.arctan2(y,x)
    irisColor=np.array((.095,.23,.40) if ident=='commander-female' else (.13,.075,.034))
    radial=.74+.18*np.sin(ang*59+rr*21)+.08*np.sin(ang*107-rr*35)
    sclera=np.zeros((S,S,3))+np.array((.76,.72,.68));sclera*=1-.08*np.clip(rr,0,1)[:,:,None]
    iris=irisColor*radial[:,:,None]*(.65+.35*np.sin(np.clip(rr/.53,0,1)*np.pi))[:,:,None]
    border=np.clip((.54-rr)/.035,0,1);pupil=np.clip((.22-rr)/.035,0,1)
    col=sclera*(1-border[:,:,None])+iris*border[:,:,None];col=col*(1-pupil[:,:,None])+.008*pupil[:,:,None]
    im=image(ident+'_iris',np.concatenate([np.clip(col,0,1),np.ones((S,S,1))],axis=-1))
    mat=bpy.data.materials.new(ident+'_eyePBR');mat.use_nodes=True;bs=principled(mat);bs.inputs['Roughness'].default_value=.17;bs.inputs['Metallic'].default_value=0.
    if 'Coat Weight' in bs.inputs:bs.inputs['Coat Weight'].default_value=.23;bs.inputs['Coat Roughness'].default_value=.16
    tex=mat.node_tree.nodes.new('ShaderNodeTexImage');tex.image=im;un=mat.node_tree.nodes.new('ShaderNodeUVMap');un.uv_map=uv.name
    mat.node_tree.links.new(un.outputs['UV'],tex.inputs['Vector']);mat.node_tree.links.new(tex.outputs['Color'],bs.inputs['Base Color'])
    mesh.materials.append(mat);mi=len(mesh.materials)-1
    for side,g,c,ext in eyeGroups:
        mask=np.zeros(len(P),bool);mask[g]=True;ps=[p for p in mesh.polygons if all(mask[v] for v in p.vertices)]
        for p in ps:
            p.material_index=mi
            for k in p.loop_indices:
                v=mesh.loops[k].vertex_index;uv.data[k].uv=(.5+(P[v,0]-c[0])/max(ext[0],.01),.5+(P[v,2]-c[2])/max(ext[2],.01))
        eyeReport.append({'side':side,'vertices':len(g),'polygons':len(ps),'center_m':c.tolist(),'extent_m':ext.tolist(),'sourceGeometryPreserved':True})
    mesh.uv_layers.active=uv0
# Preserve original hair texture & alpha, only adjust unlinked roughness.
# Retain wardrobe source materials; apply material response only to known
# metal plates and textile surfaces, not skin or eyes.
for kind,objs,roughness in [('hair',hair,.38),('cloth',cloth,.72),('armor',plates,.32)]:
    cache={}
    for o in objs:
        for k,m in enumerate(o.data.materials):
            if not m:continue
            if m.name in cache:o.data.materials[k]=cache[m.name];continue
            mc=m.copy();mc.name=ident+'_'+kind+'PBR_'+m.name;bs=principled(mc)
            if bs is None:continue
            sock=bs.inputs['Roughness']
            if not sock.is_linked:sock.default_value=roughness
            if kind=='armor' and not bs.inputs['Metallic'].is_linked:bs.inputs['Metallic'].default_value=.76
            cache[m.name]=mc;o.data.materials[k]=mc
            changes.append({'part':kind,'original':m.name,'material':mc.name,'roughnessLinkedPreserved':bool(sock.is_linked),'roughness':float(sock.default_value),'originalBaseColorPreserved':True})
if not changes:raise RuntimeError('no eligible material changes')
for o in parts:
    if not np.array_equal(pts(o),original[o.name]):raise RuntimeError('original geometry changed '+o.name)
for n in names:
    if not np.array_equal(np.array([body.matrix_world@v.co for v in mesh.shape_keys.key_blocks[n].data]),morphs[(body.name,n)]):raise RuntimeError('morph changed '+n)
shots('after')
# Additional isolated hair/head views and real expressions.
for o in parts:o.hide_render=(o!=body)
render('head_only_front',(0,-1,0),fc,hh*4.3)
for o in parts:o.hide_render=o not in hair
render('hair_only_front',(0,-1,0),fc,hh*4.3)
for o in parts:o.hide_render=False
for n in ('blink_L','smile','viseme_A'):
    body.data.shape_keys.key_blocks[n].value=1;bpy.context.view_layer.update();render('expr_'+n,(0,-1,0),fc,hh*4.3);reset()
# Report existing hair/skin/wardrobe collision proxies without modifying mesh.
checks=[]
for n,act in selected.items():
    reset();ad.action=act;lo,hi=map(float,act.frame_range)
    for f in np.linspace(lo,hi,3):
        scene.frame_set(math.floor(f),subframe=float(f%1));bpy.context.view_layer.update();bt=tree([body],True)
        checks.append({'clip':n,'frame':float(f),'hair':[{'part':o.name,**metrics(pts(o,True),bt)} for o in hair],'clothing':[{'part':o.name,**metrics(pts(o,True),bt)} for o in cloth+plates]})
reset()
for n,act in selected.items():
    t=ad.nla_tracks.new();t.name='R53_'+n;t.strips.new('R53_'+n,1,act)
bpy.ops.object.select_all(action='DESELECT')
for o in parts+[rig]:o.select_set(True)
bpy.context.view_layer.objects.active=body
dest=out/(ident+'_hero_pbr.glb')
opts=dict(filepath=str(dest),export_format='GLB',use_selection=True,export_skins=True,export_animations=True,export_morph=True)
props=bpy.ops.export_scene.gltf.get_rna_type().properties
if 'export_animation_mode' in props and 'NLA_TRACKS' in props['export_animation_mode'].enum_items.keys():opts['export_animation_mode']='NLA_TRACKS'
elif 'export_nla_strips' in props:opts['export_nla_strips']=True
else:raise RuntimeError('NLA export unsupported')
bpy.ops.export_scene.gltf(**opts)
raw=dest.read_bytes();g=json.loads(raw[20:20+int.from_bytes(raw[12:16],'little')])
if len(g.get('skins',[]))!=1 or not all(any(n.lower() in a.get('name','').lower() for a in g.get('animations',[])) for n in clips):raise RuntimeError('export rig/animation')
if eyeReport and not any('eyePBR' in m.get('name','') and 'baseColorTexture' in m.get('pbrMetallicRoughness',{}) for m in g.get('materials',[])):raise RuntimeError('eye texture not exported')
if any(q.get('normalAdded') for q in changes) and not any('skinPBR' in m.get('name','') and 'normalTexture' in m for m in g.get('materials',[])):raise RuntimeError('skin normal not exported')
count=len(parts);bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(dest));bpy.context.view_layer.update()
rt=[o for o in bpy.context.scene.objects if o.type=='MESH' and rigof(o)]
if len(rt)!=count or len({rigof(o) for o in rt})!=1 or len([o for o in rt if o.data.shape_keys and all(n in o.data.shape_keys.key_blocks for n in names)])!=1:raise RuntimeError('roundtrip inventory')
result={'id':ident,'sourceSHA256':rec['sha256'],'sha256':sha(dest),'meshCount':count,'rigCount':1,'morphs':names,'clips':clips,'roundTrip':True,'sourceGeometryPreservedBeforeExport':True,'materialChanges':changes,'skinComponentVertices':len(skinids),'eyes':eyeReport,'eyeCandidateApplied':len(eyeReport)==2,'poseSamples':checks,'visualApproved':False,'productionApproved':False,'protectedR6Used':False,'limitations':['procedural skin detail only, not scan','eye geometry unchanged, projected iris on identified source component only','no new lashes, teeth or face sculpt','not final visual likeness or FF15 quality']}
(out/'hero-pbr-report.json').write_text(json.dumps(result,indent=2));print('R53 HERO PBR',ident,'materials',len(changes),'eyes',len(eyeReport),'skinNormals',sum(q.get('normalAdded',False) for q in changes),flush=True)
