"""Independent R54 measured head prototype. No imported head geometry.
All dimensions normalized by a design IPD; hidden skull/ear depths inferred.
This is a new topology candidate, not an approved animation-ready asset.
"""
import bpy, numpy as np, math, json, sys
from pathlib import Path
from mathutils import Vector
from mathutils import Matrix
import bmesh
from functools import lru_cache
args=sys.argv[sys.argv.index('--')+1:]
out=Path(args[0]).resolve();out.mkdir(parents=True,exist_ok=True)
d=json.loads(Path('data/r53-female-detail-landmarks.json').read_text())
nine=json.loads(Path('data/r53-female-nine-view-design.json').read_text())
f={k:np.array(v,float) for k,v in d['views']['front'].items()}
mid=(f['irisL'][0]+f['irisR'][0])/2
ipd=float(np.linalg.norm(f['irisR'][0]-f['irisL'][0]))
contract=json.loads(Path('data/r54-dimensional-constraints.json').read_text())
assert contract['referenceSHA256']==d['sourceSHA256']
UNIT=contract['unit']['designIPD_mm']/1000 # design scale, not measured physical size
def px(P):return np.column_stack(((P[:,0]-mid[0])/ipd,(mid[1]-P[:,1])/ipd))
# v12 candidate uses the user-selected bald reference for visible
# face geometry, instead of mixing incompatible frontal feature ratios.
# Retain the original 350-point ledger on disk and copy its constraints
# for groups not visible in the bald sheet (e.g. individual lashes).
import copy
originalContract=copy.deepcopy(contract)
baldFace=json.loads(Path('data/r54-bald-face-landmarks.json').read_text())
assert baldFace['referenceSHA256']==json.loads(Path('data/r54-bald-reference-scaffold.json').read_text())['referenceSHA256']
for k,g in baldFace['front']['groups'].items():
    a=np.asarray(g['xz_ipd'],float)
    # Keep all legacy consumers on their original pixel coordinate frame.
    f[k]=np.column_stack([mid[0]+a[:,0]*ipd,mid[1]-a[:,1]*ipd])
    contract['front'][k]={'xz_ipd':a.tolist(),'source':'bald-face-landmarks-v1','originalPixel':g['originalPixel']}
contract['unit']['frontChinZ_ipd']=float(np.mean(np.asarray(baldFace['front']['groups']['chin']['xz_ipd'])[:,1]))
# One observed profile, mirrored as an explicit inference for the other
# side; no false claim of a second independently observed profile.
for lab in ('left','right'):
    for k,g in baldFace['side']['groups'].items():
        if k in contract['side'][lab]['groups']:
            contract['side'][lab]['groups'][k]['yzRelativeEye_ipd']=g['yzRelativeEye_ipd']
            contract['side'][lab]['groups'][k]['source']='observed profile' if lab=='left' else 'mirrored observed profile, inferred'
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
skin=mat('Skin_reference_estimate',[207,163,151],.49,.075)
upperlip=mat('Upper_vermilion',[164,96,87],.49,.045)
lowerlip=mat('Lower_vermilion',[190,119,109],.43,.055)
lining=mat('Oral_lining',[76,32,35],.58)
enamel=mat('Tooth_enamel',[229,220,199],.29,.035)
gum=mat('Gingiva',[151,77,75],.46,.06)
tongueMat=mat('Tongue',[157,77,82],.47,.07)
lidUpper=mat('Upper_lid_margin',[92,60,55],.49)
lidLower=mat('Lower_lid_margin',[182,124,115],.49)
lashmat=mat('Lash',[35,24,20],.57)
browmat=mat('Brow',[77,53,41],.68)
sclera=mat('Sclera',[232,224,219],.25,.03)
pupil=mat('Pupil',[15,20,27],.20)
irisM=[mat('Iris_%02d'%i,c,.24) for i,c in enumerate(([48,61,81],[69,94,125],[100,126,153],[59,83,113],[116,137,151],[34,47,68]))]
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
left=np.vstack([contract['front'][k]['xz_ipd'] for k in ('cheekL','jawL')])
right=np.vstack([contract['front'][k]['xz_ipd'] for k in ('cheekR','jawR')])
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
traceZ=np.linspace(-1.51,-.31,29)
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
# Head-only envelope. Do not make the chin into a neck cross section.
# The true neck interface and rig will be constructed after face approval.
chinZ=float(contract['unit']['frontChinZ_ipd'])
WZ=np.array([chinZ-.025,chinZ+.020,chinZ+.070,-1.51,-1.42,-1.34,-1.16,-.98,-.80,-.61,-.42,-.20,.10,.40,.70,.95,1.15,1.30,1.42,1.50,1.53])
WW=np.array([.095,.145,.225,*[float(np.interp(z,traceZ,smoothW)) for z in (-1.51,-1.42,-1.34,-1.16,-.98,-.80,-.61,-.42)],.89,.92,.93,.91,.84,.74,.60,.42,.23,.065])
assert len(WZ)==len(WW)
# Supplemental bald profile resolves the hair-obscured cranial envelope.
bald=json.loads(Path('data/r54-bald-reference-scaffold.json').read_text())
# Re-extracted silhouette from original reference pixels. Previous
# hand trace incorrectly treated the top of the head as a broad cylinder.
pixelSil=json.loads(Path('data/r54-bald-pixel-silhouette.json').read_text())
assert pixelSil['referenceSHA256']==bald['referenceSHA256']
baldFront=np.asarray(pixelSil['front']['outerXZ_ipd'])
baldAnt=np.asarray(pixelSil['profile']['anteriorYZ_ipd'])
baldPost=np.asarray(pixelSil['profile']['posteriorYZ_ipd'])
apexZ=float(pixelSil['inferred']['crownApexZIpd'])
apexY=float(pixelSil['inferred']['crownApexDepthIpd'])
def traced_half_width(z):
    vals=[]
    for mask in (baldFront[:,0]<0,baldFront[:,0]>0):
        pp=baldFront[mask];j=np.argsort(pp[:,1])
        vals.append(abs(smooth_interp(z,pp[j,1],pp[j,0])))
    return float(np.mean(vals))
# All measured upper head stations, with regularization to suppress
# pixel-scale noise. Blend from the original lower facial constraints.
keep=WZ<-.44
sz=np.unique(baldFront[:,1]);sz.sort()
znew=np.r_[[-.44,-.36,-.28,-.20,-.12,-.04,.04,.12],sz,apexZ-.045,apexZ-.015,apexZ]
znew=np.unique(znew);znew=znew[znew>=-.44]
widths=[]
for z in znew:
    if z>sz[-1]:
        # Radius of a rounded cap has sqrt(distance-to-pole) behavior.
        v=traced_half_width(sz[-1])*math.sqrt(max(.00003,(apexZ-z)/(apexZ-sz[-1])))
    else:
        # No fixed .89-IPD temple station: join the observed lower
        # face directly to the observed scalp above the ear.
        t=float(sstep((z+.44)/.54))
        cheekWidth=(trace_width(left,z)+trace_width(right,z))*.5
        v=(1-t)*cheekWidth+t*traced_half_width(z)
    widths.append(max(.009,v))
WZ=np.r_[WZ[keep],znew];WW=np.r_[WW[keep],widths]
# Chin cap closes into a small rounded pole, not a flat underside disk.
chinTrace=np.asarray(contract['front']['chin']['xz_ipd'])
chinHalf=float(np.ptp(chinTrace[:,0])*.5)
WW[0]=.008;WW[1]=max(.045,chinHalf*.52);WW[2]=max(.09,chinHalf*.83)
for k in range(3):
    avg=WW.copy();avg[1:-1]=.72*WW[1:-1]+.14*(WW[:-2]+WW[2:])
    mask=(WZ>-.55)&(WZ<sz[-1]-.04);WW[mask]=avg[mask]
assert len(WZ)==len(WW)
# Regularize the sampled continuous section curves before meshing.
def regularized_table(X,Y,sigma):
    X=np.asarray(X,float);Y=np.asarray(Y,float)
    z=np.linspace(X.min(),X.max(),max(200,int((X.max()-X.min())/.008)+1))
    raw=np.array([smooth_interp(t,X,Y) for t in z])
    step=z[1]-z[0];r=max(2,int(4*sigma/step))
    k=np.exp(-.5*(np.arange(-r,r+1)*step/sigma)**2);k/=k.sum()
    sm=np.convolve(np.pad(raw,r,mode='edge'),k,mode='valid')
    w=sstep((z-z[0])/(2.4*sigma))*sstep((z[-1]-z)/(2.4*sigma))
    return z,raw+(sm-raw)*w,raw
widthTable=None
def reset_width_table():
    global widthTable
    widthTable=regularized_table(WZ,WW,.105)
    fitwidth.cache_clear()
@lru_cache(maxsize=65536)
def fitwidth(z,side):return float(np.interp(z,widthTable[0],widthTable[1]))
reset_width_table()
profiles=[]
for key in ('left','right'):
    p=np.array(contract['side'][key]['groups']['profile']['yzRelativeEye_ipd'],float)[:25]
    profiles.append((p[:,1],p[:,0]+contract['side'][key]['eyeAnteriorDesignYIpd']))
BZ=[-1.665,-1.63,-1.57,-1.50,-1.30,-1.10,-.85,-.60,-.35,0,.25,.48,.75,1.0,1.25,1.44,1.53]
BY=[-.43,-.47,-.51,-.52,-.49,-.50,-.51,-.52,-.53,-.54,-.57,-.54,-.45,-.33,-.16,.08,.25]
# Single C1 profile through the forehead/temple stations, rather than
# stitching a piecewise-linear profile at z=.43 and 1.49. Reference
# upper forehead observations are interpolated; apex closure inferred.
antP=baldAnt[np.argsort(baldAnt[:,1])]
postP=baldPost[np.argsort(baldPost[:,1])]
def obs_depth(P,z):return smooth_interp(z,P[:,1],P[:,0])
# Single C1 station curve. Preserve lower facial profile and use
# original pixel-sampled upper forehead rather than a hand-picked cap.
az=np.linspace(.30,min(antP[-1,1],apexZ-.05),23)
az=np.r_[az,apexZ-.025,apexZ]
ay=[]
for z in az:
    if z>antP[-1,1]:
        k=math.sqrt(max(0.,(apexZ-z)/(apexZ-antP[-1,1])))
        val=apexY+(antP[-1,0]-apexY)*k
    else:val=obs_depth(antP,z)
    t=float(sstep((z-.28)/.32))
    ay.append((1-t)*(-.57)+t*val)
