"""Named male visual candidates: licensed plate meshes, hair palette, surface-rooted short beard.
Not a final likeness or collision approval; keep original body, hair geometry, garments, actions.
"""
import bpy,numpy as np,sys,json,hashlib,math
from pathlib import Path
from mathutils import Vector,Matrix
from mathutils.bvhtree import BVHTree
args=sys.argv[sys.argv.index('--')+1:]
src,armorfile,out=map(lambda x:Path(x).resolve(),args[:3]);ident=args[3];out.mkdir(parents=True,exist_ok=True)
if ident not in ('commander-male','garan'):raise RuntimeError('unknown cast')
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def gitblob(p):
    b=p.read_bytes();return hashlib.sha1(('blob '+str(len(b))+'\0').encode()+b).hexdigest()
report=json.loads((src/'assembly-report.json').read_text());p=src/(ident+'_assembled.glb')
if report['id']!=ident or sha(p)!=report['sha256'] or gitblob(armorfile)!='92393b5785cf67e838603290b23b921e6608b398':raise RuntimeError('asset provenance mismatch')
(out/'ATTRIBUTION.md').write_bytes((src/'ATTRIBUTION.md').read_bytes())
bpy.ops.wm.read_factory_settings(use_empty=True)
def load(p):
    before=set(bpy.context.scene.objects);bpy.ops.import_scene.gltf(filepath=str(p));bpy.context.view_layer.update()
    return [o for o in bpy.context.scene.objects if o not in before]
def rigof(o):return next((m.object for m in o.modifiers if m.type=='ARMATURE' and m.object),None)
def pts(o,posed=False):
    if not posed:return np.array([o.matrix_world@v.co for v in o.data.vertices],np.float64)
    e=o.evaluated_get(bpy.context.evaluated_depsgraph_get());m=e.to_mesh()
    try:return np.array([e.matrix_world@v.co for v in m.vertices],np.float64)
    finally:e.to_mesh_clear()
def tri(o):
    o.data.calc_loop_triangles();return np.array([tuple(t.vertices) for t in o.data.loop_triangles],np.int32)
def bvh(P,T):
    if len(T)==0 or not np.isfinite(P).all():raise RuntimeError('invalid BVH')
    return BVHTree.FromPolygons([Vector(tuple(float(v) for v in p)) for p in P],[tuple(int(v) for v in t) for t in T],all_triangles=True)
def merged_tree(objs,posed=False):
    vs=[];ts=[];n=0
    for o in objs:
        P=pts(o,posed);T=tri(o);vs.append(P);ts.append(T+n);n+=len(P)
    return bvh(np.concatenate(vs),np.concatenate(ts))
def measure(Q,tree):
    ds=[]
    for p in Q:
        q,n,i,d=tree.find_nearest(Vector(p))
        if q is None:raise RuntimeError('surface lookup failed')
        ds.append((Vector(p)-q).dot(n))
    a=np.array(ds);return {'penetrationProxy':float(np.mean(a<-.003)),'deepPenetrationProxy':float(np.mean(a<-.015)),'minimumSignedDistance_m':float(a.min())}
def bone(n):return np.array(rig.matrix_world@rig.data.bones[n].head_local)
objs=load(p);parts=[o for o in objs if o.type=='MESH' and rigof(o)]
names=report['morphs'];clips=report['clips']
bs=[o for o in parts if o.data.shape_keys and all(n in o.data.shape_keys.key_blocks for n in names)]
if len(bs)!=1 or len({rigof(o) for o in parts})!=1:raise RuntimeError('source body or rig mismatch')
body=bs[0];rig=rigof(body);hair=[o for o in parts if o.name.startswith('R53_Hair_')];cloth=[o for o in parts if o.name.startswith('R53_Clothing_')]
if not hair or not cloth or len(parts)!=1+len(hair)+len(cloth):raise RuntimeError('part inventory mismatch')
ad=rig.animation_data;acts={}
if ad.action:acts[ad.action.name]=ad.action
for tr in ad.nla_tracks:
    for st in tr.strips:
        if st.action:acts[st.action.name]=st.action
    tr.mute=True
