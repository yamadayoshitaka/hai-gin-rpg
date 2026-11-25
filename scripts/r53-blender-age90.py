"""R53: bake sex-specific five-build body studies from actual rigged donors.
Nine age-band candidate studies using three verified donor cohorts.
Age coefficients are provisional anatomical estimates, not image measurements.
No final face, skeletal age, skin, motion or garment approval is claimed.
"""
import bpy,sys,math,json,hashlib,re
from pathlib import Path
from mathutils import Vector
import numpy as np
args=sys.argv[sys.argv.index("--")+1:]
root,out=map(lambda p:Path(p).resolve(),args[:2]);out.mkdir(parents=True,exist_ok=True)
donors=[
 ("female","adult","HM08_adult_female_R36_review.glb","44fb2575373902da4eb43045f737ffbad5ce50b8"),
 ("male","adult","HM08_male-adult_R41.glb","a30287190e5175fa52933ef97e0a92715cbf155a"),
 ("female","senior","HM08_female-senior_R41.glb","36be6e03ace38d947302e8f6f95a7d30691abf20"),
 ("male","senior","HM08_male-senior_R41.glb","5cae2c3b55e9c2cc22d3c8de5abf760d1936aecf"),
 ("female","child","HM08_female-child_R41.glb","03ee6b250b77ea30707e092cee57276aa33b0b6d"),
 ("male","child","HM08_male-child_R41.glb","e058e1bc4f8b3027e0d1dd1e757accc26cd48b5d")]
# torso width, abdomen depth, hip, thigh, upper arm, neck, upper chest
builds={
 "slim":(-.14,-.15,-.11,-.13,-.12,-.07,-.08),
 "normal":(0,0,0,0,0,0,0),
 "muscular":(.04,.01,.03,.17,.26,.09,.16),
 "chubby":(.16,.23,.12,.14,.14,.09,.08),
 "obese":(.36,.52,.27,.30,.28,.20,.15)}
def bell(t,c,w):return np.exp(-((t-c)/w)**2)
def smooth(lo,hi,t):
    t=np.clip((t-lo)/(hi-lo),0,1);return t*t*(3-2*t)
def norm(P,t):
    q=P[t];return np.cross(q[:,1]-q[:,0],q[:,2]-q[:,0])
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def bone_signature(rig):
    return [(b.name,b.parent.name if b.parent else None,list(b.head_local),list(b.tail_local)) for b in rig.data.bones]
# Local tissue adjustments relative to the cohort donor: waist, abdomen,
# hip, thigh, upper arm, neck, chest. No global scaling or head inflation.
# Teen remains an adult-donor transition study; skeletal maturity is not yet approved.
profiles={
 "under10":("child",(0,0,0,0,0,0,0)),
 "teens":("adult",(-.06,-.07,-.05,-.07,-.09,-.035,-.07)),
 "20s":("adult",(-.025,-.035,-.015,.015,.025,0,.025)),
 "30s":("adult",(0,0,0,0,0,0,0)),
 "40s":("adult",(.035,.055,.015,-.015,-.015,.008,-.01)),
 "50s":("adult",(.065,.095,.025,-.035,-.04,.015,-.025)),
 "60s":("senior",(.025,.04,.01,.025,.035,.01,.02)),
 "70s":("senior",(0,0,0,0,0,0,0)),
 "80plus":("senior",(.015,.035,-.035,-.055,-.07,-.015,-.045))}
