#!/usr/bin/env python3
"""Final female v121 GLB stage: clean cosmetic band/chin tint, sculpt soft folds.

This edits real skin POSITION, NORMAL and COLOR_0 attributes and saves a GLB.
The 13,455 indexed face vertex IDs, UVs, geometry index buffer, eye/pupil UV,
eyelashes, brows, rig zones and older game models are not changed.
"""
import argparse
import json
import math
import pathlib
import struct


def bell(x, center, width):
    return math.exp(-.5*((x-center)/width)**2)


def clamp(x, low=0., high=1.):
    return max(low, min(high, x))


def fade(x, low, high):
    t=clamp((x-low)/(high-low))
    return t*t*(3-2*t)


def read_glb(path):
    data=path.read_bytes()
    if data[:4]!=b'glTF' or struct.unpack_from('<II',data,4)!=(2,len(data)):
        raise ValueError('Expected complete GLB 2.0')
    json_length=struct.unpack_from('<I',data,12)[0]
    graph=json.loads(data[20:20+json_length])
    offset=20+json_length
    if data[offset+4:offset+8]!=b'BIN\0':
        raise ValueError('GLB missing binary chunk')
    return graph,bytearray(data[offset+8:])


def accessor(g,b,i):
    a=g['accessors'][i]
    c={'SCALAR':1,'VEC2':2,'VEC3':3}[a['type']]
    fmt={5123:'H',5125:'I',5126:'f'}[a['componentType']]
    view=g['bufferViews'][a['bufferView']]
    start=view.get('byteOffset',0)+a.get('byteOffset',0)
    stride=view.get('byteStride',c*struct.calcsize(fmt))
    return [struct.unpack_from('<'+fmt*c,b,start+j*stride)
            for j in range(a['count'])]


def add_vec3(g,b,values):
    while len(b)%4:b.append(0)
    offset=len(b)
    for v in values:
        b.extend(struct.pack('<fff',*v))
    view=len(g['bufferViews'])
    g['bufferViews'].append({'buffer':0,'byteOffset':offset,
                             'byteLength':12*len(values)})
    ai=len(g['accessors'])
    g['accessors'].append({
        'bufferView':view,'componentType':5126,'type':'VEC3',
        'count':len(values),
        'min':[min(v[k] for v in values) for k in range(3)],
        'max':[max(v[k] for v in values) for k in range(3)]})
    return ai


def normalise(v):
    d=math.sqrt(sum(t*t for t in v))
    return tuple(t/d for t in v) if d>1e-12 else (0.,0.,1.)


def normals(points,triangles):
    out=[[0.,0.,0.] for _ in points]
    for a,b,c in triangles:
        p,q,r=points[a],points[b],points[c]
        u=[q[k]-p[k] for k in range(3)]
        v=[r[k]-p[k] for k in range(3)]
        face=(u[1]*v[2]-u[2]*v[1],
              u[2]*v[0]-u[0]*v[2],
              u[0]*v[1]-u[1]*v[0])
        for i in (a,b,c):
            for k in range(3):
                out[i][k]+=face[k]
    return [normalise(t) for t in out]


def fold_displacement(x,y,z):
    """Eliminate lateral dimples; retain only very fine under-eye skin relief.

    Earlier v121 built a nostril-to-mouth *lateral nasolabial* valley and an
    extra mouth-corner pit. The reference request is instead the CENTRAL
    philtrum beneath the columella, not smile lines at either cheek.
    """
    front=fade(z,.075,.122)
    ax=abs(x)
    under_eye=(-.00026*bell(y,.287,.0038)*
               fade(ax,.023,.033)*(1.-fade(ax,.062,.072))*front)
    # Fill the artificial corner dimples left by the prior lateral crease.
    # Only touch skin on the outward corner surface, not actual lip geometry.
    dimple_fill=(.0028*bell(ax,.046,.010)*bell(y,.232,.014)*
                 fade(z,.078,.128)*(1.-fade(z,.154,.17)))
    return under_eye+dimple_fill