AZ=np.r_[[-1.65,-1.59,-1.53,-1.45,-1.30,-1.10,-.85,-.60,-.35,-.16,.04,.24],az]
AY=np.r_[[-.44,-.47,-.49,-.51,-.49,-.50,-.51,-.52,-.53,-.54,-.57,-.57],ay]
pz=np.linspace(-.91,min(postP[-1,1],apexZ-.05),38)
pz=np.r_[pz,apexZ-.025,apexZ]
py=[]
for z in pz:
    if z>postP[-1,1]:
        k=math.sqrt(max(0.,(apexZ-z)/(apexZ-postP[-1,1])))
        val=apexY+(postP[-1,0]-apexY)*k
    else:val=obs_depth(postP,z)
    py.append(val)
PZ=np.r_[[WZ[0],-1.57,-1.48,-1.37,-1.25,-1.12],pz]
PY=np.r_[[-.43,-.24,.05,.46,.93,1.40],py]
# Suppress isolated color segmentation noise; endpoints are pinned.
for _ in range(3):
    AY[13:-1]=.64*AY[13:-1]+.18*(AY[12:-2]+AY[14:])
    PY[7:-1]=.68*PY[7:-1]+.16*(PY[6:-2]+PY[8:])
antTable=regularized_table(AZ,AY,.13)
postTable=regularized_table(PZ,PY,.15)
@lru_cache(maxsize=65536)
def baseline_depth(z):return float(np.interp(z,antTable[0],antTable[1]))
@lru_cache(maxsize=65536)
def center_depth(z):
    base=baseline_depth(z)
    if -1.65<z<.28:
        raw=float(np.mean([smooth_interp(z,a,b) for a,b in profiles]))
        t=float(sstep((z+1.65)/.14)*sstep((.28-z)/.22))
        return base+(raw-base)*t*.95
    return base
@lru_cache(maxsize=65536)
def back_depth(z):return float(np.interp(z,postTable[0],postTable[1]))
eyeCent={'L':np.array([-.5,-.16,0.]),'R':np.array([.5,-.16,0.])}
eyeRequired=max(abs(p[0]-eyeCent[lab][0]) for lab in ('L','R') for group in ('Upper','Lower') for p in px(f['eye'+lab+group]))
eyeR=np.array([max(.252,eyeRequired+.018),.192,.215])
for c0 in eyeCent.values():c0[1]=-.198 # unchanged anterior apex, reduced side bulge
def globe_surface(label,x,z):
    c=eyeCent[label];a=((x-c[0])/eyeR[0])**2+((z-c[2])/eyeR[2])**2
    return None if a>=1 else c[1]-eyeR[1]*math.sqrt(max(0,1-a))
def softmin(a,b,k):
    h=max(k-abs(a-b),0.)/k
    return min(a,b)-.25*k*h*h
eyeTrace={lab:px(f['eye'+lab+'Upper']) for lab in ('L','R')}
alarCurve=px(f['noseAlar']);noseCurve=px(f['nose']);philCurve=px(f['philtrum'])
alarHalf=float(np.ptp(alarCurve[:,0])*.5);noseMid=float(np.mean(noseCurve[:,0]))
alarZ=float(np.mean([alarCurve[0,1],alarCurve[-1,1]]))
nostrilZ=float(np.mean(alarCurve[[2,6],1]));philMid=float(np.mean(philCurve[:,0]));philZ=float(np.mean(philCurve[:,1]))
# Observed bilateral alar outline, inferred nostril depth and orientation.
alarAnchors=[alarCurve[1:4],alarCurve[5:8]]
alarCenters=[np.mean(p,axis=0) for p in alarAnchors]
nostrilCenters=[alarCurve[2]*.65+alarCurve[3]*.35,alarCurve[6]*.65+alarCurve[5]*.35]
philTop=float(philCurve[:,1].max());philBottom=float(philCurve[:,1].min())
@lru_cache(maxsize=65536)
def local_feature_width(z):return smooth_interp(z,[-1.65,-1.35,-1.10,-.85,-.68,-.57,-.45,-.25,.0,.42],[.35,.35,.32,.27,.13,.145,.112,.105,.125,.30])
def surf(u,z,front=True):
    w=fitwidth(z,-1 if u<0 else 1);x=u*w
    q=max(0.,1-u*u)**.50
    sidePlane=(baseline_depth(z)+back_depth(z))*.5
    if front:
        base=baseline_depth(z);y=sidePlane+(base-sidePlane)*q
        y-=.10*(u*u)*(q*q)*math.exp(-((z+.42)/.72)**2)
        width=local_feature_width(z)
        featureX=x-noseMid*float(sstep((z+.82)/.22)*sstep((.20-z)/.26))
        y+=(center_depth(z)-base)*math.exp(-((featureX/max(.08,width))**2))
        # Local nose wings use the traced alar breadth, not a horizontal
        # ridge. Shallow subalar grooves are geometry, not painted holes.
        alar=alarHalf
        # Projected alar and philtrum anchors measured; relief is inferred.
        nx=x-noseMid;ax=abs(nx)
        # Each wing follows its own observed x/z anchor. Rounded relief
        # is a geometric estimate, not a measured cavity or painted hole.
        for ac,nc in zip(alarCenters,nostrilCenters):
            y-=.052*math.exp(-((x-ac[0])/(alar*.36))**2-((z-ac[1]-.025)/.085)**2)
            # Infer a downward-facing recess; keep its frontal height small.
            dx=x-nc[0];dz=z-nc[1]+.012
            y+=.048*math.exp(-(dx/(alar*.23))**2-((dz+.12*abs(dx))/.032)**2)
        # The measured profile already supplies tip projection. Avoid
        # adding a second excessive tip on top of that silhouette.
        y-=.012*math.exp(-(nx/.072)**2-((z-(nostrilZ+.066))/.069)**2)
        y-=.013*math.exp(-(nx/.038)**2-((z-nostrilZ)/.063)**2)
        # The philtrum tapers into the measured Cupid's bow and nose base.
        t=float(np.clip((philTop-z)/max(.001,philTop-philBottom),0.,1.))
        paxis=float(smooth_interp(z,philCurve[:,1],philCurve[:,0]))
        ph=x-paxis;fade=math.sin(math.pi*t)**1.4
        ridgeWidth=.033+.024*t
        y+=.017*fade*math.exp(-(ph/(.029+.010*t))**2)
        y-=.011*fade*math.exp(-((abs(ph)-ridgeWidth)/.022)**2)
        # Broad cheekbone relief, smooth lower orbital transition.
        y-=.032*math.exp(-((abs(x)-.54)/.38)**2-((z+.39)/.48)**2)
        y+=.006*math.exp(-((abs(x)-.70)/.25)**2-((z+.81)/.38)**2)
        y+=.012*math.exp(-((abs(x)-.50)/.36)**2-((z-.04)/.32)**2)
        # Upper lid fold above the measured contour, attenuated at canthi.
        for lab,P in eyeTrace.items():
            if P[0,0]<x<P[-1,0]:
                fr=(x-P[0,0])/(P[-1,0]-P[0,0]);upper=float(np.interp(x,P[:,0],P[:,1]))
                y+=.018*math.sin(math.pi*fr)*math.exp(-((z-upper-.070)/.039)**2)
        # Enclose the entire globe except the explicitly meshed lid hole.
        # A larger smooth support volume eliminates the lateral scleral
        # breakthrough visible in v2.
        for lab,c in eyeCent.items():
            a=((x-c[0])/eyeR[0])**2+((z-c[2])/eyeR[2])**2
            # The globe requires clearance only near its actual volume.
            # A broad Gaussian support blends the eyelid into the orbit.
            rad=math.sqrt(a)
            if rad<1.22:
                shell=c[1]-(eyeR[1]+.010)*math.sqrt(max(0,1-(rad/1.04)**2))-.009
                weight=float(sstep((1.22-rad)/.35))
                y=(1-weight)*y+weight*softmin(y,shell,.025)
    else:y=sidePlane+(back_depth(z)-sidePlane)*q
    # Lift the posterior underside to follow a distinct mandibular line.
    # Shared front/rear side vertices have identical displacement.
    lift=.35*float(sstep((-z-1.02)/.60))*float(sstep((y+.28)/1.05))
    # Rounded inferior chin, lifting lateral vertices instead of a flat cap.
    lift+=.068*float(sstep((-z-1.42)/.22))*abs(u)**2
    return (x,y,z+lift)
# New structured topology: front and rear grids, sharing side boundary.
# Three deliberate openings for the actual eyelid and lip loop topology.
U=np.sin(np.linspace(-math.pi/2,math.pi/2,161));Z=np.linspace(WZ[0],apexZ,241)
# Fit the actual provisional surface projection, not only the generator
# parameters. Lower-jaw lifting changes the projected widths.
fitRows=np.linspace(-1.50,-.32,25)
fitTarget=np.array([trace_width(left,z)+trace_width(right,z) for z in fitRows])
fitHistory=[]
def projected_widths():
    ZZ=np.linspace(WZ[0],-.18,120);UU=np.linspace(-1,1,41)
    A=np.array([[surf(float(u),float(z),front) for z in ZZ] for front in (True,False) for u in UU])
    p=A[:,:-1,:].reshape(-1,3);q=A[:,1:,:].reshape(-1,3)
    widths=[]
    for z in fitRows:
        u=p[:,2]-z;v=q[:,2]-z;k=(u*v<0)
        P=p[k]+(q[k]-p[k])*(u[k]/(u[k]-v[k]))[:,None]
        widths.append(float(np.ptp(P[:,0])) if len(P) else np.nan)
    return np.array(widths)
def score_width(v):
    return float(np.sqrt(np.mean((v-fitTarget)**2))) if np.isfinite(v).all() else 1e3
current=projected_widths();initialWidth=current.copy();currentScore=score_width(current)
for iteration in range(5):
    old=WW.copy();change=np.interp(WZ,fitRows,(fitTarget-current)*.5,left=0.,right=0.)
    change=np.clip(change,-.10,.10)
    change[WZ<-1.55]=0.;change*=sstep((-.24-WZ)/.30)
    best=(currentScore,old,current)
    for strength in (.35,.65,1.):
        WW[:]=np.clip(old+strength*change,.009,1.20);reset_width_table()
        actual=projected_widths();e=score_width(actual)
        fitHistory.append({'iteration':iteration+1,'strength':strength,'rmsIpd':e})
        if e<best[0]-1e-6:best=(e,WW.copy(),actual)
    WW[:]=best[1];reset_width_table()
    if best[0]>=currentScore-1e-6:break
    currentScore,current=best[0],best[2]
    if currentScore<contract['policy']['projectedToleranceIpd']:break

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
    # Concentric closing rings reduce long thin fan faces.
    center=np.mean([V[k] for k in q],axis=0)
    prev=q
    for frac in (.70,.38,.12):
        rr=[add(center+frac*(np.asarray(V[k])-center)) for k in q]
        for i,k in enumerate(prev):face((k,prev[(i+1)%len(prev)],rr[(i+1)%len(rr)],rr[i]))
        prev=rr
    c=add(center)
    for i,k in enumerate(prev):face((c,k,prev[(i+1)%len(prev)]))
