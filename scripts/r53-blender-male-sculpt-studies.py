"""R53: offline male sculpt studies from the male-only Blender master.
These are explicitly unapproved candidate meshes, not the production catalog.
Each study has independently baked geometry; no runtime identity parameters.
"""
import bpy,sys,math,json,hashlib
from pathlib import Path
from mathutils import Vector
import numpy as np
args=sys.argv[sys.argv.index("--")+1:]
source,out=Path(args[0]).resolve(),Path(args[1]).resolve()
out.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(source))
bpy.context.view_layer.update()
obj=bpy.data.objects.get("R53_male_sculpt_master")
if obj is None or obj.type!="MESH":raise RuntimeError("Male sculpt master unavailable")
rigs=[m.object for m in obj.modifiers if m.type=="ARMATURE" and m.object]
if len(rigs)!=1:raise RuntimeError("Missing male rig")
rig=rigs[0]
M=obj.matrix_world.copy();inv=M.inverted()
mesh=obj.data;mesh.calc_loop_triangles()
P=np.array([M@v.co for v in mesh.vertices],dtype=np.float64)
tri=np.array([list(t.vertices) for t in mesh.loop_triangles],dtype=np.int32)
x,y,z=P.T; a=np.abs(x); side=np.sign(x)
anchor=z<=1.535
if abs(z.min()-1.515)>1e-5 or abs(z.max()-1.760)>.005:
    raise RuntimeError("Unexpected male coordinate system")
def smooth(a,b,t):
    u=np.clip((t-a)/(b-a),0,1)
    return u*u*(3-2*u)
def bell(cx,cy,cz,rx,ry,rz):
    return np.exp(-((a-cx)/rx)**2-((y-cy)/ry)**2-((z-cz)/rz)**2)
# Landmarks from R41 source measurements; field falloffs keep attached
# anatomy continuous. Values below are artist study directions in metres.
eye=bell(.033,-.125,1.643,.024,.030,.019)
brow=bell(.037,-.123,1.665,.035,.035,.014)
nose=bell(0,-.147,1.620,.020,.032,.029)
tip=bell(0,-.158,1.607,.018,.018,.014)
mouth=bell(0,-.129,1.577,.035,.030,.014)
jaw=bell(.053,-.069,1.563,.027,.045,.022)
cheek=bell(.054,-.100,1.613,.024,.036,.027)
guard=smooth(1.535,1.554,z)
# Separate offline sculpt studies; no skull scaling or cross-sex mesh.
# Each function describes a different anatomical editing sequence.
def study(i):
    D=np.zeros_like(P)
    def eyes(width=0,height=0,spacing=0,lift=0,tilt=0,depth=0):
        D[:,0]+=eye*(width*(x-side*.033)+side*spacing)
        D[:,2]+=eye*(height*(z-1.643)+lift+tilt*(a-.033))
        D[:,1]-=eye*depth
    def nose_edit(bridge=0,wing=0,roundness=0):
        D[:,1]-=nose*bridge+tip*roundness
        D[:,0]+=nose*x*wing
    def lips(width=0,fullness=0,lift=0):
        D[:,0]+=mouth*x*width
        D[:,1]-=mouth*fullness
        D[:,2]+=mouth*lift
    def lower(j=0,c=0):
        D[:,0]+=jaw*side*j
        D[:,1]-=cheek*c
    if i==2:
        eyes(height=-.14,tilt=.12,depth=-.001);nose_edit(bridge=.003);lips(fullness=-.001)
    elif i==3:
        eyes(width=.15,spacing=.001);nose_edit(wing=-.16);lips(width=-.10)
    elif i==4:
        eyes(height=.16,tilt=-.07);nose_edit(roundness=.002);lips(width=.13)
    elif i==5:
        eyes(depth=-.004);nose_edit(bridge=.004);lower(c=.002)
    elif i==6:
        D[:,2]-=brow*.0035;nose_edit(wing=.14);lips(width=.17);lower(j=.002)
    elif i==7:
        eyes(height=.18,width=.08);nose_edit(bridge=-.002,wing=-.09);lower(j=-.002)
    elif i==8:
        eyes(lift=-.002,height=-.08);nose_edit(bridge=.0025,wing=-.08);lips(fullness=-.0015)
    elif i==9:
        eyes(tilt=-.15);lips(fullness=.002);lower(c=.0015)
    elif i==10:
        eyes(width=.20,height=-.07,tilt=.10);nose_edit(bridge=.0035,wing=-.06);lips(width=.04)
    D*=guard[:,None];D[anchor]=0
    return D