def philtrum_relief(x,y,z):
    """Real central groove under the nasal septum, fading into Cupid's bow.

    The groove is not drawn as a dark cosmetic line. Paired raised philtral
    columns create the light/shadow difference naturally from the 3D surface.
    """
    # Previous -0.0092 peak formed an oval *hole* in the upper-lip skin:
    # its y mask cut off well before the septum and the paired high columns
    # exaggerated the isolated depression. The actual philtrum is a LONG,
    # gently shaded central channel, not a circular indentation.
    if y<.236 or y>.266:
        return 0.
    # The actual upper lip is centered at local Y≈.240, not .208. Keep
    # the philtrum between the lip and nasal base, never on the chin.
    vertical=fade(y,.236,.244)*(1.-fade(y,.258,.266))
    front=fade(z,.071,.116)
    groove=-.0038*bell(x,0,.0057)*vertical*front
    columns=.00095*(bell(x,-.0102,.0046)+bell(x,.0102,.0046))*vertical*front
    return groove+columns



def nose_and_lips(x,y,z):
    """Localized real-mesh sculpt; keep nostril cavity and mouth loop intact.

    Narrow the alar silhouette and soften the front-facing bulbous nasal
    tip without bridging the two nostril openings. Shape a genuine Cupid's
    bow, upper and lower vermilion, philtrum and relaxed closed lip seam.
    """
    ax=abs(x)
    nose_front=fade(z,.093,.141)
    wing=(bell(ax,.028,.017)*bell(y,.243,.024)*fade(z,.084,.127)*
          (1.-fade(ax,.043,.054)))
    nx=x*(1.-.063*wing)
    tip=bell(x,0.,.017)*bell(y,.250,.016)*fade(z,.122,.154)
    ala=bell(ax,.027,.011)*bell(y,.242,.018)*nose_front*(1.-fade(ax,.043,.054))
    nz=z-.0030*tip-.00115*ala
    lip_front=fade(z,.103,.137)
    horizontal=bell(x,0,.038)*(1.-fade(ax,.044,.056))
    upper=bell(y,.2400,.0072)*horizontal*lip_front
    lower=bell(y,.2235,.0086)*horizontal*lip_front
    cupids=bell(ax,.012,.0065)*bell(y,.245,.007)*lip_front
    seam=bell(y,.232,.0028)*horizontal*lip_front
    nz+=(.0028*upper+.0043*lower+.0012*cupids
         -.0008*seam)
    nz+=philtrum_relief(nx,y,nz)
    return (nx,y,nz)


def neutral_color(x,y,z):
    """Reference-like soft makeup, anchored to anatomical vertices.

    Avoid colour patches between the eyes/brows or on chin. Each mask
    fades on all edges; PBR BaseColor remains the underlying real skin.
    """
    ax=abs(x)
    front=fade(z,.070,.125)
    # Light rose blush following upper outer cheeks, nowhere near chin.
    # Do not extend blush into the lower jaw, even at a tiny gaussian tail.
    cheek=((bell(x,-.077,.037)+bell(x,.077,.037))*
           bell(y,.256,.033)*front if y>=.215 else 0.)
    nose_tip=bell(x,0,.024)*bell(y,.258,.012)*fade(z,.118,.153)
    # The upstream resting lipstick is strictly bounded to the two
    # anatomical vermilion bands. Gaussian tails must never tint a chin.
    lip_region=(.216<=y<=.249 and abs(x)<=.052 and z>.119)
    vermilion=(.78*bell(y,.240,.0068)+bell(y,.224,.0078))
    lips=(vermilion*bell(x,0,.033)*fade(z,.119,.143)
          if lip_region else 0.)
    # Soft brown-beige upper eyelid shadow, bounded below the actual brows.
    shadow=(bell(x,-.044,.025)+bell(x,.044,.025))*bell(y,.318,.005)*front
    lower_liner=(bell(x,-.044,.023)+bell(x,.044,.023))*bell(y,.295,.004)*front
    # R channel near 1, G/B reductions create soft pink and taupe accents.
    return (clamp(.995-.007*lips-.024*shadow-.009*lower_liner),
            clamp(.994-.075*cheek-.022*nose_tip-.170*lips-.037*shadow-.015*lower_liner),
            clamp(.992-.094*cheek-.027*nose_tip-.190*lips-.049*shadow-.021*lower_liner))