def ring_bridge(a,b,m=0):
    for i,k in enumerate(a):face((k,a[(i+1)%len(a)],b[(i+1)%len(b)],b[i]),m if isinstance(m,int) else m[i])
def rect(s):
    a,b,c,e=(s[k] for k in ('x0','x1','z0','z1'))
    return [(i,c) for i in range(a,b)]+[(b,j) for j in range(c,e)]+[(i,e) for i in range(b,a,-1)]+[(a,j) for j in range(e,c,-1)]
def curve_on(s,frac,top,key=None):
    arr=s[key] if key else s['upper' if top else 'lower']
    x=s['upper'][0,0]+frac*(s['upper'][-1,0]-s['upper'][0,0])
    return x,smooth_interp(x,arr[:,0],arr[:,1])
mouthVertices={};mouthMotion={};mouthPairs=[];eyeRims={};eyeMotionRings={};boundaryReport=[];actualRings={}
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
            y=surf(x/max(fitwidth(z,-1 if x<0 else 1),.1),z)[1]-.006*math.sin(math.pi*frac)
        else:
            g=globe_surface(s['lab'],x,z);y=g-.012 if g is not None else surf(x/max(fitwidth(z,-1 if x<0 else 1),.1),z)[1]
        target.append(np.array([x,y,z]))
    previous=outer
    for t in (.12,.24,.38,.52,.66,.80,.92,1.):
        ring=[]
        for k,p in zip(outer,target):
            outerP=np.array(V[k]);xz=(1-t)*outerP+t*p
            u=float(np.clip(xz[0]/max(fitwidth(xz[2],-1 if xz[0]<0 else 1),.05),-.999,.999))
            yy=surf(u,xz[2])[1]
            ublend=float(sstep((t-.08)/.92))
            if s['id']!='mouth':
                # Correct only the depth discrepancy relative to the
                # smooth broad surface; avoid the old double blend.
                up0=float(np.clip(p[0]/max(fitwidth(p[2],-1 if p[0]<0 else 1),.05),-.999,.999))
                ytarget=surf(up0,p[2])[1]
                xz[1]=yy+ublend*(p[1]-ytarget)
            else:xz[1]=(1-ublend)*yy+ublend*xz[1]
            ring.append(add(xz))
        ring_bridge(previous,ring);previous=ring
    if s['id']=='mouth':
        lipOuter=previous;actualRings['lipOuter']=list(lipOuter);inner=[]
        for frac,top in params:
            x,z=curve_on(s,frac,top,'seam')
            # minute neutral opening, with real oral depth.
            z+=(.006 if top else -.006)*max(.04,math.sin(math.pi*frac))
            y=surf(x/max(fitwidth(z,-1 if x<0 else 1),.1),z)[1]-.019*math.sin(math.pi*frac)
            inner.append(add((x,y,z)))
        actualRings['lipSeam']=list(inner)
        for k,(_,top) in enumerate(params):mouthVertices[inner[k]]=top
        # v15: local measured thickness drives independently rounded lip surfaces.
        mids=[];prevLip=lipOuter
        for t in (.22,.44,.66,.84):
            row=[]
            for i,j,(fr,top) in zip(lipOuter,inner,params):
                a0=np.asarray(V[i]);a1=np.asarray(V[j]);p=(1-t)*a0+t*a1
                thickness=abs(a1[2]-a0[2]);taper=max(0.,math.sin(math.pi*fr))**.75
                relief=min(.033 if top else .050,thickness*(.24 if top else .32))
                p[1]-=relief*math.sin(math.pi*t)*taper
                row.append(add(p))
            ring_bridge(prevLip,row,[1 if top else 2 for _,top in params]);prevLip=row;mids.append(row)
        ring_bridge(prevLip,inner,[1 if top else 2 for _,top in params])
        for row in [lipOuter,*mids,inner]:
            for k,(fr,top) in zip(row,params):
                w=float(sstep(min(fr,1-fr)/.19))
                mouthMotion[k]=0. if top else w
        upper=[(fr,k) for k,(fr,top) in zip(inner,params) if top]
        lower=[(fr,k) for k,(fr,top) in zip(inner,params) if not top]
        for fr,k in upper:
            if .22<fr<.78:
                f0,j=min(lower,key=lambda q:abs(q[0]-fr))
                if abs(f0-fr)<.025:mouthPairs.append((k,j))
        # v18: widen and deepen the actual oral lining behind the lips.
        oralRim=np.asarray([V[k] for k in inner],float)
        oralCenter=np.mean(oralRim,axis=0)
        oralHalfWidth=float(np.ptp(oralRim[:,0])*.5)
        prevCavity=inner
        for depth,expand,halfHeight in ((.055,1.02,.085),(.14,1.08,.155),(.27,1.04,.16),(.40,.78,.12)):
            cavity=[]
            for k,(fr,top) in zip(inner,params):
                p=np.asarray(V[k]).copy()
                p[0]=oralCenter[0]+(p[0]-oralCenter[0])*expand
                p[1]+=depth
                p[2]+=(1 if top else -1)*halfHeight*math.sqrt(max(0.,math.sin(math.pi*fr)))
                j=add(p);cavity.append(j)
                mouthMotion[j]=0. if top else float(sstep(min(fr,1-fr)/.19))*.9
            ring_bridge(prevCavity,cavity,3);prevCavity=cavity
        cp=add(np.mean([V[k] for k in cavity],axis=0)+[0,.045,0]);mouthMotion[cp]=.35
        for j,k in enumerate(cavity):face((k,cavity[(j+1)%len(cavity)],cp),3)
    else:
        # Add a small actual eyelid thickness and inner rim surface.
        # The aperture remains open; the margin is a narrow strip, not a
        # painted black outline. Estimate depth from the globe geometry.
        c0=eyeCent[s['lab']];inner=[]
        for k,(fr,top) in zip(previous,params):
            p=np.array(V[k]);x=c0[0]+(p[0]-c0[0])*.978;z=c0[2]+(p[2]-c0[2])*.967
            y0=globe_surface(s['lab'],x,z);yy=y0-.0045 if y0 is not None else p[1]+.004
            inner.append(add((x,yy,z)))
        ring_bridge(previous,inner,[4 if top else 5 for fr,top in params])
        eyeRims[s['lab']]=[V[k] for k in inner]
        actualRings['eye'+s['lab']]=list(inner)
        eyeMotionRings[s['lab']]={'inner':list(inner),'outer':list(previous),'params':list(params)}
    boundaryReport.append({'id':s['id'],'boundaryVertices':len(outer),'targetXZ_ipd':[p[[0,2]].tolist() for p in target],'referenceUpper_ipd':s['upper'].tolist(),'referenceLower_ipd':s['lower'].tolist()})
# Local topology-aware fairing of depth around the orbital transition.
# Keep the measured x/z and the actual eye/lip margins pinned. This
# reduces the visible rectangular patch bulge without changing aperture.
PV=np.asarray(V,float)
edges=set()
for poly in F:
    for j,i in enumerate(poly):
        k=poly[(j+1)%len(poly)]
        if i!=k:edges.add((min(i,k),max(i,k)))
ee=np.asarray(sorted(edges),int);aa=np.r_[ee[:,0],ee[:,1]];bb=np.r_[ee[:,1],ee[:,0]]
degree=np.maximum(1,np.bincount(aa,minlength=len(PV)))
mask=np.zeros(len(PV))
for lab,c in eyeCent.items():
    dx=(PV[:,0]-c[0])/.34;dz=PV[:,2]/.30
    mask=np.maximum(mask,np.exp(-(dx**4+dz**4))*sstep((.26-PV[:,1])/.36))
for ids in actualRings.values():mask[ids]=0.
# Also hold the measured oral surface and centerline nose.
mask[np.abs(PV[:,0])<.23]=0.
beforeFair=PV.copy()
for _ in range(16):
    avg=np.bincount(aa,weights=PV[bb,1],minlength=len(PV))/degree
    PV[:,1]+=np.clip((avg-PV[:,1])*.42*mask,-.007,.007)
    PV[:,1]=np.clip(PV[:,1],beforeFair[:,1]-.045,beforeFair[:,1]+.045)
# Bounded global surface fairing; do not move measured eye/lip rims.
beforeGlobal=PV.copy()
pins=np.zeros(len(PV),bool)
for ids in actualRings.values():pins[ids]=True
faceWeight=sstep((PV[:,1]+.46)/.20)
headWeight=sstep((PV[:,2]-.16)/.34)
weight=np.maximum(faceWeight*.65,headWeight)*sstep((np.abs(PV[:,0])-.07)/.24)
weight[pins]=0.
for _ in range(22):
    for lam in (.43,-.39):
        avg=np.column_stack([np.bincount(aa,weights=PV[bb,k],minlength=len(PV))/degree for k in range(3)])
        PV+=(avg-PV)*weight[:,None]*lam
        lim=np.array([.014,.025,.016])
        PV=np.minimum(np.maximum(PV,beforeGlobal-lim),beforeGlobal+lim)
# Enforce eyeball coverage after all smoothing, on the actual front
# vertices rather than merely the analytic pre-fairing support surface.
# All vertices outside the lid opening should precede the ellipsoid.
# The opening itself has no skin faces. Pin measured x/z coordinates.
coverageBefore=PV.copy()
coverageReport={}
for lab,c0 in eyeCent.items():
    x=PV[:,0];z=PV[:,2];y=PV[:,1]
    r2=((x-c0[0])/eyeR[0])**2+((z-c0[2])/eyeR[2])**2
    near=(r2<1.0)&(y<c0[1]+.035)
    shell=c0[1]-eyeR[1]*np.sqrt(np.maximum(0,1-r2))
    # All front skin over the globe, including the transition rings.
    # Rims retain their constructed depths; inner rim already precedes globe.
    apply=near & ~pins
    deficit=np.maximum(0.,y-shell+.010)
    PV[apply,1]-=deficit[apply]
    coverageReport[lab]={'correctedVertices':int(np.count_nonzero(apply&(deficit>0))),
                          'maxCorrectionDesignMm':float(np.max(deficit[apply])*UNIT*1000) if np.any(apply) else 0.,
                          'remainingVertexExposureCount':int(np.count_nonzero(apply&(PV[:,1]>shell-.009)))}