def normals(p):
    t=p[tri]
    return np.cross(t[:,1]-t[:,0],t[:,2]-t[:,0])
N=normals(P);valid=np.linalg.norm(N,axis=1)>1e-12
scene=bpy.context.scene
scene.render.engine="BLENDER_WORKBENCH"
scene.render.resolution_x=480;scene.render.resolution_y=480
scene.render.resolution_percentage=100;scene.render.image_settings.file_format="PNG"
sh=scene.display.shading;sh.light="STUDIO";sh.color_type="SINGLE"
sh.single_color=(.65,.58,.52);sh.show_shadows=True
sh.show_cavity=True;sh.cavity_type="BOTH"
bpy.ops.object.camera_add()
cam=bpy.context.object;cam.data.type="ORTHO";cam.data.ortho_scale=.31
scene.camera=cam
center=Vector((0,(y.min()+y.max())/2,(z.min()+z.max())/2))
records=[]
for i in range(1,11):
    ident="male_face_%02d"%i
    D=study(i)
    factor=1.
    for _ in range(15):
        Q=P+D*factor
        nn=normals(Q)
        flips=int(np.sum((np.einsum("ij,ij->i",N,nn)<0)&valid))
        if flips==0:break
        factor*=.8
    if flips:raise RuntimeError("Face inversion in "+ident)
    if np.max(np.abs(Q[anchor]-P[anchor]))>1e-10:
        raise RuntimeError("Neck anchors changed")
    for v,p in zip(mesh.vertices,Q):v.co=inv@Vector(p)
    mesh.update();bpy.context.view_layer.update()
    obj.name=ident
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True);rig.select_set(True);bpy.context.view_layer.objects.active=obj
    glb=out/(ident+".glb")
    bpy.ops.export_scene.gltf(filepath=str(glb),export_format="GLB",use_selection=True,
        export_animations=False,export_skins=True,export_morph=True)
    for angle,tag in [(0,"front"),(90,"side"),(45,"45")]:
        rad=math.radians(angle)
        cam.location=center+Vector((math.sin(rad),-math.cos(rad),0))*.7
        cam.rotation_euler=(center-cam.location).to_track_quat("-Z","Y").to_euler()
        scene.render.filepath=str(out/(ident+"_"+tag+".png"))
        bpy.ops.render.render(write_still=True)
    records.append(dict(id=ident,sourceSex="male",vertices=len(P),
        sha256=hashlib.sha256(glb.read_bytes()).hexdigest(),
        geometry_sha256=hashlib.sha256(Q.astype("<f4").tobytes()).hexdigest(),
        applied_factor=factor,new_face_flips=flips,neck_anchor_error_m=0,
        displacement_rms_m=float(np.sqrt(np.mean(np.sum((Q-P)**2,axis=1)))),
        visualApproved=False))
    print("R53 sculpt study",records[-1],flush=True)
if len({r["geometry_sha256"] for r in records})!=10:raise RuntimeError("Duplicate candidate geometry")
(out/"male-candidate-audit.json").write_text(json.dumps(dict(
    revision="R53",classification="unapproved offline male sculpt studies",
    missing=["high precision facial details","skin PBR","individual expression shape keys",
             "hair and body fit","visual approval"],faces=records),indent=2))
