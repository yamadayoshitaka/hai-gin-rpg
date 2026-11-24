#!/usr/bin/env python3
"""Actual GLB sculpt to the four-view reference; preserve topology and byte budget."""
import collections,math,pathlib,runpy,statistics,struct,json,sys
V=runpy.run_path(str(pathlib.Path(__file__).with_name('refine-v121-mouth-v27.py')))
H=V['H'];S=V['S'];fade=V['fade'];bell=V['bell'];unit=V['unit'];store=V['replace_vec3']
def lip(p):
    x,y,z=p;a=abs(x)
    w=(1-fade(a,.025,.038))*fade(z,.113,.138)*fade(y,.204,.219)*(1-fade(y,.243,.251))
    upper=fade(y,.232,.236)
    lower=1-fade(y,.228,.232)
    # Retract the whole muzzle, not just the coloured lip surface.
    muzzle=(1-fade(a,.032,.060))*fade(z,.105,.138)*fade(y,.183,.217)*(1-fade(y,.248,.261))
    return (x,y-(y-.232)*(.40*upper-.55*lower)*w,
            z+(.00035*bell(y,.225,.004)*lower-.00105*bell(y,.238,.004)*upper)*w-.0090*muzzle)
def shorten_philtrum(p):
    # A monotone vertical deformation moves the complete mouth and oral
    # geometry together. Y is up; no lipstick-only relocation.
    x,y,z=p
    weight=(1-fade(abs(x),.034,.095))*fade(z,.025,.090)
    lift=.014*fade(y,.150,.212)*(1-fade(y,.241,.279))
    return (x,y+weight*lift,z)

def eye(p):
    x,y,z=p;a=abs(x);s=1 if x>=0 else -1
    w=fade(a,.010,.019)*(1-fade(a,.062,.076))*fade(y,.282,.296)*(1-fade(y,.324,.335))*fade(z,.090,.118)
    return (x+.045*(x-s*.0365)*w,y-.10*(y-.307)*w+.0011*fade(a,.038,.061)*w,z)
def subnasal(p):
    x,y,z=p;a=abs(x)
    # Contract the real subnasal skin and its alar transition, not the lip.
    w=fade(y,.242,.251)*(1-fade(y,.268,.279))*(1-fade(a,.026,.061))*fade(z,.100,.137)
    column=fade(y,.246,.251)*(1-fade(y,.265,.273))*fade(z,.110,.140)
    # A shallow vertical philtral channel with gently rounded columns.
    relief=column*(-.00045*bell(a,0,.0045)+.00024*bell(a,.0075,.004))
    return (x*(1-.20*w),y-.0008*w*bell(a,0,.018),z-.0020*w+relief)

def face_warp(p):
    # Gaussian tails must never alter the protected scalp/side vertices.
    px,py,pz=p
    if py>=.335 or abs(px)>=.125:return p
    gate=(1-fade(py,.328,.335))*(1-fade(abs(px),.110,.125))
    x,y,z=lip(p);x,y,z=eye((x,y,z));a=abs(x)
    # Broad cheek support and smooth taper into the jaw, not another notch.
    cheek=bell(a,.066,.025)*bell(y,.236,.031)*fade(a,.032,.045)*(1-fade(a,.099,.119))*fade(y,.177,.200)*(1-fade(y,.269,.286))*fade(z,.042,.094)
    # Suppress protruding lateral orbital/cheek rim without moving the lid loop.
    orbit=bell(a,.069,.012)*bell(y,.287,.011)*fade(a,.055,.066)*(1-fade(a,.084,.101))*fade(z,.064,.111)
    bridge=bell(a,.013,.010)*fade(y,.265,.277)*(1-fade(y,.304,.318))*fade(z,.105,.145)
    ridge=bell(a,0,.008)*fade(y,.270,.280)*(1-fade(y,.303,.317))*fade(z,.115,.149)
    # Rounded nasal tip/alar rim lowered a little; keep philtrum intact.
    rim=bell(a,.022,.010)*bell(y,.266,.010)*fade(a,.007,.014)*(1-fade(a,.033,.044))*fade(y,.253,.263)*(1-fade(y,.277,.285))*fade(z,.106,.136)
    tip=bell(a,0,.016)*bell(y,.274,.010)*fade(y,.263,.269)*(1-fade(y,.283,.292))*fade(z,.130,.154)
    # Lower cheek support is distinct from the excess suborbital bulge.
    uppercheek=bell(a,.051,.023)*fade(a,.020,.034)*(1-fade(a,.086,.105))*fade(y,.252,.270)*(1-fade(y,.290,.302))*fade(z,.087,.126)
    orbit_tip=bell(a,.062,.009)*bell(y,.300,.009)*fade(a,.050,.059)*(1-fade(a,.073,.086))*fade(z,.089,.119)
    target=(x+(1 if x>=0 else -1)*(.0009*cheek-.0008*orbit-.0007*orbit_tip)-.150*x*bridge-.095*x*rim,
            y-.0050*rim-.0030*tip,
            z+.0003*cheek-.0014*orbit-.0030*uppercheek-.0008*orbit_tip+.0009*ridge-.0018*rim-.0012*tip)
    return tuple(a+gate*(b-a) for a,b in zip(p,subnasal(target)))
