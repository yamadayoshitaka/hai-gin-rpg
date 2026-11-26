"""Independent R54 measured head prototype. No imported head geometry.
All dimensions normalized by a design IPD; hidden skull/ear depths inferred.
This is a new topology candidate, not an approved animation-ready asset.
"""
import bpy, numpy as np, math, json, sys
from pathlib import Path
from mathutils import Vector
from mathutils import Matrix
import bmesh
args=sys.argv[sys.argv.index('--')+1:]
out=Path(args[0]).resolve();out.mkdir(parents=True,exist_ok=True)
d=json.loads(Path('data/r53-female-detail-landmarks.json').read_text())
nine=json.loads(Path('data/r53-female-nine-view-design.json').read_text())
f={k:np.array(v,float) for k,v in d['views']['front'].items()}
mid=(f['irisL'][0]+f['irisR'][0])/2
ipd=float(np.linalg.norm(f['irisR'][0]-f['irisL'][0]))
UNIT=.063 # design interpupillary distance, not a physical measurement
def px(P):return np.column_stack(((P[:,0]-mid[0])/ipd,(mid[1]-P[:,1])/ipd))
def linear(rgb):
    a=np.asarray(rgb,float)/255
    return np.where(a<=.04045,a/12.92,((a+.055)/1.055)**2.4)
bpy.ops.wm.read_factory_settings(use_empty=True)
def mat(name,rgb,rough=.5,sss=0):
    m=bpy.data.materials.new(name);m.use_nodes=True
    c=linear(rgb);m.diffuse_color=(*c,1);b=m.node_tree.nodes.get('Principled BSDF')
    b.inputs['Base Color'].default_value=(*c,1);b.inputs['Roughness'].default_value=rough
    if 'Subsurface Weight' in b.inputs:b.inputs['Subsurface Weight'].default_value=sss
    return m
skin=mat('Skin_reference_estimate',[224,186,171],.51,.065)
upperlip=mat('Upper_vermilion',[181,112,104],.40,.045)
lowerlip=mat('Lower_vermilion',[213,142,134],.36,.055)
lining=mat('Oral_lining',[76,32,35],.58)
lashmat=mat('Lash',[35,24,20],.57)
browmat=mat('Brow',[96,69,54],.60)
sclera=mat('Sclera',[232,224,219],.25,.03)
pupil=mat('Pupil',[15,20,27],.20)
irisM=[mat('Iris_%02d'%i,c,.26) for i,c in enumerate(([56,65,82],[91,117,143],[119,144,165],[77,99,128],[155,159,163],[49,62,82]))]
def object_mesh(name,V,F,materials,indices=None):
    me=bpy.data.meshes.new(name);me.from_pydata([tuple(np.asarray(p)*UNIT) for p in V],[],F);me.update()
    ob=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(ob)
    for m in materials:me.materials.append(m)
    if indices is not None:
        for p,k in zip(me.polygons,indices):p.material_index=int(k)
    bm=bmesh.new();bm.from_mesh(me);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(me);bm.free()
    for p in me.polygons:p.use_smooth=True
    return ob
def sstep(t):
    t=np.clip(t,0,1);return t*t*(3-2*t)