sex_filter=args[2]; requested=args[3].split(',')
assert sex_filter in ('female','male') and all(a in profiles for a in requested)
results=[];failures=[]
source_by_age={(s,a):(f,h) for s,a,f,h in donors}
for band in requested:
    sex=sex_filter
    age,age_delta=profiles[band]
    filename,source_sha=source_by_age[(sex,age)]
    src=root/filename;raw=src.read_bytes()
    if hashlib.sha1(("blob "+str(len(raw))+"\0").encode()+raw).hexdigest()!=source_sha:
        raise RuntimeError("Unexpected source bytes "+filename)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(src));bpy.context.view_layer.update()
    objs=[o for o in bpy.context.scene.objects if o.type=="MESH" and len(o.data.vertices)>1000 and any(m.type=="ARMATURE" and m.object for m in o.modifiers)]
    if len(objs)!=1:raise RuntimeError("Expected one anatomical donor "+filename+" "+str([(o.name,len(o.data.vertices)) for o in objs]))
    obj=objs[0];rig=next(m.object for m in obj.modifiers if m.type=="ARMATURE" and m.object)
    mesh=obj.data;M=obj.matrix_world.copy();inv=M.inverted();P=np.array([M@v.co for v in mesh.vertices],np.float64)
    x,y,z=P.T;z0=z.min();H=z.max()-z0;h=(z-z0)/H
    if not 1.0<H<2.1:raise RuntimeError("Invalid height")
    mesh.calc_loop_triangles();tri=np.array([list(t.vertices) for t in mesh.loop_triangles],np.int32)
    N=norm(P,tri);area=np.linalg.norm(N,axis=1);valid=area>1e-11
    groups=[g.name for g in obj.vertex_groups];weights=np.zeros((len(P),len(groups)),np.float64)
    for v in mesh.vertices:
        for w in v.groups:weights[v.index,w.group]=w.weight
    if not np.isfinite(weights).all() or weights.sum(1).min()<=0:raise RuntimeError("Missing skin weights")
    signatures=bone_signature(rig);uvs=[u.name for u in mesh.uv_layers]
    # Body centres measured from the donor, not assumptions about the front.
    abdomen=(h>.47)&(h<.64)&(np.abs(x)<.12*H)
    cy=float((y[abdomen].min()+y[abdomen].max())/2)
    front=np.maximum(0,cy-y);back=np.maximum(0,y-cy)
    torso=np.zeros(len(P));neck=np.zeros(len(P));head=np.zeros(len(P));limb=np.zeros(len(P));parts={}
    for k,name in enumerate(groups):
        n=name.lower()
        if re.match(r"spine|pelvis|breast|chest|rib",n):torso+=weights[:,k]
        if n.startswith("neck"):neck+=weights[:,k]
        if re.match(r"head|jaw|face|eye",n):head+=weights[:,k]
        if re.match(r"upperarm|lowerarm|upperleg|lowerleg",n) and rig.data.bones.get(name):
            bone=rig.data.bones[name];A=np.array(rig.matrix_world@bone.head_local);B=np.array(rig.matrix_world@bone.tail_local)
            axis=B-A;L=np.linalg.norm(axis)
            if L>1e-5:
                axis/=L;R=P-A;radial=R-np.outer(R@axis,axis)
                parts[name]=(weights[:,k],radial);limb+=weights[:,k]
    if len(parts)<8:raise RuntimeError("Anatomical limb bone mapping incomplete "+filename)
    # Use shared displacement groups at UV-split vertices.  A local defect
    # must not reduce the entire abdomen, arms and legs together.
    _, weld = np.unique(np.round(P,6),axis=0,return_inverse=True)
    weld_count=int(weld.max())+1
    counts=np.bincount(weld,minlength=weld_count)
    welded_tri=weld[tri]
    edges=np.unique(np.sort(np.concatenate((welded_tri[:,[0,1]],welded_tri[:,[1,2]],welded_tri[:,[2,0]])),axis=1),axis=0)
    edges=edges[edges[:,0]!=edges[:,1]]
    edge_from=np.concatenate((edges[:,0],edges[:,1]));edge_to=np.concatenate((edges[:,1],edges[:,0]))
    degree=np.maximum(1,np.bincount(edge_from,minlength=weld_count))
    protected=np.zeros(weld_count,dtype=bool)
    protected[weld[h>=.94]]=True
    def corrected_displacement(D):
        field=np.column_stack([np.bincount(weld,weights=D[:,k],minlength=weld_count)/counts for k in range(3)])
        field[protected]=0
        alpha=np.ones(weld_count)
        for it in range(120):
            Q=P+(field*alpha[:,None])[weld]
            nn=norm(Q,tri)
            reversed_=(np.einsum("ij,ij->i",N,nn)<0)&valid
            collapsed_=(np.linalg.norm(nn,axis=1)<area*.02)&valid
            bad=reversed_|collapsed_
            if not bad.any():
                return Q,alpha[weld],it,int(reversed_.sum()),int(collapsed_.sum())
            seeds=np.unique(welded_tri[bad])
            target=alpha.copy()
            target[seeds]*=.72
            # Smooth the attenuation into a two-ring neighborhood, never
            # re-increase a previously reduced vertex.
            for _ in range(2):
                avg=np.bincount(edge_from,weights=target[edge_to],minlength=weld_count)/degree
                target=np.minimum(target,.58*target+.42*avg)
            alpha=np.minimum(alpha,target)
        raise RuntimeError("Local body correction failed "+str(int(bad.sum())))
    def proposal(v):
        waist,belly,hip,leg,arm,neckgain,chest=v
        # Sex-specific distribution: pelvis/thigh emphasis vs chest/abdomen.
        hip*=1.15 if sex=="female" else .90
        chest*=1.13 if sex=="male" else .92
        if age=="child":chest*=.65;neckgain*=.75
        D=np.zeros_like(P)
        # Trunk only; no overall horizontal scale. Use skin influence and local masks.
        tw=np.clip(torso,0,1)*smooth(.36,.43,h)*(1-smooth(.80,.86,h))
        w=bell(h,.58,.115);ab=bell(h,.55,.10);hips=bell(h,.49,.085);upper=bell(h,.72,.095)
        D[:,0]+=tw*x*(waist*w+hip*hips+chest*upper)
        D[:,1]+=tw*((y-cy)*(waist*.35*w+hip*.45*hips+chest*.7*upper)+(-front*belly*ab+back*belly*.32*ab))
        # radial expansion about original arm/leg bone axes; avoid hands and feet
        for name,(wt,radial) in parts.items():
            n=name.lower()
            gain=arm*(1 if n.startswith("upperarm") else .55) if "arm" in n else leg*(1 if n.startswith("upperleg") else .48)
            D+=radial*(wt*gain)[:,None]
        # neck thickens locally and tapers toward the unchanged donor face.
        nw=np.clip(neck,0,1)*bell(h,.86,.065)*(1-smooth(.90,.94,h))
        D[:,0]+=nw*x*neckgain;D[:,1]+=nw*(y-cy)*neckgain*.65
        # Protect hands, feet, and upper facial landmarks. Lower neck is deliberately
        # changed on heavier builds; separate R53 face-to-body fitting remains required.
        D*=smooth(.055,.12,h)[:,None];D[h>=.94]=0
        return D
    scene=bpy.context.scene;scene.render.engine="BLENDER_WORKBENCH"
    scene.render.resolution_x=500;scene.render.resolution_y=640;scene.render.resolution_percentage=100
    scene.render.image_settings.file_format="PNG";sh=scene.display.shading
    sh.light="STUDIO";sh.color_type="SINGLE";sh.single_color=(.60,.51,.44);sh.show_shadows=True;sh.show_cavity=True;sh.cavity_type="BOTH"
    bpy.ops.object.camera_add();cam=bpy.context.object;cam.data.type="ORTHO";cam.data.ortho_scale=H*1.14;scene.camera=cam
    center=Vector((0,cy,z0+H*.5))
    for build,values in builds.items():
        try:
            ident=f"{sex}_{band}_{build}";D=proposal(tuple(a+b for a,b in zip(values,age_delta)))
            Q,alpha,iterations,flips,collapse=corrected_displacement(D)
            mag=np.linalg.norm(D,axis=1)
            active=mag>1e-5
            factor=float(np.average(alpha[active],weights=mag[active])) if active.any() else 1.
            if flips or collapse:raise RuntimeError("Body deformation invalid "+ident)
            if active.any() and factor<.65:raise RuntimeError("Body effect too attenuated "+ident)
            for v,p in zip(mesh.vertices,Q):v.co=inv@Vector(p)
            mesh.update();bpy.context.view_layer.update()
            if bone_signature(rig)!=signatures or [u.name for u in mesh.uv_layers]!=uvs:raise RuntimeError("Rig or UV changed")
            assert np.isfinite(Q).all()
            if np.max(np.abs(Q[h>=.94]-P[h>=.94]))>1e-9:raise RuntimeError("Upper head moved")
            def widthdepth(a):
                band=a[(h>.55)&(h<.59)&(np.abs(x)<.13*H)]
                return [float(np.ptp(band[:,0])),float(np.ptp(band[:,1]))]
            before=widthdepth(P);after=widthdepth(Q)
            if build=="obese" and (after[0]<before[0]*1.08 or after[1]<before[1]*1.08):
                raise RuntimeError("Obese torso expansion insufficient "+ident+" "+str([before,after]))
            obj.name=ident
            bpy.ops.object.select_all(action="DESELECT");obj.select_set(True);rig.select_set(True);bpy.context.view_layer.objects.active=obj
            dest=out/(ident+".glb")
            bpy.ops.export_scene.gltf(filepath=str(dest),export_format="GLB",use_selection=True,export_skins=True,export_animations=False)
            data=dest.read_bytes();n=int.from_bytes(data[12:16],"little");g=json.loads(data[20:20+n])
            if not g.get("skins") or len(g["skins"][0]["joints"])!=len(signatures):raise RuntimeError("Exported rig missing "+ident)
            if True:
                for tag,angle in [("front",0),("side",90),("45",45)]:
                    rad=math.radians(angle);cam.location=center+Vector((math.sin(rad),-math.cos(rad),0))*H*3
                    cam.rotation_euler=(center-cam.location).to_track_quat("-Z","Y").to_euler()
                    scene.render.filepath=str(out/(ident+"_"+tag+".png"));bpy.ops.render.render(write_still=True)
            rec=dict(id=ident,sex=sex,ageBand=band,ageCohort=age,ageCoefficients=list(age_delta),ageSource="estimated local tissue profile",build=build,source_git_blob=source_sha,sha256=sha(dest),
                     height_m=float(H),vertices=len(P),triangles=len(tri),bones=len(signatures),new_face_flips=flips,collapsed=collapse,
                     applied_factor=factor,local_correction_iterations=iterations,locally_attenuated_vertices=int(np.sum(alpha<.99)),waist_width_depth_before_m=before,waist_width_depth_after_m=after,
                     visualApproved=False,faceIntegration=False,clothingFit=False,motionApproved=False,skeletalAgeApproved=False,skinAgeApproved=False)
            results.append(rec);print("R53 BODY",json.dumps(rec),flush=True)
        except Exception as exc:
            failures.append({"id":f"{sex}_{band}_{build}","error":str(exc)})
            print("R53 AGE FAILURE",failures[-1],flush=True)
        finally:
            (out/"body-candidates.json").write_text(json.dumps(dict(revision="R53-age90",classification="unapproved age/body studies",models=results,failures=failures),indent=2))
if failures or len(results)!=len(requested)*5:raise RuntimeError("Incomplete shard; partial output retained")