def smooth_chin(points,faces):
    """One bounded pass across the old jagged chin shading, not the lips."""
    adjacency=[set() for _ in points]
    for a,b,c in faces:
        adjacency[a].update((b,c))
        adjacency[b].update((a,c))
        adjacency[c].update((a,b))
    result=list(points)
    smoothed=0
    for i,(x,y,z) in enumerate(points):
        if not (.098<y<.177 and abs(x)<.082 and z>.005):
            continue
        weight=(fade(y,.109,.133)*(1-fade(y,.153,.172))*
                (1-fade(abs(x),.058,.080))*fade(z,.005,.050))
        if weight<.015 or not adjacency[i]:
            continue
        mean=sum(points[j][2] for j in adjacency[i])/len(adjacency[i])
        value=clamp(mean-z,-.003,.003)*.32*weight
        result[i]=(x,y,z+value)
        if abs(value)>1e-7:smoothed+=1
    return result,smoothed



def correct_chin_profile(points):
    """Rebuild v121 mandibular outline against the *finished* lower/upper lip.

    Upstream sculpting uses coordinate-local gaussians.  They can all run
    successfully while the final frontal chin is as far forward as the lips.
    A measured sagittal guardrail avoids that visual regression and feathers
    the correction out at the cheeks and toward the neck.
    """
    # Collect the frontal region without an assumed Z depth; the source GLB
    # can vary its absolute facial Z offsets. Max Z selects the forward skin.
    lip=[z for x,y,z in points if abs(x)<.042 and .217<y<.249]
    chin=[z for x,y,z in points if abs(x)<.055 and .110<y<.163]
    print('V121 SAGITTAL PROBE', {
        'lipCount':len(lip), 'chinCount':len(chin),
        'lipZMax':max(lip) if lip else None,
        'chinZMax':max(chin) if chin else None})
    if len(lip)<12 or len(chin)<12:
        raise ValueError('Cannot measure v121 sagittal lip/chin profile')
    lip_front=max(lip)
    chin_before=max(chin)
    clearance=.0170
    # Even when the chin is already behind the lips numerically, the
    # lower-face silhouette can still look elongated/angular. Give the
    # menton a small, guaranteed round-and-recede fairing pass.
    displacement=max(.0060,chin_before-(lip_front-clearance))
    print('V121 CHIN SECTION ZMAX', [
        (round(low,3),round(max((z for x,y,z in points
            if abs(x)<.065 and low<=y<low+.016),default=-1.),5))
        for low in (.092,.108,.124,.140,.156,.172,.188,.204)])
    if displacement>.038:
        raise ValueError('Chin correction too large; verify face coordinates')
    result=[]
    changed=0
    for x,y,z in points:
        ax=abs(x)
        # Flat-topped core with smooth C1 lateral/vertical fades. There is
        # no displacement on the red lip, lateral cheek or cervical base.
        lateral=1.-fade(ax,.034,.083)
        vertical=fade(y,.080,.116)*(1.-fade(y,.154,.182))
        frontal=fade(z,.035,.086)
        w=lateral*vertical*frontal
        # Lift and round the menton a little without turning the jaw into
        # a pointed wedge. The neck y<.080 does not move at all.
        lift=.0062*bell(y,.125,.026)*(1.-fade(ax,.039,.081))*vertical
        # A gently fuller central U-shaped menton in frontal view.
        rounded_x=x*(1.+.022*bell(y,.127,.027)*lateral*vertical)
        result.append((rounded_x,y+lift,z-displacement*w))
        if displacement*w>.00005 or lift>.00005:changed+=1
    chin_after=max(z for x,y,z in result
                   if abs(x)<.055 and .110<y<.163)
    if chin_after>lip_front-clearance+.0006:
        raise ValueError('v121 sagittal chin profile remains protrusive')
    return result,{
        'version':'female-v121-sagittal-guard-20261123',
        'lipFrontZ':round(lip_front,6),
        'chinBeforeZ':round(chin_before,6),
        'chinAfterZ':round(chin_after,6),
        'lipChinDepthClearance':clearance,
        'vertexCorrectionZ':round(displacement,6),
        'changedVertices':changed,
        'neutralUpperLipUnaffected':True,
        'neckBelow080Unaffected':True
    }