# Face width is a traced visible envelope, with separate inferred upper
# cranium and neck support. Interpolate the left/right traces independently.
left=px(np.vstack((f['cheekL'],f['jawL'])))
right=px(np.vstack((f['cheekR'],f['jawR'])))
# Shape-preserving C1 interpolation. No piecewise-linear ridges or
# duplicate stations at the transition between neck and jaw.
def smooth_interp(x,X,Y):
    X=np.asarray(X,float);Y=np.asarray(Y,float)
    j=np.argsort(X);X=X[j];Y=Y[j]
    X,idx=np.unique(X,return_index=True);Y=Y[idx]
    h=np.diff(X);m=np.diff(Y)/h
    d=np.zeros_like(Y);d[0]=m[0];d[-1]=m[-1]
    for k in range(1,len(Y)-1):
        if m[k-1]*m[k]>0:
            w1=2*h[k]+h[k-1];w2=h[k]+2*h[k-1]
            d[k]=(w1+w2)/(w1/m[k-1]+w2/m[k])
    x=float(np.clip(x,X[0],X[-1]));k=min(len(X)-2,max(0,int(np.searchsorted(X,x)-1)))
    t=(x-X[k])/h[k]
    return float((2*t**3-3*t*t+1)*Y[k]+(t**3-2*t*t+t)*h[k]*d[k]+(-2*t**3+3*t*t)*Y[k+1]+(t**3-t*t)*h[k]*d[k+1])
# Reference visible widths are measurements; skull and neck rows are
# inferred. Neck cross-section must not shrink to the chin-tip width.
# Smooth interpolation joins all rows rather than fitting facial outline
# extrema to the entire head and neck section indiscriminately.
# R54 v3: fit a coherent width envelope to the paired facial contours.
# Independent noisy left/right traces caused a notch at the temple. The
# reference is almost frontal, but not a calibrated symmetric scan.
# Average the visible sides, preserve the measured taper as a target,
# and regularize across adjoining stations. Hidden skull/neck inferred.
traceZ=np.linspace(-1.39,-.31,25)
def trace_width(P,z):
    k=np.argsort(P[:,1]);return float(np.interp(z,P[k,1],abs(P[k,0])))
traceW=np.array([(trace_width(left,z)+trace_width(right,z))*.5 for z in traceZ])
# Least-squares fit with a second-derivative penalty to suppress short
# contour kinks. Report the residual; do not force the observed chin
# silhouette into the posterior neck section.
D2=np.diff(np.eye(len(traceZ)),n=2,axis=0)
smoothW=np.linalg.solve(np.eye(len(traceZ))+18*(D2.T@D2),traceW)
# Use a few broad stations, blend the neck/temple rather than use
# closely spaced inconsistent extrema.
WZ=np.array([-2.03,-1.82,-1.65,-1.50,-1.34,-1.16,-.98,-.80,-.61,-.42,-.20,.10,.40,.70,.95,1.15,1.30,1.42,1.50,1.53])
WW=np.array([.50,.48,.47,.49,.56,*[float(np.interp(z,traceZ,smoothW)) for z in (-1.16,-.98,-.80,-.61,-.42)],.89,.92,.93,.91,.84,.74,.60,.42,.23,.065])
# Broad cheekbone envelope: bounded smooth slopes into the temples.
for k in range(3):
    WW[1:-1]=.72*WW[1:-1]+.14*(WW[:-2]+WW[2:])
def fitwidth(z,side):return smooth_interp(z,WZ,WW)
profiles=[]
for key,sgn in [('left',1),('right',-1)]:
    a=d['views'][key];P=np.array(a['profile'],float)[:25];e=np.array(a['eye'][0],float)
    sc=abs(np.mean(f['chin'][:,1])-mid[1])/ipd/max(abs(P[-1,1]-e[1]),1)
    Z=-(P[:,1]-e[1])*sc;Y=-.30+(P[:,0]-e[0])*sc*sgn
    profiles.append((Z,Y))
BZ=[-2.03,-1.83,-1.66,-1.50,-1.30,-1.10,-.85,-.60,-.35,0,.25,.48,.75,1.0,1.25,1.44,1.53]
BY=[.02,.02,-.13,-.38,-.49,-.50,-.51,-.52,-.53,-.54,-.57,-.54,-.45,-.33,-.16,.08,.25]
def baseline_depth(z):return smooth_interp(z,BZ,BY)
def center_depth(z):
    base=baseline_depth(z)
    if -1.58<z<.42:
        raw=float(np.mean([smooth_interp(z,a,b) for a,b in profiles]))
        t=float(sstep((z+1.58)/.16)*sstep((.42-z)/.17))
        # The reference nose and lip edges are not absolute depth; keep
        # projection close to measured profile without overlarge relief.
        return base+(raw-base)*t*.86
    return base
