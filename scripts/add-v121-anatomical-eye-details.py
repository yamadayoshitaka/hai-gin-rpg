#!/usr/bin/env python3
"""Add REAL v121 eye-line, fine lashes, eyelid crease and brows to exported GLB.

All parts are actual indexed triangles, not 2D screenshots or JS-only overlays.
They are separate named face-local meshes, ready for later brow/eyelid rigging.
Female v121 only; original 13455 skin vertex IDs/UVs/triangles are preserved.
"""
import argparse
import json
import math
import pathlib
import random
import struct

def read(path):
    raw=path.read_bytes()
    if raw[:4]!=b'glTF' or struct.unpack_from('<II',raw,4)!=(2,len(raw)):
        raise ValueError('Expected GLB v2')
    size=struct.unpack_from('<I',raw,12)[0]
    data=json.loads(raw[20:20+size])
    off=20+size
    if raw[off+4:off+8]!=b'BIN\0':
        raise ValueError('No BIN chunk')
    return data,bytearray(raw[off+8:])

def unpack(g,b,idx):
    a=g['accessors'][idx]
    columns={'SCALAR':1,'VEC2':2,'VEC3':3}[a['type']]
    fmt={5123:'H',5125:'I',5126:'f'}[a['componentType']]
    view=g['bufferViews'][a['bufferView']]
    offset=view.get('byteOffset',0)+a.get('byteOffset',0)
    stride=view.get('byteStride',struct.calcsize(fmt)*columns)
    return [struct.unpack_from('<'+fmt*columns,b,offset+i*stride)
            for i in range(a['count'])]

def pack(g,b,rows,typ,shape):
    raw=b''.join(struct.pack('<'+{'f': 'f', 'I': 'I'}[typ]*len(row),*row)
                 for row in rows)
    while len(b)%4:b.append(0)
    start=len(b)
    b.extend(raw)
    v=len(g['bufferViews'])
    g['bufferViews'].append({'buffer':0,'byteOffset':start,'byteLength':len(raw)})
    aid=len(g['accessors'])
    ac={'bufferView':v,'componentType':5126 if typ=='f' else 5125,
        'count':len(rows),'type':shape}
    if shape=='VEC3':
        ac['min']=[min(row[k] for row in rows) for k in range(3)]
        ac['max']=[max(row[k] for row in rows) for k in range(3)]
    g['accessors'].append(ac)
    return aid

def clamp(v,a=0.,b=1.):
    return max(a,min(b,v))

def bell(v,c,w):
    return math.exp(-.5*((v-c)/w)**2)