selected={}
for n in clips:
    matches=[a for k,a in acts.items() if n.lower() in k.lower()]
    if len(matches)!=1:raise RuntimeError('missing or ambiguous clip '+n)
    selected[n]=matches[0];matches[0].use_fake_user=True
ad.action=None
for tr in list(ad.nla_tracks):ad.nla_tracks.remove(tr)
def reset():
    ad.action=None
    for b in rig.pose.bones:b.matrix_basis=Matrix.Identity(4)
    for n in names:body.data.shape_keys.key_blocks[n].value=0
    if beard is not None:
        for n in names:beard.data.shape_keys.key_blocks[n].value=0
    bpy.context.view_layer.update()
beard=None;reset()
P=pts(body);T=tri(body);tree=bvh(P,T);outer=merged_tree([body]+cloth)
H=float(np.ptp(P[:,2]));center=Vector((P.min(0)+P.max(0))/2)
morph0={n:np.array([body.matrix_world@v.co for v in body.data.shape_keys.key_blocks[n].data]) for n in names}
hair0={o.name:pts(o) for o in hair}
gn=[g.name for g in body.vertex_groups]
weights=[{gn[g.group]:float(g.weight) for g in v.groups if gn[g.group] in rig.data.bones and g.weight>1e-6} for v in body.data.vertices]
scene=bpy.context.scene;scene.render.engine='BLENDER_WORKBENCH';scene.render.resolution_x=540;scene.render.resolution_y=720;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';sh=scene.display.shading;sh.light='STUDIO';sh.color_type='TEXTURE';sh.show_cavity=True
bpy.ops.object.camera_add();cam=bpy.context.object;cam.data.type='ORTHO';scene.camera=cam
def render(tag,d,c=center,size=H*1.3):
    cam.data.ortho_scale=size;cam.location=c+Vector(d).normalized()*H*3;cam.rotation_euler=(c-cam.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath=str(out/(tag+'.png'));bpy.ops.render.render(write_still=True)
eye=(bone('eye.L')+bone('eye.R'))/2;top=float(P[:,2].max());hh=top-eye[2]
fc=Vector((eye[0],eye[1],top-hh*.95))
for tag,d in [('front',(0,-1,0)),('side',(1,0,0))]:render('before_'+tag,d)
render('before_face',(0,-1,0),fc,hh*3.9)
def material(name,color,metal=0.,rough=.5):
    m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
    b=m.node_tree.nodes.get('Principled BSDF');b.inputs['Base Color'].default_value=(*color,1);b.inputs['Metallic'].default_value=metal;b.inputs['Roughness'].default_value=rough;return m
# Recolor source texture, preserving spatial variation and alpha. Do not recolor face.
palette=(.012,.015,.021) if ident=='commander-male' else (.30,.32,.34)
recolors={};imageCache={};hairImages=[]
for o in hair:
    for k,m in enumerate(o.data.materials):
        if not m:continue
        if m.name in recolors:o.data.materials[k]=recolors[m.name];continue
        mc=m.copy();mc.name=ident+'_hair_'+m.name;recolors[m.name]=mc;o.data.materials[k]=mc
        mc.diffuse_color=(*palette,1)
        if not mc.use_nodes:continue
        bsdf=next((n for n in mc.node_tree.nodes if n.type=='BSDF_PRINCIPLED'),None)
        if not bsdf:continue
        sock=bsdf.inputs['Base Color'];ln=list(sock.links)
        if not ln:sock.default_value=(*palette,1);continue
        node=ln[0].from_node
        if node.type!='TEX_IMAGE' or node.image is None:continue
        old=node.image
        if old.name not in imageCache:
            im=old.copy();im.name=ident+'_hair_color_'+old.name
            a=np.empty(len(im.pixels),np.float32);im.pixels.foreach_get(a);a=a.reshape(-1,4)
            lum=a[:,:3]@np.array([.2126,.7152,.0722]);valid=a[:,3]>.05
            lo,hi=np.quantile(lum[valid] if valid.any() else lum,[.05,.95])
            detail=np.clip((lum-lo)/max(float(hi-lo),.005),0,1)
            fac=(.55+.9*detail) if ident=='commander-male' else (.35+1.05*detail)
            a[:,:3]=np.clip(fac[:,None]*np.array(palette)[None,:],0,1);im.pixels.foreach_set(a.ravel());im.update();im.pack()
            imageCache[old.name]=im;hairImages.append({'source':old.name,'copy':im.name,'pixels':list(im.size),'alphaPreserved':True})
        node.image=imageCache[old.name];sock.default_value=(1,1,1,1)
# Existing licensed armor parts, not primitive substitutes. Keep Ranger base layer.
raw=load(armorfile);source={o.name:o for o in raw if o.type=='MESH'}
groups={
'chest':['breastplate__Faceted breastplate reinforcement','breastplate__Breastplate folded center ridge','breastplate__Articulated abdominal overlap'],
'left':['breastplate__Plate pauldron -1','breastplate__Pauldron bound front edge -1'],
'right':['breastplate__Plate pauldron 1','breastplate__Pauldron bound front edge 1']}
if any(n not in source for g in groups.values() for n in g):raise RuntimeError('authored source armor names missing '+str(list(source)))
sp=sorted([bone('spine%02d'%i) for i in range(1,6)],key=lambda q:q[2]);hip=(bone('upperleg01.L')+bone('upperleg01.R'))/2;neck=bone('neck01')
mid=(sp[1][2]+sp[3][2])/2;zlo=max(hip[2]+.035*H,sp[0][2]-.015*H);zhi=min(neck[2]-.018*H,sp[-1][2]+.035*H)
torsoW=np.array([sum(v for n,v in w.items() if n.startswith(('spine','pelvis','breast','clavicle','root'))) for w in weights])
torso=P[(P[:,2]>zlo)&(P[:,2]<zhi)&(torsoW>.55)]
if len(torso)<100:raise RuntimeError('too few torso measurement points')
tc=np.quantile(torso,[.03,.97],axis=0);torsoBone=min(['spine%02d'%i for i in range(1,6)],key=lambda n:abs(bone(n)[2]-mid))
steel=material(ident+'_plate',(.027,.039,.056) if ident=='commander-male' else (.34,.37,.40),.78,.33)
edge=material(ident+'_edge',(.58,.36,.09) if ident=='commander-male' else (.44,.46,.48),.82,.30)
armor=[];armorReports=[]
def normals(Q,T):
    a=Q[T];return np.cross(a[:,1]-a[:,0],a[:,2]-a[:,0])
def correct(Q,T):
    # Small bounded outward adjustments against the actual underlayer.
    N=normals(Q,T);A=np.linalg.norm(N,axis=1);valid=A>1e-12;base=Q.copy();best=measure(Q,outer)
    def score(m):return m['penetrationProxy']+2*m['deepPenetrationProxy']
    for k in range(12):
        D=np.zeros_like(Q)
        for j,p in enumerate(Q):
            q,n,i,d=outer.find_nearest(Vector(p));signed=(Vector(p)-q).dot(n)
            if signed<.004 and d<.12:D[j]=np.array(n)*min(.005,.004-signed)
        if not np.any(D):break
        for f in (1.,.5,.25,.1):
            C=Q+D*f;v=C-base;C=base+v*np.minimum(1,.045/np.maximum(np.linalg.norm(v,axis=1),1e-12))[:,None]
            nn=normals(C,T)
            if np.any((np.sum(nn*N,axis=1)<0)&valid) or np.any((np.linalg.norm(nn,axis=1)<A*.035)&valid):continue
            m=measure(C,outer)
            if score(m)<score(best)-1e-8:Q=C;best=m;break
        else:break
    return Q,best
for key,ns in groups.items():
    group=[source[n] for n in ns];S=np.concatenate([pts(o) for o in group]);lo=S.min(0);hi=S.max(0);size=hi-lo
    if np.min(size)<1e-5:raise RuntimeError('degenerate armor source group')
    if key=='chest':
        targetLo=np.array([tc[0,0]*.94,tc[0,1]-.018,zlo]);targetHi=np.array([tc[1,0]*.94,tc[0,1]+.025,zhi])
        bind=torsoBone
    else:
        sign=-1 if key=='left' else 1
        side=min(('L','R'),key=lambda s:abs(np.sign(bone('upperarm01.'+s)[0]-eye[0])-sign))
        j=bone('upperarm01.'+side);e=bone('lowerarm01.'+side);u=e-j;length=np.linalg.norm(u);u/=length
        rel=P-j;along=rel@u;rad=np.linalg.norm(rel-along[:,None]*u,axis=1)
        reg=P[(along>-.045*H)&(along<length*.40)&(rad<.11*H)&(np.sign(P[:,0]-eye[0])==sign)]
        if len(reg)<40:raise RuntimeError('insufficient shoulder measurements')
        q=np.quantile(reg,[.03,.97],axis=0);targetLo=q[0]-.012;targetHi=q[1]+.015;bind='upperarm01.'+side
    for o in group:
        old=pts(o);TT=tri(o);uv=len(o.data.uv_layers);Q=targetLo+(old-lo)/size*(targetHi-targetLo)
        if key=='chest':
            # Preserve relief relative to source rear face; fit to actual front
            # of the underlying torso and clothing at each projected x,z.
            for i,(x,y,z) in enumerate(Q):
                start=Vector((x,float(P[:,1].min()-.5),z));q,n,t,d=outer.ray_cast(start,Vector((0,1,0)),H)
                if q is not None and n.y<-.10:
                    Q[i,1]=q.y-.008-(targetHi[1]-y)
        before=measure(Q,outer);Q,after=correct(Q,TT)
        if not np.isfinite(Q).all() or len(o.data.uv_layers)!=uv:raise RuntimeError('invalid armor fit')
        o.parent=None;o.matrix_world=Matrix.Identity(4)
        for v,q in zip(o.data.vertices,Q):v.co=Vector(q)
        o.data.update();o.vertex_groups.clear();g=o.vertex_groups.new(name=bind);g.add(list(range(len(Q))),1.,'REPLACE')
        mod=o.modifiers.new('R53 plate bind','ARMATURE');mod.object=rig
        for i,m in enumerate(o.data.materials):o.data.materials[i]=edge if m and 'edge' in m.name.lower() else steel
        oldName=o.name;o.name='R53_Armor_'+str(len(armor)).zfill(2);armor.append(o)
        armorReports.append({'sourcePart':oldName,'name':o.name,'bone':bind,'vertices':len(Q),'triangles':len(TT),'uvLayers':uv,'targetBounds_m':[targetLo.tolist(),targetHi.tolist()],'before':before,'after':after})
for o in raw:
    if o not in armor and o.name in bpy.data.objects:bpy.data.objects.remove(o,do_unlink=True)
# Short beard: rooted by forward ray casting on the actual facial surface.
# Each tapered tube follows a down-and-out tangent; weights and expression
# deltas interpolate from the triangle under its root, not a generic head.
beardInfo=None
if ident=='garan':
    mz=bone('oris01')[2]
    if not eye[2]-hh*1.2<mz<eye[2]-hh*.15:mz=eye[2]-.67*hh
    rng=np.random.default_rng(5348);verts=[];faces=[];fmat=[];roots=[];rootFor=[];rweights=[];rdelta=[]
    for z in np.arange(mz-hh*.66,mz+hh*.24,hh*.035):
        for x in np.arange(-hh*.59,hh*.60,hh*.035):
            x+=rng.uniform(-.009,.009)*hh;zz=z+rng.uniform(-.010,.010)*hh
            ax=abs(x/hh);dz=(zz-mz)/hh
            allowed=(dz<-.18 and (ax/.59)**2+((dz+.25)/.49)**2<1.) or (.12<dz<.24 and .12<ax<.40) or (-.25<dz<.14 and .35<ax<.55)
            if not allowed:continue
            q,n,idx,d=tree.ray_cast(Vector((eye[0]+x,P[:,1].min()-.5,zz)),Vector((0,1,0)),H)
            if q is None or n.y>-.18 or idx is None:continue
            ids=T[idx];A,B,C=P[ids];v=B-A;w=C-A;u=np.array(q)-A;den=np.dot(v,v)*np.dot(w,w)-np.dot(v,w)**2
            if den<1e-18:continue
            b=(np.dot(u,v)*np.dot(w,w)-np.dot(u,w)*np.dot(v,w))/den;c=(np.dot(u,w)*np.dot(v,v)-np.dot(u,v)*np.dot(v,w))/den
            bary=np.clip(np.array([1-b-c,b,c]),0,1);bary/=bary.sum()
            rw={}
            for k,vi in enumerate(ids):
                for bn,wt in weights[vi].items():rw[bn]=rw.get(bn,0)+wt*bary[k]
            if not rw:continue
            rw=dict(sorted(rw.items(),key=lambda a:-a[1])[:4]);total=sum(rw.values());rw={bn:wt/total for bn,wt in rw.items()}
            normal=Vector(n).normalized();direction=Vector((.20*np.sign(x),0,-1));tangent=direction-normal*direction.dot(normal)
            if tangent.length<1e-5:continue
            tangent.normalize();across=tangent.cross(normal).normalized()
            length=hh*rng.uniform(.075,.15);rad=hh*rng.uniform(.004,.007);root=Vector(q)+normal*.0011
            rid=len(roots);roots.append((list(q),list(normal),idx,bary.tolist()));rweights.append(rw);rdelta.append({k:np.sum((morph0[k][ids]-P[ids])*bary[:,None],axis=0) for k in names})
            base=len(verts)
            for t,rr in ((0.,1.),(.45,.83),(.83,.42),(1.,.075)):
                c0=root+tangent*length*t+normal*length*(.35*t+.16*t*t)
                for j in range(5):
                    a=2*math.pi*j/5;v=c0+(across*math.cos(a)+normal*math.sin(a))*rad*rr
                    loc,nr,_,dist=tree.find_nearest(v)
                    if loc is not None and (v-loc).dot(nr)<.00035:v=loc+nr*.00035
                    verts.append(tuple(v));rootFor.append(rid)
            mat=int(rng.integers(0,4))
            for k in range(3):
                for j in range(5):faces.append((base+5*k+j,base+5*k+(j+1)%5,base+5*(k+1)+(j+1)%5,base+5*(k+1)+j));fmat.append(mat)
            faces.append(tuple(base+15+j for j in range(5)));fmat.append(mat)
    if len(roots)<35:raise RuntimeError('insufficient beard roots on actual skin '+str(len(roots)))
    me=bpy.data.meshes.new('R53 beard tapered strands');me.from_pydata(verts,[],faces);me.update()
    beard=bpy.data.objects.new('R53_Beard',me);bpy.context.collection.objects.link(beard)
    for j,col in enumerate(((.15,.16,.17),(.27,.28,.29),(.43,.44,.45),(.56,.57,.58))):me.materials.append(material('Garan_beard_'+str(j),col,0,.66))
    for f,i in zip(me.polygons,fmat):f.material_index=i;f.use_smooth=True
    groups={n:beard.vertex_groups.new(name=n) for n in sorted({n for w in rweights for n in w})}
    for vi,ri in enumerate(rootFor):
        for n,v in rweights[ri].items():groups[n].add([vi],v,'REPLACE')
    mod=beard.modifiers.new('R53 facial skin weights','ARMATURE');mod.object=rig
    beard.shape_key_add(name='Basis')
    for n in names:
        key=beard.shape_key_add(name=n)
        for vi,ri in enumerate(rootFor):key.data[vi].co=Vector(verts[vi])+Vector(rdelta[ri][n])
    beardInfo={'rootCount':len(roots),'vertices':len(verts),'rootTriangleIndices':[int(r[2]) for r in roots],'rootBarycentric':[r[3] for r in roots],'morphs':names,'neutralSurface':measure(pts(beard),tree),'source':'skin ray intersections and tapered mesh strands; approximate facial hair design'}
bpy.context.view_layer.update()
if not np.array_equal(pts(body),P) or any(not np.array_equal(pts(o),hair0[o.name]) for o in hair):raise RuntimeError('original geometry changed')
for n in names:
    if not np.array_equal(np.array([body.matrix_world@v.co for v in body.data.shape_keys.key_blocks[n].data]),morph0[n]):raise RuntimeError('body morph changed')
for tag,d in [('front',(0,-1,0)),('left',(-1,0,0)),('right',(1,0,0)),('rear',(0,1,0)),('threequarter',(1,-1,0))]:render('after_'+tag,d)
for tag,d in [('front',(0,-1,0)),('side',(1,0,0)),('crown',(0,-.05,1))]:render('face_'+tag,d,fc,hh*3.9)
checks=[]
for n,act in selected.items():
    reset();ad.action=act;lo,hi=map(float,act.frame_range)
    for k,f in enumerate(np.linspace(lo,hi,3)):
        scene.frame_set(math.floor(f),subframe=float(f%1));bpy.context.view_layer.update()
        bt=merged_tree([body],True);ot=merged_tree([body]+cloth,True)
        checks.append({'clip':n,'frame':float(f),'armor':[{'part':o.name,'body':measure(pts(o,True),bt),'underlayer':measure(pts(o,True),ot)} for o in armor],'beard':measure(pts(beard,True),bt) if beard else None})
        if k==1 and n in ('Walk_Loop','Sword_Attack'):render('action_'+n,(1,-2,0))
reset()
expr=[]
for n in ('jawOpen','smile','viseme_A'):
    body.data.shape_keys.key_blocks[n].value=1
    if beard:beard.data.shape_keys.key_blocks[n].value=1
    bpy.context.view_layer.update();expr.append({'morph':n,'beard':measure(pts(beard,True),merged_tree([body],True)) if beard else None});render('expression_'+n,(0,-1,0),fc,hh*3.9);reset()
for n,act in selected.items():
    tr=ad.nla_tracks.new();tr.name='R53_'+n;tr.strips.new('R53_'+n,1,act)
allparts=parts+armor+([beard] if beard else [])
bpy.ops.object.select_all(action='DESELECT')
for o in allparts+[rig]:o.select_set(True)
bpy.context.view_layer.objects.active=body
dest=out/(ident+'_visual_candidate.glb')
opts=dict(filepath=str(dest),export_format='GLB',use_selection=True,export_skins=True,export_animations=True,export_morph=True)
props=bpy.ops.export_scene.gltf.get_rna_type().properties
if 'export_animation_mode' in props and 'NLA_TRACKS' in props['export_animation_mode'].enum_items.keys():opts['export_animation_mode']='NLA_TRACKS'
elif 'export_nla_strips' in props:opts['export_nla_strips']=True
else:raise RuntimeError('NLA export unsupported')
bpy.ops.export_scene.gltf(**opts)
raw=dest.read_bytes();g=json.loads(raw[20:20+int.from_bytes(raw[12:16],'little')]);exported=[a.get('name','') for a in g.get('animations',[])]
if len(g.get('skins',[]))!=1 or not all(any(n.lower() in a.lower() for a in exported) for n in clips):raise RuntimeError('rig or clip lost')
if not any(all(n in m.get('extras',{}).get('targetNames',[]) for n in names) for m in g['meshes']):raise RuntimeError('body expressions lost')
count=len(allparts);bpy.ops.wm.read_factory_settings(use_empty=True);rr=load(dest);rt=[o for o in rr if o.type=='MESH' and rigof(o)]
if len(rt)!=count or len({rigof(o) for o in rt})!=1:raise RuntimeError('roundtrip parts or shared rig mismatch')
if not any(o.data.shape_keys and all(n in o.data.shape_keys.key_blocks for n in names) and not o.name.startswith('R53_Beard') for o in rt):raise RuntimeError('roundtrip face morph loss')
if ident=='garan' and not any(o.name.startswith('R53_Beard') and o.data.shape_keys and all(n in o.data.shape_keys.key_blocks for n in names) for o in rt):raise RuntimeError('roundtrip beard expressions lost')
result={'id':ident,'sourceSHA256':report['sha256'],'armorSourceSHA256':sha(armorfile),'sha256':sha(dest),'armorParts':armorReports,'beard':beardInfo,'hairPalette':palette,'recoloredImages':hairImages,'samples':checks,'expressionSamples':expr,'meshCount':count,'rigCount':1,'morphs':names,'clips':clips,'roundTrip':True,'bodyUnchanged':True,'visualApproved':False,'collisionApproved':False,'finalIdentity':False,'productionApproved':False,'limitations':['Ranger underlayer retained','only breastplate and pauldrons fitted','no cape or complete armor','gray/black hair palette candidate, not final hairstyle','no fine age skin or visual signoff']}
(out/'visual-report.json').write_text(json.dumps(result,indent=2));print('R53 CAST VISUAL',ident,len(armorReports),len(checks),'beard roots',beardInfo['rootCount'] if beardInfo else 0,flush=True)