def back_depth(z):
    return smooth_interp(z,[-2.03,-1.83,-1.60,-1.30,-1.0,-.55,0,.5,.85,1.10,1.30,1.44,1.53],[.70,.69,.70,.81,.94,1.04,1.08,1.06,.98,.85,.67,.46,.29])
eyeCent={'L':np.array([-.5,-.16,0.]),'R':np.array([.5,-.16,0.])}
eyeR=np.array([.252,.230,.225])
def globe_surface(label,x,z):
    c=eyeCent[label];a=((x-c[0])/eyeR[0])**2+((z-c[2])/eyeR[2])**2
    return None if a>=1 else c[1]-eyeR[1]*math.sqrt(max(0,1-a))
def softmin(a,b,k):
    h=max(k-abs(a-b),0.)/k
    return min(a,b)-.25*k*h*h
def surf(u,z,front=True):
    w=fitwidth(z,-1 if u<0 else 1);x=u*w
    q=max(0.,1-u*u)**.50
    if front:
        base=baseline_depth(z);y=.24+(base-.24)*q
        width=smooth_interp(z,[-1.58,-1.35,-1.10,-.85,-.68,-.45,-.25,.0,.36],[.35,.35,.32,.28,.14,.15,.14,.16,.30])
        y+=(center_depth(z)-base)*math.exp(-((x/max(.08,width))**2))
        # Local nose wings use the traced alar breadth, not a horizontal
        # ridge. Shallow subalar grooves are geometry, not painted holes.
        alar=float(np.ptp(px(f['noseAlar'])[:,0])*.5)
        y-=.063*math.exp(-((abs(x)-alar*.69)/.075)**2-((z+.62)/.095)**2)
        y+=.022*math.exp(-((abs(x)-alar*.50)/.045)**2-((z+.70)/.038)**2)
        y-=.040*math.exp(-((abs(x)-.56)/.25)**2-((z+.39)/.32)**2)
        y+=.033*math.exp(-((abs(x)-.50)/.23)**2-((z-.04)/.17)**2)
        # Enclose the entire globe except the explicitly meshed lid hole.
        # A larger smooth support volume eliminates the lateral scleral
        # breakthrough visible in v2.
        for lab,c in eyeCent.items():
            a=((x-c[0])/(eyeR[0]*1.13))**2+((z-c[2])/(eyeR[2]*1.13))**2
            if a<1:
                shell=c[1]-(eyeR[1]+.025)*math.sqrt(max(0,1-a))-.012
                blend=float(sstep((1-a)/.15))
                y=(1-blend)*y+blend*softmin(y,shell,.035)
    else:y=.24+(back_depth(z)-.24)*q
    return (x,y,z)
# New structured topology: front and rear grids, sharing side boundary.
# Three deliberate openings for the actual eyelid and lip loop topology.
U=np.linspace(-1,1,121);Z=np.linspace(-2.03,1.53,181)
def closest(arr,x):return int(np.argmin(abs(arr-x)))
spec=[]
for lab in ('L','R'):
    up=px(f['eye'+lab+'Upper']);lo=px(f['eye'+lab+'Lower'])
    x0,x1=up[0,0],up[-1,0];z0,z1=min(lo[:,1])-.075,max(up[:,1])+.075
    w=fitwidth(0,-1 if lab=='L' else 1)
    a=closest(U,(x0-.075)/w);b=closest(U,(x1+.075)/w)
    spec.append({'id':'eye_'+lab,'lab':lab,'x0':a,'x1':b,'z0':closest(Z,z0),'z1':closest(Z,z1),'upper':up,'lower':lo})