def fair_weight(p):
    x,y,z=p;a=abs(x)
    # Broad skin-only blend; exclude eyelid rims, nostril and actual lip seam.
    front=fade(z,.045,.092)
    cheek=fade(a,.033,.046)*(1-fade(a,.105,.124))*fade(y,.168,.204)*(1-fade(y,.286,.299))*front
    corner=fade(a,.029,.038)*(1-fade(a,.079,.100))*fade(y,.197,.218)*(1-fade(y,.246,.259))*front
    chin=fade(a,.020,.034)*(1-fade(a,.087,.110))*fade(y,.136,.165)*(1-fade(y,.195,.216))*front
    return max(cheek,corner,chin*.75)

def fair_surface(old,base,faces):
    """Replace both cheek fields by a broad fitted bicubic anatomical patch.
    The target is a single continuous surface per cheek, not repeated
    vertex-level smoothing. The existing lip/nostril/eyelid boundaries and
    outer head are retained; UV duplicate vertices get identical coordinates.
    """
    def basis(a,y):
        u=(a-.068)/.050;v=(y-.235)/.065
        return (1.,u,v,u*u,u*v,v*v,u*u*u,u*u*v,u*v*v,v*v*v)
    def fit_patch(rows):
        weights=[w for _,_,w in rows]
        coef=None
        for _ in range(5):
            n=10;A=[[0.]*n for _ in range(n)];b=[0.]*n
            for (f,z,_),w in zip(rows,weights):
                for i in range(n):
                    b[i]+=w*f[i]*z
                    for j in range(n):A[i][j]+=w*f[i]*f[j]
            for i in range(n):A[i][i]+=(.00001 if i<3 else .012 if i<6 else .10)
            coef=S['solve'](A,b)
            if coef is None:raise ValueError('Singular cheek reconstruction')
            err=[abs(z-sum(a*b for a,b in zip(f,coef))) for f,z,_ in rows]
            scale=max(.0015,2.5*statistics.median(err))
            weights=[w*min(1.,scale/max(e,1e-9)) for (_,_,w),e in zip(rows,err)]
        return coef
    # Area-weighted samples from actual front triangles; cap the influence
    # of overly dense local topology and reject nostril/interior surfaces.
    rows={-1:[],1:[]}
    for i,j,k in faces:
        p,q,r=(base[i],base[j],base[k])
        x,y,z=tuple((p[t]+q[t]+r[t])/3 for t in range(3))
        a=abs(x)
        if not (.034<a<.116 and .158<y<.294 and z>.062):continue
        if a<.043 and y>.246:continue
        u=tuple(q[t]-p[t] for t in range(3));v=tuple(r[t]-p[t] for t in range(3))
        cross=(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0])
        mag=math.sqrt(sum(t*t for t in cross))
        if mag<1e-12 or abs(cross[2])/mag<.30:continue
        rows[1 if x>=0 else -1].append((basis(a,y),z,abs(cross[2])*1e6))
    if min(map(len,rows.values()))<60:raise ValueError('Insufficient cheek patch samples')
    coeff={s:fit_patch(rs) for s,rs in rows.items()}
    out=list(base);near={};targets={};groups=collections.defaultdict(list)
    for i,p in enumerate(old):groups[p].append(i)
    for i,(x,y,z) in enumerate(base):
        a=abs(x);w=fair_weight(old[i])
        # Feather across a broad collar; full replacement in cheek core.
        # Do not let the broad fit cross vermilion, alar rim, or eyelids.
        w*=fade(a,.025,.039)*(1-fade(y,.281,.295))
        if w<=.02:continue
        target=sum(t*c for t,c in zip(basis(a,y),coeff[1 if x>=0 else -1]))
        # A common low-order surface fills troughs AND cuts bulges. Limit
        # exceptional excursions near transition boundaries, not the core.
        dz=max(-.009,min(.009,target-z))
        out[i]=(x,y,z+w*dz)
        near[i]=(w,0,())
        targets[i]=(w,target)
    for ids in groups.values():
        if len(ids)>1 and all(i in near for i in ids):
            avg=tuple(sum(out[i][k] for i in ids)/len(ids) for k in range(3))
            for i in ids:out[i]=avg
    def residual(points):
        return math.sqrt(sum(w*(points[i][2]-t)**2 for i,(w,t) in targets.items())/sum(w for w,t in targets.values()))
    initial=residual(base);final=residual(out)
    if len(near)<80 or not final<initial:raise ValueError('Cheek reconstruction did not improve')
    # Detect collapsed or flipped triangles in the reconstructed patch.
    def cross(p,q,r):
        u=[q[t]-p[t] for t in range(3)];v=[r[t]-p[t] for t in range(3)]
        return (u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0])
    bad=0
    for ids in faces:
        if not any(i in near for i in ids):continue
        n0=cross(*(base[i] for i in ids));n1=cross(*(out[i] for i in ids))
        l0=math.sqrt(sum(v*v for v in n0));l1=math.sqrt(sum(v*v for v in n1))
        if l0>1e-10 and (l1<.1*l0 or sum(a*b for a,b in zip(n0,n1))<0):bad+=1
    # Preserve a diagnostic rather than silently declare visual approval.
    return out,near,{'samples':len(near),'rmsBefore':initial,'rmsAfter':final,
                     'method':'area-weighted robust bicubic cheek reconstruction',
                     'suspectTriangles':bad,'patchSamples':{str(s):len(rs) for s,rs in rows.items()}}

