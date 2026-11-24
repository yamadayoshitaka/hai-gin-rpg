#!/usr/bin/env python3
"""Actual GLB sculpt to the four-view reference; preserve topology and byte budget."""
import math,pathlib,runpy,statistics,struct,json,sys
V=runpy.run_path(str(pathlib.Path(__file__).with_name('refine-v121-mouth-v27.py')))
H=V['H'];S=V['S'];fade=V['fade'];bell=V['bell'];unit=V['unit'];store=V['replace_vec3']
def lip(p):
    x,y,z=p;a=abs(x)
    w=(1-fade(a,.025,.038))*fade(z,.113,.138)*fade(y,.204,.219)*(1-fade(y,.243,.251))
    upper=fade(y,.232,.236)
    lower=1-fade(y,.228,.232)
    return (x,y-(y-.232)*(.24*upper-.22*lower)*w,z+(.0011*bell(y,.225,.004)*lower-.00085*bell(y,.238,.004)*upper)*w)
def eye(p):
    x,y,z=p;a=abs(x);s=1 if x>=0 else -1
    w=fade(a,.010,.019)*(1-fade(a,.062,.076))*fade(y,.282,.296)*(1-fade(y,.324,.335))*fade(z,.090,.118)
    return (x+.045*(x-s*.0365)*w,y-.10*(y-.307)*w+.0011*fade(a,.038,.061)*w,z)
def face_warp(p):
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
    return (x+math.copysign(.0009*cheek-.0008*orbit,x)-.065*x*bridge,
            y-.0023*rim-.0012*tip,
            z+.0036*cheek-.0020*orbit+.0012*ridge+.0009*rim+.0006*tip)
def fair_weight(p):
    x,y,z=p;a=abs(x)
    return fade(a,.034,.046)*(1-fade(a,.100,.121))*fade(y,.186,.210)*(1-fade(y,.270,.284))*fade(z,.047,.093)
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
            # Each root stays attached; the tips follow a swept C curve.
            dx=(p[0]-root[0])*(.78 if upper else .65)
            dy=(p[1]-root[1])*((.65+.12*t) if upper else .46)
            dz=(p[2]-root[2])*(.76 if upper else .55)
            dx+=s*(.0017 if upper else .00035)*t*u*u
            out[start+j]=(root[0]+dx,root[1]+dy,root[2]+dz)
    return out
def apply(path):
    g,b=H['read_glb'](path);size=len(b);head=g['meshes'][0]
    for mi,m in enumerate(g['meshes']):
        name=m['name']
        if mi in (1,2):continue
        for pi,p in enumerate(m['primitives']):
            a=p['attributes'];old=H['accessor'](g,b,a['POSITION']);n=H['accessor'](g,b,a['NORMAL'])
            if mi==0:warp=face_warp
            elif name.startswith('V121_ORAL_'):warp=lip
            else:warp=eye
            base=list(old)
            if 'UPPER_EYELASHES' in name:base=lashes(old,True)
            elif 'LOWER_EYELASHES' in name:base=lashes(old,False)
            new=[warp(v) for v in base]
            idx=[v[0] for v in H['accessor'](g,b,p['indices'])]
            faces=[tuple(idx[i:i+3]) for i in range(0,len(idx),3)]
            if mi==0:
                # Fair the supported cheek on actual local neighborhoods.
                near=S['neighborhoods'](new)
                near={i:(fair_weight(old[i]),r,q) for i,(_,r,q) in near.items() if fair_weight(old[i])>.05}
                initial=list(new)
                for _ in range(4):
                    nxt=list(new)
                    for i,(w,r,q) in near.items():
                        fit=S['fit'](new,i,q)
                        if fit is None:continue
                        x,y,z=new[i];d=max(-.00018,min(.00018,.45*w*fit[0]))
                        nxt[i]=(x,y,max(initial[i][2]-.0007,min(initial[i][2]+.0007,z+d)))
                    new=nxt
            nn=normal_delta(old,new,n,faces)
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
    head['extras']['mouthChinRebuild']['v28ReferenceAnatomy']={'version':'v28','cheekSupport':True,'orbitalRimReduced':True,'upperLipThinner':True,'lowerLipFuller':True,'nasalRimRounded':True,'upperLashesSwept':True,'lowerLashesShortened':True}
    if len(b)!=size:raise ValueError('GLB binary grew')
    raw=json.dumps(g,ensure_ascii=False,separators=(',',':')).encode();raw+=b' '*((-len(raw))%4)
    b+=b'\0'*((-len(b))%4)
    path.write_bytes(struct.pack('<4sII',b'glTF',2,28+len(raw)+len(b))+struct.pack('<I4s',len(raw),b'JSON')+raw+struct.pack('<I4s',len(b),b'BIN\0')+b)
    print('v28 anatomy, unchanged BIN size',size)
if __name__=='__main__':apply(pathlib.Path(sys.argv[1]))