up=px(f['lipTop']);lo=px(f['lipBottom']);seam=px(f['lipSeam'])
# Mouth outer box is larger than the measured vermilion outline.
wm=fitwidth(-1.04,1)
spec.append({'id':'mouth','x0':closest(U,(seam[0,0]-.10)/wm),'x1':closest(U,(seam[-1,0]+.10)/wm),'z0':closest(Z,min(lo[:,1])-.09),'z1':closest(Z,max(up[:,1])+.09),'upper':up,'lower':lo,'seam':seam})
V=[];F=[];MI=[];grid={}
def add(p):V.append(tuple(p));return len(V)-1
def face(p,m=0):
    if len(set(p))>=3:F.append(tuple(p));MI.append(m)
for front in (True,False):
    for j,z in enumerate(Z):
        for i,u in enumerate(U):
            if not front and i in (0,len(U)-1):grid[front,i,j]=grid[True,i,j]
            else:grid[front,i,j]=add(surf(float(u),float(z),front))
for front in (True,False):
    for j in range(len(Z)-1):
        for i in range(len(U)-1):
            if front and any(s['x0']<=i<s['x1'] and s['z0']<=j<s['z1'] for s in spec):continue
            q=(grid[front,i,j],grid[front,i+1,j],grid[front,i+1,j+1],grid[front,i,j+1])
            face(q if front else q[::-1])
for j in (0,len(Z)-1):
    q=[grid[True,i,j] for i in range(len(U))]+[grid[False,i,j] for i in range(len(U)-2,0,-1)]
    # fan cap; temporary closed neck until actual body seam integration.
    c=add(np.mean([V[k] for k in q],axis=0))
    for i,k in enumerate(q):face((c,k,q[(i+1)%len(q)]))
def ring_bridge(a,b,m=0):
    for i,k in enumerate(a):face((k,a[(i+1)%len(a)],b[(i+1)%len(b)],b[i]),m if isinstance(m,int) else m[i])
def rect(s):
    a,b,c,e=(s[k] for k in ('x0','x1','z0','z1'))
    return [(i,c) for i in range(a,b)]+[(b,j) for j in range(c,e)]+[(i,e) for i in range(b,a,-1)]+[(a,j) for j in range(e,c,-1)]
def curve_on(s,frac,top,key=None):
    arr=s[key] if key else s['upper' if top else 'lower']
    x=s['upper'][0,0]+frac*(s['upper'][-1,0]-s['upper'][0,0])
    return x,float(np.interp(x,arr[:,0],arr[:,1]))
