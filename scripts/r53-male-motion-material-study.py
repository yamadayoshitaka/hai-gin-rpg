"""R53 male candidate PBR + facial motion study, from ten real baked male meshes.
This is an experimental facial rig, not a completed anatomy or production asset.
No invented teeth, lashes, or visual approval flags.
"""
import bpy,sys,math,json,hashlib
from pathlib import Path
from mathutils import Vector
import numpy as np
args=sys.argv[sys.argv.index("--")+1:]
src,out=map(lambda p:Path(p).resolve(),args[:2]);out.mkdir(parents=True,exist_ok=True)
report=json.loads((src/"male-candidate-audit.json").read_text())
ids=["male_face_%02d"%i for i in range(1,11)]
records={r["id"]:r for r in report["faces"]}
if set(records)!=set(ids):raise RuntimeError("Incomplete male candidate source")
names=["jawOpen","viseme_A","viseme_I","viseme_U","viseme_E","viseme_O","smile","blink_L","blink_R","browRaise","browFrown"]
def smooth(lo,hi,p):
    v=np.clip((p-lo)/(hi-lo),0,1);return v*v*(3-2*v)
def material(name,rough):
    mat=bpy.data.materials.new(name);mat.use_nodes=True
    bs=mat.node_tree.nodes.get("Principled BSDF")
    bs.inputs["Roughness"].default_value=rough
    bs.inputs["Metallic"].default_value=0
    color=mat.node_tree.nodes.new("ShaderNodeVertexColor");color.layer_name="R53_Albedo"
    mat.node_tree.links.new(color.outputs["Color"],bs.inputs["Base Color"])
    return mat
def components(P,edges):
    # Coincident split vertices are grouped for analysis only; topology unchanged.
    _,mapping=np.unique(np.round(P,6),axis=0,return_inverse=True)
    count=int(mapping.max())+1; parent=list(range(count))
    def root(i):
        while parent[i]!=i:
            parent[i]=parent[parent[i]];i=parent[i]
        return i
    for u,v in edges:
        a,b=root(int(mapping[u])),root(int(mapping[v]))
        if a!=b:parent[b]=a
    labels=np.array([root(int(i)) for i in mapping])
    return [np.flatnonzero(labels==c) for c in np.unique(labels)]