def fair_normals(old,new,n,faces,near):
    # Normals are derived from reconstructed geometry, not smoothed to
    # disguise uneven vertex positions. Match coincident UV seams.
    geom=H['normals'](new,faces)
    out=normal_delta(old,new,n,faces)
    for i,(w,_,_) in near.items():
        q=geom[i]
        if sum(a*b for a,b in zip(q,n[i]))<0:q=tuple(-a for a in q)
        out[i]=unit(tuple((1-w)*a+w*b for a,b in zip(out[i],q)))
    groups=collections.defaultdict(list)
    for i,p in enumerate(old):
        if i in near:groups[p].append(i)
    for ids in groups.values():
        if len(ids)<2:continue
        q=unit(tuple(sum(out[i][k] for i in ids) for k in range(3)))
        for i in ids:out[i]=q
    return out
def normal_delta(old,new,n,faces):
    n0=H['normals'](old,faces);n1=H['normals'](new,faces)
    out=list(n)
    for i,(p,q) in enumerate(zip(old,new)):
        if math.dist(p,q)<1e-8:continue
        out[i]=unit(tuple(a+max(-.45,min(.45,c-b)) for a,b,c in zip(n[i],n0[i],n1[i])))
    return out
def lashes(old,upper):
    out=list(old)
    # Lower eyelid has 66 waterline vertices interleaved after each eye.
    # Keep both waterlines intact and reshape only the actual 42-vertex hairs.
    starts=list(range(0,82*42,42)) if upper else [eye_id*(22*42+66)+j*42 for eye_id in range(2) for j in range(22)]
    for start in starts:
        root=tuple(sum(old[start+j][k] for j in range(6))/6 for k in range(3))
        s=1 if root[0]>=0 else -1
        t=fade(abs(root[0]),.029,.058)
        for j in range(42):
            p=old[start+j];u=(j//6)/6
            if j<6:continue  # Preserve the actual follicle attachment ring.
            # Each root stays attached; the tips follow a swept C curve.
            dx=(p[0]-root[0])*(.78 if upper else .65)
            dy=(p[1]-root[1])*((.65+.12*t) if upper else .46)
            dz=(p[2]-root[2])*(.76 if upper else .55)
            dx+=s*(.0017 if upper else .00035)*t*u*u
            out[start+j]=(root[0]+dx,root[1]+dy,root[2]+dz)
    return out
def brows(old,skin,faces):
    # Rebuild the existing 272 individually tapered fibres in place. Use
    # the outermost actual head-triangle intersection, not a flat decal.
    triangles=[]
    for i,j,k in faces:
        pts=(skin[i],skin[j],skin[k])
        if max(p[1] for p in pts)<.316 or min(p[1] for p in pts)>.352:continue
        if max(p[2] for p in pts)<.090:continue
        triangles.append(pts)
    def surface(x,y):
        hits=[]
        for (ax,ay,az),(bx,by,bz),(cx,cy,cz) in triangles:
            if not min(ax,bx,cx)<=x<=max(ax,bx,cx) or not min(ay,by,cy)<=y<=max(ay,by,cy):continue
            den=(by-cy)*(ax-cx)+(cx-bx)*(ay-cy)
            if abs(den)<1e-14:continue
            u=((by-cy)*(x-cx)+(cx-bx)*(y-cy))/den
            v=((cy-ay)*(x-cx)+(ax-cx)*(y-cy))/den
            if min(u,v,1-u-v)>=-1e-7:hits.append(u*az+v*bz+(1-u-v)*cz)
        if not hits:raise ValueError('Brow fibre has no skin projection')
        return max(hits)
    if len(old)!=272*8:raise ValueError('Unexpected brow fibre layout')
    result=[]
    for start in range(0,len(old),8):
        a,b=old[start:start+2];root=tuple((x+y)*.5 for x,y in zip(a,b))
        side=1 if root[0]>=0 else -1
        t=max(0,min(1,(abs(root[0])-.0185)/.046))
        n=(start//8)%136
        # Multiple irregular rows, fuller inner brow and a tapered outer tail.
        jitter=math.sin(n*12.9898)*.5+math.sin(n*5.31)*.5
        thickness=.0012+.0022*(1-fade(t,.56,1))
        x0=root[0];y0=.3300+.0046*math.sin(math.pi*t)+thickness*jitter
        dx=side*(.0011+.0036*fade(t,.08,.85))
        dy=.0039*(1-fade(t,.08,.65))+.0005-.0021*fade(t,.68,1)
        length=.87+.22*(.5+.5*math.sin(n*2.41))
        for row in range(4):
            u=row/3
            x=x0+dx*length*u
            y=y0+dy*length*(.8*u+.2*u*u)
            width=max(.000012,abs(old[start+2*row+1][0]-old[start+2*row][0])*.68)
            # Width perpendicular to the projected strand direction.
            norm=max(1e-8,math.hypot(dx,dy))
            for sign in (-1,1):
                xx=x+sign*width*(-dy/norm);yy=y+sign*width*(dx/norm)
                result.append((xx,yy,surface(xx,yy)+.00027+.00040*math.sin(math.pi*u)))
    return result

def apply(path):
    g,b=H['read_glb'](path);size=len(b);head=g['meshes'][0]
    skin_new=None;skin_faces=None
    for mi,m in enumerate(g['meshes']):
        name=m['name']
        if mi in (1,2):continue
        for pi,p in enumerate(m['primitives']):
            a=p['attributes'];old=H['accessor'](g,b,a['POSITION']);n=H['accessor'](g,b,a['NORMAL'])
            if mi==0:warp=face_warp
            elif name.startswith('V121_ORAL_'):warp=lip
            elif 'EYEBROW_FIBERS' in name:warp=lambda v:v
            else:warp=eye
            base=list(old)
            if 'UPPER_EYELASHES' in name:base=lashes(old,True)
            elif 'LOWER_EYELASHES' in name:base=lashes(old,False)
            elif 'EYEBROW_FIBERS' in name:
                if skin_new is None:raise ValueError('Missing rebuilt skin')
                base=brows(old,skin_new,skin_faces)
                g['materials'][p['material']]['pbrMetallicRoughness']['baseColorFactor']=[.24,.145,.095,1.]
            new=[warp(v) for v in base]
            idx=[v[0] for v in H['accessor'](g,b,p['indices'])]
            faces=[tuple(idx[i:i+3]) for i in range(0,len(idx),3)]
            if mi==0:
                new,near,report=fair_surface(old,new,faces)
                before_lift=list(new)
                new=[shorten_philtrum(q) for q in new]
                new=[p if p[1]>=.335 or abs(p[0])>=.125 else q for p,q in zip(old,new)]
                # Matched material samples from upper vermilion and nasal base.
                lip_ids=[i for i,(x,y,z) in enumerate(before_lift) if abs(x)<.014 and .237<y<.243 and z>.125]
                nose_ids=[i for i,(x,y,z) in enumerate(before_lift) if abs(x)<.014 and .265<y<.278 and z>.135]
                if not lip_ids or not nose_ids:raise ValueError('Missing philtrum landmark samples')
                gap=lambda ps: statistics.median(ps[i][1] for i in nose_ids)-statistics.median(ps[i][1] for i in lip_ids)
                gap0,gap1=gap(before_lift),gap(new)
                if gap0<=0 or gap1>gap0*.80:raise ValueError('Philtrum vertical shortening below 20 percent')
                report.update({'philtrumBeforeM':gap0,'philtrumAfterM':gap1,'philtrumSampleRatio':gap1/gap0,'revision':'R4'})
                skin_new,skin_faces=new,faces
                # Verify the actual subnasal vertex coordinates were narrowed.
                region=[i for i,(x,y,z) in enumerate(old) if .010<abs(x)<.032 and .252<y<.266 and z>.130]
                if not region:raise ValueError('No subnasal verification vertices')
                ratio=statistics.median(abs(new[i][0])/abs(old[i][0]) for i in region)
                if ratio>=.95:raise ValueError('Subnasal width not reduced')
                report['subnasalMedianWidthRatioVsV27']=ratio
                report['qualityApproved']=False
                head['extras']['mouthChinRebuild']['v28R2Fairing']=report
                nn=fair_normals(old,new,n,faces,near)
            else:
                if name.startswith('V121_ORAL_'):
                    new=[shorten_philtrum(q) for q in new]
                nn=normal_delta(old,new,n,faces)
            if mi==0 or name.startswith('V121_ORAL_'):
                original_warp=warp
                warp=lambda v:shorten_philtrum(original_warp(v))
            store(g,b,a['POSITION'],new);store(g,b,a['NORMAL'],nn)
            for t in p.get('targets',[]):
                d=H['accessor'](g,b,t['POSITION'])
                # Keep all original channels, transform the local delta.
                vals=[]
                for v,q,dd in zip(base,new,d):
                    start=warp(v);end=warp(tuple(x+y for x,y in zip(v,dd)))
                    vals.append(tuple(x-y for x,y in zip(end,start)))
                store(g,b,t['POSITION'],vals)
    # Globe roots stay registered in their original nodes. Slightly reduce
    # frontal projection, keeping the UV iris and actual eyeball intact.
    for node in g['nodes']:
        if node.get('mesh') in (1,2) and 'translation' in node:
            node['translation'][2]-=.0007
    head['extras']['mouthChinRebuild']['v28ReferenceAnatomy']={'version':'v28','cheekSupport':True,'orbitalRimReduced':True,'upperLipThinner':True,'lowerLipFuller':True,'nasalRimRounded':True,'upperLashesSwept':True,'lowerLashesShortened':True,'protectedScalpExact':True,'muzzleRetracted':True,'upperCheekReduced':True,'browFibresSurfaceReprojected':272}
    if len(b)!=size:raise ValueError('GLB binary grew')
    raw=json.dumps(g,ensure_ascii=False,separators=(',',':')).encode();raw+=b' '*((-len(raw))%4)
    b+=b'\0'*((-len(b))%4)
    path.write_bytes(struct.pack('<4sII',b'glTF',2,28+len(raw)+len(b))+struct.pack('<I4s',len(raw),b'JSON')+raw+struct.pack('<I4s',len(b),b'BIN\0')+b)
    print('v28 R4 anatomy, unchanged BIN size',size,head['extras']['mouthChinRebuild']['v28R2Fairing'])
if __name__=='__main__':apply(pathlib.Path(sys.argv[1]))