mouthVertices={};eyeRims={};boundaryReport=[]
for s in spec:
    coords=rect(s);outer=[grid[True,i,j] for i,j in coords]
    a,b,c,e=(s[k] for k in ('x0','x1','z0','z1'))
    # Map rectangular border to reference loops with monotone angular
    # ordering. This creates newly authored quad rings, not a painted eye.
    params=[]
    for i,j in coords:
        qx=2*(i-a)/max(b-a,1)-1;qz=2*(j-c)/max(e-c,1)-1
        th=math.atan2(qz,qx);params.append(((math.cos(th)+1)*.5,math.sin(th)>=0))
    target=[]
    for frac,top in params:
        x,z=curve_on(s,frac,top)
        if s['id']=='mouth':
            y=surf(x/max(fitwidth(z,-1 if x<0 else 1),.1),z)[1]-.012*math.sin(math.pi*frac)
        else:
            g=globe_surface(s['lab'],x,z);y=g-.014 if g is not None else surf(x/max(fitwidth(z,-1 if x<0 else 1),.1),z)[1]
        target.append(np.array([x,y,z]))
    previous=outer
    for t in (.18,.36,.56,.76,.91,1.):
        ring=[]
        for k,p in zip(outer,target):
            outerP=np.array(V[k]);xz=(1-t)*outerP+t*p
            u=float(np.clip(xz[0]/max(fitwidth(xz[2],-1 if xz[0]<0 else 1),.05),-.999,.999))
            yy=surf(u,xz[2])[1]
            ublend=float(sstep((t-.20)/.80))
            xz[1]=(1-ublend)*yy+ublend*xz[1]
            ring.append(add(xz))
        ring_bridge(previous,ring);previous=ring
    if s['id']=='mouth':
        lipOuter=previous;inner=[]
        for frac,top in params:
            x,z=curve_on(s,frac,top,'seam')
            # minute neutral opening, with real oral depth.
            z+=(.006 if top else -.006)*max(.04,math.sin(math.pi*frac))
            y=surf(x/max(fitwidth(z,-1 if x<0 else 1),.1),z)[1]-.028*math.sin(math.pi*frac)
            inner.append(add((x,y,z)))
        for k,(_,top) in enumerate(params):mouthVertices[inner[k]]=top
        mids=[add(.48*np.array(V[i])+.52*np.array(V[j])+np.array([0,-.020*math.sin(math.pi*fr),0])) for i,j,(fr,_) in zip(lipOuter,inner,params)]
        m=[1 if top else 2 for _,top in params]
        ring_bridge(lipOuter,mids,m);ring_bridge(mids,inner,m)
        cavity=[add(np.array(V[k])+np.array([0,.13,0])) for k in inner]
        ring_bridge(inner,cavity,3)
        cp=add(np.mean([V[k] for k in cavity],axis=0)+[0,.035,0])
        for j,k in enumerate(cavity):face((k,cavity[(j+1)%len(cavity)],cp),3)
    else:
        eyeRims[s['lab']]=[V[k] for k in previous]
    boundaryReport.append({'id':s['id'],'boundaryVertices':len(outer),'targetXZ_ipd':[p[[0,2]].tolist() for p in target],'referenceUpper_ipd':s['upper'].tolist(),'referenceLower_ipd':s['lower'].tolist()})
# Remove unused hole interior vertices before exporting.
used=sorted(set(i for p in F for i in p));remap={k:i for i,k in enumerate(used)}
head=object_mesh('R54_NewMeasuredHead',[V[i] for i in used],[tuple(remap[k] for k in q) for q in F],[skin,upperlip,lowerlip,lining],MI)
# Independent initial jaw shape key: hinge is an estimated external design
# anchor. Not certified anatomical motion, no inherited morph transfer.
head.shape_key_add(name='Basis');jaw=head.shape_key_add(name='jawOpen_candidate')
for i,k in enumerate(used):
    x,y,z=np.array(V[k]);w=float(sstep((-z-.98)/.28))*float(sstep((z+2.03)/.22))*float(sstep((.80-y)/.6))
    ang=.19*w;dy=y-.58;dz=z+.92
    jaw.data[i].co=Vector((x,.58+dy*math.cos(ang)-dz*math.sin(ang),-.92+dy*math.sin(ang)+dz*math.cos(ang)))*UNIT
jaw.value=0
# Independent ocular meshes, visible iris on the curved scleral surface.
for label,c in eyeCent.items():
    bpy.ops.mesh.primitive_uv_sphere_add(segments=64,ring_count=32,location=Vector(c)*UNIT)
    o=bpy.context.object;o.name='R54_Eyeball_'+label;o.scale=Vector(eyeR)*UNIT
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(sclera)
    for p in o.data.polygons:p.use_smooth=True
    r=float(np.ptp(px(f['iris'+label])[:,0])/2)
    iv=[(c[0],c[1]-eyeR[1]-.004,c[2])];iff=[];imi=[]
    n=96
    for j in range(1,17):
        rr=r*j/16
        for k in range(n):
            a=2*math.pi*k/n;x=c[0]+rr*math.cos(a);z=c[2]+rr*math.sin(a)
            g=globe_surface(label,x,z);iv.append((x,g-.004 if g is not None else c[1]-.1,z))
    for k in range(n):iff.append((0,1+k,1+(k+1)%n));imi.append(0)
    for j in range(15):
        for k in range(n):
            a=1+j*n+k;b=1+j*n+(k+1)%n;iff.append((a,b,b+n,a+n))
            imi.append(0 if j<4 else (6 if j>=13 else 1+(k*13+j*3)%5))
    object_mesh('R54_Iris_'+label,iv,iff,[pupil]+irisM,imi)