def main(path):
    g,b=read(path)
    skin=g['meshes'][0]
    meta=skin.get('extras',{})
    if meta.get('version')!=121 or meta['topology']['vertices']!=13455:
        raise ValueError('Refuse all non-v121 meshes')
    if meta.get('eyelidFiberUpgrade'):
        raise ValueError('Already upgraded')
    if len(g['meshes'])!=3 or len(g['nodes'])!=3:
        raise ValueError('Unexpected base (must be one skin plus two eye globes)')
    base=skin['primitives'][0]
    points=unpack(g,b,base['attributes']['POSITION'])
    # Sample the true lower eyelid rim from the head's open eye-socket
    # triangle boundary. Previous hard-coded y=.2986 left detached dots
    # visibly below the eye in the user's Android close-up.
    head_index=[i[0] for i in unpack(g,b,base['indices'])]
    edge_uses={}
    for i in range(0,len(head_index),3):
        a,bb,c=head_index[i:i+3]
        for e in ((a,bb),(bb,c),(c,a)):
            key=tuple(sorted(e))
            edge_uses[key]=edge_uses.get(key,0)+1
    rim_ids=set()
    for (a,bb),uses in edge_uses.items():
        if uses==1:
            rim_ids.update((a,bb))
    rim_candidates={}
    for side in (-1,1):
        rim_candidates[side]=[(x,y,z) for j,(x,y,z) in enumerate(points)
                              if j in rim_ids and x*side>.022 and x*side<.053
                              and .298<y<.312 and z>.105 and z<.145]
        if len(rim_candidates[side])<12:
            raise ValueError('Could not identify actual lower eyelid boundary')
    # Only the anatomically exposed front surface participates. The eye hole
    # has deep rear-wall vertices which must NEVER define eyeliner depth.
    surface=[(x,y,z) for x,y,z in points if z>.102 and
             .012<abs(x)<.077 and .280<y<.375]
    if len(surface)<200:
        raise ValueError('No valid face surface around eyelids and brows')
    def skin_z(x,y):
        near=sorted(((sx-x)**2+(sy-y)**2,z)
                    for sx,sy,z in surface)[:5]
        return sum(z/(d+.000001) for d,z in near)/sum(1/(d+.000001) for d,_ in near)
    # Derive the cosmetic line from the real eye opening, not straight eyeliner.
    # Inner corner lies by nose; outer tail is tapered and lightly upturned.
    def lid(s,t):
        x=s*(.0365+.0214*t)
        arch=math.sqrt(max(0.,1.-t*t))
        y=.3054+.0109*arch+.0014*clamp((t-.70)/.30)
        return x,y
    def lower_lid(s,t):
        # Interpolate rim position and depth directly from real skin geometry:
        # do not infer the root from a painted eyelid or an arbitrary offset.
        x=s*(.0365+.0124*t)
        expected_y=.3019+.0057*t*t
        neighbors=sorted(
            rim_candidates[s],
            key=lambda p:((p[0]-x)/.005)**2+
                         ((p[1]-expected_y)/.007)**2
        )[:5]
        weights=[1/(.0000002+(p[0]-x)**2+
                    .65*(p[1]-expected_y)**2) for p in neighbors]
        total=sum(weights)
        y=sum(w*p[1] for w,p in zip(weights,neighbors))/total
        z=sum(w*p[2] for w,p in zip(weights,neighbors))/total
        return x,y-.00020,z+.00042
    # Mesh builders: triangles with real volume/silhouette in the close-up,
    # not flat vertex-colored eyebrows or fake pupil discs.
    def new_part(name,color,rough=.80):
        mid=len(g['materials'])
        g['materials'].append({
            'name':name+'_PBR',
            'doubleSided':True,
            'pbrMetallicRoughness':{
                'baseColorFactor':[*color,1.0],
                'metallicFactor':0,'roughnessFactor':rough}})
        return {'name':name,'material':mid,'xyz':[],'faces':[],'strands':0}
    liner=new_part('V121_UPPER_EYELINER',(.145,.080,.072),.69)
    crease=new_part('V121_NATURAL_UPPER_LID_CREASE',(.48,.30,.28),.90)
    upper=new_part('V121_TAPERED_UPPER_EYELASHES',(.115,.077,.061),.62)
    lower=new_part('V121_FINE_LOWER_EYELASHES',(.26,.18,.15),.76)
    brow=new_part('V121_INDIVIDUAL_EYEBROW_FIBERS',(.36,.27,.23),.89)
    rng=random.Random(121236)

    def ribbon(part,control,widths):
        # Variable width / connected, front-facing quad strip.
        if len(control)!=len(widths):
            raise ValueError('Unequal ribbon lengths')
        at=len(part['xyz'])
        for j,(x,y,z) in enumerate(control):
            w=widths[j]
            part['xyz'].extend(((x,y-w*.5,z),(x,y+w*.5,z)))
        for j in range(len(control)-1):
            a=at+2*j
            part['faces'].extend(((a,a+1,a+2),(a+1,a+3,a+2)))
        if 'normals' in part:
            # Keep per-vertex normals aligned when a lower-lid ribbon is
            # interleaved between the left and right eye's 3D lash tubes.
            part['normals'].extend([(0.,0.,1.)]*(2*len(control)))
        part['strands']+=1

    def curved_lash(part,pts,root_radius):
        """Seven elliptical rings: actual C-curled, tapering 3D hair geometry.

        Root emerges at the upper/lower waterline; curved tangent starts
        projecting forward before its tip turns up/down. Rounded geometry
        has real vertex normals and survives mobile antialiasing better than
        the previous hairline-width, camera-facing planar triangles.
        """
        sides=6
        at=len(part['xyz'])
        assert len(pts)==7
        for k,p in enumerate(pts):
            prev=pts[max(0,k-1)]
            next_p=pts[min(len(pts)-1,k+1)]
            tangent=unit(tuple(next_p[d]-prev[d] for d in range(3)))
            # Cross world z with tangent to obtain stable sideways axis.
            bx=unit((-tangent[1],tangent[0],0.))
            bz=unit((tangent[1]*bx[2]-tangent[2]*bx[1],
                     tangent[2]*bx[0]-tangent[0]*bx[2],
                     tangent[0]*bx[1]-tangent[1]*bx[0]))
            u=k/6
            taper=(1-u)**.75
            radius=root_radius*max(.035,taper)
            if k==0: radius*=.73
            for segment in range(sides):
                theta=math.tau*segment/sides
                c=math.cos(theta)
                d=math.sin(theta)
                radial=unit(tuple(bx[q]*c+bz[q]*d for q in range(3)))
                # Elliptical cross section: thicker across x, thinner in z.
                part['xyz'].append(tuple(p[q]+radius*(bx[q]*c+.66*bz[q]*d)
                                         for q in range(3)))
                part.setdefault('normals',[]).append(radial)
        for k in range(len(pts)-1):
            for segment in range(sides):
                a=at+k*sides+segment
                b=at+k*sides+(segment+1)%sides
                c=at+(k+1)*sides+segment
                d=at+(k+1)*sides+(segment+1)%sides
                part['faces'].extend(((a,b,c),(b,d,c)))
        part['strands']+=1

    def unit(v):
        length=math.sqrt(sum(t*t for t in v))
        return tuple(t/length for t in v) if length>1e-9 else (1.,0.,0.)

    def fiber(part,pts,width):
        # Fine brow hairs remain individual planar tapered fibers; lashes
        # above and below the eye use real 3D curved tube geometry.
        at=len(part['xyz'])
        for j,(x,y,z) in enumerate(pts):
            ww=max(width*(1-j/(len(pts)-1))**.85,.000006)
            part['xyz'].extend(((x-ww,y,z),(x+ww,y,z)))
        for j in range(len(pts)-1):
            a=at+2*j
            part['faces'].extend(((a,a+1,a+2),(a+1,a+3,a+2)))
        part['strands']+=1

    for side in (-1,1):
        upperline=[]
        crease_line=[]
        for j in range(49):
            t=-1+2*j/48
            x,y=lid(side,t)
            upperline.append((x,y,skin_z(x,y)+.00085))
            cy=y+.0053+.0012*(1-abs(t))
            crease_line.append((x,cy,skin_z(x,cy)+.00039))
        widths=[]
        for j in range(49):
            t=-1+2*j/48
            widths.append(.00012+.00115*math.sin(math.pi*j/48)**.9+
                          .00045*clamp((t-.78)/.22))
        ribbon(liner,upperline,widths)
        ribbon(crease,crease_line,[.000018+.00033*math.sin(math.pi*j/48)
                                  for j in range(49)])
        # Wispy, individually tapered lashes. Outer lashes fan laterally and
        # curl into z, rather than making a thick flat black triangle.
        for j in range(41):
            t=-.91+1.85*j/40
            x,y=lid(side,t)
            z=skin_z(x,y)+.0010
            length=(.0066+.0032*max(0.,1.-abs(t))+
                    .0020*clamp((t-.25)/.75))*(.88+.18*rng.random())
            fan=side*(.0018+.0040*clamp((t+.20)/1.20))
            # Root first projects toward the viewer; later segments lift
            # and curl upward in the reference's natural C-shaped silhouette.
            pts=[(x+fan*u*(.65+.35*u),
                  y+length*(.12*u+.88*u*u),
                  z+.0060*math.sin(1.72*u)+.0001*u)
                 for u in (0,.16,.33,.50,.67,.84,1.)]
            curved_lash(upper,pts,.000185+.000050*rng.random())
        for j in range(22):
            t=-.86+1.70*j/21
            x,y,z=lower_lid(side,t)
            # Root on the lower waterline, tips sweep DOWN and slightly OUT.
            # The reference has fine sparse lower lashes, not floating dots.
            length=(.0036+.00165*(1-abs(t)))*(.88+.20*rng.random())
            sideways=side*(.00050+.0017*max(0.,t))
            # Lower lashes curve DOWN while first growing away from skin,
            # so their tips are not hidden by the lower eyelid surface.
            pts=[(x+sideways*u*(.8+.2*u),
                  y-length*(.12*u+.88*u*u),
                  z+.00295*math.sin(1.65*u)+.00035*u)
                 for u in (0,.16,.33,.50,.67,.84,1.)]
            curved_lash(lower,pts,.000155+.000038*rng.random())
        # A soft, unobtrusive waterline connects the actual lower-lid rim,
        # making the roots visible even when the face fills ~280 mobile px.
        lower_edge=[]
        for j in range(33):
            t=-.86+1.72*j/32
            x,y,z=lower_lid(side,t)
            lower_edge.append((x,y-.00016,z+.00072))
        ribbon(lower,lower_edge,[.00007+.00035*math.sin(math.pi*j/32)**.8
                                for j in range(33)])
        lower['strands']-=1  # Continuous lid edge is not an eyelash strand.
        # 136 subtle blonde-taupe eyebrow hairs per eye with follicle roots
        # attached to the actual head surface. Gradual inner-to-outer slope.
        for j in range(136):
            t=(j+.36*rng.random())/136
            x=side*(.0185+.0460*t+.00034*(rng.random()-.5))
            arch=.0058*math.sin(math.pi*t)
            y=.3475+arch+.0019*(rng.random()-.5)
            z=skin_z(x,y)+.00048
            span=(.0024+.0023*math.sin(math.pi*t)**.75)*(.85+.27*rng.random())
            lateral=side*(.0012+.0025*t)
            pts=[(x+lateral*u,
                  y+span*(u*.77+.23*u*u),
                  z+.0007*u+.00025*u*u)
                 for u in (0,.35,.72,1.)]
            fiber(brow,pts,.000085+.000045*rng.random())

    # Slightly richer actual lip vertex colour rather than an unrelated 2D
    # cosmetic decal; preserve all v121 UV and indexed skin geometry.
    color_id=base['attributes']['COLOR_0']
    old_colors=unpack(g,b,color_id)
    new_colors=[]
    for (x,y,z),(r,gg,bb) in zip(points,old_colors):
        lip=(bell(y,.197,.019)*bell(x,0,.043)*
             clamp((z-.095)/.046))
        new_colors.append((clamp(r*(1-.015*lip)),
                           clamp(gg*(1-.115*lip)),
                           clamp(bb*(1-.090*lip))))
    base['attributes']['COLOR_0']=pack(g,b,new_colors,'f','VEC3')

    metrics={}
    for part in (liner,crease,upper,lower,brow):
        if not part['faces']:
            raise ValueError('Face detail has no triangles: '+part['name'])
        all_normals=part.get('normals',[])
        if all_normals:
            if len(all_normals)!=len(part['xyz']):
                raise ValueError('Curved lash normals are not vertex-index aligned')
        else:
            all_normals=[(0.,0.,1.)]*len(part['xyz'])
        attrs={
            'POSITION':pack(g,b,part['xyz'],'f','VEC3'),
            'NORMAL':pack(g,b,all_normals,'f','VEC3')}
        faces=pack(g,b,[(i,) for f in part['faces'] for i in f],'I','SCALAR')
        mesh_i=len(g['meshes'])
        g['meshes'].append({
            'name':part['name'],
            'primitives':[{'attributes':attrs,'indices':faces,
                           'material':part['material']}],
            'extras':{'rootSpace':'original_face_skin_local',
                      'neutralOnly':True,
                      'futureRigAnchor':part['name'].split('_')[2],
                      'curveCount':part['strands'],
                      'freeFloating':False}})
        # Reuse the head node's transform, so socket and brow contours remain
        # in the same coordinate system as the native skin mesh.
        node_i=len(g['nodes'])
        original=g['nodes'][0]
        node={'name':part['name'],'mesh':mesh_i}
        for field in ('translation','rotation','scale','matrix'):
            if field in original:
                node[field]=list(original[field])
        g['nodes'].append(node)
        g['scenes'][0]['nodes'].append(node_i)
        metrics[part['name']]={
            'vertices':len(part['xyz']),
            'triangles':len(part['faces']),
            'strands':part['strands']}

    meta['eyelidFiberUpgrade']={
        'version':'v121-eye-details-2',
        'browsAreFacialFeaturesNotScalpHair':True,
        'method':'native indexed tapered triangle strips using skin surface depth',
        'features':metrics,
        'neutralOnly':True,
        'futureBlinkTargetsReady':True,
        'lowerLashAttachment':'true_eyelid_rim_boundary_interpolation',
        'lowerLashPlacementVersion':'v121-anatomical-rim-20261123',
        'curvedLashGeometry':'seven_segment_elliptical_3d_tapered_C_curl',
        'upperLashCcurl':True,'lowerLashDownwardCurl':True,
        'lowerLidWaterline':True}
    if meta.get('hairIncluded') is not False:
        raise ValueError('Unexpected head hair state')
    g['buffers'][0]['byteLength']=len(b)
    g['asset']['generator']='HaiGin v121 Anatomical GLB + Real Liner/Lashes/Brow Fibers'
    encoded=json.dumps(g,separators=(',',':'),ensure_ascii=False).encode()
    encoded+=b' '*((-len(encoded))%4)
    b+=b'\0'*((-len(b))%4)
    length=12+8+len(encoded)+8+len(b)
    with path.open('wb') as f:
        f.write(struct.pack('<4sII',b'glTF',2,length))
        f.write(struct.pack('<I4s',len(encoded),b'JSON'));f.write(encoded)
        f.write(struct.pack('<I4s',len(b),b'BIN\0'));f.write(b)
    print('v121 EYE DETAILS actual geometry',json.dumps(metrics),
          'face vertices retained',len(points),'total GLB bytes',length)

if __name__=='__main__':
    cli=argparse.ArgumentParser()
    cli.add_argument('glb',type=pathlib.Path)
    main(cli.parse_args().glb)