results=[]
for i,ident in enumerate(ids):
    file=src/(ident+".glb")
    if hashlib.sha256(file.read_bytes()).hexdigest()!=records[ident]["sha256"]:
        raise RuntimeError("Source hash mismatch "+ident)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(file));bpy.context.view_layer.update()
    candidates=[o for o in bpy.context.scene.objects if o.type=="MESH" and len(o.data.vertices)>50000
                and any(m.type=="ARMATURE" and m.object for m in o.modifiers)]
    if len(candidates)!=1:raise RuntimeError("Cannot identify male study mesh "+ident)
    obj=candidates[0];rig=next(m.object for m in obj.modifiers if m.type=="ARMATURE" and m.object)
    M=obj.matrix_world.copy();inv=M.inverted();mesh=obj.data
    P=np.array([M@v.co for v in mesh.vertices],dtype=np.float64)
    if abs(P[:,2].min()-1.515)>2e-5 or abs(P[:,2].max()-1.760)>.006:
        raise RuntimeError("Unexpected world coordinate system "+ident)
    x,y,z=P.T;a=np.abs(x)
    groups=components(P,[e.vertices for e in mesh.edges])
    info=[]
    for g in groups:
        lo=P[g].min(0);hi=P[g].max(0);c=(lo+hi)/2
        info.append((g,lo,hi,c))
    eyes=[]
    for sign in [-1,1]:
        hit=[(g,lo,hi,c) for g,lo,hi,c in info if len(g)>100
             and .024<sign*c[0]<.043 and 1.632<c[2]<1.655
             and -.143<c[1]<-.108 and (hi-lo).max()<.05]
        if len(hit)!=1:
            raise RuntimeError("Expected unique anatomical eyeball "+ident+" "+str(sign)+" "+str([(len(g),lo.tolist(),hi.tolist()) for g,lo,hi,c in info if len(g)>100]))
        eyes.append(hit[0])
    oral_hits=[(g,lo,hi,c) for g,lo,hi,c in info if len(g)>100
               and abs(c[0])<.01 and 1.555<c[2]<1.595 and hi[2]<1.626
               and .055<hi[0]-lo[0]<.115 and hi[2]-lo[2]>.045]
    if len(oral_hits)!=1:raise RuntimeError("Cannot identify original oral component "+ident)
    oral=oral_hits[0][0]
    eye_mask=np.zeros(len(P),bool);oral_mask=np.zeros(len(P),bool)
    oral_mask[oral]=True
    for g,*_ in eyes:eye_mask[g]=True
    skin=~(eye_mask|oral_mask)
    anchor=z<=1.535
    # Distinct linear-albedo study palettes (not inferred ethnicity).
    tones=[(.48,.30,.22),(.55,.36,.28),(.39,.24,.17),(.63,.43,.32),(.44,.28,.21),
           (.57,.39,.29),(.35,.21,.15),(.51,.32,.23),(.60,.40,.30),(.46,.29,.24)]
    irises=[(.12,.064,.028),(.075,.044,.028),(.16,.11,.055),(.08,.105,.09),(.09,.055,.035),
            (.12,.09,.045),(.065,.038,.024),(.085,.13,.14),(.19,.12,.055),(.08,.065,.05)]
    color=np.ones((len(P),4),np.float32);color[:,:3]=tones[i]
    lip=np.exp(-(x/.026)**2-((y+.144)/.019)**2-((z-1.577)/.006)**2)*skin
    lip*=.30
    color[:,:3]=color[:,:3]*(1-lip[:,None])+np.array([.35,.13,.12])*lip[:,None]
    color[oral,:3]=(.15,.045,.043)
    for g,lo,hi,c in eyes:
        # Color the existing globe surface; iris is not a separate floating disk.
        radius=np.sqrt((P[g,0]-c[0])**2+(P[g,2]-c[2])**2)
        front=1-smooth(c[1]-.005,c[1]+.001,P[g,1])
        iris=(1-smooth(.0051,.0065,radius))*front
        pupil=(1-smooth(.0021,.0030,radius))*front
        sclera=np.array([.69,.65,.60])
        base=sclera*(1-iris[:,None])+np.array(irises[i])*iris[:,None]
        base=base*(1-pupil[:,None])+np.array([.014,.011,.009])*pupil[:,None]
        color[g,:3]=base
    mesh.materials.clear()
    for name,rough in [("R53_skin",.64),("R53_eye",.27),("R53_oral",.74)]:
        mesh.materials.append(material(name,rough))
    for poly in mesh.polygons:
        j=poly.vertices[0]
        poly.material_index=1 if eye_mask[j] else 2 if oral_mask[j] else 0
    old=mesh.color_attributes.get("R53_Albedo")
    if old:mesh.color_attributes.remove(old)
    ca=mesh.color_attributes.new(name="R53_Albedo",type="FLOAT_COLOR",domain="POINT")
    ca.data.foreach_set("color",color.ravel())
    mesh.color_attributes.active_color=ca
    # Experimental local facial motion fields. Original eye spheres stay rigid.
    def g(cx,cy,cz,rx,ry,rz):
        return np.exp(-((a-cx)/rx)**2-((y-cy)/ry)**2-((z-cz)/rz)**2)
    mouth=g(0,-.139,1.577,.040,.035,.017)
    jaw=g(.023,-.105,1.557,.055,.065,.024)
    brow=g(.037,-.123,1.665,.031,.04,.015)
    eye=g(.033,-.126,1.643,.022,.029,.018)
    lower=1-smooth(1.575,1.582,z)
    guard=smooth(1.535,1.550,z)
    def delta(name):
        d=np.zeros_like(P)
        if name in ["jawOpen","viseme_A","viseme_I","viseme_U","viseme_E","viseme_O","smile"]:
            op,wide,forward,raise_corner={
                "jawOpen":(.009,0,0,0),"viseme_A":(.008,.04,0,0),
                "viseme_I":(.002,.16,0,.001),"viseme_U":(.001,-.18,.003,0),
                "viseme_E":(.004,.13,0,.001),"viseme_O":(.006,-.12,.002,0),
                "smile":(.001,.17,-.001,.003)}[name]
            d[:,2]-=op*lower*np.maximum(mouth,jaw*.65)
            d[:,0]+=mouth*x*wide
            d[:,1]-=mouth*forward
            d[:,2]+=raise_corner*mouth*smooth(.010,.027,a)
            # Mouth interior moves with lower jaw, but never moves eye globes.
            d[oral,0]*=.35;d[oral,1]*=.6
        elif name.startswith("blink"):
            sign=1 if name=="blink_L" else -1
            lid=eye*(x*sign>0)*skin
            d[:,2]+=(1.643-z)*lid*.75
        elif name=="browRaise":d[:,2]+=brow*.003*skin
        elif name=="browFrown":
            d[:,2]-=brow*.0025*skin
            d[:,0]-=brow*np.sign(x)*.0015*skin
        d*=guard[:,None];d[eye_mask|anchor]=0
        return d
    mesh.calc_loop_triangles();tri=np.array([list(t.vertices) for t in mesh.loop_triangles],np.int32)
    def normals(q):
        t=q[tri];return np.cross(t[:,1]-t[:,0],t[:,2]-t[:,0])
    N=normals(P);valid=np.linalg.norm(N,axis=1)>1e-12
    if mesh.shape_keys:raise RuntimeError("Unexpected existing shape keys")
    obj.shape_key_add(name="Basis")
    keys=[]
    for name in names:
        d=delta(name);factor=1.
        for _ in range(18):
            Q=P+d*factor;nn=normals(Q)
            flips=int(np.sum((np.einsum("ij,ij->i",N,nn)<0)&valid))
            if not flips:break
            factor*=.75
        peak=float(np.max(np.linalg.norm(Q-P,axis=1)))
        if flips or peak<.0001:raise RuntimeError("Invalid motion "+ident+" "+name)
        key=obj.shape_key_add(name=name);key.slider_min=0;key.slider_max=1
        local=np.array([inv@Vector(p) for p in Q],np.float32)
        key.data.foreach_set("co",local.ravel());key.value=0
        keys.append(dict(name=name,peak_m=peak,factor=factor,new_face_flips=flips,
                         neck_anchor_error_m=float(np.max(np.abs(Q[anchor]-P[anchor])))))
    mesh.update();bpy.context.view_layer.update()
    bpy.ops.object.select_all(action="DESELECT");obj.select_set(True);rig.select_set(True)
    bpy.context.view_layer.objects.active=obj
    dest=out/(ident+".glb")
    bpy.ops.export_scene.gltf(filepath=str(dest),export_format="GLB",use_selection=True,
       export_animations=False,export_skins=True,export_morph=True,export_morph_normal=True)
    raw=dest.read_bytes();n=int.from_bytes(raw[12:16],"little");gltf=json.loads(raw[20:20+n])
    targets=[m.get("extras",{}).get("targetNames",[]) for m in gltf["meshes"]]
    if not any(all(k in t for k in names) for t in targets):raise RuntimeError("Missing exported morphs "+ident)
    # Render only actual model geometry with its baked vertex colors.
    scene=bpy.context.scene;scene.render.engine="BLENDER_WORKBENCH"
    scene.render.resolution_x=480;scene.render.resolution_y=480;scene.render.resolution_percentage=100
    scene.render.image_settings.file_format="PNG";sh=scene.display.shading
    sh.light="STUDIO";sh.color_type="VERTEX";sh.show_shadows=True;sh.show_cavity=True;sh.cavity_type="BOTH"
    bpy.ops.object.camera_add();cam=bpy.context.object;cam.data.type="ORTHO";cam.data.ortho_scale=.31;scene.camera=cam
    center=Vector((0,(y.min()+y.max())/2,(z.min()+z.max())/2))
    for tag,angle,morph in [("front",0,None),("side",90,None),("smile",0,"smile"),("open",0,"jawOpen")]:
        for name in names:obj.data.shape_keys.key_blocks[name].value=float(name==morph)
        rad=math.radians(angle);cam.location=center+Vector((math.sin(rad),-math.cos(rad),0))*.7
        cam.rotation_euler=(center-cam.location).to_track_quat("-Z","Y").to_euler()
        scene.render.filepath=str(out/(ident+"_"+tag+".png"));bpy.ops.render.render(write_still=True)
    r=dict(id=ident,sourceSex="male",source_sha256=records[ident]["sha256"],sha256=hashlib.sha256(raw).hexdigest(),
           eye_vertices=int(eye_mask.sum()),oral_vertices=len(oral),skin_vertices=int(skin.sum()),
           materials=3,morphs=keys,visualApproved=False)
    results.append(r);print("R53 experimental face motion",r,flush=True)
(out/"male-motion-audit.json").write_text(json.dumps(dict(revision="R53",classification="experimental motion and material candidates",faces=results,
   remaining=["actual eyelid rig and mouth anatomy review","teeth/tongue separation","eyebrows and lashes","hair and body fitting","editor compatibility","visual approval"]),indent=2))