def tube(name,points,r0,material):
    V0=[];F0=[];n=6
    for j,p in enumerate(points):
        t=j/max(1,len(points)-1);P=Vector(p);axis=Vector(points[min(j+1,len(points)-1)])-Vector(points[max(j-1,0)])
        if axis.length<1e-8:axis=Vector((0,0,1))
        axis.normalize();base=axis.cross(Vector((0,1,0)))
        if base.length<1e-7:base=axis.cross(Vector((1,0,0)))
        base.normalize();other=axis.cross(base).normalized()
        r=r0*(1-.95*t)
        for k in range(n):V0.append(tuple(P+r*(math.cos(2*math.pi*k/n)*base+math.sin(2*math.pi*k/n)*other)))
    for j in range(len(points)-1):
        for k in range(n):a=j*n+k;b=j*n+(k+1)%n;F0.append((a,b,b+n,a+n))
    return V0,F0
def merge_tubes(name,paths,material):
    v=[];faces=[]
    for p,r in paths:
        a,b=tube(name,p,r,material);base=len(v);v+=a;faces.extend(tuple(base+i for i in q) for q in b)
    return object_mesh(name,v,faces,[material])
# Exact reference-derived strand vectors in projected view; curl depth is
# inferred. Roots are sampled on the new lid rim or new forehead.
for s in spec[:2]:
    lab=s['lab'];paths=[]
    for top in (True,False):
        prefix=('lash' if top else 'lowerLash')+lab
        roots=px(f[prefix+'Roots']);tips=px(f[prefix+'Tips']);delta=tips-roots
        order=np.argsort(roots[:,0]);roots=roots[order];delta=delta[order]
        for frac in np.linspace(.035,.965,43 if top else 25):
            x,z=curve_on(s,float(frac),top);y=globe_surface(lab,x,z)
            if y is None:continue
            dx,dz=[float(np.interp(x,roots[:,0],delta[:,k])) for k in range(2)]
            dz=(1 if top else -1)*max(abs(dz),.008)
            P=[(x+dx*t,y-.014-.034*(1.5*t-.5*t*t),z+dz*(.55*t+.45*t*t)) for t in np.linspace(0,1,8)]
            paths.append((P,.0022 if top else .00145))
    merge_tubes('R54_Lashes_'+lab,paths,lashmat)
    bu=px(f['brow'+lab+'Top']);bl=px(f['brow'+lab+'Bottom']);paths=[]
    bu=bu[np.argsort(bu[:,0])];bl=bl[np.argsort(bl[:,0])]
    for frac in np.linspace(.025,.975,42):
        x=bu[0,0]+frac*(bu[-1,0]-bu[0,0]);zu=float(np.interp(x,bu[:,0],bu[:,1]));zl=float(np.interp(x,bl[:,0],bl[:,1]))
        for v in (.15,.45,.75):
            z=zl+v*(zu-zl);dx=.027*(-1 if lab=='L' else 1)
            path=[]
            for t in np.linspace(0,1,5):
                X=x+dx*t;zz=z+.035*t*(1-frac*.60);u=X/max(fitwidth(zz,-1 if X<0 else 1),.1)
                path.append((X,surf(float(np.clip(u,-.99,.99)),zz)[1]-.008,zz))
            paths.append((path,.0023))
    merge_tubes('R54_Brows_'+lab,paths,browmat)