V=[tuple(q) for q in PV]
globalFairReport={'maxDisplacementDesignMm':float(np.max(np.linalg.norm(PV-beforeGlobal,axis=1))*UNIT*1000),'method':'22 bounded Taubin pairs, measured rim vertices pinned; no remesh'}
fairReport={'method':'16 adjacency-based depth fairing iterations; x/z and measured rims unchanged','maxDepthChangeDesignMm':float(np.max(np.abs(PV[:,1]-beforeFair[:,1]))*UNIT*1000),'scope':'peri-orbital patch only; actual visible fit remains unapproved'}
# Remove unused hole interior vertices before exporting.
used=sorted(set(i for p in F for i in p));remap={k:i for i,k in enumerate(used)}
head=object_mesh('R54_NewMeasuredHead',[V[i] for i in used],[tuple(remap[k] for k in q) for q in F],[skin,upperlip,lowerlip,lining,lidUpper,lidLower],MI)
# Store a gentle reference-inspired regional skin color as real mesh
# material data. It is an estimated albedo, not a photograph or exact
# measured skin reflectance. No postprocessing of the review images.
P=np.asarray([V[k] for k in used]);x=P[:,0];y=P[:,1];z=P[:,2]
frontW=np.clip((.28-y)/.53,0,1)
blush=np.exp(-((np.abs(x)-.53)/.26)**2-((z+.43)/.24)**2)*frontW
under=np.exp(-((np.abs(x)-.50)/.23)**2-((z+.18)/.12)**2)*frontW
noseTint=np.exp(-(x/.18)**2-((z+.63)/.15)**2)*frontW
rgb=np.tile(np.array([207.,163.,151.]),(len(P),1))+blush[:,None]*[4.,-5.,-4.]+under[:,None]*[-5.,-8.,-7.]+noseTint[:,None]*[1.,-5.,-5.]
rgb=np.clip(rgb/255.,0.,1.);rgb=np.where(rgb<=.04045,rgb/12.92,((rgb+.055)/1.055)**2.4)
attr=head.data.color_attributes.new(name='R54_SkinTone',type='FLOAT_COLOR',domain='POINT')
attr.data.foreach_set('color',np.column_stack([rgb,np.ones(len(P))]).astype(np.float32).ravel())
node=skin.node_tree.nodes.new('ShaderNodeVertexColor');node.layer_name=attr.name
skin.node_tree.links.new(node.outputs['Color'],skin.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
# Independent dimension audit of the generated mesh, before rendering.
# Use actual mesh edges for silhouette, and actual ring vertices located
# by 3D nearest-neighbor to their construction positions.
from mathutils.kdtree import KDTree
A=np.array([tuple(v.co) for v in head.data.vertices],float)/UNIT
E=np.array([tuple(e.vertices) for e in head.data.edges],int)
P=A[E[:,0]];Q=A[E[:,1]]
def section(axis,value):
    u=P[:,axis]-value;v=Q[:,axis]-value;k=u*v<0
    return P[k]+(Q[k]-P[k])*(u[k]/(u[k]-v[k]))[:,None]
tol=float(contract['policy']['projectedToleranceIpd'])
def stats(errors):
    a=np.asarray(errors,float)
    return {'count':len(a),'rmsIpd':float(np.sqrt(np.mean(a*a))) if len(a) else None,'maxIpd':float(np.max(np.abs(a))) if len(a) else None,'rmsDesignMm':float(np.sqrt(np.mean(a*a))*UNIT*1000) if len(a) else None,'withinTolerance':bool(len(a) and np.max(np.abs(a))<=tol)}
outline={}
for name,sgn in (('left',-1),('right',1)):
    trace=left if sgn<0 else right
    rows=[]
    for x,z in trace:
        S=section(2,z)
        if len(S):
            val=float(S[:,0].min() if sgn<0 else S[:,0].max())
            rows.append({'zIpd':float(z),'targetXIpd':float(x),'actualXIpd':val,'errorIpd':val-float(x)})
    outline[name]={'points':rows,**stats([r['errorIpd'] for r in rows]),'missing':len(trace)-len(rows)}
profile={}
for name in ('left','right'):
    g=contract['side'][name]['groups'];rows=[]
    for label in ('noseRoot','noseTip','noseBase','upperLip','mouth','lowerLip','chin'):
        y,z=g[label]['yzRelativeEye_ipd'][0];target=y+contract['side'][name]['eyeAnteriorDesignYIpd']
        S=section(2,z)
        if len(S):
            val=float(S[:,1].min())
            rows.append({'landmark':label,'zIpd':z,'targetYIpd':target,'actualAnteriorYIpd':val,'errorIpd':val-target})
    profile[name]={'points':rows,**stats([r['errorIpd'] for r in rows]),'missing':7-len(rows),'limitation':'anterior silhouette proxy; not exact landmark identity'}
kd=KDTree(len(A))
for i,p0 in enumerate(A):kd.insert(Vector(p0),i)
kd.balance()
def ring_mesh(ids):
    return np.array([tuple(kd.find(Vector(V[i]))[0]) for i in ids])
def curve_errors(points,poly):
    pp=np.asarray(points,float);q=np.roll(poly,-1,axis=0);delta=q-poly
    errs=[]
    for p in pp:
        t=np.clip(np.sum((p-poly)*delta,axis=1)/np.maximum(np.sum(delta*delta,axis=1),1e-12),0,1)
        errs.append(float(np.min(np.linalg.norm(poly+t[:,None]*delta-p,axis=1))))
    return errs
rings={}
for key,groups in [('eyeL',('eyeLUpper','eyeLLower')),('eyeR',('eyeRUpper','eyeRLower')),('lipOuter',('lipTop','lipBottom')),('lipSeam',('lipSeam',))]:
    poly=ring_mesh(actualRings[key])[:,[0,2]]
    rows=[]
    for group in groups:
        tar=contract['front'][group]['xz_ipd'];e=curve_errors(tar,poly)
        rows.append({'group':group,'referencePoints':tar,'distanceIpd':e,**stats(e)})
    rings[key]={'actualCurveXZ_ipd':poly.tolist(),'groups':rows}
dimReport={'schema':'R54-actual-mesh-dimension-audit-v1','referenceSHA256':contract['referenceSHA256'],'designScaleMm':UNIT*1000,'toleranceIpd':tol,'toleranceDesignMm':tol*UNIT*1000,'outline':outline,'sideProfile':profile,'actualRings':rings,'foundationFit':{'rowsZIpd':fitRows.tolist(),'targetWidthIpd':fitTarget.tolist(),'beforeWidthIpd':initialWidth.tolist(),'afterWidthIpd':current.tolist(),'beforeRmsIpd':score_width(initialWidth),'afterRmsIpd':currentScore,'attempts':fitHistory},'actualBoundsMm':(np.ptp(A,axis=0)*UNIT*1000).tolist(),'unverified':['ear and upper skull dimensions occluded','other 6 projected views','brow/lash depth and material reflectance','anatomical rig and actual motion'],'visualApproved':False}
dimReport['allMeasuredWithinTolerance']=all(x['withinTolerance'] and not x['missing'] for x in list(outline.values())+list(profile.values())) and all(g['withinTolerance'] for r in rings.values() for g in r['groups'])
# Independently measure actual skull geometry, not the parameter table.
cranial={}
for group,points,selector in [('forehead_width',baldFront[baldFront[:,1]>.35],'x'),('posterior_depth',baldPost[(baldPost[:,1]>-.80)&(baldPost[:,1]<1.48)],'y')]:
    rows=[]
    for p0,z0 in points:
        S=section(2,z0)
        if len(S):
            actual=float(S[:,1].max() if selector=='y' else (S[:,0].min() if p0<0 else S[:,0].max()))
            rows.append({'targetIpd':float(p0),'zIpd':float(z0),'actualIpd':actual,'errorIpd':actual-float(p0)})
    cranial[group]={'points':rows,**stats([r['errorIpd'] for r in rows]),'missing':len(points)-len(rows)}
dimReport['supplementalCranialAudit']=cranial
dimReport['supplementalReferenceSHA256']=bald['referenceSHA256']
dimReport['pixelSilhouetteContract']='data/r54-bald-pixel-silhouette.json'
dimReport['pixelSilhouetteRows']={'front':len(pixelSil['front']['rawPixelRows']),'side':len(pixelSil['profile']['rawPixelRows'])}
dimReport['priorScaffoldWarning']='v9 forehead RMS was based on a superseded approximate hand trace; compare visual quality and new pixel-derived target instead'
dimReport['orbitalFairing']=fairReport
dimReport['globalSurfaceFairing']=globalFairReport
dimReport['ocularCoverageVertexAudit']=coverageReport
dimReport['activeFaceTarget']='data/r54-bald-face-landmarks.json'
dimReport['profileSource']='single observed side, other side mirrored inference'
dimReport['originalCharacterTargetRetained']='data/r54-dimensional-constraints.json'
dimReport['curveRegularization']={'widthSigmaIpd':.105,'anteriorSigmaIpd':.13,'posteriorSigmaIpd':.15,'widthMaxChangeDesignMm':float(np.max(np.abs(widthTable[1]-widthTable[2]))*UNIT*1000),'anteriorMaxChangeDesignMm':float(np.max(np.abs(antTable[1]-antTable[2]))*UNIT*1000),'posteriorMaxChangeDesignMm':float(np.max(np.abs(postTable[1]-postTable[2]))*UNIT*1000),'measuredChinHalfWidthIpd':chinHalf,'eyeGlobeRadiusIpd':eyeR.tolist(),'noseAnchorsIpd':{'axis':noseMid,'alarZ':alarZ,'nostrilZ':nostrilZ,'philtrumZ':philZ}}
dimReport['allMeasuredWithinTolerance']=dimReport['allMeasuredWithinTolerance'] and all(x['withinTolerance'] and not x['missing'] for x in cranial.values())
(out/'dimension-audit.json').write_text(json.dumps(dimReport,indent=2,allow_nan=False))
# Measure the final mesh profile, not just the shape parameters.
noseRows=[q for q in profile['left']['points'] if q['landmark'] in ('noseRoot','noseTip','noseBase')]
noseAudit={'sideProfile':noseRows,'profileRmsDesignMm':stats([q['errorIpd'] for q in noseRows])['rmsDesignMm'],'alarTargetXZIpd':alarCurve.tolist(),'philtrumTargetXZIpd':philCurve.tolist(),'nostrilCenterXZIpd':[p.tolist() for p in nostrilCenters],'nostrilDepthAndOrientation':'inferred surface recess; not a true opening','visualApproved':False}
(out/'nose-audit.json').write_text(json.dumps(noseAudit,indent=2,allow_nan=False))
# Independent initial jaw shape key: hinge is an estimated external design
# anchor. Not certified anatomical motion, no inherited morph transfer.
head.shape_key_add(name='Basis');jaw=head.shape_key_add(name='jawOpen_candidate')
for i,k in enumerate(used):
    x,y,z=np.array(V[k]);w=float(sstep((-z-.98)/.28))*float(sstep((z+2.03)/.22))*float(sstep((.80-y)/.6))
    if k in mouthMotion:w=mouthMotion[k]
    ang=.19*w;dy=y-.58;dz=z+.92
    jaw.data[i].co=Vector((x,.58+dy*math.cos(ang)-dz*math.sin(ang),-.92+dy*math.sin(ang)+dz*math.cos(ang)))*UNIT
jaw.value=0
# Measure actual neutral/open shape-key separation at matched central lip samples.
oralRows=[]
for ku,kl in mouthPairs:
    iu,il=remap[ku],remap[kl]
    bu0,bl0=head.data.vertices[iu].co,head.data.vertices[il].co
    ju,jl=jaw.data[iu].co,jaw.data[il].co
    oralRows.append({'neutralGapMm':float((bu0.z-bl0.z)*1000),'openGapMm':float((ju.z-jl.z)*1000),'upperTravelMm':float((ju-bu0).length*1000),'lowerTravelMm':float((jl-bl0).length*1000)})
# Separate closed oral meshes. Dimensions derived from the observed lip
# width, but hidden dental anatomy is explicitly inferred, not measured.
def oral_solid(center,radii,power=.65,angle=0.,n=24,m=16):
    # Superellipsoid with single poles, continuous rounded crown.
    cx,cy,cz=center;rx,ry,rz=radii
    def sp(v,p):return math.copysign(abs(v)**p,v)
    vv=[(cx,cy,cz-rz)];ff=[]
    for j in range(1,m):
        lat=-math.pi/2+math.pi*j/m
        for k in range(n):
            lon=2*math.pi*k/n
            x=rx*sp(math.cos(lat),power)*sp(math.cos(lon),power)
            y=ry*sp(math.cos(lat),power)*sp(math.sin(lon),power)
            vv.append((cx+x*math.cos(angle)-y*math.sin(angle),cy+x*math.sin(angle)+y*math.cos(angle),cz+rz*sp(math.sin(lat),power)))
    for k in range(n):ff.append((0,1+(k+1)%n,1+k))
    for j in range(m-2):
        for k in range(n):
            a=1+j*n+k;b=1+j*n+(k+1)%n;ff.append((a,b,b+n,a+n))
    tip=len(vv);vv.append((cx,cy,cz+rz))
    for k in range(n):ff.append((tip,1+(m-2)*n+k,1+(m-2)*n+(k+1)%n))
    return vv,ff
oralObjects={};oralKeys={}
def oral_part(name,pieces,material,lower=False):
    vv=[];ff=[]
    for center,radii,power,angle in pieces:
        a,b=oral_solid(center,radii,power,angle)
        off=len(vv);vv.extend(a);ff.extend(tuple(off+i for i in q) for q in b)
    ob=object_mesh(name,vv,ff,[material]);oralObjects[name]=ob
    if lower:
        ob.shape_key_add(name='Basis');key=ob.shape_key_add(name='jawOpen_candidate')
        for i,v in enumerate(ob.data.vertices):
            x,y,z=np.asarray(v.co)/UNIT
            dy=y-.58;dz=z+.92;ang=.19
            key.data[i].co=Vector((x,.58+dy*math.cos(ang)-dz*math.sin(ang),-.92+dy*math.sin(ang)+dz*math.cos(ang)))*UNIT
        key.value=0;oralKeys[name]=key
    return ob
# Ten crowns per row: visible anterior teeth plus premolar proxies.
# A compact horseshoe follows the opening; no full dental scan is claimed.
cx,cy,cz=map(float,oralCenter);hw=oralHalfWidth
archHalf=hw*.73
for lower in (False,True):
    sign=-1 if lower else 1
    tag='Lower' if lower else 'Upper'
    crowns=[];gingiva=[]
    for k,t0 in enumerate(np.linspace(-1,1,10)):
        t=float(t0);x=cx+t*archHalf
        y=cy+.083+.205*abs(t)**1.85+(.014 if lower else 0.)
        h=(.052 if lower else .061)*(1-.20*abs(t))
        z=cz+sign*(h+.012)
        halfX=archHalf/10*.96;halfY=.031+.013*abs(t)
        theta=math.atan2(.205*1.85*abs(t)**.85,archHalf)*(-1 if t<0 else 1)
        crowns.append(((x,y,z),(halfX,halfY,h),.57,theta))
        gingiva.append(((x,y+.014,z+sign*h*.88),(halfX*1.30,halfY*1.25,h*.60),.88,theta))
    oral_part('R54_Teeth_'+tag,crowns,enamel,lower)
    oral_part('R54_Gingiva_'+tag,gingiva,gum,lower)
oral_part('R54_Tongue',[((cx,cy+.245,cz-.106),(hw*.57,.115,.043),.93,0.)],tongueMat,True)
def set_oral_open(value):
    jaw.value=value
    for key in oralKeys.values():key.value=value
    bpy.context.view_layer.update()
# Audit actual geometry and synchronized lower shape keys. This does not
# substitute for a full collision or dental anatomy verification.
oralPartAudit={}
for name,ob in oralObjects.items():
    base=np.array([tuple(v.co) for v in ob.data.vertices],float)
    moved=np.array([tuple(v.co) for v in oralKeys[name].data],float) if name in oralKeys else base
    oralPartAudit[name]={'vertices':len(base),'boundsMm':(np.ptp(base,axis=0)*1000).tolist(),'maxJawTravelMm':float(np.max(np.linalg.norm(moved-base,axis=1))*1000),'jawLinked':name in oralKeys}
oralAudit={'samples':oralRows,'sampleCount':len(oralRows),'separationPassed':bool(oralRows) and all(q['openGapMm']>q['neutralGapMm'] and q['upperTravelMm']<.01 for q in oralRows),'depthStatus':'inferred from measured mouth width; no internal scan','visualApproved':False,'teethTongueStatus':'independent candidate meshes','crownsPerRow':10,'parts':oralPartAudit,'collisionChecked':False}
(out/'oral-motion-audit.json').write_text(json.dumps(oralAudit,indent=2,allow_nan=False))
# Independent ocular meshes, visible iris on the curved scleral surface.
# The full ellipsoid in v12 still protruded at oblique angles.
# Build the visible corneoscleral surface using the measured opening,
# retaining the full anatomical globe parameters for future rigging.
# This neutral review patch is NOT a finished rotating/blinking eye.
ocularPatchReport={};eyeMorphs={};eyeMotionAudit={};blinkFunctions={}
for label,c in eyeCent.items():
    sp=next(q for q in spec if q.get('lab')==label)
    up=np.asarray(sp['upper']);low=np.asarray(sp['lower'])
    # Use the generated inner eyelid polygon, not the larger reference
    # outer contour: the latter causes white slivers at oblique angles.
    rim=np.asarray([V[k] for k in actualRings['eye'+label]],float)
    poly=rim[:,[0,2]];qpoly=np.roll(poly,-1,axis=0)
    xmin=float(poly[:,0].min());xmax=float(poly[:,0].max())
    def bounds(x):
        x=float(np.clip(x,xmin+1e-8,xmax-1e-8))
        x0,x1=poly[:,0],qpoly[:,0]
        k=((x0<=x)&(x<x1))|((x1<=x)&(x<x0))
        if not np.any(k):
            z0=float(poly[np.argmin(abs(x0-x)),1]);return z0,z0
        t=(x-x0[k])/(x1[k]-x0[k])
        zs=poly[k,1]+t*(qpoly[k,1]-poly[k,1])
        return float(zs.min()),float(zs.max())
    def surface(x,z):
        g=globe_surface(label,x,z)
        if g is None:g=c[1]-.025
        return g+.005
    ev=[];ef=[];nx=85;nz=27
    for i,x in enumerate(np.linspace(xmin+.0008,xmax-.0008,nx)):
        zz0,zz1=bounds(x)
        for t in np.linspace(0,1,nz):
            zz=(1-t)*zz0+t*zz1
            # slight overlap behind skin at lid margins, not in front.
            ev.append((x,surface(x,zz),zz))
    for i in range(nx-1):
        for j in range(nz-1):
            a=i*nz+j;ef.append((a,a+nz,a+nz+1,a+1))
    eyeObj=object_mesh('R54_EyeballVisible_'+label,ev,ef,[sclera])
    # Iris disk clipped to the same actual opening. No part of the
    # independent iris may project beyond the measured lid curves.
    measuredIris=px(f['iris'+label])
    r=float(np.ptp(measuredIris[:,0])/2)
    rz=float(np.ptp(measuredIris[:,1])/2)
    icx,icz=map(float,measuredIris[0])
    # Visible projection is measured; pupil diameter is a design estimate.
    pupilRatio=.34
    iv=[(icx,surface(icx,icz)-.003,icz)];iff=[];imi=[];n=128
    caps=[]
    for k in range(n):
        a=2*math.pi*k/n;ca=math.cos(a);sa=math.sin(a)
        allowed=0.
        for rho in np.linspace(0,1,201):
            x=icx+r*rho*ca;z=icz+rz*rho*sa
            if not xmin+.0005<=x<=xmax-.0005:break
            a0,b0=bounds(x)
            if not a0+.0005<=z<=b0-.0005:break
            allowed=rho
        caps.append(allowed)
    # Preserve pupil proportions independently of iris clipping. Only
    # the outer annulus adapts to the actual lid boundary.
    nr=24;npupil=8
    for j in range(1,nr+1):
        for k in range(n):
            a=2*math.pi*k/n
            cap=caps[k];pr=min(pupilRatio,cap*.85)
            rho=pr*j/npupil if j<=npupil else pr+(cap-pr)*(j-npupil)/(nr-npupil)
            x=icx+r*rho*math.cos(a);z=icz+rz*rho*math.sin(a)
            iv.append((x,surface(x,z)-.003,z))
    for k in range(n):iff.append((0,1+k,1+(k+1)%n));imi.append(0)
    for j in range(nr-1):
        for k in range(n):
            a=1+j*n+k;b=1+j*n+(k+1)%n;iff.append((a,b,b+n,a+n))
            # A narrow limbal ring, radial fiber variation, and distinct pupil.
            imi.append(0 if j<npupil-1 else (6 if j>=nr-3 and min(caps[k],caps[(k+1)%n])>.96 else 1+(k*13+j*3)%5))
    irisObj=object_mesh('R54_Iris_'+label,iv,iff,[pupil]+irisM,imi)
    # Check actual mesh vertex projection against opening.
    def outside(obj):
        bad=0;maxerr=0.
        for v0 in obj.data.vertices:
            x,y,z=np.asarray(v0.co)/UNIT
            lo0,hi0=bounds(x)
            err=max(xmin-x,x-xmax,lo0-z,z-hi0,0.)
            bad+=int(err>.001);maxerr=max(maxerr,err)
        return {'outsideVertices':bad,'maxOutsideDesignMm':maxerr*UNIT*1000}
    # Blink: the measured inner aperture closes toward a common curved
    # seam. Eyelid motion and the visible ocular patches share that seam.
    # This is a clipped-patch prototype, not a true rotating globe.
    def make_blink(label0,poly0,xmin0,xmax0):
        q0=np.roll(poly0,-1,axis=0)
        def lim(x):
            x=float(np.clip(x,xmin0+1e-8,xmax0-1e-8))
            a,b=poly0[:,0],q0[:,0];mask=((a<=x)&(x<b))|((b<=x)&(x<a))
            if not np.any(mask):
                z=float(poly0[np.argmin(abs(a-x)),1]);return z,z
            t=(x-a[mask])/(b[mask]-a[mask])
            z=poly0[mask,1]+t*(q0[mask,1]-poly0[mask,1]);return float(z.min()),float(z.max())
        def seam(x):
            lo,hi=lim(x);return .76*lo+.24*hi
        return lim,seam
    limits,closeZ=make_blink(label,poly.copy(),xmin,xmax)
    blinkFunctions[label]=(limits,closeZ,xmin,xmax)
    keyName='blink_'+label+'_candidate'
    bk=head.shape_key_add(name=keyName)
    def moved_lid(x,y,z,top,weight=1.):
        lo,hi=limits(x);target=closeZ(x)+(.0006 if top else -.0006)
        edge=hi if top else lo
        dz=(target-edge)*weight
        old=globe_surface(label,x,z);new=globe_surface(label,x,z+dz)
        dy=(new-old) if old is not None and new is not None else 0.
        return (x,y+dy,z+dz)
    # Blend periocular skin toward the lid, fixing remote facial geometry.
    for idx,v0 in enumerate(head.data.vertices):
        x,y,z=np.asarray(v0.co)/UNIT
        if not xmin-.055<x<xmax+.055 or y>.05:continue
        lo,hi=limits(x);top=z>=closeZ(x)
        edge=hi if top else lo
        w=float(sstep(1-abs(z-edge)/.17)*sstep((x-xmin+.035)/.065)*sstep((xmax-x+.035)/.065))
        if w>0:bk.data[idx].co=Vector(moved_lid(x,y,z,top,w))*UNIT
    # Pin the exact eyelid margin to the seam, using its actual x coordinate.
    mr=eyeMotionRings[label]
    for ids in (mr['inner'],mr['outer']):
        for k,(fr,top) in zip(ids,mr['params']):
            idx=remap[k];x,y,z=np.asarray(head.data.vertices[idx].co)/UNIT
            target=closeZ(x)+(.0006 if top else -.0006)
            # Preserve the margin thickness on the outer ring.
            if ids is mr['outer']:target+=.003 if top else -.003
            old=globe_surface(label,x,z);new=globe_surface(label,x,target)
            dy=new-old if old is not None and new is not None else 0.
            bk.data[idx].co=Vector((x,y+dy,target))*UNIT
    bk.value=0.;eyeMorphs[keyName]=[bk]
    for ob in (eyeObj,irisObj):
        ob.shape_key_add(name='Basis');key=ob.shape_key_add(name=keyName)
        for idx,v0 in enumerate(ob.data.vertices):
            x,y,z=np.asarray(v0.co)/UNIT;target=closeZ(x)
            old=globe_surface(label,x,z);new=globe_surface(label,x,target)
            dy=new-old if old is not None and new is not None else 0.
            key.data[idx].co=Vector((x,y+dy,target+(z-target)*.003))*UNIT
        key.value=0.;eyeMorphs[keyName].append(key)
    # Gaze targets use a conservative inferred range. Reproject all iris
    # vertices into the actual aperture, including clipped outer annulus.
    gazeAudit={}
    for name,dx,dz in (('lookLeft',-.045,0.),('lookRight',.045,0.),('lookUp',0.,.026),('lookDown',0.,-.026)):
        key=irisObj.shape_key_add(name=name+'_candidate')
        errors=[]
        for idx,v0 in enumerate(irisObj.data.vertices):
            x,y,z=np.asarray(v0.co)/UNIT
            xx=float(np.clip(x+dx,xmin+.0005,xmax-.0005))
            lo,hi=limits(xx);margin=min(.0005,max(0.,(hi-lo)*.25))
            zz=float(np.clip(z+dz,lo+margin,hi-margin))
            key.data[idx].co=Vector((xx,surface(xx,zz)-.003,zz))*UNIT
            errors.append(max(xmin-xx,xx-xmax,lo-zz,zz-hi,0.))
        key.value=0.;eyeMorphs.setdefault(name+'_candidate',[]).append(key)
        gazeAudit[name]={'shiftXZIpd':[dx,dz],'maxOutsideDesignMm':float(max(errors)*UNIT*1000)}
    rimTravel=[float((bk.data[remap[k]].co-head.data.vertices[remap[k]].co).length*1000) for k in mr['inner']]
    eyeMotionAudit[label]={'blinkRimMaxTravelMm':max(rimTravel),'blinkRimSamples':len(rimTravel),'gaze':gazeAudit,'combinedGazeBlinkChecked':False,'visualApproved':False}
    ocularPatchReport[label]={'sclera':outside(eyeObj),'iris':outside(irisObj),'globeCenterIpd':c.tolist(),'globeRadiusIpd':eyeR.tolist(),'irisRadiusIpd':r,'irisVerticalRadiusIpd':rz,'irisCenterXZIpd':[icx,icz],'pupilRatioDesignEstimate':pupilRatio,'clippedDirectionCount':int(sum(bool(t<.99) for t in caps)),'method':'actual inner eyelid polygon, measured elliptical iris and independent pupil; full eyeball rig required for dynamic use'}
(out/'ocular-patch-audit.json').write_text(json.dumps(ocularPatchReport,indent=2,allow_nan=False))
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
# Sample final actual facial skin, not the pre-fairing analytic surface.
from mathutils.bvhtree import BVHTree
facialTree=BVHTree.FromObject(head,bpy.context.evaluated_depsgraph_get())
def actual_front_y(x,z):
    hit,_,_,_=facialTree.ray_cast(Vector((x*UNIT,-.25,z*UNIT)),Vector((0,1,0)),.5)
    return float(hit.y/UNIT) if hit is not None else None
# Exact reference-derived strand vectors in projected view; curl depth is
# inferred. Roots are sampled on the new lid rim or new forehead.
for s in spec[:2]:
    lab=s['lab'];paths=[]
    for top in (True,False):
        paths=[]
        prefix=('lash' if top else 'lowerLash')+lab
        roots=px(f[prefix+'Roots']);tips=px(f[prefix+'Tips']);delta=tips-roots
        order=np.argsort(roots[:,0]);roots=roots[order];delta=delta[order]
        for frac in np.linspace(.035,.965,43 if top else 25):
            x,z=curve_on(s,float(frac),top);y=globe_surface(lab,x,z)
            if y is None:continue
            dx,dz=[float(np.interp(x,roots[:,0],delta[:,k])) for k in range(2)]
            dz=(1 if top else -1)*max(abs(dz),.008)
            P=[]
            for t in np.linspace(0,1,8):
                xx=x+dx*t;zz=z+dz*(.55*t+.45*t*t)
                yy=y-.014-.034*(1.5*t-.5*t*t)
                sy=actual_front_y(xx,zz)
                # Keep root and shaft on the actual visible surface.
                if sy is not None:yy=min(yy,sy-.003-.018*t)
                P.append((xx,yy,zz))
            paths.append((P,.0027 if top else .0017))
        if paths:
            ob=merge_tubes('R54_Lashes_'+lab+('_Upper' if top else '_Lower'),paths,lashmat)
            ob.shape_key_add(name='Basis');name='blink_'+lab+'_candidate';key=ob.shape_key_add(name=name)
            lim,closeZ,xmin,xmax=blinkFunctions[lab]
            for idx,v0 in enumerate(ob.data.vertices):
                x,y,z=np.asarray(v0.co)/UNIT;lo,hi=lim(x);edge=hi if top else lo
                dz=closeZ(x)-edge
                old=globe_surface(lab,x,edge);new=globe_surface(lab,x,edge+dz)
                dy=new-old if old is not None and new is not None else 0.
                key.data[idx].co=Vector((x,y+dy,z+dz))*UNIT
            key.value=0.;eyeMorphs[name].append(key)
    bu=px(f['brow'+lab+'Top']);bl=px(f['brow'+lab+'Bottom']);paths=[]
    bu=bu[np.argsort(bu[:,0])];bl=bl[np.argsort(bl[:,0])]
    for frac in np.linspace(.025,.975,88):
        x=bu[0,0]+frac*(bu[-1,0]-bu[0,0]);zu=float(np.interp(x,bu[:,0],bu[:,1]));zl=float(np.interp(x,bl[:,0],bl[:,1]))
        for v in (.12,.32,.52,.72,.88):
            z=zl+v*(zu-zl);dx=.030*(-1 if lab=='L' else 1)
            medial=frac if lab=='R' else 1-frac
            path=[]
            for t in np.linspace(0,1,5):
                X=x+dx*t;zz=z+.029*t*(1-medial*.78);u=X/max(fitwidth(zz,-1 if X<0 else 1),.1)
                yy=actual_front_y(X,zz)
                if yy is None:yy=surf(float(np.clip(u,-.99,.99)),zz)[1]
                path.append((X,yy-.006,zz))
            paths.append((path,.0025*(.65+.35*math.sin(math.pi*frac))))
    merge_tubes('R54_Brows_'+lab,paths,browmat)
def set_eye_pose(name=None,value=0.):
    for n,keys in eyeMorphs.items():
        for key in keys:key.value=value if n==name or (name=='blinkBoth' and n.startswith('blink_')) else 0.
    bpy.context.view_layer.update()
(out/'eye-motion-audit.json').write_text(json.dumps(eyeMotionAudit,indent=2,allow_nan=False))
# R54 v6: independently modeled auricles. Side-view outline points are
# direct projected constraints, unlike the inferred front root and cartilage.
from mathutils.bvhtree import BVHTree
earSpec=json.loads(Path('data/r54-ear-design.json').read_text())
assert earSpec['referenceSHA256']==contract['referenceSHA256']
headTree=BVHTree.FromObject(head,bpy.context.evaluated_depsgraph_get())
earObjects={};earReport={}
def skull_x(sgn,y,z):
    hit,_,_,_=headTree.ray_cast(Vector((sgn*.25,y*UNIT,z*UNIT)),Vector((-sgn,0,0)),.5)
    return abs(float(hit.x/UNIT)) if hit is not None else None
def closed_outline(points,n=120):
    # Periodic Catmull-Rom, interpolates every observed station exactly.
    pts=np.array(points,float);ret=[]
    for k in range(len(pts)):
        a,b,c,d=[pts[j%len(pts)] for j in (k-1,k,k+1,k+2)]
        for t in np.linspace(0,1,n//len(pts),endpoint=False):
            ret.append(.5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t))
    return np.array(ret)
for label,sgn in (('left',-1),('right',1)):
    item=earSpec['ears'][label]
    raw=np.array(item['observedOuterCurve']['yzRelativeEye_ipd'],float)
    raw[:,0]+=float(item['sideEyeAnteriorDesignYIpd'])
    ymin,zmin=raw.min(axis=0);ymax,zmax=raw.max(axis=0)
    w=ymax-ymin;h=zmax-zmin
    # Visible side outline starts at superior root and ends at lobe.
    # Anterior edge is occluded; close using explicitly inferred anchors.
    extra=np.array([[ymin-.055*w,zmin+.25*h],[ymin-.17*w,zmin+.50*h],[ymin-.07*w,zmin+.77*h]])
    allpts=np.vstack([raw,extra]);rim=closed_outline(allpts,156)
    n=len(rim);center=np.array([ymin+.43*w,zmin+.49*h])
    # Ear disc has a gently tilted base. Anterior roots intersect the
    # head slightly; exterior cartilage remains an independent shell.
    xgoal=float(earSpec['frontOuterXDesignIpd'])
    def local(y,z):
        return ((y-center[0])/max(w*.5,.001),(z-center[1])/max(h*.5,.001))
    def xsurface(r,y,z):
        u,v=local(y,z)
        # x is lateral displacement. The concha is a true recessed
        # basin; helix and antihelix have distinct continuous relief.
        root=skull_x(sgn,y,z)
        if root is None:
            root=skull_x(sgn,min(y,.72),z)
        if root is None:root=.51
        frontFactor=float(sstep((y-ymin+.035)/(w*.58)))
        free=float(sstep((r-.18)/.75))
        # Taper frontal protrusion toward superior root and lobule. Do not
        # clamp the entire free edge to a flat vertical plane.
        heightFactor=max(0.,1.-((v-.08)/1.28)**2)
        lateralTarget=.79+.27*heightFactor+.08*frontFactor
        envelope=(root-.018)*(1-frontFactor)+lateralTarget*frontFactor
        helix=.086*math.exp(-((r-.86)/.125)**2)
        anti=.075*math.exp(-((u-.10)/.24)**2)*math.exp(-((v-.16)/.65)**2)
        # Upper bifurcation of antihelix.
        anti+=.047*math.exp(-((u-.38*(v-.05))/.17)**2-((v-.51)/.29)**2)
        concha=-.128*math.exp(-((u+.22)/.38)**2-((v+.17)/.43)**2)
        tragus=.077*math.exp(-((u+.82)/.19)**2-((v+.05)/.21)**2)
        canal=-.064*math.exp(-((u+.43)/.13)**2-((v+.07)/.15)**2)
        lobe=.065*math.exp(-((v+.84)/.25)**2-((u+.17)/.55)**2)
        x=envelope+free*.025+helix+anti+concha+tragus+canal+lobe
        # Anchor the anterior root below the cranial surface.
        anch=float(sstep((y-ymin+.02)/(w*.24)))
        x=(root-.020)*(1-anch)+x*anch
        # Bounded smooth cap varies vertically; the hair-obscured frontal
        # outline is only a proxy. Avoid a rectangular silhouette.
        cap=min(xgoal+.018,.91+.23*max(0.,1.-((v-.06)/1.2)**2))
        if x>cap-.045:x=cap-.045*math.exp(-(x-cap+.045)/.045)
        return x
    rv=np.linspace(.04,1.,28);VV=[];FF=[];II=[]
    def push(p):VV.append(tuple(p));return len(VV)-1
    for outerSide in (True,False):
        for r in rv:
            for yy,zz in rim:
                y,z=center+r*(np.array([yy,zz])-center)
                x=xsurface(float(r),float(y),float(z))
                if not outerSide:
                    # Cartilage thickness is estimated; posterior surface
                    # closes the ear rather than leaving loose tubes.
                    x-=.025+.028*(1-r*r)
                push((sgn*x,y,z))
    nr=len(rv);N=nr*n
    for shell in (0,1):
        off=shell*N
        for j in range(nr-1):
            for k in range(n):
                a=off+j*n+k;b=off+j*n+(k+1)%n
                q=(a,b,b+n,a+n);FF.append(q if shell==0 else q[::-1]);II.append(0)
        cp=push(np.mean(VV[off:off+n],axis=0))
        for k in range(n):FF.append((cp,off+k,off+(k+1)%n));II.append(0)
    for k in range(n):
        a=(nr-1)*n+k;b=(nr-1)*n+(k+1)%n
        FF.append((a,b,b+N,a+N));II.append(0)
    ear=object_mesh('R54_Auricle_'+label,VV,FF,[skin],II)
    # Skin's vertex-color node expects its named point attribute.
    C=np.array(VV);u=(C[:,1]-center[0])/(w*.5);v=(C[:,2]-center[1])/(h*.5)
    redden=np.exp(-((u+.10)/.80)**2-((v+.10)/.85)**2)
    rgb=np.tile([207.,163.,151.],(len(C),1))+redden[:,None]*[4.,-9.,-8.]
    rgba=np.column_stack([np.array([linear(q) for q in rgb]),np.ones(len(C))])
    ca=ear.data.color_attributes.new(name='R54_SkinTone',type='FLOAT_COLOR',domain='POINT')
    ca.data.foreach_set('color',rgba.astype(np.float32).ravel())
    earObjects[label]=ear
    # Verify the actual exported mesh surface positions, not design rows.
    B=np.array([tuple(v.co) for v in ear.data.vertices])/UNIT
    # BMesh may reorder vertices; nearest actual projected vertex is
    # independently checked for each traced outer station as well.
    nearest=[float(np.linalg.norm(B[:,1:3]-p,axis=1).min()) for p in raw]
    rootSel=B[:,1]<ymin+w*.12
    distances=[]
    for x,y,z in B[rootSel][::max(1,int(rootSel.sum())//100)]:
        h0,n0,_,dd=headTree.find_nearest(Vector((x*UNIT,y*UNIT,z*UNIT)))
        if h0 is not None:distances.append(float((Vector((x*UNIT,y*UNIT,z*UNIT))-h0).dot(n0)*1000))
    earReport[label]={'observedOuterYZIpd':raw.tolist(),'inferredAnteriorYZIpd':extra.tolist(),'actualBoundsMm':(np.ptp(B,axis=0)*UNIT*1000).tolist(),'observedHeightDesignMm':float(h*UNIT*1000),'observedWidthDesignMm':float(w*UNIT*1000),'actualOutlineNearestVertex':stats(nearest),'inferredCartilage':['helix','antihelix','concha','tragus','lobule','canal depression'],'rootContactSignedMm':distances,'rootContactSamples':len(distances),'rootOverlapSamples':sum(x<0 for x in distances),'seamWelded':False,'visualApproved':False}
    bpy.ops.object.select_all(action='DESELECT');ear.select_set(True);bpy.context.view_layer.objects.active=ear
    bpy.ops.export_scene.gltf(filepath=str(out/('R54_ear_'+label+'.glb')),export_format='GLB',use_selection=True)
(out/'ear-audit.json').write_text(json.dumps({'referenceSHA256':earSpec['referenceSHA256'],'ears':earReport,'internalAnatomyStatus':'inferred, not measured','attachmentStatus':'overlap candidate; no welded seam or rig yet','visualApproved':False},indent=2,allow_nan=False))
# R54 v7 neck: independent smooth anatomical surface, fit to actual
# head underside. The visible collar/neck outline is a projection only.
neckSpec=json.loads(Path('data/r54-neck-design.json').read_text())
assert neckSpec['referenceSHA256']==contract['referenceSHA256']
ns=neckSpec['sideProjections']
frontYZ=np.mean([ns[k]['frontYZ'] for k in ('left','right')],axis=0)
backYZ=np.mean([ns[k]['backYZ'] for k in ('left','right')],axis=0)
baseZ=float((frontYZ[1]+backYZ[1])*.5-.24)
# Lower ellipse follows the measured anterior and posterior side anchors.
# Keep estimates bounded because the reference includes a collar and hair.
lowerFront=float(np.clip(frontYZ[0],-.04,.38))
lowerBack=float(np.clip(backYZ[0],.72,1.25))
nb=np.asarray(bald['side']['neckBackYZ_ipd']);nj=np.argsort(nb[:,1]);lowerBack=float(np.clip(np.interp(baseZ,nb[nj,1],nb[nj,0]),lowerBack,1.38))
if lowerBack-lowerFront<.55:lowerBack=lowerFront+.55
lowerHalf=float(np.clip(neckSpec['frontCollarWidthIpd']*.40,.40,.55))
upperHalf=lowerHalf*.90
upperCenter=.49
upperDepth=.46
N=128;rows=45;NV=[];NF=[];topAudit=[]
# sample underside at a conservative upper neck ellipse. Pull inward
# until a ray meets the actual skull; never fabricate a successful hit.
for j in range(rows):
    t=j/(rows-1);blend=float(sstep(t))
    for i in range(N):
        ang=2*math.pi*i/N;sn=math.sin(ang);cs=math.cos(ang)
        ux=upperHalf*sn;uy=upperCenter-upperDepth*cs
        hit=None
        for scale in (1.,.94,.88,.80,.70,.60):
            x=ux*scale;y=upperCenter+(uy-upperCenter)*scale
            q,_,_,_=headTree.ray_cast(Vector((x*UNIT,y*UNIT,-.25)),Vector((0,0,1)),.35)
            if q is not None:hit=(x,y,float(q.z/UNIT));break
        if hit is None:raise RuntimeError('neck underside ray missed at angle '+str(i))
        tx,ty,tz=hit
        # Short overlap is explicit, not a claim of a welded seam.
        tz+=.11
        lx=lowerHalf*sn;ly=(lowerBack+lowerFront)*.5-(lowerBack-lowerFront)*.5*cs
        # The neck narrows slightly below the jaw, then broadens at base.
        waist=1-.065*math.sin(math.pi*t)
        x=((1-blend)*tx+blend*lx)*waist
        y=(1-blend)*ty+blend*ly
        z=(1-t)*tz+t*baseZ
        # Soft paired sternocleidomastoid contour, with zero boundary
        # displacement and no external disconnected muscle geometry.
        ridge=.023*math.sin(math.pi*t)**2*math.exp(-((abs(sn)-.69)/.22)**2)
        x+=math.copysign(ridge,x) if abs(x)>1e-9 else 0
        y-=ridge*.4*max(0.,cs)
        NV.append((x,y,z))
        if j==0:
            q0,n0,_,dd=headTree.find_nearest(Vector((x*UNIT,y*UNIT,z*UNIT)))
            signed=float((Vector((x*UNIT,y*UNIT,z*UNIT))-q0).dot(n0)*1000) if q0 is not None else None
            topAudit.append({'angleDeg':360*i/N,'headIntersectionIpd':[tx,ty,tz-.11],'neckTopIpd':[x,y,z],'signedDistanceMm':signed})
for j in range(rows-1):
    for i in range(N):
        a=j*N+i;b=j*N+(i+1)%N;NF.append((a,b,b+N,a+N))
for j in (0,rows-1):
    q=list(range(j*N,(j+1)*N))
    ci=len(NV);NV.append(tuple(np.mean([NV[k] for k in q],axis=0)))
    for i,k in enumerate(q):NF.append((ci,k,q[(i+1)%N]))
neck=object_mesh('R54_AnatomicalNeck',NV,NF,[skin])
attr=neck.data.color_attributes.new(name='R54_SkinTone',type='FLOAT_COLOR',domain='POINT')
rgba=np.tile(np.r_[linear([207,163,151]),1.],(len(neck.data.vertices),1))
attr.data.foreach_set('color',rgba.astype(np.float32).ravel())
neckBounds=np.array([tuple(v.co) for v in neck.data.vertices])
neckReport={'referenceSHA256':neckSpec['referenceSHA256'],'designInputs':neckSpec,'actualBoundsMm':(np.ptp(neckBounds,axis=0)*1000).tolist(),'topAttachmentSamples':topAudit,'topOverlapSamples':sum(r['signedDistanceMm'] is not None and r['signedDistanceMm']<0 for r in topAudit),'sampleCount':len(topAudit),'bodySocket':{'origin_m':[0.,(lowerFront+lowerBack)*.5*UNIT,baseZ*UNIT],'ellipseHalfAxes_m':[lowerHalf*UNIT,(lowerBack-lowerFront)*.5*UNIT],'status':'design estimate; not fitted to body'},'seamWelded':False,'rigged':False,'visualApproved':False}
(out/'neck-audit.json').write_text(json.dumps(neckReport,indent=2,allow_nan=False))
bpy.ops.object.select_all(action='DESELECT');neck.select_set(True);bpy.context.view_layer.objects.active=neck
bpy.ops.export_scene.gltf(filepath=str(out/'R54_neck.glb'),export_format='GLB',use_selection=True)
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
focus=Vector((0,.013,-.038))
for name,p,power,sz in [('Key',(-.28,-.46,.36),10,.40),('Fill',(.31,-.39,.12),5,.38),('Rim',(.10,.29,.29),8,.34)]:
    l=bpy.data.lights.new(name,'AREA');l.energy=power;l.shape='DISK';l.size=sz
    o=bpy.data.objects.new(name,l);scene.collection.objects.link(o);o.location=p;o.rotation_euler=(focus-o.location).to_track_quat('-Z','Y').to_euler()
cam=bpy.data.cameras.new('ReviewCamera');cam.type='ORTHO';cam.ortho_scale=.33
o=bpy.data.objects.new('ReviewCamera',cam);scene.collection.objects.link(o);scene.camera=o
scene.render.resolution_x=840;scene.render.resolution_y=840;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='JPEG';scene.render.image_settings.quality=95
def render(name,axis):
    o.location=focus+Vector(axis).normalized()*.72;o.rotation_euler=(focus-o.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath=str(out/(name+'.jpg'));bpy.ops.render.render(write_still=True)
for tag,axis in [('front',(0,-1,0)),('left',(-1,0,0)),('right',(1,0,0)),('threequarter',(.66,-1,.03)),('rear',(0,1,0))]:render(tag,axis)
# Close-up renders use the same real model and unchanged material.
oldFocus=focus.copy();oldScale=cam.ortho_scale
for label,sgn in (('left',-1),('right',1)):
    ear=earObjects[label]
    center0=np.mean([tuple(v.co) for v in ear.data.vertices],axis=0)
    focus=Vector(center0);cam.ortho_scale=.095
    render('ear_'+label+'_detail',(sgn,0,0))
    render('ear_'+label+'_threequarter',(sgn,-.48,.06))
# Actual close-up JPGs of the new ocular geometry.
for label,c0 in eyeCent.items():
    focus=Vector((c0[0]*UNIT,-.025,c0[2]*UNIT));cam.ortho_scale=.055
    render('eye_'+label+'_detail',(0,-1,0))
    render('eye_'+label+'_oblique',(.46 if label=='R' else -.46,-1,.05))
focus=Vector((noseMid*UNIT,-.028,-.48*UNIT));cam.ortho_scale=.075
for tag,axis in [('nose_front_detail',(0,-1,0)),('nose_profile_detail',(1,0,0)),('nose_oblique_detail',(.65,-1,-.12))]:render(tag,axis)
focus=oldFocus;cam.ortho_scale=oldScale
set_oral_open(1.);render('jaw_open_experimental',(0,-1,0))
focus=Vector((cx*UNIT,(cy+.035)*UNIT,(cz-.025)*UNIT));cam.ortho_scale=.082
render('oral_open_detail',(0,-1,-.05));render('oral_open_oblique',(.55,-1,-.10))
set_oral_open(0.);render('oral_neutral_detail',(0,-1,0))
focus=oldFocus;cam.ortho_scale=oldScale
for tag,pose,value in [('blink_closed','blinkBoth',1.),('blink_half','blinkBoth',.5),('gaze_left','lookLeft_candidate',1.),('gaze_right','lookRight_candidate',1.),('gaze_up','lookUp_candidate',1.),('gaze_down','lookDown_candidate',1.)]:
    set_eye_pose(pose,value);render(tag,(0,-1,0))
set_eye_pose()
bpy.ops.wm.save_as_mainfile(filepath=str(out/'R54_new_head.blend'))
report={'id':'R54-new-head-v19','method':'independently constructed front/back grids and explicit eye/lip boundary rings; zero imported head vertices','referenceSHA256':d['sourceSHA256'],'inputPoints':d['pointCount'],'nineViewPoints':nine['pointsCount'],'foundationRevision':'measured front width constraints and bilateral side profile, iterative projected silhouette fitting; rounded chin and smooth feature curves','dimensionAudit':'dimension-audit.json','ocularPatchAudit':'ocular-patch-audit.json','ocularMotionStatus':'candidate eyelid, iris, sclera and lash morphs; clipped ocular patch, not true globe rotation','eyeMotionAudit':'eye-motion-audit.json','orbitalFairing':fairReport,'ocularCoverageVertexAudit':coverageReport,'activeFaceTarget':'data/r54-bald-face-landmarks.json','globalSurfaceFairing':globalFairReport,'earAudit':'ear-audit.json','earParts':['R54_ear_left.glb','R54_ear_right.glb'],'dimensionGatePassed':dimReport['allMeasuredWithinTolerance'],'neckPolicy':'independent neck mesh fitted to head underside; not welded or body-rigged','neckAudit':'neck-audit.json','supplementalCranialReference':bald['referenceSHA256'],'supplementalScaffold':'data/r54-bald-reference-scaffold.json','pixelSilhouette':'data/r54-bald-pixel-silhouette.json','neckPart':'R54_neck.glb','skinColorMethod':'estimated regional vertex albedo, no image correction','visibleWidthFitRms_ipd':float(np.sqrt(np.mean((np.array([fitwidth(z,1) for z in traceZ])-traceW)**2))),'widthStationZ_ipd':WZ.tolist(),'widthStationHalf_ipd':WW.tolist(),'actualUsed':['front cheek/jaw traces','bilateral sagittal profile','front eyelid contours','iris diameter','lip top/seam/bottom','brow contours','lash vectors'],'designIPD_m':UNIT,'headVertices':len(head.data.vertices),'headFaces':len(head.data.polygons),'parts':[ob.name for ob in objects],'boundaries':boundaryReport,'materialStatus':'reference-inspired estimates, not verified albedo','newTopology':True,'priorHeadUsed':False,'visualApproved':False,'productionApproved':False,'limitations':['upper cranium and posterior head inferred from occluded reference','ear inner cartilage and thickness inferred; frontal taper revised; seam/rig integration unapproved','oral lining, 20 tooth crowns, gingiva and tongue are inferred candidates; collision testing and full dentition pending','jaw and blink/gaze morphs experimental; simultaneous gaze/blink and full facial expressions unverified','neck overlap is preliminary; welded seam, body fit and rig integration pending','nine-view image is synthetic and not calibrated; fit not independently verified'],'oralMotionAudit':'oral-motion-audit.json','oralSeparationPassed':oralAudit['separationPassed'],'noseAudit':'nose-audit.json','revisionNotes':['left and right blink morphs on actual eyelid margins','synchronized upper/lower lashes and visible ocular patch morphs','four aperture-constrained gaze targets','six actual eye pose review JPGs','retains v18 oral geometry'],'next':'verify blink/gaze and oral poses visually, then neck interface and facial expression candidates; no automatic adoption'}
(out/'report.json').write_text(json.dumps(report,indent=2))
print('New head candidate generated',report['headVertices'],report['headFaces'])