def finish(path):
    g,b=read_glb(path)
    face=g['meshes'][0]
    meta=face.get('extras',{})
    if meta.get('version')!=121 or meta.get('hairIncluded') is not False:
        raise ValueError('Only the female bald v121 face may be changed')
    if meta.get('naturalFoldCleanup'):
        raise ValueError('Skin was already cleaned')
    if len(g['meshes'])!=8 or len(g['nodes'])!=8:
        raise ValueError('Expected v121 with actual eyeliner/lash/brow meshes')
    p=face['primitives'][0]
    pos=[tuple(q) for q in accessor(g,b,p['attributes']['POSITION'])]
    if len(pos)!=13455:
        raise ValueError('Must preserve original 13455 skin vertices')
    flat=[t[0] for t in accessor(g,b,p['indices'])]
    if len(flat)!=25920*3:
        raise ValueError('Must preserve all 25920 skin triangles')
    faces=[tuple(flat[i:i+3]) for i in range(0,len(flat),3)]
    xyz,chin_count=smooth_chin(pos,faces)
    folds_left=[]
    folds_right=[]
    philtrum_ids=[]
    dimple_filled_ids=[]
    updated=[]
    nasal_vertices=[]
    lip_vertices=[]
    for i,(x,y,z) in enumerate(xyz):
        nx,ny,nz=nose_and_lips(x,y,z)
        dz=fold_displacement(nx,ny,nz)
        updated.append((nx,ny,nz+dz))
        central=philtrum_relief(nx,ny,nz)
        if central<-.00038 and abs(nx)<.011 and .241<ny<.262:
            philtrum_ids.append(i)
        if dz>.00020 and .218<ny<.251 and .025<abs(nx)<.067:
            dimple_filled_ids.append(i)
        if abs(nx-x)>.00008 and .225<y<.280:
            nasal_vertices.append(i)
        if abs(nz-z)>.00015 and .216<y<.252 and abs(x)<.058:
            lip_vertices.append(i)
    if len(nasal_vertices)<20 or len(lip_vertices)<30:
        raise ValueError('Nose and vermilion must have actual displaced vertices')
    updated,chin_profile=correct_chin_profile(updated)
    meta['sagittalChinProfile']=chin_profile
    # Keep the original POSITION vertex order, immutable UVs and triangles.
    p['attributes']['POSITION']=add_vec3(g,b,updated)
    p['attributes']['NORMAL']=add_vec3(g,b,normals(updated,faces))
    colors=[neutral_color(x,y,z) for x,y,z in updated]
    p['attributes']['COLOR_0']=add_vec3(g,b,colors)
    if len(philtrum_ids)<12 or len(dimple_filled_ids)<12:
        raise ValueError('Real central philtrum and corner correction required')
    # Reduce the separate eyelid-crease ribbon tint: no hard pink mask.
    for material in g['materials']:
        if material['name']=='V121_NATURAL_UPPER_LID_CREASE_PBR':
            material['pbrMetallicRoughness']['baseColorFactor']=[
                .79,.65,.62,1.]
            material['pbrMetallicRoughness']['roughnessFactor']=.92
    # Texture/PBR remains embedded in the same original GLB; use tasteful,
    # low-gloss cosmetics rather than flat vertex-color face paint.
    skin_material=g['materials'][0]
    skin_material['pbrMetallicRoughness']['roughnessFactor']=.88
    skin_material['normalTexture']['scale']=.075
    for material in g['materials']:
        name=material.get('name','')
        pbr=material.get('pbrMetallicRoughness',{})
        if name=='V121_UPPER_EYELINER_PBR':
            pbr['baseColorFactor']=[.15,.095,.090,1.]
        elif name=='V121_FINE_LOWER_EYELASHES_PBR':
            pbr['baseColorFactor']=[.25,.17,.145,1.]
        elif name=='V121_INDIVIDUAL_EYEBROW_FIBERS_PBR':
            pbr['baseColorFactor']=[.38,.29,.235,1.]
    meta['referenceMakeup']={
        'version':'v121-makeup-20261123',
        'skinPalette':'warm-natural-ivory',
        'cheekBlush':'subtle-peach-rose',
        'lips':'soft-rose-pink-vertex-gradient',
        'upperLid':'warm-taupe-blended',
        'lashColor':'soft-brown',
        'skinPBR':True,
        'noSeparateFloatingDecals':True}
    meta['referenceFeatureSculpt']={
        'version':'v121-nose-lips-lower-lashes-20261123',
        'nostrilWingVerticesAdjusted':nasal_vertices,
        'lipVermilionVerticesAdjusted':lip_vertices,
        'centralPhiltrumStart':[0.,.264],
        'philtrumGrooveMasterDepth':.0038,
        'philtrumColumnsRelief':.00095,
        'philtrumShape':'continuous_nose_base_to_vermilion_shallow_channel_v122fix',
        'philtrumNoOvalPit':True,
        'parametricDepthControlSupported':True,
        'centralPhiltrumEnd':[0.,.238],
        'philtrumVertexIds':philtrum_ids,
        'lateralDimpleCorrectionVertexIds':dimple_filled_ids,
        'lateralNasolabialPitRemoved':True,
        'foldIsActualSkinGeometry':True,
        'preservesEyeAndMouthTopology':True,
        'facialExpressionAnimations':False}
    meta['naturalFoldCleanup']={
        'version':'v121-folds-20261123',
        'technique':'native indexed skin vertex sculpt and corrected neutral vertex colors',
        'removedLegacyBrowLidBand':True,
        'removedChinTintLeakage':True,
        'lipPigmentRestrictedToVermilion':True,
        'chinVerticesSmoothed':chin_count,
        'nasolabialLeftVertexIds':[],
        'nasolabialRightVertexIds':[],
        'philtrumVertexIds':philtrum_ids,
        'dimpleCorrectionVertexIds':dimple_filled_ids,
        'additionalFoldRegions':['central-philtrum','infraorbital'],
        'surfaceDeformationOnly':True,
        'expressionAnimationImplemented':False}
    g['asset']['generator']='HaiGin v121 central philtrum sculpt and lateral dimple removal'
    g['buffers'][0]['byteLength']=len(b)
    json_bytes=json.dumps(g,ensure_ascii=False,separators=(',',':')).encode('utf8')
    json_bytes+=b' '*((-len(json_bytes))%4)
    b+=b'\0'*((-len(b))%4)
    length=12+8+len(json_bytes)+8+len(b)
    with path.open('wb') as f:
        f.write(struct.pack('<4sII',b'glTF',2,length))
        f.write(struct.pack('<I4s',len(json_bytes),b'JSON'))
        f.write(json_bytes)
        f.write(struct.pack('<I4s',len(b),b'BIN\0'))
        f.write(b)
    print('v121 skin cleanup complete',json.dumps({
        'vertices':len(updated),'chinSmoothed':chin_count,
        'centralPhiltrumVertices':len(philtrum_ids),
        'dimpleFillVertices':len(dimple_filled_ids),
        'noseChanged':len(nasal_vertices),'lipsChanged':len(lip_vertices),
        'byteLength':length}))


if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('glb',type=pathlib.Path)
    finish(parser.parse_args().glb)