# Export candidate without old head geometry or armor.
objects=[o for o in bpy.context.scene.objects if o.type=='MESH']
bpy.ops.object.select_all(action='DESELECT')
for ob in objects:ob.select_set(True)
bpy.context.view_layer.objects.active=head
bpy.ops.export_scene.gltf(filepath=str(out/'R54_new_head.glb'),export_format='GLB',use_selection=True,export_morph=True)
# Studio lights and camera with fixed settings; no post-render brightening.
scene=bpy.context.scene
try:scene.render.engine='BLENDER_EEVEE_NEXT'
except Exception:scene.render.engine='BLENDER_EEVEE'
scene.world=bpy.data.worlds.new('NeutralStudio');scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.28,.28,.28,1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value=.48
focus=Vector((0,.008,-.018))
for name,p,power,sz in [('Key',(-.28,-.46,.36),14,.40),('Fill',(.31,-.39,.12),7,.38),('Rim',(.10,.29,.29),10,.34)]:
    l=bpy.data.lights.new(name,'AREA');l.energy=power;l.shape='DISK';l.size=sz
    o=bpy.data.objects.new(name,l);scene.collection.objects.link(o);o.location=p;o.rotation_euler=(focus-o.location).to_track_quat('-Z','Y').to_euler()
cam=bpy.data.cameras.new('ReviewCamera');cam.type='ORTHO';cam.ortho_scale=.255
o=bpy.data.objects.new('ReviewCamera',cam);scene.collection.objects.link(o);scene.camera=o
scene.render.resolution_x=840;scene.render.resolution_y=840;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='JPEG';scene.render.image_settings.quality=95
def render(name,axis):
    o.location=focus+Vector(axis).normalized()*.72;o.rotation_euler=(focus-o.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath=str(out/(name+'.jpg'));bpy.ops.render.render(write_still=True)
for tag,axis in [('front',(0,-1,0)),('left',(-1,0,0)),('right',(1,0,0)),('threequarter',(.66,-1,.03)),('rear',(0,1,0))]:render(tag,axis)
jaw.value=1;render('jaw_open_experimental',(0,-1,0));jaw.value=0
bpy.ops.wm.save_as_mainfile(filepath=str(out/'R54_new_head.blend'))
report={'id':'R54-new-head-v3','method':'independently constructed front/back grids and explicit eye/lip boundary rings; zero imported head vertices','referenceSHA256':d['sourceSHA256'],'inputPoints':d['pointCount'],'nineViewPoints':nine['pointsCount'],'foundationRevision':'regularized paired contour envelope, coherent cheek-temple shape, deeper seated eyes, widened neck support and localized alar geometry','visibleWidthFitRms_ipd':float(np.sqrt(np.mean((np.array([fitwidth(z,1) for z in traceZ])-traceW)**2))),'widthStationZ_ipd':WZ.tolist(),'widthStationHalf_ipd':WW.tolist(),'actualUsed':['front cheek/jaw traces','bilateral sagittal profile','front eyelid contours','iris diameter','lip top/seam/bottom','brow contours','lash vectors'],'designIPD_m':UNIT,'headVertices':len(head.data.vertices),'headFaces':len(head.data.polygons),'parts':[ob.name for ob in objects],'boundaries':boundaryReport,'materialStatus':'reference-inspired estimates, not verified albedo','newTopology':True,'priorHeadUsed':False,'visualApproved':False,'productionApproved':False,'limitations':['upper cranium and posterior head inferred from occluded reference','ears not yet built','mouth cavity provisional; teeth/tongue missing','jaw motion experimental, no blink or full facial morphs','no body rig or neck seam integration yet','nine-view image is synthetic and not calibrated; fit not independently verified'],'next':'visual review, then reconstruct ears, eye/lip deformations, neck interface and skin weights; no automatic adoption'}
(out/'report.json').write_text(json.dumps(report,indent=2))
print('New head candidate generated',report['headVertices'],report['headFaces'])
